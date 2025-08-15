/**
 * Ultra-simple Sogni backend for teaching purposes
 * - Exposes POST /api/generate to start a render
 * - Exposes GET  /api/progress/:projectId for SSE progress + results
 *
 * This file purposely avoids sessions/redis/etc. to demonstrate just the core
 * flow for learning. Keep credentials on the server. Frontend never sees them.
 *
 * CHANGELOG (fix “Project not found” on boot):
 * - Lazy-import and create the Sogni client only on first /api/generate call
 *   so the SDK doesn’t try to resume/fetch projects during server startup.
 * - Guard any background 404s (errorCode 102) coming from the SDK and ignore.
 * - Unsubscribe listeners when a project finishes/fails to avoid leaks.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

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

  // Some SDK builds auto-connect sockets on first use; ensure it’s online
  // If connect() doesn’t exist in your version, this no-ops.
  if (typeof client.connect === 'function') {
    try { await client.connect(); } catch (err) {
      if (!ignoreProjectNotFound(err)) throw err;
    }
  }

  // Guard against noisy background probes
  // (Some SDK versions might surface rejections on internal polling)
  process.on('unhandledRejection', (reason) => {
    if (ignoreProjectNotFound(reason)) return;
    // You might still want to see other errors in dev:
    console.error('[unhandledRejection]', reason);
  });

  sogniClient = client;
  return sogniClient;
}

/** Helper: push an event to all SSE listeners for a given project. */
function emitToProject(projectId, payload) {
  const clients = sseClients.get(projectId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch {/* broken pipe safe-guard */}
  }
}

/**
 * Start a render
 * Body: { prompt: string, width?: number, height?: number, modelId?: string, numImages?: number, guidance?: number, seed?: number }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const {
      prompt,
      width = 1024,
      height = 1024,
      modelId = 'flux1-schnell-fp8',   // fast demo model; swap to your preferred
      numImages = 1,
      guidance = 3,
      seed
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const client = await getSogniClient();

    // Create a project on Sogni
    const project = await client.projects.create({
      modelId,
      positivePrompt: prompt,
      negativePrompt: '',
      sizePreset: 'custom',
      width,
      height,
      steps: 10,                // keep small for demo latency
      guidance,
      numberOfImages: numImages,
      scheduler: 'DPM Solver Multistep (DPM-Solver++)',
      timeStepSpacing: 'Karras',
      disableNSFWFilter: false,
      ...(seed != null ? { seed: Number(seed) } : {})
    }).catch(err => {
      if (ignoreProjectNotFound(err)) {
        // If a stray probe caused a 404 concurrently, just retry once
        return client.projects.create({
          modelId,
          positivePrompt: prompt,
          negativePrompt: '',
          sizePreset: 'custom',
          width,
          height,
          steps: 10,
          guidance,
          numberOfImages: numImages,
          scheduler: 'DPM Solver Multistep (DPM-Solver++)',
          timeStepSpacing: 'Karras',
          disableNSFWFilter: false,
          ...(seed != null ? { seed: Number(seed) } : {})
        });
      }
      throw err;
    });

    const projectId = project.id;

    // Handlers (scoped so we can remove them on completion/failure)
    const onProject = (evt) => {
      if (evt.projectId !== projectId) return;
      if (evt.type === 'completed') {
        emitToProject(projectId, { type: 'completed' });
        detach(); // stop listening for this project
      } else if (evt.type === 'error' || evt.type === 'failed') {
        emitToProject(projectId, { type: 'error', message: evt?.error?.message || 'Project failed' });
        detach();
      }
    };
    const onJob = (evt) => {
      if (evt.projectId !== projectId) return;
      if (evt.type === 'progress') {
        const pct = Math.max(0, Math.min(100, Math.floor((evt.step / evt.stepCount) * 100)));
        emitToProject(projectId, { type: 'progress', jobId: evt.jobId, progress: pct });
      }
      if (evt.type === 'preview') {
        emitToProject(projectId, { type: 'preview', jobId: evt.jobId, url: evt.url });
      }
      if (evt.type === 'completed') {
        emitToProject(projectId, {
          type: 'jobCompleted',
          jobId: evt.jobId,
          resultUrl: evt.resultUrl,
          seed: evt.seed,
          steps: evt.steps
        });
      }
      if (evt.type === 'error' || evt.type === 'failed') {
        emitToProject(projectId, { type: 'jobFailed', jobId: evt.jobId, message: evt?.error || 'Job failed' });
      }
    };

    // Attach once per project
    client.projects.on('project', onProject);
    client.projects.on('job', onJob);

    // Helper to remove listeners when we’re done
    function detach() {
      try { client.projects.off('project', onProject); } catch {}
      try { client.projects.off('job', onJob); } catch {}
    }

    // Respond with projectId immediately (frontend will connect to SSE)
    res.json({ projectId });
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
    res.end();
  });
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true, env: process.env.SOGNI_ENV || 'production' });
});

app.listen(PORT, () => {
  console.log(`Sogni tattoo ideas API running on http://localhost:${PORT}`);
  console.log(`Allowed CORS origins: ${origins.join(', ')}`);
});
