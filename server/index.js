/**
 * Ultra-simple Sogni backend for teaching purposes
 * - Exposes POST /api/generate to start a render
 * - Exposes POST /api/generate-controlnet to start a render with a sketch (ControlNet)
 * - Exposes GET  /api/progress/:projectId for SSE progress + results
 * - Exposes GET  /api/result/:projectId/:jobId to proxy signed result URLs
 * - Exposes GET  /api/cancel/:projectId to cancel a project
 * - Exposes GET  /api/health for basic health checks
 *
 * This file purposely avoids sessions/redis/etc. to demonstrate just the core
 * flow for learning. Keep credentials on the server. Frontend never sees them.
 *
 * Unified render config for ALL renders:
 *     modelId: 'flux1-schnell-fp8'
 *     steps: 4 (ControlNet route overrides this to >= CONTROLNET_MIN_STEPS)
 *     guidance: 1
 *     scheduler: 'Euler'
 *     timeStepSpacing: 'Simple'
 *     sizePreset: 'custom'
 *     width: 512, height: 512
 *     numberOfImages: 16
 *     tokenType: 'spark'
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Readable } from 'node:stream';

// Enhanced error handling for syntax errors
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', new Date().toISOString());
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  if (err.code === 'MODULE_NOT_FOUND' || err.message.includes('SyntaxError')) {
    console.error('File:', err.fileName || 'unknown');
    console.error('Line:', err.lineNumber || 'unknown');
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  if (ignoreProjectNotFound(reason)) return;
  console.error('[UNHANDLED REJECTION]', new Date().toISOString());
  console.error('Reason:', reason);
  console.error('Promise:', promise);
});

const app = express();
app.use(express.json({ limit: '8mb' }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/** Resolve allowed origins (comma-separated in CLIENT_ORIGIN) */
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, cb) {
      // allow same-origin (no origin header) and any configured origin
      if (!origin || origins.includes(origin)) return cb(null, true);
      return cb(new Error(`Blocked by CORS: ${origin}`));
    },
    credentials: false
  })
);

const PORT = process.env.PORT || 3001;

// Map of projectId -> Set<SSE response objects>
const sseClients = new Map();

// Keep a reference to live Project instances (for getResultUrl calls)
const activeProjects = new Map(); // projectId -> Project

// Reuse a single Sogni client for simplicity
let sogniClient = null;

// Small helper to noop known “Project not found” noise coming from the SDK
function ignoreProjectNotFound(err) {
  // Known shape from the SDK:
  // { status: 404, payload: { status: 'error', errorCode: 102, message: 'Project not found' } }
  const code = err?.payload?.errorCode || err?.errorCode;
  const msg = err?.payload?.message || err?.message || '';
  return err?.status === 404 && (code === 102 || /Project not found/i.test(msg));
}

/**
 * Create or reuse the Sogni client with connection recovery.
 * NOTE: We lazy-import & create on demand (not at server boot) to avoid
 * the SDK attempting to resume or fetch projects that don't exist yet.
 */
