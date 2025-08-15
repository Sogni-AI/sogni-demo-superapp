import React, { useMemo, useRef, useState } from 'react';

/**
 * Teaching-friendly “Tattoo Idea Generator”
 * - Compose prompts from UX inputs (no LLM required)
 * - Click "Generate Sample" to render via Sogni through a tiny Express backend
 *
 * Notes on env:
 * - DEV: Vite proxies /api to http://localhost:3001 (vite.config.ts)
 * - PROD (or custom): set VITE_API_BASE_URL in web/.env(.production) and we'll call that.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/,'') : '';

const STYLES = [
  'Japanese Irezumi', 'American Traditional', 'Neo-Traditional',
  'Blackwork', 'Geometric', 'Realism', 'Watercolor', 'Minimalist'
];

const PLACEMENTS = [
  'Forearm', 'Upper Arm', 'Sleeve', 'Chest', 'Back', 'Thigh', 'Calf', 'Ankle', 'Neck', 'Behind Ear'
];

type Idea = {
  id: string;
  title: string;
  prompt: string;
  generating?: boolean;
  progress?: number;          // 0..100
  previews?: string[];        // preview urls (if emitted)
  images?: string[];          // final result urls
  sse?: EventSource | null;   // live stream connection
  error?: string | null;
};

export default function App() {
  // Form state
  const [subject, setSubject] = useState('koi fish');
  const [style, setStyle] = useState(STYLES[0]);
  const [placement, setPlacement] = useState(PLACEMENTS[0]);
  const [size, setSize] = useState('medium'); // small / medium / large
  const [color, setColor] = useState<'color'|'black & grey'>('black & grey');
  const [mood, setMood] = useState('bold, timeless');
  const [extras, setExtras] = useState('fine line details, great composition');
  const [numIdeas, setNumIdeas] = useState(4);
  const [numImages, setNumImages] = useState(1);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Simple deterministic IDs
  const counter = useRef(0);
  const nextId = () => `idea_${++counter.current}`;

  // Compose a single prompt string from the current form values.
  const basePrompt = useMemo(() => {
    return [
      `tattoo concept of ${subject}`,
      `style: ${style}`,
      `placement: ${placement}`,
      `size: ${size}`,
      `palette: ${color}`,
      `mood: ${mood}`,
      extras ? `notes: ${extras}` : ''
    ].filter(Boolean).join(', ');
  }, [subject, style, placement, size, color, mood, extras]);

  function generateIdeas() {
    const angles = [
      'close-up focal composition',
      'dynamic perspective with flow following muscle lines',
      'balanced negative space for readability',
      'ornamental frame elements that match placement'
    ];

    const created: Idea[] = Array.from({ length: Math.max(1, Math.min(12, numIdeas)) }).map((_, i) => {
      const id = nextId();
      const title = `${style} • ${subject} on ${placement} (${size})`;
      const flavor = angles[i % angles.length];

      const prompt = `${basePrompt}, ${flavor}. High-res concept sheet, clean background, design clarity.`;
      return { id, title, prompt, previews: [], images: [] };
    });

    setIdeas(created);
    announce(`${created.length} design idea${created.length === 1 ? '' : 's'} generated`);
  }

  function announce(message: string) {
    // Accessibility: announce status changes to screen readers
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
      setTimeout(() => { if (liveRegionRef.current) liveRegionRef.current.textContent = ''; }, 600);
    }
  }

  async function startRender(idea: Idea) {
    idea.sse?.close();

    setIdeas(prev => prev.map(i =>
      i.id === idea.id ? { ...i, generating: true, progress: 0, previews: [], images: [], error: null } : i
    ));

    try {
      const resp = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: idea.prompt,
          width: 1024,
          height: 1024,
          numImages: Math.max(1, Math.min(4, numImages)),
          modelId: 'flux1-schnell-fp8',
          guidance: 3
        })
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${resp.status}`);
      }

      const { projectId } = await resp.json();

      // Listen to SSE events for this project
      const es = new EventSource(`${API_BASE}/api/progress/${projectId}`);
      const close = () => { try { es.close(); } catch {} };

      es.onmessage = (evt) => {
        let data;
        try {
          data = JSON.parse(evt.data);
          console.log('[SSE]', data); // Debug logging
        } catch (err) {
          console.error('[SSE] Invalid JSON:', evt.data);
          return;
        }

        setIdeas(prev => prev.map(i => {
          if (i.id !== idea.id) return i;

          if (data.type === 'connected') {
            announce('render connected');
            return i;
          }
          if (data.type === 'progress') {
            return { ...i, progress: Number(data.progress) || 0 };
          }
          if (data.type === 'preview' && data.url) {
            const previews = Array.from(new Set([...(i.previews || []), data.url]));
            return { ...i, previews };
          }
          if (data.type === 'jobCompleted' && data.job?.resultUrl) {
            console.log('[SSE] Got jobCompleted with resultUrl:', data.job.resultUrl);
            const images = Array.from(new Set([...(i.images || []), data.job.resultUrl]));
            return { ...i, images, progress: 100 };
          }
          // Also handle legacy event formats for compatibility
          if (data.type === 'final' && data.url) {
            console.log('[SSE] Got final with url:', data.url);
            const images = Array.from(new Set([...(i.images || []), data.url]));
            return { ...i, images, progress: 100 };
          }
          if (data.type === 'result' && data.url) {
            console.log('[SSE] Got result with url:', data.url);
            const images = Array.from(new Set([...(i.images || []), data.url]));
            return { ...i, images, progress: 100 };
          }
          if (data.type === 'results' && data.urls) {
            console.log('[SSE] Got results with urls:', data.urls);
            const images = Array.from(new Set([...(i.images || []), ...data.urls]));
            return { ...i, images, progress: 100 };
          }
          if (data.type === 'completed') {
            close();
            announce('render completed');
            return { ...i, generating: false, sse: null, progress: 100 };
          }
          if (data.type === 'error' || data.type === 'jobFailed') {
            close();
            announce('render failed');
            const errorMsg = data.error || data.message || data.job?.error || 'Render failed';
            return { ...i, generating: false, sse: null, error: errorMsg };
          }

          return i;
        }));
      };

      es.onerror = () => {
        close();
        setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, generating: false, sse: null, error: 'Stream error' } : i));
      };

      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, sse: es } : i));
    } catch (err: any) {
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, generating: false, error: err?.message || 'Failed to start render' } : i));
    }
  }

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="subtle" style={{ position: 'absolute', clip: 'rect(0 0 0 0)' }} ref={liveRegionRef} />

      <div className="grid">
        {/* Left: form & prompt */}
        <section className="card">
          <h2 style={{ margin: '4px 0 10px' }}>Describe your tattoo</h2>
          <p className="subtle" style={{ marginTop: 0 }}>
            Keep it simple. You can always refine once you see the first samples.
          </p>

          <div className="row two" style={{ marginTop: 10 }}>
            <label>
              Subject
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g., koi fish, skull, peony"
              />
            </label>

            <label>
              Style
              <select value={style} onChange={e => setStyle(e.target.value)}>
                {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <div className="row three" style={{ marginTop: 10 }}>
            <label>
              Placement
              <select value={placement} onChange={e => setPlacement(e.target.value)}>
                {PLACEMENTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label>
              Size
              <select value={size} onChange={e => setSize(e.target.value)}>
                {['small', 'medium', 'large'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label>
              Palette
              <select value={color} onChange={e => setColor(e.target.value as any)}>
                <option>black & grey</option>
                <option>color</option>
              </select>
            </label>
          </div>

          <div className="row two" style={{ marginTop: 10 }}>
            <label>
              Mood
              <input value={mood} onChange={e => setMood(e.target.value)} placeholder="e.g., bold, timeless" />
            </label>

            <label>
              Extras
              <input value={extras} onChange={e => setExtras(e.target.value)} placeholder="e.g., fine line details" />
            </label>
          </div>

          <div className="row two" style={{ marginTop: 10 }}>
            <label>
              Ideas
              <input type="number" min={1} max={12} value={numIdeas} onChange={e => setNumIdeas(Number(e.target.value || 1))} />
            </label>
            <label>
              Images / idea
              <input type="number" min={1} max={4} value={numImages} onChange={e => setNumImages(Number(e.target.value || 1))} />
            </label>
          </div>

          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => {
              setSubject('koi fish'); setStyle('Japanese Irezumi'); setPlacement('Forearm');
              setSize('medium'); setColor('black & grey'); setMood('bold, timeless'); setExtras('fine line details, great composition');
            }}>Reset</button>
            <button className="btn primary" onClick={generateIdeas}>Make Ideas</button>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="subtle">Prompt preview</div>
            <div className="card mono" style={{ marginTop: 6 }}>{basePrompt}</div>
          </div>
        </section>

        {/* Right: tips / usage */}
        <aside className="card">
          <h3 style={{ margin: '4px 0 8px' }}>How it works</h3>
          <ol className="subtle" style={{ lineHeight: 1.5, paddingLeft: 18 }}>
            <li>Describe your idea. We build a clean prompt from your inputs.</li>
            <li>Click <strong>Make Ideas</strong> to create several variants.</li>
            <li>Pick one and hit <strong>Generate Sample</strong> to render via Sogni.</li>
          </ol>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="subtle">Tips</div>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>Use clear subjects (e.g., “peony”, “phoenix”, “snake + dagger”).</li>
              <li>Style guides the line weight and shading language.</li>
              <li>Placement & size influence silhouette and flow.</li>
            </ul>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="subtle">Shortcuts</div>
            <p className="subtle" style={{ marginTop: 6 }}>
              Press <span className="kbd">Tab</span> to jump fields quickly.
            </p>
          </div>
        </aside>
      </div>

      {!!ideas.length && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 style={{ margin: '4px 0 8px' }}>Ideas</h2>
          <div className="ideas" style={{ marginTop: 8 }}>
            {ideas.map(idea => (
              <div key={idea.id} className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{idea.title}</strong>
                  {idea.error && <span className="subtle" style={{ color: '#ff7b7b' }}>{idea.error}</span>}
                </div>
                <div className="mono">{idea.prompt}</div>
                <div className="actions">
                  <button
                    className="btn primary"
                    disabled={!!idea.generating}
                    aria-busy={idea.generating}
                    onClick={() => startRender(idea)}
                  >
                    {idea.generating ? 'Rendering…' : 'Generate Sample'}
                  </button>
                </div>
                <div className="progress" aria-hidden={!idea.generating}>
                  <div className="bar" style={{ width: `${idea.progress || 0}%` }} />
                </div>

                {!!idea.previews?.length && (
                  <>
                    <div className="subtle">Previews</div>
                    <div className="img-grid">
                      {idea.previews.map((u, i) => <img key={u + i} src={u} alt="tattoo preview" loading="lazy" />)}
                    </div>
                  </>
                )}
                {!!idea.images?.length && (
                  <>
                    <div className="subtle">Final</div>
                    <div className="img-grid">
                      {idea.images.map((u, i) => <img key={u + i} src={u} alt="final tattoo concept" loading="lazy" />)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <footer>
        Built with a minimal Express + Sogni backend and a tiny React frontend.
        Set <span className="kbd">VITE_API_BASE_URL</span> if your API lives on another origin.
      </footer>
    </>
  );
}
