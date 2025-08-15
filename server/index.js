/**
 * Ultra-simple Sogni backend for teaching purposes
 * - Exposes POST /api/generate to start a render
 * - Exposes GET  /api/progress/:projectId for SSE progress + results
 *
 * This file purposely avoids sessions/redis/etc. to demonstrate just the core
 * flow for learning. Keep credentials on the server. Frontend never sees them.
 *
 * - Standardize render config for ALL renders:
 *     modelId: 'flux1-schnell-fp8'
 *     steps: 4
 *     guidance: 1
 *     scheduler: 'Euler'
 *     timeStepSpacing: 'Linear'
 *     sizePreset: 'custom'
 *     width: 512, height: 512
 *     stylePrompt: <style from body or ''>
 *
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Readable } from 'node:stream';

const app = express();
app.use(express.json({ limit: '8mb' }));

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
 * Create or reuse the Sogni client.
 * NOTE: We lazy-import & create on demand (not at server boot) to avoid
 * the SDK attempting to resume or fetch projects that don’t exist yet.
 */
async function getSogniClient() {
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
  await client.account.login(process.env.SOGNI_USERNAME, process.env.SOGNI_PASSWORD).catch(err => {
    if (ignoreProjectNotFound(err)) return; // rare edge if SDK probes
    throw err;
  });

  // Ensure socket is online (some SDK builds auto-connect on first use)
  if (typeof client.connect === 'function') {
    try {
      console.log('[Sogni] Connecting WebSocket…');
      await client.connect();
      console.log('[Sogni] WebSocket connected.');
    } catch (err) {
      if (!ignoreProjectNotFound(err)) throw err;
    }
  }

  // Guard against noisy background probes
  process.on('unhandledRejection', (reason) => {
    if (ignoreProjectNotFound(reason)) return;
    console.error('[unhandledRejection]', reason);
  });

  sogniClient = client;
  return sogniClient;
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
  scheduler: 'Euler',
  timeStepSpacing: 'Linear',
  sizePreset: 'custom',
  width: 512,
  height: 512,
  tokenType: 'spark' // <- charge Spark points instead of SOGNI (defaults to SOGNI if omitted)
  // Ref: ProjectParams.tokenType; defaults to SOGNI if unspecified
  // https://sdk-docs.sogni.ai/interfaces/ProjectParams.html
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
 * - Prefer eventResultUrl when present.
 * - Otherwise, ask the SDK for a fresh URL via Job.getResultUrl().
 *   (URLs expire; SDK recommends fetching on demand.)
 */
async function ensureJobResultUrl(project, jobId, eventResultUrl) {
  if (eventResultUrl) return eventResultUrl;

  try {
    const jobEntity = project && typeof project.job === 'function' ? project.job(jobId) : undefined;
    if (jobEntity && typeof jobEntity.getResultUrl === 'function') {
      const url = await jobEntity.getResultUrl(); // signed URL (expires ~30m)
      return url;
    }
  } catch {
    // ignore; will fall through
  }
  // As an absolute fallback, try jobEntity?.resultUrl (may be undefined/null)
  try {
    const jobEntity = project && typeof project.job === 'function' ? project.job(jobId) : undefined;
    return jobEntity?.resultUrl;
  } catch {
    return undefined;
  }
}

/**
 * Build an array of result URLs for the whole project.
 * Uses Job.getResultUrl() for each job (fresh signed URLs), falling back
 * to project.resultUrls if any call fails.
 */
async function collectProjectResultUrls(project) {
  if (!project) return [];
  try {
    const jobs = Array.isArray(project.jobs) ? project.jobs : [];
    if (jobs.length > 0) {
      const list = await Promise.all(
        jobs.map(async (j) => {
          try { return await j.getResultUrl?.(); } // preferred
          catch { return j?.resultUrl; }
        })
      );
      return list.filter(Boolean);
    }
  } catch {
    // fall through
  }
  // Fallback to snapshot getter (may already contain URLs)
  try {
    const urls = project.resultUrls || [];
    return Array.isArray(urls) ? urls.filter(Boolean) : [];
  } catch {
    return [];
  }
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
 * Start a render
 * Body: {
 *   prompt: string,            // required
 *   style?: string,            // optional; becomes stylePrompt
 *   numImages?: number,        // optional; default 1
 *   seed?: number              // optional
 * }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const {
      prompt,
      style = '',
      numImages = 1,
      seed
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const client = await getSogniClient();

    // Create a project on Sogni with fixed defaults + Spark billing
    const createPayload = {
      modelId: MODEL_ID,
      positivePrompt: prompt,
      negativePrompt: '',
      stylePrompt: style,
      numberOfImages: numImages,
      disableNSFWFilter: false,
      ...(seed != null ? { seed: Number(seed) } : {}),
      ...RENDER_DEFAULTS
    };

    const project = await client.projects.create(createPayload).catch(err => {
      if (ignoreProjectNotFound(err)) {
        // If a stray probe caused a 404 concurrently, just retry once
        return client.projects.create(createPayload);
      }
      throw err;
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
        // Push aggregated results (broad UI compatibility)
        try {
          const urls = await collectProjectResultUrls(project);
          if (urls.length) {
            emitToProject(projectId, { type: 'results', urls });
          }
        } catch { /* ignore */ }

        emitToProject(projectId, { type: 'completed' });
        detach(); // stop listening for this project
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

      // Mirror SDK-like job lifecycle + legacy aliases
      emitJobLifecycle(project, jobIndexById, evt);

      if (evt.type === 'completed') {
        // Try to ensure we have a usable URL (event may not include one)
        const resultUrl = await ensureJobResultUrl(project, evt.jobId, evt.resultUrl);

        // SDK-like 'jobCompleted' event (preferred by FE)
        emitToProject(projectId, {
          type: 'jobCompleted',
          job: {
            id: evt.jobId,
            resultUrl,
            positivePrompt: evt.positivePrompt
          },
          // Same-origin proxy for blob/XHR if CDN CORS blocks
          proxyUrl: `/api/result/${encodeURIComponent(projectId)}/${encodeURIComponent(evt.jobId)}`
        });

        // Back-compat aliases for older UIs
        if (resultUrl) {
          emitToProject(projectId, { type: 'final', jobId: evt.jobId, url: resultUrl });
          emitToProject(projectId, { type: 'result', jobId: evt.jobId, url: resultUrl });
        }
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

    // Attach once per project
    sogniClient.projects.on('project', onProject);
    sogniClient.projects.on('job', onJob);

    // Helper to remove listeners when we’re done
    function detach() {
      try { sogniClient.projects.off('project', onProject); } catch {}
      try { sogniClient.projects.off('job', onJob); } catch {}
      activeProjects.delete(projectId);
    }
  } catch (err) {
    if (ignoreProjectNotFound(err)) {
      // Treat as a transient; front-end can retry
      console.warn('[ignored] transient Project not found during generate');
      return res.status(503).json({ error: 'Transient: please retry' });
    }
    console.error(err);
    res.status(500).json({ error: err?.message || 'Render failed to start' });
  }
});

/**
 * Server-Sent Events endpoint
 * - Keeps a connection open
 * - We .write() JSON events as they happen
 * - Sends heartbeats so proxies don’t prune the stream
 */
app.get('/api/progress/:projectId', (req, res) => {
  const { projectId } = req.params;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Some proxies (nginx) buffer by default; this header disables buffering if respected
  res.setHeader('X-Accel-Buffering', 'no');

  // register this client
  if (!sseClients.has(projectId)) sseClients.set(projectId, new Set());
  sseClients.get(projectId).add(res);

  // initial hello + flush
  res.write(`data: ${JSON.stringify({ type: 'connected', projectId })}\n\n`);

  // Heartbeat every 20s to keep the connection alive
  const hb = setInterval(() => {
    try { res.write(':\n\n'); } catch {/* ignore */}
  }, 20000);

  // clean up on close
  req.on('close', () => {
    clearInterval(hb);
    const set = sseClients.get(projectId);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseClients.delete(projectId);
    }
    try { res.end(); } catch {}
  });
});

/**
 * Cancel a running project (used when FE starts a new run).
 */
app.get('/api/cancel/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const client = await getSogniClient();

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

    res.json({ ok: true, projectId, cancelled: true });
  } catch (err) {
    if (ignoreProjectNotFound(err)) {
      return res.json({ ok: true, projectId, cancelled: true });
    }
    console.error('cancel error', err);
    res.status(500).json({ ok: false, error: err?.message || 'Cancel failed' });
  }
});