async function getSogniClient() {
  if (sogniClient) {
    // Check if WebSocket is connected, recreate if not
    try {
      if (sogniClient.apiClient?.socket?.readyState !== 1) { // WebSocket.OPEN = 1
        console.log('🔄 WebSocket disconnected, recreating client...');
        sogniClient = null;
      }
    } catch (err) {
      console.log('🔄 Error checking WebSocket state, recreating client...');
      sogniClient = null;
    }
  }
  
  if (sogniClient) return sogniClient;

  // Lazy import so nothing runs before we need it
  const { SogniClient } = await import('@sogni-ai/sogni-client');

  const env = process.env.SOGNI_ENV || 'production';
  const hosts = {
    local:      { socket: 'wss://socket-local.sogni.ai',   api: 'https://api-local.sogni.ai' },
    staging:    { socket: 'wss://socket-staging.sogni.ai', api: 'https://api-staging.sogni.ai' },
    production: { socket: 'wss://socket.sogni.ai',         api: 'https://api.sogni.ai' }
  };
  const endpoints = hosts[env] || hosts.production;

  // Create client (no project work yet)
  const client = await SogniClient.createInstance({
    appId: process.env.SOGNI_APP_ID || `tattoo-ideas-${Date.now()}`,
    testnet: env !== 'production',
    network: 'fast',
    restEndpoint: endpoints.api,
    socketEndpoint: endpoints.socket,
    logLevel: 'info'
  });

  // Log in and connect socket
  try {
    if (!process.env.SOGNI_USERNAME || !process.env.SOGNI_PASSWORD) {
      console.warn('⚠️  SOGNI_USERNAME or SOGNI_PASSWORD not set. Using demo mode.');
      console.warn('   Set credentials in server/.env to enable real image generation.');
      // Continue without login for demo purposes
    } else {
      await client.account.login(process.env.SOGNI_USERNAME, process.env.SOGNI_PASSWORD);
      console.log('✅ Logged into Sogni successfully');
    }
  } catch (err) {
    if (ignoreProjectNotFound(err)) return client;
    console.error('❌ Sogni login failed:', err.message);
    console.warn('⚠️  Continuing in demo mode. Set valid credentials to enable image generation.');
  }

  // Debug: optionally wrap socket .on for selective logging
  if (client.apiClient && client.apiClient.socket) {
    const originalOn = client.apiClient.socket.on;
    client.apiClient.socket.on = function(event, handler) {
      const wrappedHandler = function(...args) {
        // uncomment to debug WS events
        // if (event === 'jobState' || event === 'jobResult' || event === 'jobProgress') {
        //   console.log(`[WebSocket] ${event} event:`, args[0]);
        // }
        return handler.apply(this, args);
      };
      return originalOn.call(this, event, wrappedHandler);
    };
  }

  // Ensure socket is online (some SDK builds auto-connect on first use)
  if (typeof client.connect === 'function') {
    try { await client.connect(); } catch (err) {
      if (!ignoreProjectNotFound(err)) throw err;
    }
  }

  // Add connection error handling and auto-reconnection
  if (client.apiClient && client.apiClient.socket) {
    client.apiClient.socket.on('close', () => {
      console.log('⚠️  WebSocket connection closed');
    });
    
    client.apiClient.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  }

  // Guard against noisy background probes
  process.on('unhandledRejection', (reason) => {
    if (ignoreProjectNotFound(reason)) return;
    console.error('[unhandledRejection]', reason);
  });

  sogniClient = client;
  return sogniClient;
}

/**
 * Wrapper to retry operations that might fail due to WebSocket disconnection
 */
async function withRetry(operation, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await getSogniClient();
      return await operation(client);
    } catch (err) {
      const isConnectionError = err.message?.includes('WebSocket not connected') ||
                               err.message?.includes('Connection lost') ||
                               err.message?.includes('not connected');
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`🔄 Connection error (attempt ${attempt}/${maxRetries}), retrying...`);
        sogniClient = null; // Force recreation
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }
      throw err;
    }
  }
}

