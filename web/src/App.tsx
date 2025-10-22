import React, { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Sogni Tattoo Ideas — Teaching Demo (Simplified)
 *
 * This edit focuses on:
 * - ✅ Pen-down persists across canvas boundaries (Pointer Events + capture)
 * - ✅ Stop drawing on pointerup/cancel anywhere (window fallback)
 * - ✅ Square canvas (CSS aspect-ratio) + DPR backing store preserved
 * - ✅ Spacebar while typing still works; compare toggle still stable
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
  : '';

/* ---------- Design Tokens (Mobile-first, DRY) ---------- */

const MobileStyles = () => (
  <style>{`
    :root {
      --brand: #ff6b35;
      --bg-app: #0e0f11;
      --bg-app-2: #101113;
      --card-bg: #ffffff;
      --text-strong: #0f1115;
      --text: #dee1e7;
      --text-muted: #9aa0a6;

      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;

      --radius-2: 12px;
      --radius-3: 16px;

      --shadow-1: 0 4px 12px rgba(0,0,0,.18);
      --shadow-2: 0 10px 30px rgba(0,0,0,.22);
      --border-soft: 1px solid rgba(0,0,0,.06);
      --border-soft-dark: 1px solid rgba(255,255,255,.06);
    }

    /* Fullscreen shell for Draw Mode (native app vibe) */
    .draw-mode {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background:
        radial-gradient(1200px 800px at 50% -10%, var(--bg-app-2) 0%, var(--bg-app) 60%, #0b0c0e 100%);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: stretch;
      padding: calc(env(safe-area-inset-top) + var(--space-4)) var(--space-4)
               calc(env(safe-area-inset-bottom) + var(--space-6));
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    /* Center column with mobile maximum; scales up on tablets/desktop */
    .draw-center {
      width: 100%;
      max-width: 520px; /* iPhone "app card" width */
      display: grid;
      grid-template-rows: auto auto auto 1fr auto;
      row-gap: var(--space-4);
      position: relative;
    }

    /* Header (app bar) */
    .mobile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .mobile-title {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: .2px;
      color: #f3f5f9;
      margin: 0 auto;
    }
    .icon-btn {
      inline-size: 40px;
      block-size: 40px;
      display: inline-grid;
      place-items: center;
      border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.04);
      color: #f3f5f9;
      cursor: pointer;
      transition: transform .06s ease;
    }
    .icon-btn:active { transform: scale(.98); }

    /* Input + tools */
    .vision-input {
      width: 100%;
      height: 44px;
      border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.05);
      color: #f3f5f9;
      padding: 0 var(--space-3);
      outline: none;
    }
    .draw-controls .tools-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-3);
      align-items: center;
    }
    .tool-buttons, .color-buttons, .size-control, .io-buttons {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .tool-btn, .color-btn, .clear-btn {
      min-width: 40px;
      height: 40px;
      border-radius: 10px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.05);
      color: #f3f5f9;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      transition: transform .06s ease, background .2s ease;
    }
    .tool-btn.active, .color-btn.active {
      background: rgba(255,255,255,.12);
      outline: 1px solid rgba(255,255,255,.12);
    }
    .tool-btn:active, .color-btn:active, .clear-btn:active { transform: scale(.98); }
    .color-btn.white { color: #fff; }
    .color-btn.black { color: #000; background: #fff; }
    .size-control label { opacity: .75; margin-right: var(--space-2); }
    .size-control span { opacity: .75; margin-left: var(--space-2); }

    /* Canvas card */
    .mobile-card {
      background: transparent;
      color: var(--text);
      border-radius: var(--radius-3);
      box-shadow: none;
      padding: 0;
      border: none;
    }
    .drawing-canvas-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin-inline: auto;
      position: relative;
    }
    .drawing-canvas {
      display: block;
      margin: 0 auto;
      width: 100%;
      height: auto;
      aspect-ratio: 1 / 1; /* 🔒 always square in CSS */
      border-radius: 14px;
      box-shadow:
        inset 0 0 0 1px rgba(0,0,0,.06),
        0 1px 0 rgba(255,255,255,.5);
      touch-action: none; /* ensure no scroll/zoom interference while drawing */
      user-select: none;
      -webkit-user-select: none;
      background: #ffffff;
    }

    /* Subtle drop target */
    .drop-overlay { border-radius: 14px !important; }

    /* Footer CTA */
    .create-btn {
      width: 100%;
      height: 48px;
      border-radius: 12px;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      letter-spacing: .2px;
      border: none;
      box-shadow: 0 8px 20px rgba(255,107,53,.35);
    }
    .create-btn:disabled { opacity: .6; box-shadow: none; }

    /* Legacy close visible on desktop */
    .draw-close {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      inline-size: 40px;
      block-size: 40px;
      border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.05);
      color: #f3f5f9;
      display: none;
    }

    /* Non-hero list images polish (keeps perf) */
    .circle-img, .orbit-img { border-radius: 12px; background: #fff; }

    @media (min-width: 768px) {
      .draw-center { max-width: 680px; }
      .draw-close { display: inline-grid; place-items: center; }
      .draw-controls .tools-row {
        grid-template-columns: 1fr auto auto 1fr auto auto;
      }
    }
  `}</style>
);

/* ---------- Data & Constants ---------- */

const BASE_STYLES = [
  'Japanese Irezumi', 'American Traditional', 'Neo-Traditional', 'New School',
  'Blackwork', 'Geometric', 'Sacred Geometry', 'Mandala',
  'Realism', 'Hyperrealism', 'Portrait', 'Photorealism',
  'Watercolor', 'Abstract Watercolor', 'Splash Watercolor',
  'Minimalist', 'Fine Line', 'Single Needle', 'Micro Realism',
  'Dotwork', 'Stippling', 'Pointillism',
  'Tribal', 'Polynesian', 'Maori', 'Celtic',
  'Biomechanical', 'Cyberpunk', 'Steampunk',
  'Surreal', 'Abstract', 'Psychedelic',
  'Ornamental', 'Filigree', 'Art Nouveau', 'Art Deco',
  'Sketch Style', 'Pencil Drawing', 'Charcoal',
  'Trash Polka', 'Collage Style', 'Mixed Media',
  'Blackout', 'Solid Black', 'Negative Space',
  'Lettering', 'Script', 'Gothic Lettering', 'Typography',
  'Horror', 'Dark Art', 'Gothic Style',
  'Nature', 'Botanical', 'Floral',
  'Religious', 'Spiritual', 'Mythology'
];

const TATTOO_SUGGESTIONS = [
  'geometric wolf', 'japanese dragon', 'minimalist mountain range', 'watercolor phoenix',
  'sacred geometry mandala', 'fine line rose', 'tribal sun', 'realistic tiger portrait',
  'abstract tree of life', 'celtic knot', 'biomechanical arm piece', 'dotwork lotus',
  'neo-traditional snake', 'blackwork raven', 'ornamental compass', 'floral sleeve design',
  'skull and roses', 'geometric lion', 'watercolor galaxy', 'minimalist wave',
  'traditional anchor', 'realistic eye', 'abstract mountain', 'fine line constellation',
  'tribal elephant', 'geometric butterfly', 'japanese koi fish', 'watercolor feather',
  'blackwork forest', 'ornamental key', 'realistic wolf pack', 'minimalist arrow',
  'sacred geometry owl', 'neo-traditional lighthouse', 'dotwork elephant', 'floral mandala',
  'geometric stag', 'watercolor hummingbird', 'blackwork octopus', 'fine line moon phases',
  'tribal phoenix', 'realistic lion portrait', 'abstract waves', 'ornamental dagger',
  'minimalist birds in flight', 'geometric fox', 'japanese cherry blossoms', 'watercolor jellyfish'
];

const HERO_REFINEMENT_OPTIONS = [
  { label: 'More Realistic', value: 'photorealistic, detailed shading, lifelike rendering', lockSeed: true },
  { label: 'More Geometric', value: 'geometric patterns, angular shapes, precise lines', lockSeed: true },
  { label: 'More Organic', value: 'flowing curves, natural forms, soft edges', lockSeed: true },
  { label: 'More Color', value: 'vibrant colors, rich palette, colorful design', lockSeed: true },
  { label: 'More Traditional', value: 'classic tattoo style, bold outlines, traditional approach', lockSeed: true },
  { label: 'More Minimal', value: 'clean design, negative space, simple forms', lockSeed: true },
  { label: 'More Detailed', value: 'intricate elements, complex textures, rich detail', lockSeed: true },
  { label: 'More Abstract', value: 'abstract interpretation, artistic expression, creative style', lockSeed: true },
  { label: 'More Bold', value: 'strong outlines, high contrast, dramatic impact', lockSeed: true },
  { label: 'More Delicate', value: 'fine lines, subtle details, gentle approach', lockSeed: true },
  { label: 'More Dark', value: 'deep shadows, black ink, moody atmosphere', lockSeed: true },
  { label: 'More Ornate', value: 'decorative elements, ornamental design, elaborate details', lockSeed: true },
  { label: 'More Stylized', value: 'artistic interpretation, unique style, creative approach', lockSeed: true },
  { label: 'More Dynamic', value: 'movement, energy, dynamic composition', lockSeed: true },
  { label: 'More Textured', value: 'rich textures, surface details, tactile quality', lockSeed: true },
  { label: 'More Variations', value: 'same concept, different interpretation', lockSeed: false }
];

// Max device pixel ratio to cap canvas buffers (perf/memory)
const MAX_DPR = 2;

/* ---------- Types ---------- */

type TattooImage = {
  id: string;
  url: string;
  prompt: string;
  loadTime: number;
  aspectRatio?: number;
  isNSFW?: boolean;
};

type ControlnetIteration = {
  imageUrl: string;
  prompt: string;
  refinement?: string;
  isOriginalSketch?: boolean;
};

type GenerationSession = {
  id: string;
  basePrompt: string;
  style: string;
  refinement: string;
  images: TattooImage[];
  generating: boolean;
  progress: number;
  sse?: EventSource | null;
  error?: string | null;
  seed?: number;
  isControlnet?: boolean;
  controlImageBlob?: Blob;
  controlnetHistory?: ControlnetIteration[];
  /** Sticky compare source (server-provided or local sketch) used when history is absent */
  compareAgainstUrl?: string;
};

/* ---------- Small Utilities ---------- */

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
const STYLES = shuffleArray(BASE_STYLES);
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Generates a random seed for reproducibility when needed */
const randomSeed = () => Math.floor(Math.random() * 1000000);
/** Reset controlnet history index to "current design" */
function resetHistoryIndexFor(history: ControlnetIteration[] | undefined) {
  if (!history?.length) return 0;
  return history.length;
}

/* ---------- App Component ---------- */

export default function App() {
  // Stable ID counters across re-renders
  const sessionIdRef = useRef(0);
  const imageIdRef = useRef(0);
  const nextSessionId = useCallback(() => `session_${++sessionIdRef.current}`, []);
  const nextImageId = useCallback(() => `image_${++imageIdRef.current}`, []);

  // Core app state
  const [prompt, setPrompt] = useState(
    () => TATTOO_SUGGESTIONS[Math.floor(Math.random() * TATTOO_SUGGESTIONS.length)]
  );
  const [selectedStyle, setSelectedStyle] = useState(
    () => STYLES[Math.floor(Math.random() * STYLES.length)]
  );

  const [currentSession, setCurrentSession] = useState<GenerationSession | null>(null);
  const [heroImage, setHeroImage] = useState<TattooImage | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSession, setHeroSession] = useState<GenerationSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<GenerationSession[]>([]);

  // Draw mode
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [visionPrompt, setVisionPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(8);
  const [drawColor, setDrawColor] = useState('#000000');
  const [drawTool, setDrawTool] = useState<'brush' | 'square' | 'calligraphy'>('brush');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [baseImageData, setBaseImageData] = useState<ImageData | null>(null);
  const [isOutsideCanvas, setIsOutsideCanvas] = useState(false);
  const [originalSketch, setOriginalSketch] = useState<string | null>(null);
  const [originalControlBlob, setOriginalControlBlob] = useState<Blob | null>(null);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [showOriginalSketch, setShowOriginalSketch] = useState(false);

  // NEW: Draw Mode I/O
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Calligraphy extras
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [strokeHistory, setStrokeHistory] = useState<
    Array<{ x: number; y: number; pressure: number; time: number }>
  >([]);
  const [drips, setDrips] = useState<
    Array<{ id: number; x: number; y: number; length: number; speed: number; alpha: number }>
  >([]);
  const dripCounter = useRef(0);

  // Misc
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Track latest sessions for unmount cleanup (SSE)
  const currentSessionRef = useRef<GenerationSession | null>(null);
  const heroSessionRef = useRef<GenerationSession | null>(null);
  useEffect(() => { currentSessionRef.current = currentSession; }, [currentSession]);
  useEffect(() => { heroSessionRef.current = heroSession; }, [heroSession]);

  /* ---------- Effects ---------- */

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || 'ontouchstart' in window || window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animate drips
  useEffect(() => {
    if (drips.length === 0) return;
    const animationInterval = setInterval(() => {
      setDrips(prevDrips => {
        const canvas = canvasRef.current;
        if (!canvas) return prevDrips;
        const ctx = canvas.getContext('2d');
        if (!ctx) return prevDrips;

        const updatedDrips = prevDrips
          .map(drip => ({
            ...drip,
            y: drip.y + drip.speed,
            alpha: drip.alpha - 0.01,
            length: drip.length + 0.2
          }))
          .filter(drip => drip.alpha > 0);

        ctx.save();
        updatedDrips.forEach(drip => {
          ctx.globalAlpha = drip.alpha;
          ctx.fillStyle = drawColor;
          ctx.beginPath();
          ctx.ellipse(drip.x, drip.y, 1, drip.length / 2, 0, 0, 2 * Math.PI);
          ctx.fill();
        });
        ctx.restore();
        return updatedDrips;
      });
    }, 50);
    return () => clearInterval(animationInterval);
  }, [drips.length, drawColor]);

  // Focus hero mode when it opens
  useEffect(() => {
    if (heroImage) {
      const heroElement = document.querySelector('.hero-mode') as HTMLElement | null;
      heroElement?.focus();
    }
  }, [heroImage]);

  // Close any open SSE connections when the app unmounts
  useEffect(() => {
    return () => {
      try { currentSessionRef.current?.sse?.close(); } catch {}
      try { heroSessionRef.current?.sse?.close(); } catch {}
    };
  }, []);


  /* ---------- Responsive Canvas + DPR Scaling (square) ---------- */

  const resizeCanvasToDisplaySize = useCallback((preserve = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Measure the current rendered (CSS) size; canvas is square via CSS aspect-ratio
    const rect = canvas.getBoundingClientRect();
    const cssSide = Math.max(1, Math.floor(rect.width));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const target = Math.max(1, Math.floor(cssSide * dpr));

    // 🔒 keep the backing store square, too
    if (canvas.width === target && canvas.height === target) return;

    // Optionally preserve current drawing
    let prevUrl: string | null = null;
    if (preserve) {
      try { prevUrl = canvas.toDataURL('image/png'); } catch { prevUrl = null; }
    }

    // Resize backing store (square)
    canvas.width = target;
    canvas.height = target;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White background (ink on white)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Redraw previous content scaled to new size
    if (prevUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.imageSmoothingEnabled = true;
        // @ts-expect-error TS lib may not know this union type
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = prevUrl;
    }

    // Reset draw-state caches
    setDrips([]);
    setStrokeHistory([]);
  }, []);

  useEffect(() => {
    if (!isDrawMode) return;
    const id = window.requestAnimationFrame(() => resizeCanvasToDisplaySize(false));
    const onResize = () => resizeCanvasToDisplaySize(true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [isDrawMode, resizeCanvasToDisplaySize]);

  /* ---------- Announcer ---------- */

  const announce = useCallback((message: string) => {
    if (!liveRegionRef.current) return;
    liveRegionRef.current.textContent = message;
    setTimeout(() => {
      if (liveRegionRef.current) liveRegionRef.current.textContent = '';
    }, 600);
  }, []);

  /* ---------- SSE Helpers (shared) ---------- */

  type SSEData =
    | { type: 'connected'; projectId?: string }
    | { type: 'progress'; progress?: number }
    | {
        type: 'jobCompleted';
        job: { id?: string; resultUrl?: string; positivePrompt?: string; isNSFW?: boolean };
        compareAgainstUrl?: string;
        previousUrl?: string;
      }
    | { type: 'completed' }
    | { type: 'jobFailed' | 'error'; error?: string };

  function attachSSE(
    projectId: string,
    sessionId: string,
    basePrompt: string,
    apply: React.Dispatch<React.SetStateAction<GenerationSession | null>>,
    onDone?: () => void
  ) {
    const es = new EventSource(`${API_BASE}/api/progress/${projectId}`);

    es.onmessage = evt => {
      let data: SSEData | undefined;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (!data) return;

      apply(prev => {
        if (!prev || prev.id !== sessionId) return prev;

        switch (data.type) {
          case 'connected':
            return prev;
          case 'progress':
            return { ...prev, progress: clamp01(Number(data.progress) || 0) };
          case 'jobCompleted': {
            const newImage: TattooImage = {
              id: nextImageId(),
              url: data.job.resultUrl || '',
              prompt: data.job.positivePrompt || basePrompt,
              loadTime: Date.now(),
              isNSFW: !!data.job.isNSFW
            };
            const updatedImages = [...prev.images, newImage];
            announce(`${updatedImages.length} of 16 variations ready`);

            // Pick up sticky compare from server (if present)
            const compareFromServer =
              data.compareAgainstUrl || data.previousUrl || prev.compareAgainstUrl;

            return { ...prev, images: updatedImages, compareAgainstUrl: compareFromServer };
          }
          case 'completed':
            es.close();
            announce('All 16 variations complete!');
            onDone?.();
            return { ...prev, generating: false, sse: null };
          case 'jobFailed':
          case 'error':
            es.close();
            announce('Generation failed');
            return { ...prev, generating: false, sse: null, error: data.error || 'Generation failed' };
          default:
            return prev;
        }
      });
    };

    es.onerror = () => {
      es.close();
      apply(prev => (prev ? { ...prev, generating: false, sse: null, error: 'Connection error' } : null));
    };

    apply(prev => (prev ? { ...prev, sse: es } : null));
  }

  /* ---------- Network helpers ---------- */

  async function postJSON<T>(url: string, body: unknown): Promise<T> {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({}));
      throw new Error(payload?.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  async function postForm<T>(url: string, form: FormData): Promise<T> {
    const resp = await fetch(url, { method: 'POST', body: form });
    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({}));
      throw new Error(payload?.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  /* ---------- Session Starters (text, controlnet, hero-refine) ---------- */

  const startGeneration = useCallback(
    async (basePrompt: string, style: string, refinement = '') => {
      currentSession?.sse?.close();

      const sessionId = nextSessionId();
      const newSession: GenerationSession = {
        id: sessionId,
        basePrompt,
        style,
        refinement,
        images: [],
        generating: true,
        progress: 0,
        error: null,
        seed: randomSeed()
      };

      setCurrentSession(newSession);
      setHeroImage(null);
      announce('Generating 16 tattoo variations...');

      try {
        const { projectId, context } = await postJSON<{ projectId: string; context?: any }>(
          `${API_BASE}/api/generate`,
          { prompt: basePrompt, style, refinement }
        );

        if (context?.compareAgainstUrl) {
          setCurrentSession(prev => (prev ? { ...prev, compareAgainstUrl: context.compareAgainstUrl } : prev));
        }

        attachSSE(projectId, sessionId, basePrompt, setCurrentSession, () => {
          setCurrentSession(prev => {
            if (!prev) return prev;
            setSessionHistory(history => [prev, ...history.slice(0, 9)]);
            return prev;
          });
        });
      } catch (err: any) {
        setCurrentSession(prev => (prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null));
      }
    },
    [announce, currentSession?.sse, nextSessionId]
  );

  const startGenerationWithControlnet = useCallback(
    async (basePrompt: string, style: string, controlImage: File, sketchDataUrl?: string) => {
      currentSession?.sse?.close();

      const sessionId = nextSessionId();
      const controlnetStyle = 'Bold Black Ink Tattoo Design';
      const newSession: GenerationSession = {
        id: sessionId,
        basePrompt,
        style: controlnetStyle,
        refinement: '',
        images: [],
        generating: true,
        progress: 0,
        error: null,
        isControlnet: true,
        controlImageBlob: controlImage,
        controlnetHistory: [
          {
            imageUrl: sketchDataUrl || originalSketch || '',
            prompt: basePrompt,
            isOriginalSketch: true
          }
        ],
        compareAgainstUrl: sketchDataUrl || originalSketch || undefined
      };

      setPrompt('custom');
      setSelectedStyle('Solid Black');

      setCurrentSession(newSession);
      setHeroImage(null);
      announce('Generating 16 tattoo variations from your drawing...');

      try {
        const form = new FormData();
        form.append('prompt', basePrompt);
        form.append('style', style);
        form.append('controlImage', controlImage);

        const { projectId, context } = await postForm<{ projectId: string; context?: any }>(
          `${API_BASE}/api/generate-controlnet`,
          form
        );

        if (context?.compareAgainstUrl) {
          setCurrentSession(prev => (prev ? { ...prev, compareAgainstUrl: context.compareAgainstUrl } : prev));
        }

        attachSSE(projectId, sessionId, basePrompt, setCurrentSession, () => {
          setCurrentSession(prev => {
            if (!prev) return prev;
            setSessionHistory(history => [prev, ...history.slice(0, 9)]);
            return prev;
          });
        });
      } catch (err: any) {
        setCurrentSession(prev => (prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null));
      }
    },
    [announce, currentSession?.sse, nextSessionId, originalSketch]
  );

  const startHeroGeneration = useCallback(
    async (
      basePrompt: string,
      style: string,
      refinement: string,
      seed?: number,
      useControlnet?: boolean,
      sourceImageUrl?: string
    ) => {
      heroSession?.sse?.close();

      const sessionId = nextSessionId();
      const newHero: GenerationSession = {
        id: sessionId,
        basePrompt,
        style,
        refinement,
        images: [],
        generating: true,
        progress: 0,
        error: null,
        seed,
        compareAgainstUrl: useControlnet ? sourceImageUrl || originalSketch || undefined : undefined
      };

      if (useControlnet && currentSession?.controlnetHistory && sourceImageUrl) {
        newHero.controlnetHistory = [
          ...currentSession.controlnetHistory,
          { imageUrl: sourceImageUrl, prompt: basePrompt, refinement }
        ];
      }

      setHeroSession(newHero);
      announce('Generating 16 variations...');

      try {
        let projectResp: { projectId: string; context?: any };

        if (useControlnet) {
          let controlBlob: Blob | null = null;
          if (sourceImageUrl) {
            try {
              const r = await fetch(sourceImageUrl);
              controlBlob = await r.blob();
            } catch {
              controlBlob = originalControlBlob;
            }
          } else {
            controlBlob = originalControlBlob;
          }
          if (!controlBlob) throw new Error('No control image available for controlnet generation');

          const form = new FormData();
          form.append('prompt', basePrompt);
          form.append('style', style);
          form.append('refinement', refinement);
          form.append('controlImage', controlBlob);

          projectResp = await postForm(`${API_BASE}/api/generate-controlnet`, form);
        } else {
          projectResp = await postJSON(`${API_BASE}/api/generate`, {
            prompt: basePrompt,
            style,
            refinement,
            seed: seed !== undefined ? seed : undefined
          });
        }

        const { projectId, context } = projectResp;

        if (context?.compareAgainstUrl) {
          setHeroSession(prev => (prev ? { ...prev, compareAgainstUrl: context.compareAgainstUrl } : prev));
        }

        attachSSE(projectId, sessionId, basePrompt, setHeroSession);
      } catch (err: any) {
        setHeroSession(prev => (prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null));
      }
    },
    [announce, currentSession, heroSession?.sse, nextSessionId, originalControlBlob, originalSketch]
  );

  /* ---------- UI event helpers ---------- */

  const handleGenerate = () => {
    if (prompt.trim()) startGeneration(prompt.trim(), selectedStyle);
  };

  const handleSuggest = () => {
    setPrompt(TATTOO_SUGGESTIONS[Math.floor(Math.random() * TATTOO_SUGGESTIONS.length)]);
  };

  const closeHeroMode = useCallback(() => {
    const heroElement = document.querySelector('.hero-mode') as HTMLElement | null;
    if (heroElement) {
      heroElement.style.animation = 'heroFadeOut 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards';
      setTimeout(() => {
        setHeroImage(null);
        setHeroSession(null);
        setCurrentHistoryIndex(0);
        setShowOriginalSketch(false);
      }, 600);
    } else {
      setHeroImage(null);
      setHeroSession(null);
      setCurrentHistoryIndex(0);
      setShowOriginalSketch(false);
    }
  }, []);

  const exitRefinementMode = useCallback(() => {
    if (!currentSession || !heroSession) return;
    const originalImage = currentSession.images.find(img => img.prompt === heroImage?.prompt);
    if (originalImage) {
      const originalIndex = currentSession.images.findIndex(img => img.id === originalImage.id);
      setHeroIndex(originalIndex);
      setHeroImage(originalImage);
    }
    setHeroSession(null);
  }, [currentSession, heroSession, heroImage]);

  const handleRefinementClick = (option: typeof HERO_REFINEMENT_OPTIONS[number]) => {
    if (!heroImage || !currentSession) return;
    const seed = option.lockSeed ? currentSession.seed : -1;
    const useControlnet = currentSession.isControlnet;
    const sourceImageUrl = useControlnet ? heroImage.url : undefined;
    startHeroGeneration(heroImage.prompt, selectedStyle, option.value, seed, useControlnet, sourceImageUrl);
  };

  const handleImageClick = (image: TattooImage) => {
    if (!currentSession || image.isNSFW) return;
    const index = currentSession.images.findIndex(img => img.id === image.id);

    const clickedImage = document.querySelector(`[data-image-index="${index}"]`) as HTMLElement | null;
    if (clickedImage) {
      clickedImage.style.transform = 'scale(1.2)';
      clickedImage.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      clickedImage.style.zIndex = '500';
      setTimeout(() => {
        setHeroImage(image);
        setHeroIndex(index);
        setHeroSession(null);

        const history = currentSession?.controlnetHistory || [];
        setCurrentHistoryIndex(resetHistoryIndexFor(history));
        setShowOriginalSketch(false);
      }, 200);
    } else {
      setHeroImage(image);
      setHeroIndex(index);
      setHeroSession(null);

      const history = currentSession?.controlnetHistory || [];
      setCurrentHistoryIndex(resetHistoryIndexFor(history));
      setShowOriginalSketch(false);
    }
  };

  const navigateHero = (direction: 'prev' | 'next') => {
    const activeSession = heroSession || currentSession;
    if (!activeSession || activeSession.images.length === 0) return;

    const newIndex =
      direction === 'prev'
        ? heroIndex > 0
          ? heroIndex - 1
          : activeSession.images.length - 1
        : heroIndex < activeSession.images.length - 1
        ? heroIndex + 1
        : 0;

    setHeroIndex(newIndex);
    setHeroImage(activeSession.images[newIndex]);

    const historySession = activeSession === heroSession ? heroSession : currentSession;
    const history = historySession?.controlnetHistory || [];
    setCurrentHistoryIndex(resetHistoryIndexFor(history));
    setShowOriginalSketch(false);
  };

  // Touch gesture (mobile) for hero navigation
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || !heroImage) return;
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    },
    [isMobile, heroImage]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || !heroImage || !touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      if (dt > 500 || Math.abs(dy) > Math.abs(dx)) return;
      const minSwipe = 50;
      if (Math.abs(dx) > minSwipe) {
        navigateHero(dx > 0 ? 'prev' : 'next');
        e.preventDefault();
      }
    },
    [isMobile, heroImage]
  );

  // Helper: should global key handler ignore this target?
  const isInteractiveTarget = (el: EventTarget | null) => {
    const node = el as HTMLElement | null;
    if (!node) return false;
    if (node.isContentEditable) return true;
    const tag = node.tagName?.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return true;
    if (node.getAttribute('role') === 'textbox') return true;
    if (node.closest('input,textarea,select,button,[contenteditable="true"],[role="textbox"]')) return true;
    return false;
  };

  // Spacebar toggle (uses state updaters; safe across renders)
  const handleSpacebarToggle = useCallback(() => {
    const activeSession = heroSession || currentSession;
    const historySession = activeSession === heroSession ? heroSession : currentSession;
    const history = historySession?.controlnetHistory || [];
    const compareUrl = historySession?.compareAgainstUrl || originalSketch || '';

    // Always allow spacebar toggle if there's comparison data available
    if (history.length > 0 || compareUrl) {
      if (history.length > 0) {
        if (history.length === 1) {
          const totalStates = 2;
          setCurrentHistoryIndex(prevIndex => {
            const newIndex = (prevIndex + 1) % totalStates;
            setShowOriginalSketch(newIndex < history.length);
            return newIndex;
          });
        } else {
          const previousIndex = history.length - 1;
          setCurrentHistoryIndex(prevIndex => {
            if (prevIndex === history.length) {
              setShowOriginalSketch(true);
              return previousIndex;
            } else {
              setShowOriginalSketch(false);
              return history.length;
            }
          });
        }
      } else if (compareUrl) {
        setShowOriginalSketch(prev => !prev);
      }
    }
  }, [heroSession, currentSession, heroImage, originalSketch]);

  // Document-level spacebar listener for toggle functionality
  useEffect(() => {
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in interactive elements
      if (isInteractiveTarget(e.target)) return;
      
      if (e.key === ' ') {
        e.preventDefault();
        handleSpacebarToggle();
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  }, [handleSpacebarToggle]);

  // Global keyboard shortcuts (skip when typing)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInteractiveTarget(e.target)) return;

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
    if (e.key === 'Escape' && heroImage) {
      closeHeroMode();
    }
    if (heroImage && e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateHero('prev');
    }
    if (heroImage && e.key === 'ArrowRight') {
      e.preventDefault();
      navigateHero('next');
    }
    if (e.key === ' ') {
      e.preventDefault();
      handleSpacebarToggle();
    }
  };

  /* ---------- Drawing with Pointer Events (persist across leave) ---------- */

  // Track the active pointer ID so we can release capture on window-level fallback
  const activePointerIdRef = useRef<number | null>(null);

  // Convert client coords to canvas coords, return null if outside bounds
  const getCanvasCoordsFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    // Check if coordinates are within canvas bounds
    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
      return null; // Outside canvas bounds
    }
    
    return { x, y };
  };

  const startDrawingPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture this pointer so we continue to receive move/up even off-canvas
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
    activePointerIdRef.current = e.pointerId;

    setIsDrawing(true);
    setIsOutsideCanvas(false);

    const coords = getCanvasCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return; // Start point is outside canvas, don't start drawing

    const { x, y } = coords;

    if (drawTool === 'brush') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (drawTool === 'square') {
      setStartPos({ x, y });
      setBaseImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } else if (drawTool === 'calligraphy') {
      setLastPos({ x, y });
      setStrokeHistory([{ x, y, pressure: 1, time: Date.now() }]);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const drawPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    // Only respond to the active pointer
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordsFromClient(e.clientX, e.clientY);
    
    // Handle cursor leaving canvas
    if (!coords) {
      if (!isOutsideCanvas) {
        setIsOutsideCanvas(true);
        // End current stroke for brush and calligraphy tools
        if (drawTool === 'brush' || drawTool === 'calligraphy') {
          ctx.beginPath(); // This will break the line when we re-enter
        }
      }
      return;
    }

    const { x, y } = coords;

    // Handle cursor re-entering canvas
    if (isOutsideCanvas) {
      setIsOutsideCanvas(false);
      // Start a new stroke at the re-entry point
      if (drawTool === 'brush') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        return; // Don't draw on re-entry, just position
      } else if (drawTool === 'calligraphy') {
        setLastPos({ x, y });
        ctx.beginPath();
        ctx.moveTo(x, y);
        return; // Don't draw on re-entry, just position
      }
      // For square tool, continue normally as it doesn't have continuous strokes
    }

    if (drawTool === 'brush') {
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = drawColor;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (drawTool === 'square' && startPos && baseImageData) {
      ctx.putImageData(baseImageData, 0, 0);
      ctx.fillStyle = drawColor;
      const width = x - startPos.x;
      const height = y - startPos.y;
      ctx.fillRect(startPos.x, startPos.y, width, height);
    } else if (drawTool === 'calligraphy' && lastPos) {
      const dx = x - lastPos.x;
      const dy = y - lastPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = distance;

      const minWidth = brushSize * 0.3;
      const maxWidth = brushSize * 1.5;
      const normalizedSpeed = Math.min(speed / 20, 1);
      const currentWidth = maxWidth - normalizedSpeed * (maxWidth - minWidth);

      const halfWidth = currentWidth / 2;
      const tiltOffset = halfWidth * 0.4;

      const ctx2 = ctx;
      ctx2.save();
      ctx2.fillStyle = drawColor;
      ctx2.beginPath();
      ctx2.moveTo(lastPos.x - tiltOffset, lastPos.y - halfWidth);
      ctx2.lineTo(lastPos.x + tiltOffset, lastPos.y + halfWidth);
      ctx2.lineTo(x + tiltOffset, y + halfWidth);
      ctx2.lineTo(x - tiltOffset, y - halfWidth);
      ctx2.closePath();
      ctx2.fill();
      ctx2.restore();

      const now = Date.now();
      setStrokeHistory(prev => [...prev, { x, y, pressure: normalizedSpeed, time: now }]);

      if (speed < 5 && Math.random() < 0.3) {
        const newDrip = {
          id: ++dripCounter.current,
          x: x + (Math.random() - 0.5) * currentWidth,
          y: y + currentWidth / 2,
          length: Math.random() * 15 + 5,
          speed: Math.random() * 2 + 1,
          alpha: 0.8
        };
        setDrips(prev => [...prev, newDrip]);
      }

      setLastPos({ x, y });
    }
  };

  const endDrawingPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Release capture if we had it
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
    activePointerIdRef.current = null;
    // Reset state
    setIsDrawing(false);
    setStartPos(null);
    setBaseImageData(null);
    setLastPos(null);
    setIsOutsideCanvas(false);
  };

  // Window-level fallback: if pointerup/cancel happens off the element and capture wasn't honored
  useEffect(() => {
    if (!isDrawing) return;
    const handleUp = () => {
      const canvas = canvasRef.current as any;
      const id = activePointerIdRef.current;
      if (canvas && typeof canvas.releasePointerCapture === 'function' && id != null) {
        try { canvas.releasePointerCapture(id); } catch {}
      }
      activePointerIdRef.current = null;
      setIsDrawing(false);
      setStartPos(null);
      setBaseImageData(null);
      setLastPos(null);
      setIsOutsideCanvas(false);
    };
    window.addEventListener('pointerup', handleUp, { passive: true });
    window.addEventListener('pointercancel', handleUp, { passive: true });
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isDrawing]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDrips([]);
    setStrokeHistory([]);
  };

  const handleDrawModeToggle = () => {
    setIsDrawMode(prev => {
      const next = !prev;
      if (next) {
        // Initialize canvas sizing + white background when entering draw mode
        setTimeout(() => {
          resizeCanvasToDisplaySize(false);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }, 50);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !visionPrompt.trim()) return;

    canvas.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
      const dataUrl = canvas.toDataURL('image/png');
      setOriginalSketch(dataUrl);
      setOriginalControlBlob(blob);
      setIsDrawMode(false);
      await startGenerationWithControlnet(visionPrompt.trim(), selectedStyle, file, dataUrl);
    }, 'image/png');
  };

  // ---------- Draw Mode — Upload/Download helpers ----------

  const drawImageContain = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.min(cw / iw, ch / ih);
    const dw = Math.round(iw * scale);
    const dh = Math.round(ih * scale);
    const dx = Math.round((cw - dw) / 2);
    const dy = Math.round((ch - dh) / 2);

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    ctx.imageSmoothingEnabled = true;
    // @ts-expect-error TS lib may not know this union type
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);

    setDrips([]);
    setStrokeHistory([]);
  };

  const loadFileIntoCanvas = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      announce('Unsupported file type — please use an image');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      drawImageContain(img);
      URL.revokeObjectURL(objectUrl);
      announce('Image loaded into canvas');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      announce('Failed to load image');
    };
    img.src = objectUrl;
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFileIntoCanvas(file);
    e.currentTarget.value = '';
  };

  const handleCanvasDragOver: React.DragEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleCanvasDragLeave: React.DragEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };
  const handleCanvasDrop: React.DragEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFileIntoCanvas(file);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLDivElement> = (e) => {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          loadFileIntoCanvas(f);
          return;
        }
      }
    }
  };

  const handleDownloadDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `sogni-drawing-${date}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 800);
      announce('Drawing downloaded');
    }, 'image/png');
  };

  const handleDrawKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === 'o') {
      e.preventDefault();
      openFilePicker();
    }
    if ((e.metaKey || e.ctrlKey) && key === 's') {
      e.preventDefault();
      handleDownloadDrawing();
    }
  };

  /* ---------- Render ---------- */

  return (
    <div className="app" onKeyDown={handleKeyDown}>
      {/* Inject mobile tokens + layout */}
      <MobileStyles />

      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRegionRef} />

      {/* Hero Mode */}
      {heroImage && (
        <div
          className="hero-mode"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          autoFocus
        >
          {/* Central Hero Image */}
          <div className="hero-center">
            {(() => {
              const activeSession = heroSession || currentSession;
              const historySession = activeSession === heroSession ? heroSession : currentSession;
              const history = historySession?.controlnetHistory || [];
              const stickyCompare = historySession?.compareAgainstUrl || originalSketch || '';

              if (showOriginalSketch && (history.length > 0 || stickyCompare)) {
                let compareSrc = stickyCompare;
                let altText = 'Compare image';
                if (history.length > 0) {
                  const currentIteration = history[currentHistoryIndex];
                  if (currentIteration) {
                    compareSrc = currentIteration.imageUrl || stickyCompare;
                    altText = currentIteration.isOriginalSketch
                      ? 'Original sketch'
                      : `Iteration ${currentHistoryIndex}`;
                  }
                }
                return <img src={compareSrc} alt={altText} className="hero-main-image" />;
              }
              return <img src={heroImage.url} alt="Selected tattoo design" className="hero-main-image" />;
            })()}

            {/* Loading indicator when generating variations */}
            {heroSession?.generating && (
              <div className="hero-loading">
                <div className="hero-loading-spinner"></div>
              </div>
            )}

            {/* Original hero prompt display with close button */}
            {!heroSession && (
              <div className="hero-prompt-container">
                <div className="hero-prompt-text">
                  <strong>{heroImage.prompt}</strong>
                  <br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', opacity: 0.8 }}>
                    Style: {currentSession?.style || selectedStyle}
                  </span>
                </div>
                <button className="hero-prompt-close" onClick={closeHeroMode} aria-label="Close hero view">
                  ×
                </button>
              </div>
            )}

            {/* Exit refinement mode button */}
            {heroSession && !heroSession.generating && (
              <div className="refinement-exit-container">
                <div className="refinement-combined-container">
                  <div className="refinement-combined-text">
                    <strong>
                      Add {heroSession.refinement.includes('Color') ? 'More Color' : heroSession.refinement.replace('More ', '')}
                    </strong>
                  </div>
                  <button className="refinement-close-btn" onClick={exitRefinementMode} aria-label="Return to original hero">
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation arrows */}
          <button className="hero-nav hero-nav-left" onClick={() => navigateHero('prev')} aria-label="Previous image">
            ←
          </button>
          <button className="hero-nav hero-nav-right" onClick={() => navigateHero('next')} aria-label="Next image">
            →
          </button>

          {/* Image counter + spacebar helper (keyboard-accessible) */}
          <div
            className="hero-counter"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleSpacebarToggle();
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation(); // avoid double-toggle with global handler
                handleSpacebarToggle();
              }
            }}
            style={{ cursor: 'pointer' }}
            aria-label="Toggle compare (Space or Enter)"
          >
            {heroIndex + 1} / {(heroSession || currentSession)?.images.length || 0}
            {isMobile && (
              <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem' }}>Swipe to navigate</div>
            )}
            {(() => {
              const activeSession = heroSession || currentSession;
              const historySession = activeSession === heroSession ? heroSession : currentSession;
              const history = historySession?.controlnetHistory || [];
              const stickyCompare = historySession?.compareAgainstUrl || originalSketch || '';

              if (history.length > 0) {
                const totalStates = history.length + 1;
                const nextIndex = (currentHistoryIndex + 1) % totalStates;

                const labelFor = (i: number) => {
                  if (i < history.length) {
                    return history[i]?.isOriginalSketch ? 'original sketch' : `iteration ${i}`;
                  }
                  return 'current design';
                };

                const currentLabel = labelFor(currentHistoryIndex).replace(/\b\w/g, s => s.toUpperCase());
                const nextLabel = labelFor(nextIndex);

                return (
                  <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem', color: '#ff6b35' }}>
                    <div style={{ marginBottom: '2px' }}>
                      {currentLabel}
                      <span style={{ opacity: 0.6, marginLeft: '8px' }}>
                        ({currentHistoryIndex + 1}/{totalStates})
                      </span>
                    </div>
                    <div>
                      <span style={{ background: 'rgba(255,107,53,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                        SPACE or CLICK
                      </span>{' '}
                      Show {nextLabel}
                    </div>
                  </div>
                );
              } else if (stickyCompare) {
                return (
                  <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem', color: '#ff6b35' }}>
                    <div>
                      <span style={{ background: 'rgba(255,107,53,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                        SPACE or CLICK
                      </span>{' '}
                      Toggle compare
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Refinement options or orbit of refinement results */}
          {!heroSession ? (
            <div className="hero-options-grid">
              {HERO_REFINEMENT_OPTIONS.map((option, index) => {
                const angle = (index * 360) / 16;
                const hue = (index * 360) / HERO_REFINEMENT_OPTIONS.length;
                const rainbowColor = `hsl(${hue}, 70%, 60%)`;
                const rainbowColorHover = `hsl(${hue}, 80%, 50%)`;

                return (
                  <div
                    key={option.label}
                    className="hero-option"
                    style={
                      {
                        '--angle': `${angle}deg`,
                        '--delay': `${index * 0.05}s`,
                        '--rainbow-color': rainbowColor,
                        '--rainbow-color-hover': rainbowColorHover
                      } as React.CSSProperties
                    }
                    onClick={() => handleRefinementClick(option)}
                  >
                    <span className="option-label">{option.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="orbit-container">
              {heroSession.images.map((image, index) => {
                const angle = (index * 360) / 16;
                return (
                  <div
                    key={image.id}
                    className="orbit-image"
                    style={{ '--angle': `${angle}deg`, '--delay': `${index * 0.1}s` } as React.CSSProperties}
                    onClick={() => {
                      if (image.isNSFW) return;
                      const newIndex = heroSession.images.findIndex(img => img.id === image.id);
                      setHeroIndex(newIndex);
                      setHeroImage(image);
                      const history = heroSession?.controlnetHistory || [];
                      setCurrentHistoryIndex(resetHistoryIndexFor(history));
                      setShowOriginalSketch(false);
                    }}
                  >
                    {image.isNSFW ? (
                      <div className="nsfw-placeholder orbit-img">
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🚫</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Content Filtered</div>
                      </div>
                    ) : (
                      <img
                        src={image.url}
                        alt={`Variation ${index + 1}`}
                        className="orbit-img"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Draw Mode */}
      {isDrawMode && (
        <div className="draw-mode">
          <div
            className="draw-center"
            onKeyDown={handleDrawKeyDown}
            onPaste={handlePaste}
          >
            {/* App-style header */}
            <div className="mobile-header">
              <button
                className="icon-btn"
                onClick={() => setIsDrawMode(false)}
                aria-label="Close draw mode"
                title="Close"
              >
                ‹
              </button>
              <div className="mobile-title">Draw</div>
              <div style={{ inlineSize: 40 }} />
            </div>

            {/* Prompt input */}
            <input
              type="text"
              value={visionPrompt}
              onChange={(e) => setVisionPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && visionPrompt.trim()) {
                  handleCreate();
                }
              }}
              placeholder="Describe your vision…"
              className="vision-input"
            />

            {/* Tools row */}
            <div className="draw-controls">
              <div className="tools-row">
                <div className="tool-buttons">
                  <button
                    className={`tool-btn ${drawTool === 'brush' ? 'active' : ''}`}
                    onClick={() => setDrawTool('brush')}
                    title="Brush"
                  >
                    🖌️
                  </button>
                  <button
                    className={`tool-btn ${drawTool === 'calligraphy' ? 'active' : ''}`}
                    onClick={() => setDrawTool('calligraphy')}
                    title="Calligraphy Pen (with drips)"
                  >
                    🖋️
                  </button>
                  <button
                    className={`tool-btn ${drawTool === 'square' ? 'active' : ''}`}
                    onClick={() => setDrawTool('square')}
                    title="Square"
                  >
                    ⬛
                  </button>
                </div>

                <div className="color-buttons">
                  <button
                    className={`color-btn black ${drawColor === '#000000' ? 'active' : ''}`}
                    onClick={() => setDrawColor('#000000')}
                    title="Black"
                  >
                    ⚫
                  </button>
                  <button
                    className={`color-btn white ${drawColor === '#ffffff' ? 'active' : ''}`}
                    onClick={() => setDrawColor('#ffffff')}
                    title="White"
                  >
                    ⚪
                  </button>
                </div>

                <div className="size-control">
                  <label>Size:</label>
                  <input
                    type="range"
                    min="2"
                    max="40"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="size-slider"
                  />
                  <span>{brushSize}px</span>
                </div>

                <div className="io-buttons">
                  <button
                    className="tool-btn"
                    onClick={openFilePicker}
                    title="Upload image (⌘/Ctrl+O)"
                  >
                    ⬆️
                  </button>
                  <button
                    className="tool-btn"
                    onClick={handleDownloadDrawing}
                    title="Download PNG (⌘/Ctrl+S)"
                  >
                    ⬇️
                  </button>
                </div>

                <button onClick={clearCanvas} className="clear-btn" title="Clear canvas">
                  🗑️
                </button>
              </div>
            </div>

            {/* Canvas card */}
            <div className="mobile-card">
              {/* Hidden input for file picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                style={{ display: 'none' }}
              />

              {/* Canvas with DnD & subtle overlay */}
              <div className="drawing-canvas-wrapper">
                <canvas
                  ref={canvasRef}
                  className="drawing-canvas"
                  // 🔽 Pointer Events: keep writing off-canvas until pointerup anywhere
                  onPointerDown={startDrawingPointer}
                  onPointerMove={drawPointer}
                  onPointerUp={endDrawingPointer}
                  onPointerCancel={endDrawingPointer}
                  onDragOver={handleCanvasDragOver}
                  onDragLeave={handleCanvasDragLeave}
                  onDrop={handleCanvasDrop}
                  aria-label="Drawing canvas"
                />
                {isDraggingOver && (
                  <div
                    className="drop-overlay"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '12px',
                      border: '2px dashed #ff6b35',
                      background: 'rgba(255,107,53,0.1)',
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      pointerEvents: 'none'
                    }}
                  >
                    Drop image to load
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                opacity: 0.7,
                textAlign: 'center'
              }}
            >
              Tip: ⌘/Ctrl+O to upload, ⌘/Ctrl+S to download — you can also paste an image here.
            </div>

            <button onClick={handleCreate} disabled={!visionPrompt.trim()} className="create-btn">
              Create
            </button>

            <button className="draw-close" onClick={() => setIsDrawMode(false)} aria-label="Close draw mode">
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Mode */}
      {!heroImage && !isDrawMode && (
        <div className="main-mode">
          <div className="center-input">
            <img src="/slothi.png" alt="Slothicorn mascot" className="mascot" />
            <div className="brand">
              <h1>Sogni Tattoo Flash Generator</h1>
            </div>

            <div className="input-controls">
              <div className="input-group">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your tattoo idea..."
                  className="prompt-input"
                  disabled={currentSession?.generating}
                />
                <button onClick={handleSuggest} className="suggest-btn" disabled={currentSession?.generating} title="Get a random suggestion">
                  ✨
                </button>
              </div>

              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="style-select"
                disabled={currentSession?.generating}
              >
                {STYLES.map(style => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>

              <div className="button-group">
                <button onClick={handleGenerate} disabled={!prompt.trim() || currentSession?.generating} className="generate-btn">
                  {currentSession?.generating ? (
                    <>
                      <div className="button-spinner"></div>
                      Creating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
                <div className="button-separator">
                  <span className="or-text">or</span>
                </div>
                <button onClick={handleDrawModeToggle} disabled={currentSession?.generating} className="draw-btn">
                  Draw
                </button>
              </div>
            </div>

            {currentSession?.error && <div className="error-message">{currentSession.error}</div>}
            
            {/* Spacebar hint when comparison data is available and not in hero mode */}
            {!heroImage && currentSession && (() => {
              const history = currentSession?.controlnetHistory || [];
              const compareUrl = currentSession?.compareAgainstUrl || originalSketch || '';
              if (history.length > 0 || compareUrl) {
                return (
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '1rem',
                    fontSize: '0.8rem', 
                    opacity: 0.7,
                    color: '#ff6b35'
                  }}>
                    <span style={{ 
                      background: 'rgba(255,107,53,0.2)', 
                      padding: '4px 8px', 
                      borderRadius: '4px' 
                    }}>
                      SPACE
                    </span>{' '}
                    Toggle compare
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {currentSession && (
            <>
              {(() => {
                // Show comparison image if spacebar is pressed and comparison data exists
                const history = currentSession?.controlnetHistory || [];
                const compareUrl = currentSession?.compareAgainstUrl || originalSketch || '';
                
                if (showOriginalSketch && (history.length > 0 || compareUrl)) {
                  let compareSrc = compareUrl;
                  let altText = 'Compare image';
                  
                  if (history.length > 0 && currentHistoryIndex < history.length) {
                    const currentIteration = history[currentHistoryIndex];
                    if (currentIteration) {
                      compareSrc = currentIteration.imageUrl || compareUrl;
                      altText = currentIteration.isOriginalSketch
                        ? 'Original sketch'
                        : `Previous iteration`;
                    }
                  }
                  return (
                    <div className="circle-container">
                      <div className="compare-overlay">
                        <img src={compareSrc} alt={altText} className="circle-compare-image" />
                        <div className="compare-label">{altText}</div>
                      </div>
                    </div>
                  );
                }
                
                // Default: show the normal orbit of images
                return (
                  <div className="circle-container">
                    {currentSession.images.map((image, index) => {
                      const angle = (index * 360) / 16;
                      return (
                        <div
                          key={image.id}
                          className="circle-image"
                          style={{ '--angle': `${angle}deg`, '--delay': `${index * 0.1}s` } as React.CSSProperties}
                          onClick={() => handleImageClick(image)}
                        >
                          {image.isNSFW ? (
                            <div className="nsfw-placeholder circle-img">
                              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🚫</div>
                              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Content Filtered</div>
                            </div>
                          ) : (
                            <img
                              src={image.url}
                              alt={`Tattoo concept ${index + 1}`}
                              className="circle-img"
                              data-image-index={index}
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