/**
 * Same-origin proxy to stream a job's result image.
 * Useful when CDN CORS prevents XHR->blob in the browser.
 */
app.get('/api/result/:projectId/:jobId', async (req, res) => {
  try {
    const { projectId, jobId } = req.params;
    const project = activeProjects.get(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not active (result may have expired)' });
    }

    const url = await ensureJobResultUrl(project, jobId);
    if (!url) {
      return res.status(404).json({ error: 'Result URL not available' });
    }

    const rsp = await fetch(url);
    if (!rsp.ok || !rsp.body) {
      return res.status(502).json({ error: `Failed to fetch result (${rsp.status})` });
    }

    // Stream through with original content-type; add short-lived cache
    const ct = rsp.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'private, max-age=600');

    // Pipe web ReadableStream to Node stream
    const nodeStream = Readable.fromWeb(rsp.body);
    nodeStream.pipe(res);
  } catch (err) {
    console.error('proxy result error', err);
    res.status(500).json({ error: err?.message || 'Proxy failed' });
  }
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, env: process.env.SOGNI_ENV || 'production' });
});

app.listen(PORT, () => {
  console.log(`Sogni tattoo ideas API running on http://localhost:${PORT}`);
  console.log(`Allowed CORS origins: ${origins.join(', ')}`);
});