/** Helper: push an event to all SSE listeners for a given project. */
function emitToProject(projectId, payload) {
  const clients = sseClients.get(projectId);
  if (!clients || clients.size === 0) return;
  const enriched = { projectId, ...payload };
  const data = `data: ${JSON.stringify(enriched)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch {/* broken pipe safe-guard */}
  }
}

// ---- Render defaults (unified for all renders) ----
const MODEL_ID = 'flux1-schnell-fp8';
const RENDER_DEFAULTS = {
  steps: 4,
  guidance: 1,
  scheduler: 'DPM Solver Multistep (DPM-Solver++)',
  timeStepSpacing: 'Linear',
  sizePreset: 'custom',
  width: 768,
  height: 768,
  numberOfImages: 16,
  tokenType: 'spark' // <- Spark points (defaults to SOGNI if omitted)
};

// ControlNet minimum steps (to avoid being overridden to 4)
const CONTROLNET_MIN_STEPS = 28;

// ControlNet-specific defaults for traditional diffusion models
const CONTROLNET_RENDER_DEFAULTS = {
  steps: 34,
  guidance: 7.5,                    // Traditional diffusion model guidance (not Flux)
  scheduler: 'DPM Solver Multistep (DPM-Solver++)',
  timeStepSpacing: 'Linear',
  sizePreset: 'custom',
  width: 768,
  height: 768,
  numberOfImages: 16,
  tokenType: 'spark'
};

// ---------- Helpers ----------

function clamp01(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Normalize progress: accepts 0..100 or 0..1 or (step, stepCount)
 * Returns a 0..1 float.
 */
function normalizeProgress(value, step, stepCount) {
  if (typeof value === 'number') {
    return value > 1 ? clamp01(value / 100) : clamp01(value);
  }
  if (typeof step === 'number' && typeof stepCount === 'number' && stepCount > 0) {
    return clamp01(step / stepCount);
  }
  return 0;
}

/**
 * Attempt to ensure we have a usable, signed URL for a completed job.
 */
async function ensureJobResultUrl(project, jobId, eventResultUrl) {
  if (eventResultUrl) return eventResultUrl;

  if (!project) {
    console.warn('[ensureJobResultUrl] No project available');
    return undefined;
  }

  try {
    let jobEntity = typeof project.job === 'function' ? project.job(jobId) : undefined;
    if (!jobEntity && Array.isArray(project.jobs)) {
      jobEntity = project.jobs.find(j => j?.id === jobId);
    }

    if (jobEntity) {
      if (typeof jobEntity.getResultUrl === 'function') {
        try {
          const url = await jobEntity.getResultUrl();
          return url;
        } catch (err) {
          console.warn('[ensureJobResultUrl] getResultUrl() failed:', err.message);
        }
      }
      if (jobEntity.resultUrl) return jobEntity.resultUrl;
    }
  } catch (err) {
    console.error('[ensureJobResultUrl] Error accessing job entity:', err);
  }

  console.warn('[ensureJobResultUrl] No result URL available for job:', jobId);
  return undefined;
}

async function getJobInfo(project, jobId) {
  try {
    let jobEntity = typeof project.job === 'function' ? project.job(jobId) : undefined;
    if (!jobEntity && Array.isArray(project.jobs)) {
      jobEntity = project.jobs.find(j => j?.id === jobId);
    }
    
    if (jobEntity) {
      return {
        isNSFW: jobEntity.isNSFW || false,
        status: jobEntity.status || 'unknown'
      };
    }
  } catch (err) {
    console.error('[getJobInfo] Error accessing job entity:', err);
  }
  return { isNSFW: false, status: 'unknown' };
}

/**
 * Build an array of result URLs for the whole project.
 */
async function collectProjectResultUrls(project) {
  if (!project) return [];
  try {
    const jobs = Array.isArray(project.jobs) ? project.jobs : [];
    if (jobs.length > 0) {
      const list = await Promise.all(
        jobs.map(async (j) => {
          try { return await j.getResultUrl?.(); }
          catch { return j?.resultUrl; }
        })
      );
      return list.filter(Boolean);
    }
  } catch (err) {
    console.error('[collectProjectResultUrls] jobs error:', err);
  }

  try {
    const urls = project.resultUrls || [];
    return Array.isArray(urls) ? urls.filter(Boolean) : [];
  } catch (err) {
    console.error('[collectProjectResultUrls] fallback error:', err);
    return [];
  }
}

/**
 * Generate 16 prompt variations optimized for Flux Schnell.
 * (We still use a single positivePrompt; numberOfImages=16 creates 16 variants.)
 */
function generatePromptVariations(basePrompt, style = '', refinement = '') {
  const compositions = [
    'centered composition',
    'dynamic asymmetrical layout',
    'flowing organic curves',
    'precise geometric forms',
    'balanced negative space',
    'bold central focus',
    'delicate line work',
    'strong silhouette',
    'detailed close-up',
    'minimalist design',
    'ornate decorative style',
    'abstract interpretation',
    'realistic rendering',
    'stylized artwork',
    'traditional approach',
    'contemporary style'
  ];

  const qualityTerms = [
    'high detail, sharp lines',
    'professional artwork, clean design',
    'bold contrast, dramatic',
    'soft shading, elegant',
    'intricate details, refined',
    'smooth gradients, polished',
    'crisp edges, precise',
    'rich textures, depth',
    'clean linework, professional',
    'artistic quality, expressive',
    'fine craftsmanship, detailed',
    'modern aesthetic, sleek',
    'timeless design, classic',
    'creative interpretation, unique',
    'masterful execution, skilled',
    'premium quality, exceptional'
  ];

  const variations = [];
  for (let i = 0; i < 16; i++) {
    const composition = compositions[i];
    const quality = qualityTerms[i];

    // Flux Schnell optimal prompt structure: subject, style, composition, quality
    let prompt = basePrompt;

    if (style) {
      prompt += `, ${style.toLowerCase()} tattoo`;
    } else {
      prompt += ' tattoo';
    }

    if (refinement) prompt += `, ${refinement}`;
    prompt += `, ${composition}, ${quality}`;
    prompt += ', tattoo design, black ink on white background';
    variations.push(prompt);
  }

  return variations;
}

/**
 * Emit SDK-like job lifecycle events (and legacy aliases for compatibility).
 */
function emitJobLifecycle(project, jobIndexById, evt) {
  const { projectId, jobId } = evt;
  const jobIndex = jobIndexById.get(jobId);

  // Normalize progress to 0..1 for SDK-like 'job' event
  if (evt.type === 'progress') {
    const norm = normalizeProgress(evt.progress, evt.step, evt.stepCount);

    // SDK-like job event
    emitToProject(projectId, {
      event: 'job',
      type: 'progress',
      jobId,
      jobIndex,
      progress: norm,
      workerName: evt.workerName,
      queuePosition: evt.queuePosition,
      positivePrompt: evt.positivePrompt
    });

    // Legacy alias (percent 0..100)
    emitToProject(projectId, {
      type: 'progress',
      jobId,
      progress: Math.round(norm * 100)
    });
    return;
  }

  if (evt.type === 'queued' || evt.type === 'started' || evt.type === 'initiating') {
    emitToProject(projectId, {
      event: 'job',
      type: evt.type,
      jobId,
      jobIndex,
      workerName: evt.workerName,
      queuePosition: evt.queuePosition
    });
    return;
  }

  if (evt.type === 'preview') {
    // Legacy preview passthrough (useful for showing interim frames)
    emitToProject(projectId, {
      type: 'preview',
      jobId,
      url: evt.url || evt.previewUrl
    });
  }
}

// ---------- Routes ----------

/**
 * Start a normal render - generates 16 tattoo variations
 * Body: {
 *   prompt: string,            // required base prompt
 *   style?: string,
 *   refinement?: string,
 *   baseImageUrl?: string,
 *   seed?: number
 * }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const {
      prompt,
      style = '',
      refinement = '',
      baseImageUrl = '',
      seed
    } = req.body || {};

    console.log('[Generate] Received request:', { prompt, style, refinement, seed });

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Create 16 prompt variations for diverse results
    const promptVariations = generatePromptVariations(prompt, style, refinement);

    // Create a project on Sogni with fixed defaults + Spark billing - always 16 images
    const createPayload = {
      modelId: MODEL_ID,
      positivePrompt: promptVariations[0],
      negativePrompt: 'blurry, low quality, watermark, text, signature, bad anatomy, distorted, ugly',
      stylePrompt: style,
      disableNSFWFilter: false,
      ...(seed !== undefined && seed !== -1 ? { seed: Number(seed) } : {}),
      ...RENDER_DEFAULTS
    };

    const project = await withRetry(async (client) => {
      return await client.projects.create(createPayload).catch(err => {
        if (ignoreProjectNotFound(err)) {
          // If a stray probe caused a 404 concurrently, just retry once
          return client.projects.create(createPayload);
        }
        throw err;
      });
    });

    const projectId = project.id;
    activeProjects.set(projectId, project);

    // Build stable job index map (id -> index) as returned by create()
    const jobs = Array.isArray(project.jobs) ? project.jobs : [];
    const jobIndexById = new Map(jobs.map((j, i) => [j.id, i]));

    // Respond immediately with projectId + stable jobs[] map
    res.json({
      projectId,
      jobs: jobs.map((j, i) => ({ id: j.id, index: i }))
    });

    // Handlers (scoped so we can remove them on completion/failure)
    const onProject = async (evt) => {
      if (evt.projectId !== projectId) return;

      // Pass through SDK-like upload events if present
      if (evt.type === 'uploadProgress') {
        emitToProject(projectId, { type: 'uploadProgress', progress: clamp01(evt.progress ?? 0) });
        return;
      }
      if (evt.type === 'uploadComplete') {
        emitToProject(projectId, { type: 'uploadComplete' });
        return;
      }

      if (evt.type === 'completed') {
        setTimeout(async () => {
          try {
            let urls = [];
            if (project.resultUrls && project.resultUrls.length) {
              urls = project.resultUrls;
            }
            if (!urls.length) {
              urls = await collectProjectResultUrls(project);
            }
            if (!urls.length && project.jobs && project.jobs.length) {
              const processingJobs = project.jobs.filter(job => job.status === 'processing');
              if (processingJobs.length > 0) {
                for (let attempt = 1; attempt <= 3; attempt++) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  urls = await collectProjectResultUrls(project);
                  if (urls.length > 0) break;
                }
              }
            }
            if (!urls.length && project.status === 'completed') {
              try {
                urls = await Promise.race([
                  project.waitForCompletion(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);
              } catch {}
            }

            if (!urls.length && project.jobs && project.jobs.length) {
              const proxyUrls = project.jobs.map(job =>
                `/api/result/${encodeURIComponent(projectId)}/${encodeURIComponent(job.id)}`
              ).filter(Boolean);

              if (proxyUrls.length) {
                emitToProject(projectId, { type: 'results', urls: proxyUrls, isProxy: true });
              }
            }
          } catch (err) {
            console.error('[Project] Error getting result URLs:', err);
          }

          emitToProject(projectId, { type: 'completed' });
          detach();
        }, 2000);
      } else if (evt.type === 'error' || evt.type === 'failed') {
        emitToProject(projectId, {
          type: 'failed',
          error: evt?.error || evt?.message || 'Project failed'
        });
        detach();
      }
    };

    const onJob = async (evt) => {
      if (evt.projectId !== projectId) return;

      // Mirror SDK-like lifecycle + legacy percent progress
      emitJobLifecycle(project, jobIndexById, evt);

      if (evt.type === 'completed') {
        let resultUrl = await ensureJobResultUrl(project, evt.jobId, evt.resultUrl);
        if (!resultUrl) {
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            resultUrl = await ensureJobResultUrl(project, evt.jobId, evt.resultUrl);
            if (resultUrl) break;
          }
        }

        const jobInfo = await getJobInfo(project, evt.jobId);

        emitToProject(projectId, {
          type: 'jobCompleted',
          job: {
            id: evt.jobId,
            resultUrl,
            positivePrompt: evt.positivePrompt,
            isNSFW: jobInfo.isNSFW
          },
          proxyUrl: `/api/result/${encodeURIComponent(projectId)}/${encodeURIComponent(evt.jobId)}`
        });
      }

      if (evt.type === 'error' || evt.type === 'failed') {
        emitToProject(projectId, {
          type: 'jobFailed',
          job: {
            id: evt.jobId,
            error: evt?.error || evt?.message || 'Job failed'
          }
        });
      }
    };

    const debugProject = (evt) => { onProject(evt); };
    const debugJob = (evt) => { onJob(evt); };

    sogniClient.projects.on('project', debugProject);
    sogniClient.projects.on('job', debugJob);

    function detach() {
      try { sogniClient.projects.off('project', debugProject); } catch {}
      try { sogniClient.projects.off('job', debugJob); } catch {}
      setTimeout(() => { activeProjects.delete(projectId); }, 10 * 60 * 1000);
    }
  } catch (err) {
    if (ignoreProjectNotFound(err)) {
      console.warn('[ignored] transient Project not found during generate');
      return res.status(503).json({ error: 'Transient: please retry' });
    }
    console.error(err);
    res.status(500).json({ error: err?.message || 'Render failed to start' });
  }
});

// ---------- ControlNet (Draw mode) generation endpoint ----------
//
// ✅ Fixes implemented here:
// 1) Uses title (if provided) as the base prompt and appends "ink tattoo concept"
// 2) No longer emits "formDefaults" that could close/reset your Draw form
// 3) Emits per-job "jobCompleted" events so images spiral out exactly like non-sketch mode
//
app.post('/api/generate-controlnet', upload.single('controlImage'), async (req, res) => {
  try {
    // Accept both "title" (preferred for Draw mode) and "prompt" for backward compatibility.
    const {
      title = '',
      prompt = '',
      // style is allowed, but we won't force a theme that could fight the requested "ink tattoo concept"
      style = ''
    } = req.body || {};

    const baseText = String(title || prompt || '').trim();
    if (!baseText) {
      return res.status(400).json({ error: 'Missing title or prompt' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Missing control image' });
    }

    // ——— Final positive prompt (enhanced for bold ink tattoo results):
    const finalPrompt = `${baseText}, bold black ink tattoo design, thick black lines, high contrast, solid black and white, traditional tattoo style, clean white background`;

    const client = await getSogniClient();

    // Wait for models to be available
    await client.projects.waitForModels();

    // Prefer specific model; fall back to most-popular available
    const CONTROLNET_MODEL_ID = 'coreml-artUniverse_v80_768';
    let modelId = CONTROLNET_MODEL_ID;
    const availableModels = client.projects.availableModels || [];
    const preferredModel = availableModels.find(m => m.id === CONTROLNET_MODEL_ID && m.workerCount > 0);
    if (!preferredModel && availableModels.length > 0) {
      const mostPopularModel = availableModels.reduce((a, b) =>
        a.workerCount > b.workerCount ? a : b
      );
      modelId = mostPopularModel.id;
      console.log('[Generate ControlNet] Falling back to most popular model:', modelId);
    } else if (preferredModel) {
      console.log('[Generate ControlNet] Using preferred model:', modelId);
    } else {
      throw new Error('No available models found');
    }

    const controlImageBuffer = req.file.buffer;

    // IMPORTANT: Use ControlNet-specific defaults for traditional diffusion models
    const createPayload = {
      ...CONTROLNET_RENDER_DEFAULTS,      // Use ControlNet defaults (guidance: 7.5, steps: 34)
      modelId,
      positivePrompt: finalPrompt,        // Enhanced prompt for bold ink tattoos
      disableNSFWFilter: false,
      controlNet: {
        name: 'scribble',                 // "draw mode" / sketch guidance
        image: controlImageBuffer,
        strength: 0.7,                    // Reduced from 1.0 for better prompt influence
        mode: 'balanced',                 // Changed from 'cn_priority' to 'balanced'
        guidanceStart: 0.0,
        guidanceEnd: 1.0
      },
      outputFormat: 'png',
      tokenType: 'spark',
      network: 'fast'
    };

    console.log('createPayload', createPayload);

    console.log('[Generate ControlNet] Creating project…', {
      modelId, steps: createPayload.steps, hasControlImage: true, positivePrompt: finalPrompt
    });

    const project = await client.projects.create(createPayload).catch(err => {
      if (ignoreProjectNotFound(err)) {
        return client.projects.create(createPayload);
      }
      throw err;
    });

    const projectId = project.id;
    activeProjects.set(projectId, project);
    console.log('[Generate ControlNet] Project created:', projectId);

    const jobs = Array.isArray(project.jobs) ? project.jobs : [];
    const jobIndexById = new Map(jobs.map((j, i) => [j.id, i]));

    // Project-level progress relay (0..1 float) — harmless extra feedback
    project.on('progress', (progress) => {
      emitToProject(projectId, { type: 'progress', progress: clamp01(progress) });
    });

    // ✅ Do NOT send "formDefaults" back — this prevents the Draw form from closing/resetting.
    res.json({
      projectId,
      jobs: jobs.map((j, i) => ({ id: j.id, index: i }))
    });

    // Handlers — mirror the normal /api/generate behavior so the UI can "spiral out"
    const onProject = async (evt) => {
      if (evt.projectId !== projectId) return;

      if (evt.type === 'uploadProgress') {
        emitToProject(projectId, { type: 'uploadProgress', progress: clamp01(evt.progress ?? 0) });
        return;
      }
      if (evt.type === 'uploadComplete') {
        emitToProject(projectId, { type: 'uploadComplete' });
        return;
      }

      if (evt.type === 'completed') {
        setTimeout(async () => {
          try {
            let urls = [];
            if (project.resultUrls && project.resultUrls.length) {
              urls = project.resultUrls;
            }
            if (!urls.length) {
              urls = await collectProjectResultUrls(project);
            }

            if (urls.length) {
              emitToProject(projectId, {
                type: 'results',
                urls
              });
            }

            emitToProject(projectId, { type: 'completed' });
          } catch (err) {
            console.error('[Project ControlNet] completion processing error:', err);
            emitToProject(projectId, { type: 'error', error: 'Failed to retrieve controlnet results' });
          } finally {
            detach();
          }
        }, 1000);
      } else if (evt.type === 'error' || evt.type === 'failed') {
        emitToProject(projectId, {
          type: 'failed',
          error: evt?.error || evt?.message || 'Project failed'
        });
        detach();
      }
    };

    const onJob = async (evt) => {
      if (evt.projectId !== projectId) return;

      // Mirror SDK-like lifecycle + legacy percent progress (drives "spiral" animation)
      emitJobLifecycle(project, jobIndexById, evt);

      if (evt.type === 'completed') {
        let resultUrl = await ensureJobResultUrl(project, evt.jobId, evt.resultUrl);
        if (!resultUrl) {
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            resultUrl = await ensureJobResultUrl(project, evt.jobId, evt.resultUrl);
            if (resultUrl) break;
          }
        }

        const jobInfo = await getJobInfo(project, evt.jobId);

        emitToProject(projectId, {
          type: 'jobCompleted',
          job: {
            id: evt.jobId,
            resultUrl,
            positivePrompt: evt.positivePrompt,
            isNSFW: jobInfo.isNSFW
          },
          proxyUrl: `/api/result/${encodeURIComponent(projectId)}/${encodeURIComponent(evt.jobId)}`
        });
      }

      if (evt.type === 'error' || evt.type === 'failed') {
        emitToProject(projectId, {
          type: 'jobFailed',
          job: {
            id: evt.jobId,
            error: evt?.error || evt?.message || 'Job failed'
          }
        });
      }
    };

    const debugProject = (evt) => { onProject(evt); };
    const debugJob = (evt) => { onJob(evt); };

    sogniClient.projects.on('project', debugProject);
    sogniClient.projects.on('job', debugJob);

    function detach() {
      try { sogniClient.projects.off('project', debugProject); } catch {}
      try { sogniClient.projects.off('job', debugJob); } catch {}
      setTimeout(() => { activeProjects.delete(projectId); }, 10 * 60 * 1000);
    }
  } catch (err) {
    if (ignoreProjectNotFound(err)) {
      console.warn('[ignored] transient Project not found during generate-controlnet');
      return res.status(503).json({ error: 'Transient: please retry' });
    }
    console.error(err);
    res.status(500).json({ error: err?.message || 'ControlNet render failed to start' });
  }
});

// ---------- SSE progress stream ----------
app.get('/api/progress/:projectId', (req, res) => {
  const { projectId } = req.params;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Track client
  let set = sseClients.get(projectId);
  if (!set) {
    set = new Set();
    sseClients.set(projectId, set);
  }
  set.add(res);

  // Initial "connected" message
  res.write(`data: ${JSON.stringify({ projectId, type: 'connected' })}\n\n`);

  // Heartbeat to keep proxies happy
  const heartbeat = setInterval(() => {
    try { res.write(':\n\n'); } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    set.delete(res);
    if (set.size === 0) sseClients.delete(projectId);
  });
});

/**
 * Cancel a running project (used when FE starts a new run).
 */
app.get('/api/cancel/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    await withRetry(async (client) => {
      // Prefer an SDK-level cancel if available
      if (client?.projects?.cancel && typeof client.projects.cancel === 'function') {
        await client.projects.cancel(projectId);
      } else {
        // Fallback: try instance method on the stored project
        const project = activeProjects.get(projectId);
        if (project?.cancel && typeof project.cancel === 'function') {
          await project.cancel();
        }
      }
    });

    res.json({ ok: true, projectId, cancelled: true });
  } catch (err) {
    if (ignoreProjectNotFound(err)) {
      return res.json({ ok: true, projectId, cancelled: true });
    }
    console.error('cancel error', err);
    res.status(500).json({ ok: false, error: err?.message || 'Cancel failed' });
  }
});

// ---------- Proxy a result image via activeProjects (signed URLs can expire) ----------
app.get('/api/result/:projectId/:jobId', async (req, res) => {
  try {
    const { projectId, jobId } = req.params;
    const project = activeProjects.get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not active' });
    }

    let url = await ensureJobResultUrl(project, jobId, null);
    if (!url) {
      // last-ditch attempt: collect any project URLs
      const all = await collectProjectResultUrls(project);
      url = all[0];
    }
    if (!url) return res.status(404).json({ error: 'Result not available yet' });

    const r = await fetch(url);
    if (!r.ok) {
      return res.status(502).json({ error: `Failed to fetch result (${r.status})` });
    }

    const ct = r.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', ct);
    if (r.body) {
      // Node 18: Web stream -> Node stream
      const nodeStream = Readable.fromWeb(r.body);
      nodeStream.pipe(res);
    } else {
      const buf = Buffer.from(await r.arrayBuffer());
      res.end(buf);
    }
  } catch (err) {
    console.error('[proxy result] error', err);
    res.status(500).json({ error: 'Failed to proxy result' });
  }
});

// ---------- Health ----------
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    sogniConnected: !!sogniClient
  });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
