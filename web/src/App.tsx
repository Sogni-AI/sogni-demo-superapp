import React, { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Sogni Tattoo Ideas — Teaching Demo (Draw Mode Overhaul)
 *
 * This edit focuses on:
 * - ✅ Pointer events + capture: pen-down persists off-canvas; stop on pointerup/cancel anywhere
 * - ✅ Square canvas (CSS aspect-ratio) + DPR backing store preserved (capped MAX_DPR)
 * - ✅ New tools: Eraser (destination-out), Undo/Redo (bounded), Stroke smoothing, Symmetry (H/V), Grid overlay
 * - ✅ Pressure-aware brush (stylus), keyboard shortcuts, ARIA, safe white-background exports (no transparency)
 * - ✅ Desktop/tablet/mobile responsive layout: new pro grid (top bar + left rail + right panel) on desktop
 * - ✅ BRUSH FIX: coalesced pointer events + gap-bridging so fast strokes don’t look dotted
 *
 * Oct 2025 fixes:
 * - ✅ Compare toggle during refinement now shows ONLY the last "influence" image (no original sketch)
 * - ✅ Spacebar toggle works reliably in deep hero/refinement UI by keeping focus on the hero container
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
    .tool-buttons, .color-buttons, .size-control, .io-buttons, .toggle-buttons, .undo-redo-buttons, .symmetry-buttons {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .tool-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .tool-group .group-label {
      font-size: 0.8rem;
      opacity: .7;
      margin-right: 6px;
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
      user-select: none;
    }
    .tool-btn.active, .color-btn.active,
    .tool-btn[aria-pressed="true"] {
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
      cursor: crosshair;
    }

    /* Grid & guides overlay */
    .grid-overlay, .sym-guides {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: 14px;
    }
    .grid-overlay {
      background:
        linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 100%),
        repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 32px),
        repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 32px);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
    }
    .sym-guides::before, .sym-guides::after {
      content: "";
      position: absolute;
      background: rgba(255,107,53,0.25);
    }
    .sym-guides.h::before {
      top: 50%; left: 0; right: 0; height: 2px; transform: translateY(-1px);
    }
    .sym-guides.v::after {
      left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-1px);
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

    /* Edit Modal Styles (unchanged) */
    .edit-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
    }
    .edit-modal {
      background: var(--bg-app);
      border-radius: var(--radius-3);
      border: var(--border-soft-dark);
      box-shadow: var(--shadow-2);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .edit-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-5) var(--space-3);
      border-bottom: var(--border-soft-dark);
    }
    .edit-modal-header h3 {
      margin: 0;
      color: #f3f5f9;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .edit-modal-close {
      background: none;
      border: none;
      color: #f3f5f9;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .edit-modal-close:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .edit-modal-content { padding: var(--space-4) var(--space-5); }
    .edit-field { margin-bottom: var(--space-4); }
    .edit-field label {
      display: block;
      color: #f3f5f9;
      font-weight: 600;
      margin-bottom: var(--space-2);
      font-size: 0.9rem;
    }
    .edit-prompt-input, .edit-style-input, .edit-controlnet-select {
      width: 100%;
      padding: var(--space-3);
      border-radius: 8px;
      border: var(--border-soft-dark);
      background: rgba(255, 255, 255, 0.05);
      color: #f3f5f9;
      font-size: 0.9rem;
      resize: vertical;
    }
    .edit-prompt-input:focus, .edit-style-input:focus, .edit-controlnet-select:focus {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.2);
    }
    .edit-modal-actions {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5) var(--space-5);
      border-top: var(--border-soft-dark);
    }
    .edit-cancel-btn, .edit-generate-btn {
      flex: 1;
      padding: var(--space-3) var(--space-4);
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .edit-cancel-btn {
      background: rgba(255, 255, 255, 0.1);
      border: var(--border-soft-dark);
      color: #f3f5f9;
    }
    .edit-cancel-btn:hover { background: rgba(255, 255, 255, 0.15); }
    .edit-generate-btn {
      background: var(--brand);
      border: none;
      color: #fff;
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
    }
    .edit-generate-btn:hover:not(:disabled) {
      background: #e55a2b;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
    }
    .edit-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }

    @media (min-width: 768px) {
      .draw-center { max-width: 820px; }
      .draw-close { display: inline-grid; place-items: center; }
      .draw-controls .tools-row {
        grid-template-columns: 1fr auto auto 1fr auto auto;
      }
    }

    /* ======== Pro Desktop Layout (>= 1024px) ======== */
    @media (min-width: 1024px) {
      .draw-mode { padding: var(--space-6); }

      .draw-pro {
        display: grid;
        grid-template-areas:
          "topbar topbar topbar"
          "left   canvas right";
        grid-template-columns: 72px 1fr 340px;
        grid-template-rows: 56px 1fr;
        width: 100%;
        max-width: 1600px;
        gap: var(--space-4);
      }

      .topbar {
        grid-area: topbar;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
        padding: 8px;
      }
      .tb-left, .tb-center, .tb-right {
        display: flex; align-items: center; gap: var(--space-2);
      }
      .tb-center { flex: 1 1 auto; }
      .tb-title { font-weight: 700; letter-spacing: .3px; opacity: .9; }
      .vision-input.pro {
        height: 40px; width: 100%;
        border-radius: 10px;
      }
      .create-btn.pro { width: auto; padding: 0 var(--space-4); height: 40px; }

      .left-rail {
        grid-area: left;
        display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
        padding: var(--space-2);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
      }
      .left-rail .tool-btn { width: 44px; height: 44px; }
      .rail-divider {
        width: 100%; height: 1px; background: rgba(255,255,255,.1);
        margin: var(--space-2) 0;
      }

      .canvas-region {
        grid-area: canvas;
        display: flex; flex-direction: column;
        gap: var(--space-3);
        align-items: center; justify-content: center;
      }
      .canvas-holder {
        width: 100%;
        max-width: 1000px;
        margin-inline: auto;
        position: relative;
      }
      .canvas-holder .drawing-canvas {
        max-height: calc(100vh - 220px);
        width: min(100%, 1000px);
        aspect-ratio: 1 / 1;
      }
      .shortcut-hint { font-size: .85rem; opacity: .7; text-align: center; }

      .right-panel {
        grid-area: right;
        display: flex; flex-direction: column; gap: var(--space-3);
        padding: var(--space-3);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
        min-width: 0;
      }
      .panel-section {
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 10px;
        padding: var(--space-3);
      }
      .panel-section h4 {
        margin: 0 0 var(--space-2);
        font-size: .9rem; opacity: .85;
      }
      .row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
      .kv { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
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
  'Blackout', 'Solid Black', 'Simple Ink', 'Negative Space',
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
// Undo/redo cap
const HISTORY_LIMIT = 20;

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
  const [drawTool, setDrawTool] = useState<'brush' | 'square' | 'calligraphy' | 'eraser'>('brush');
  const [smoothBrush, setSmoothBrush] = useState(false);
  const [symmetryH, setSymmetryH] = useState(false);
  const [symmetryV, setSymmetryV] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [controlnetType, setControlnetType] = useState('scribble');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [baseImageData, setBaseImageData] = useState<ImageData | null>(null);
  const [isOutsideCanvas, setIsOutsideCanvas] = useState(false);
  const [originalSketch, setOriginalSketch] = useState<string | null>(null);
  const [originalControlBlob, setOriginalControlBlob] = useState<Blob | null>(null);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [showOriginalSketch, setShowOriginalSketch] = useState(false);

  // Undo/Redo history
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  // Brush smoothing helpers
  const brushPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPressureRef = useRef<number>(1);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editControlnetType, setEditControlnetType] = useState('');

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
        ) || 'ontouchstart' in window || window.innerWidth <= 1023; // desktop pro kicks in >= 1024
      setIsMobile(isMobileDevice);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animate drips (calligraphy effect)
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

            // Sticky compare from server (if present)
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
      // Use the passed style, defaulting to Simple Ink for backward compatibility
      const controlnetStyle = style || 'Simple Ink';
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

      setPrompt(basePrompt);
      setSelectedStyle('Simple Ink');

      setCurrentSession(newSession);
      setHeroImage(null);
      announce('Generating 16 tattoo variations from your drawing...');

      try {
        const form = new FormData();
        form.append('prompt', basePrompt);
        form.append('style', style);
        form.append('controlImage', controlImage);
        form.append('controlnetType', controlnetType);

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
    [announce, currentSession?.sse, nextSessionId, originalSketch, controlnetType]
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
          form.append('controlnetType', controlnetType);

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
    [announce, currentSession, heroSession?.sse, nextSessionId, originalControlBlob, originalSketch, controlnetType]
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

  const openEditModal = () => {
    if (!heroImage) return;
    const activeSession = heroSession || currentSession;
    if (!activeSession) return;
    setEditPrompt(heroSession ? heroSession.basePrompt : heroImage.prompt);
    setEditStyle(activeSession.style);
    setEditControlnetType(controlnetType);
    setShowEditModal(true);
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

  /**
   * Helper: index of the last non-original entry in ControlNet history (i.e., the most recent "influence" image).
   * Returns -1 if none found.
   */
  const getLastNonOriginalIndex = useCallback((hist: ControlnetIteration[] | undefined) => {
    if (!hist || hist.length === 0) return -1;
    for (let i = hist.length - 1; i >= 0; i--) {
      const it = hist[i];
      if (it && !it.isOriginalSketch && it.imageUrl) return i;
    }
    return -1;
  }, []);

  // Spacebar toggle (uses state updaters; safe across renders)
  const handleSpacebarToggle = useCallback(() => {
    const activeSession = heroSession || currentSession;
    const historySession = activeSession === heroSession ? heroSession : currentSession;
    const history = historySession?.controlnetHistory || [];
    const compareUrl = historySession?.compareAgainstUrl || originalSketch || '';

    // Special case: in hero refinement, toggle ONLY between current design and the LAST influence image
    if (heroSession && history.length > 0) {
      const lastIdx = getLastNonOriginalIndex(history);
      if (lastIdx !== -1 || compareUrl) {
        // Two states only: parent influence <-> current design
        if (lastIdx !== -1) setCurrentHistoryIndex(lastIdx);
        setShowOriginalSketch(prev => !prev);
        return;
      }
    }

    // Default behavior (non-hero or no explicit influence available)
    if (history.length > 0 || compareUrl) {
      if (history.length > 0) {
        if (history.length === 1) {
          // Only one thing to compare against -> 2 states total
          setCurrentHistoryIndex(0);
          setShowOriginalSketch(prev => !prev);
        } else {
          // Multiple history entries -> cycle all + current design
          const totalStates = history.length + 1;
          setCurrentHistoryIndex(prevIndex => {
            const next = (prevIndex + 1) % totalStates;
            setShowOriginalSketch(next < history.length);
            return next;
          });
        }
      } else {
        // No history, but have an explicit compare URL (sticky compare)
        setShowOriginalSketch(prev => !prev);
      }
    }
  }, [heroSession, currentSession, originalSketch, getLastNonOriginalIndex]);

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

  // ----- Undo/Redo helpers -----
  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    try {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setUndoStack(prev => {
        const next = [...prev, snap];
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
      });
      setRedoStack([]); // new action clears redo chain
    } catch {
      /* ignore taint errors (shouldn't happen with local files) */
    }
  }, []);

  const applyImageData = (img: ImageData | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !img) return;
    ctx.putImageData(img, 0, 0);
    setDrips([]);
    setStrokeHistory([]);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      setRedoStack(rp => {
        try {
          const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return [...rp, current].slice(-HISTORY_LIMIT);
        } catch {
          return rp;
        }
      });
      const last = prev[prev.length - 1];
      applyImageData(last);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      setUndoStack(up => {
        try {
          const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return [...up, current].slice(-HISTORY_LIMIT);
        } catch {
          return up;
        }
      });
      const last = prev[prev.length - 1];
      applyImageData(last);
      return prev.slice(0, -1);
    });
  };

  // ----- Brush helpers (smoothing + symmetry + pressure) -----
  const midpoint = (p1: { x: number; y: number }, p2: { x: number; y: number }) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  });

  const withSymmetryPoints = (p: { x: number; y: number }) => {
    const canvas = canvasRef.current!;
    const w = canvas.width;
    const h = canvas.height;
    const list = [{ x: p.x, y: p.y }];
    if (symmetryH) list.push({ x: w - p.x, y: p.y });
    if (symmetryV) list.push({ x: p.x, y: h - p.y });
    if (symmetryH && symmetryV) list.push({ x: w - p.x, y: h - p.y });
    // Deduplicate very rare overlaps (center lines)
    const key = (pt: { x: number; y: number }) => `${Math.round(pt.x)}|${Math.round(pt.y)}`;
    const seen = new Set<string>();
    const uniq: Array<{ x: number; y: number }> = [];
    for (const pt of list) {
      const k = key(pt);
      if (!seen.has(k)) { seen.add(k); uniq.push(pt); }
    }
    return uniq;
  };

  const drawQuadraticSegment = (
    ctx: CanvasRenderingContext2D,
    p0: { x: number; y: number },
    p1: { x: number; y: number }, // control
    p2: { x: number; y: number },
    width: number,
    color: string,
    composite: GlobalCompositeOperation
  ) => {
    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  };

  const drawBrushSegment = (current: { x: number; y: number }, pressureNow: number) => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const composite: GlobalCompositeOperation =
      drawTool === 'eraser' ? 'destination-out' : 'source-over';
    const baseWidth = brushSize;
    const pressureWidth = Number.isFinite(pressureNow) && pressureNow > 0
      ? Math.max(0.3, pressureNow) * baseWidth
      : baseWidth;

    if (!smoothBrush) {
      // Straight segment: last -> current (with symmetry)
      const prev = lastBrushPointRef.current || current;

      // Gap-bridging when events are sparse (prevents dotted look on fast strokes)
      const dx = current.x - prev.x;
      const dy = current.y - prev.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, pressureWidth * 0.5); // densify by ~half brush width
      const steps = Math.max(1, Math.floor(dist / step));
      const segments: Array<{ x: number; y: number }> = [];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        segments.push({ x: prev.x + dx * t, y: prev.y + dy * t });
      }

      ctx.save();
      ctx.globalCompositeOperation = composite;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = drawTool === 'eraser' ? '#000' : drawColor;

      let last = prev;
      for (const p of segments) {
        const originals: Array<[ {x:number;y:number}, {x:number;y:number} ]> = [[last, p]];
        const allPairs: Array<[ {x:number;y:number}, {x:number;y:number} ]> = [];
        originals.forEach(([a, b]) => {
          const pa = withSymmetryPoints(a);
          const pb = withSymmetryPoints(b);
          for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
            allPairs.push([pa[i], pb[i]]);
          }
        });
        for (const [a, b] of allPairs) {
          ctx.beginPath();
          ctx.lineWidth = pressureWidth;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        last = p;
      }
      ctx.restore();
      lastBrushPointRef.current = current;
      return;
    }

    // Smoothing: draw quadratic from prevMid -> (prev) -> currMid
    brushPointsRef.current.push(current);
    if (brushPointsRef.current.length < 2) {
      lastBrushPointRef.current = current;
      return;
    }
    const pts = brushPointsRef.current;
    const prev = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    const prevMid = midpoint(prev, lastBrushPointRef.current || prev);
    const currMid = midpoint(prev, curr);

    // Symmetric segments
    const p0s = withSymmetryPoints(prevMid);
    const pcs = withSymmetryPoints(prev);
    const p2s = withSymmetryPoints(currMid);
    for (let i = 0; i < p0s.length; i++) {
      drawQuadraticSegment(
        ctx,
        p0s[i],
        pcs[Math.min(i, pcs.length - 1)],
        p2s[Math.min(i, p2s.length - 1)],
        pressureWidth,
        drawTool === 'eraser' ? '#000' : drawColor,
        composite
      );
    }
    lastBrushPointRef.current = curr;
  };

  const startDrawingPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture pointer so move/up are delivered even off-canvas
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
    activePointerIdRef.current = e.pointerId;

    setIsDrawing(true);
    setIsOutsideCanvas(false);

    const coords = getCanvasCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return;

    // Snapshot for undo
    pushUndoSnapshot();

    const { x, y } = coords;

    if (drawTool === 'brush' || drawTool === 'eraser') {
      lastPressureRef.current = e.pressure || 1;
      lastBrushPointRef.current = { x, y };
      brushPointsRef.current = [{ x, y }];

      // Start a tiny dot to register click taps
      const width = Math.max(1, (e.pressure || 1) * brushSize);
      const composite: GlobalCompositeOperation =
        drawTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = composite;
      ctx.fillStyle = drawTool === 'eraser' ? '#000' : drawColor;
      ctx.beginPath();
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Symmetry taps
      const taps = withSymmetryPoints({ x, y });
      for (const t of taps) {
        if (t.x === x && t.y === y) continue;
        ctx.save();
        ctx.globalCompositeOperation = composite;
        ctx.beginPath();
        ctx.arc(t.x, t.y, width / 2, 0, Math.PI * 2);
        ctx.fillStyle = drawTool === 'eraser' ? '#000' : drawColor;
        ctx.fill();
        ctx.restore();
      }
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

    // Prefer high-rate coalesced points to avoid dotted strokes on fast moves
    const native = (e as any).nativeEvent || e;
    const coalesced: Array<PointerEvent> = typeof native.getCoalescedEvents === 'function'
      ? native.getCoalescedEvents()
      : [];

    const events: Array<{ clientX: number; clientY: number; pressure: number }> =
      coalesced.length > 0
        ? coalesced.map(ev => ({ clientX: ev.clientX, clientY: ev.clientY, pressure: ev.pressure ?? 1 }))
        : [{ clientX: e.clientX, clientY: e.clientY, pressure: e.pressure ?? (lastPressureRef.current || 1) }];

    const processBrushOrEraser = (clientX: number, clientY: number, pressure: number) => {
      const coords = getCanvasCoordsFromClient(clientX, clientY);

      // Handle cursor leaving canvas
      if (!coords) {
        if (!isOutsideCanvas) {
          setIsOutsideCanvas(true);
          // break the stroke by resetting refs
          lastBrushPointRef.current = null;
          brushPointsRef.current = [];
          ctx.beginPath();
        }
        return;
      }

      // Handle cursor re-entering canvas
      if (isOutsideCanvas) {
        setIsOutsideCanvas(false);
        lastBrushPointRef.current = { x: coords.x, y: coords.y };
        brushPointsRef.current = [{ x: coords.x, y: coords.y }];
        return;
      }

      // Draw the segment (smoothing/unsmoothed handled inside drawBrushSegment)
      lastPressureRef.current = pressure || lastPressureRef.current || 1;
      drawBrushSegment({ x: coords.x, y: coords.y }, lastPressureRef.current);
    };

    const processSquare = (clientX: number, clientY: number) => {
      const coords = getCanvasCoordsFromClient(clientX, clientY);
      if (!coords) return;
      if (!(drawTool === 'square' && startPos && baseImageData)) return;
      ctx.putImageData(baseImageData, 0, 0);
      ctx.fillStyle = drawColor;
      const width = coords.x - startPos.x;
      const height = clientY - startPos.y;
      ctx.fillRect(startPos.x, startPos.y, width, height);

      if (symmetryH || symmetryV) {
        const w = canvas.width;
        const h = canvas.height;
        const rects: Array<{ sx:number; sy:number; ex:number; ey:number }> = [{ sx: startPos.x, sy: startPos.y, ex: coords.x, ey: coords.y }];

        if (symmetryH) rects.push({ sx: w - startPos.x, sy: startPos.y, ex: w - coords.x, ey: coords.y });
        if (symmetryV) rects.push({ sx: startPos.x, sy: h - startPos.y, ex: coords.x, ey: h - coords.y });
        if (symmetryH && symmetryV) rects.push({ sx: w - startPos.x, sy: h - startPos.y, ex: w - coords.x, ey: h - coords.y });

        rects.forEach((r, idx) => {
          if (idx === 0) return;
          const rw = r.ex - r.sx;
          const rh = r.ey - r.sy;
          ctx.fillRect(r.sx, r.sy, rw, rh);
        });
      }
    };

    const processCalligraphy = (clientX: number, clientY: number) => {
      const coords = getCanvasCoordsFromClient(clientX, clientY);
      if (!coords || !lastPos) return;

      const x = coords.x;
      const y = coords.y;
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

      const drawCalPoly = (ax:number, ay:number, bx:number, by:number) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.moveTo(ax - tiltOffset, ay - halfWidth);
        ctx.lineTo(ax + tiltOffset, ay + halfWidth);
        ctx.lineTo(bx + tiltOffset, by + halfWidth);
        ctx.lineTo(bx - tiltOffset, by - halfWidth);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      // Original
      drawCalPoly(lastPos.x, lastPos.y, x, y);

      // Symmetric strokes
      const w = canvas.width;
      const h = canvas.height;
      if (symmetryH) drawCalPoly(w - lastPos.x, lastPos.y, w - x, y);
      if (symmetryV) drawCalPoly(lastPos.x, h - lastPos.y, x, h - y);
      if (symmetryH && symmetryV) drawCalPoly(w - lastPos.x, h - lastPos.y, w - x, h - y);

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
    };

    if (drawTool === 'brush' || drawTool === 'eraser') {
      // Process all coalesced points for silky lines at high speed
      for (const ev of events) {
        processBrushOrEraser(ev.clientX, ev.clientY, ev.pressure ?? 1);
      }
      return;
    }

    if (drawTool === 'square') {
      // Only the last event is needed visually, but processing all is harmless
      const last = events[events.length - 1];
      processSquare(last.clientX, last.clientY);
      return;
    }

    if (drawTool === 'calligraphy') {
      for (const ev of events) {
        processCalligraphy(ev.clientX, ev.clientY);
      }
      return;
    }
  };

  const endDrawingPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    // Release capture if we had it
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
    activePointerIdRef.current = null;

    setIsDrawing(false);
    setStartPos(null);
    setBaseImageData(null);
    setLastPos(null);
    setIsOutsideCanvas(false);
    brushPointsRef.current = [];
    lastBrushPointRef.current = null;
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
      brushPointsRef.current = [];
      lastBrushPointRef.current = null;
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
    pushUndoSnapshot();
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
            // initialize undo baseline
            try {
              const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
              setUndoStack([snap]);
              setRedoStack([]);
            } catch {
              setUndoStack([]);
              setRedoStack([]);
            }
          }
        }, 50);
      }
      return next;
    });
  };

  // Flatten (white background) export to avoid transparency when using eraser
  const flattenCanvasToBlob = async (type: 'image/png' = 'image/png'): Promise<Blob | null> => {
    const src = canvasRef.current;
    if (!src) return null;
    const off = document.createElement('canvas');
    off.width = src.width;
    off.height = src.height;
    const octx = off.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, off.width, off.height);
    octx.drawImage(src, 0, 0);
    return await new Promise<Blob | null>(resolve => off.toBlob(b => resolve(b), type));
  };

  const handleCreate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !visionPrompt.trim()) return;

    const blob = await flattenCanvasToBlob('image/png');
    if (!blob) return;

    const file = new File([blob], 'drawing.png', { type: 'image/png' });
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.readAsDataURL(blob);
    });

    setOriginalSketch(dataUrl);
    setOriginalControlBlob(blob);
    setSelectedStyle('Simple Ink');
    setIsDrawMode(false);
    await startGenerationWithControlnet(visionPrompt.trim(), 'Simple Ink', file, dataUrl);
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

    pushUndoSnapshot();
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    ctx.imageSmoothingEnabled = true;
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

  const handleDownloadDrawing = async () => {
    const blob = await flattenCanvasToBlob('image/png');
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
  };

  const handleDrawKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key.toLowerCase();

    // Upload / Save
    if ((e.metaKey || e.ctrlKey) && key === 'o') {
      e.preventDefault();
      openFilePicker();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && key === 's') {
      e.preventDefault();
      void handleDownloadDrawing();
      return;
    }
    // Undo / Redo
    if ((e.metaKey || e.ctrlKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    // Brush size
    if (key === '[') {
      e.preventDefault();
      setBrushSize(v => Math.max(2, v - 1));
      return;
    }
    if (key === ']') {
      e.preventDefault();
      setBrushSize(v => Math.min(40, v + 1));
      return;
    }
    // Tool swaps
    if (key === 'b') { setDrawTool('brush'); return; }
    if (key === 'e') { setDrawTool('eraser'); return; }
    if (key === 'p') { setDrawTool('calligraphy'); return; }
    if (key === 'r') { setDrawTool('square'); return; }
    // Toggles
    if (key === 'g') { setShowGrid(v => !v); return; }
    if (key === 'h') { setSymmetryH(v => !v); return; }
    if (key === 'v') { setSymmetryV(v => !v); return; }
    if (key === 'escape') { setIsDrawMode(false); return; }
  };

  /* ---------- Render ---------- */

  return (
    <div className="app" onKeyDown={handleKeyDown}>
      {/* Inject mobile tokens + layout */}
      <MobileStyles />

      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRegionRef} />

      {/* Hero Mode (unchanged except for small refactors in comments) */}
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

              if (showOriginalSketch) {
                // In refinement hero, prefer the LAST non-original "influence" image only
                if (heroSession && history.length > 0) {
                  const lastIdx = getLastNonOriginalIndex(history);
                  if (lastIdx !== -1) {
                    const src = history[lastIdx]!.imageUrl;
                    return <img src={src} alt="Parent influence" className="hero-main-image" />;
                  }
                  if (stickyCompare) {
                    return <img src={stickyCompare} alt="Compare image" className="hero-main-image" />;
                  }
                }

                // Default: respect current index or sticky compare
                if (history.length > 0 && currentHistoryIndex < history.length) {
                  const currentIteration = history[currentHistoryIndex];
                  if (currentIteration) {
                    const src = currentIteration.imageUrl || stickyCompare;
                    const alt = currentIteration.isOriginalSketch ? 'Original sketch' : `Previous iteration`;
                    return <img src={src} alt={alt} className="hero-main-image" />;
                  }
                }
                if (stickyCompare) {
                  return <img src={stickyCompare} alt="Compare image" className="hero-main-image" />;
                }
              }

              // Default: show the current hero image
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
                <div 
                  className="hero-prompt-text"
                  onClick={openEditModal}
                  style={{ cursor: 'pointer' }}
                  title="Click to edit prompt, style, and ControlNet"
                >
                  <strong>{heroImage.prompt}</strong>
                  <br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', opacity: 0.8 }}>
                    Style: {currentSession?.style || selectedStyle}
                  </span>
                  {currentSession?.isControlnet && (
                    <>
                      <br />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', opacity: 0.8 }}>
                        ControlNet: {controlnetType}
                      </span>
                    </>
                  )}
                  <br />
                  <span style={{ color: '#ff6b35', fontSize: '0.6rem', opacity: 0.8, marginTop: '4px', display: 'block' }}>
                    Click to edit
                  </span>
                </div>
                <button className="hero-prompt-close" onClick={closeHeroMode} aria-label="Close hero view" tabIndex={-1}>
                  ×
                </button>
              </div>
            )}

            {/* Hero session info display (for edited generations) */}
            {heroSession && !heroSession.generating && (
              <div className="hero-prompt-container">
                <div 
                  className="hero-prompt-text"
                  onClick={openEditModal}
                  style={{ cursor: 'pointer' }}
                  title="Click to edit prompt, style, and ControlNet"
                >
                  <strong>{heroSession.basePrompt}</strong>
                  <br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', opacity: 0.8 }}>
                    Style: {heroSession.style}
                  </span>
                  {currentSession?.isControlnet && (
                    <>
                      <br />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', opacity: 0.8 }}>
                        ControlNet: {controlnetType}
                      </span>
                    </>
                  )}
                  <br />
                  <span style={{ color: '#ff6b35', fontSize: '0.6rem', opacity: 0.8, marginTop: '4px', display: 'block' }}>
                    Click to edit
                  </span>
                </div>
                <button className="hero-prompt-close" onClick={closeHeroMode} aria-label="Close hero view" tabIndex={-1}>
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Navigation arrows (non-focusable so spacebar stays global) */}
          <button className="hero-nav hero-nav-left" onClick={() => navigateHero('prev')} aria-label="Previous image" tabIndex={-1}>
            ←
          </button>
          <button className="hero-nav hero-nav-right" onClick={() => navigateHero('next')} aria-label="Next image" tabIndex={-1}>
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

              // In refinement hero, show a clean 2-state helper (parent influence <-> current)
              if (heroSession && (history.length > 0 || stickyCompare)) {
                const lastIdx = getLastNonOriginalIndex(history);
                const hasCompare = lastIdx !== -1 || !!stickyCompare;
                if (hasCompare) {
                  const currentLabel = showOriginalSketch ? 'Parent influence' : 'Current design';
                  const nextLabel = showOriginalSketch ? 'current design' : 'parent influence';
                  return (
                    <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem', color: '#ff6b35' }}>
                      <div style={{ marginBottom: '2px' }}>
                        {currentLabel}
                        <span style={{ opacity: 0.6, marginLeft: '8px' }}>
                          ({showOriginalSketch ? '1' : '2'}/2)
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
                }
              }

              // Original helper (non-hero or no specific influence available)
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
          {/* ======= Desktop Pro Layout ======= */}
          {!isMobile ? (
            <div
              className="draw-pro"
              onKeyDown={handleDrawKeyDown}
              onPaste={handlePaste}
            >
              {/* Top Bar */}
              <div className="topbar">
                <div className="tb-left">
                  <button
                    className="icon-btn"
                    onClick={() => setIsDrawMode(false)}
                    aria-label="Close draw mode"
                    title="Close"
                  >
                    ‹
                  </button>
                  <div className="tb-title">Draw</div>
                </div>
                <div className="tb-center">
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
                    className="vision-input pro"
                  />
                </div>
                <div className="tb-right">
                  <button className="tool-btn" onClick={undo} title="Undo (⌘/Ctrl+Z)">↶</button>
                  <button className="tool-btn" onClick={redo} title="Redo (⌘/Ctrl+Shift+Z)">↷</button>
                  <div className="rail-divider" style={{ width: 1, height: 28, margin: '0 8px' }} />
                  <button className="tool-btn" onClick={openFilePicker} title="Upload image (⌘/Ctrl+O)">⬆️</button>
                  <button className="tool-btn" onClick={handleDownloadDrawing} title="Download PNG (⌘/Ctrl+S)">⬇️</button>
                  <button
                    onClick={handleCreate}
                    disabled={!visionPrompt.trim()}
                    className="create-btn pro"
                    title="Create 16 variations"
                  >
                    Create
                  </button>
                </div>
              </div>

              {/* Left Rail — primary tools */}
              <aside className="left-rail" aria-label="Tools">
                <button
                  className={`tool-btn ${drawTool === 'brush' ? 'active' : ''}`}
                  aria-pressed={drawTool === 'brush'}
                  onClick={() => setDrawTool('brush')}
                  title="Brush (B)"
                >🖌️</button>
                <button
                  className={`tool-btn ${drawTool === 'calligraphy' ? 'active' : ''}`}
                  aria-pressed={drawTool === 'calligraphy'}
                  onClick={() => setDrawTool('calligraphy')}
                  title="Calligraphy Pen (P)"
                >🖋️</button>
                <button
                  className={`tool-btn ${drawTool === 'square' ? 'active' : ''}`}
                  aria-pressed={drawTool === 'square'}
                  onClick={() => setDrawTool('square')}
                  title="Rectangle (R)"
                >⬛</button>
                <button
                  className={`tool-btn ${drawTool === 'eraser' ? 'active' : ''}`}
                  aria-pressed={drawTool === 'eraser'}
                  onClick={() => setDrawTool('eraser')}
                  title="Eraser (E)"
                >🧽</button>

                <div className="rail-divider" />

                {/* Quick color toggles */}
                <button
                  className={`color-btn black ${drawColor === '#000000' ? 'active' : ''}`}
                  onClick={() => setDrawColor('#000000')}
                  title="Black ink"
                >⚫</button>
                <button
                  className={`color-btn white ${drawColor === '#ffffff' ? 'active' : ''}`}
                  onClick={() => setDrawColor('#ffffff')}
                  title="White ink"
                >⚪</button>
              </aside>

              {/* Canvas Region */}
              <main className="canvas-region">
                {/* Hidden input for file picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />

                <div className="canvas-holder">
                  <canvas
                    ref={canvasRef}
                    className="drawing-canvas"
                    onPointerDown={startDrawingPointer}
                    onPointerMove={drawPointer}
                    onPointerUp={endDrawingPointer}
                    onPointerCancel={endDrawingPointer}
                    onDragOver={handleCanvasDragOver}
                    onDragLeave={handleCanvasDragLeave}
                    onDrop={handleCanvasDrop}
                    aria-label="Drawing canvas"
                  />
                  {showGrid && <div className="grid-overlay" />}
                  {(symmetryH || symmetryV) && (
                    <div className={`sym-guides ${symmetryH ? 'h' : ''} ${symmetryV ? 'v' : ''}`} />
                  )}
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

                <div className="shortcut-hint">
                  Tip: ⌘/Ctrl+O to upload, ⌘/Ctrl+S to download, [ / ] to resize brush — you can also paste an image here.
                </div>
              </main>

              {/* Right Properties Panel */}
              <aside className="right-panel">
                <section className="panel-section">
                  <h4>Ink & Size</h4>
                  <div className="row">
                    <button
                      className={`color-btn black ${drawColor === '#000000' ? 'active' : ''}`}
                      onClick={() => setDrawColor('#000000')}
                      title="Black"
                    >⚫</button>
                    <button
                      className={`color-btn white ${drawColor === '#ffffff' ? 'active' : ''}`}
                      onClick={() => setDrawColor('#ffffff')}
                      title="White"
                    >⚪</button>
                  </div>
                  <div className="kv" style={{ marginTop: 10 }}>
                    <label>Brush Size</label>
                    <span>{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="40"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="size-slider"
                    aria-label="Brush size"
                    style={{ width: '100%', marginTop: 8 }}
                  />
                </section>

                <section className="panel-section">
                  <h4>Symmetry & Guides</h4>
                  <div className="row">
                    <button
                      className="tool-btn"
                      aria-pressed={symmetryH}
                      onClick={() => setSymmetryH(v => !v)}
                      title="Horizontal symmetry (H)"
                    >⇆</button>
                    <button
                      className="tool-btn"
                      aria-pressed={symmetryV}
                      onClick={() => setSymmetryV(v => !v)}
                      title="Vertical symmetry (V)"
                    >⇵</button>
                    <button
                      className="tool-btn"
                      aria-pressed={showGrid}
                      onClick={() => setShowGrid(v => !v)}
                      title="Grid (G)"
                    >#️⃣</button>
                    <button
                      className="tool-btn"
                      aria-pressed={smoothBrush}
                      onClick={() => setSmoothBrush(v => !v)}
                      title="Stroke smoothing"
                    >✨</button>
                  </div>
                </section>

                <section className="panel-section">
                  <h4>ControlNet <a
                      href="https://stable-diffusion-art.com/controlnet/"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="What is ControlNet?"
                      style={{ textDecoration: 'none', color: '#fff', opacity: 0.7 }}
                    >
                      (?)
                    </a></h4>
                  <div className="row" style={{ alignItems: 'center' }}>
                    <select
                      value={controlnetType}
                      onChange={(e) => setControlnetType(e.target.value)}
                      className="controlnet-dropdown"
                      title="Select ControlNet type for guidance"
                      style={{ flex: 1, height: 36, borderRadius: 8, border: 'var(--border-soft-dark)', background: 'rgba(255,255,255,0.05)', color: '#f3f5f9', padding: '0 8px' }}
                    >
                      <option value="scribble">scribble</option>
                      <option value="canny">canny</option>
                      <option value="inpaint">inpaint</option>
                      <option value="instrp2p">instrp2p</option>
                      <option value="lineart">lineart</option>
                      <option value="lineartanime">lineartanime</option>
                      <option value="shuffle">shuffle</option>
                      <option value="softedge">softedge</option>
                      <option value="tile">tile</option>
                    </select>
                  </div>
                </section>

                <section className="panel-section">
                  <h4>Canvas</h4>
                  <div className="row">
                    <button className="tool-btn" onClick={openFilePicker} title="Upload image (⌘/Ctrl+O)">⬆️</button>
                    <button className="tool-btn" onClick={handleDownloadDrawing} title="Download PNG (⌘/Ctrl+S)">⬇️</button>
                    <button onClick={clearCanvas} className="clear-btn" title="Clear canvas">🗑️</button>
                  </div>
                </section>
              </aside>
            </div>
          ) : (
          /* ======= Mobile Layout (original, slightly polished) ======= */
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
                <div className="tool-group">
                  <span className="group-label">Tools</span>
                  <button
                    className={`tool-btn ${drawTool === 'brush' ? 'active' : ''}`}
                    aria-pressed={drawTool === 'brush'}
                    onClick={() => setDrawTool('brush')}
                    title="Brush (B)"
                  >
                    🖌️
                  </button>
                  <button
                    className={`tool-btn ${drawTool === 'calligraphy' ? 'active' : ''}`}
                    aria-pressed={drawTool === 'calligraphy'}
                    onClick={() => setDrawTool('calligraphy')}
                    title="Calligraphy Pen (P)"
                  >
                    🖋️
                  </button>
                  <button
                    className={`tool-btn ${drawTool === 'square' ? 'active' : ''}`}
                    aria-pressed={drawTool === 'square'}
                    onClick={() => setDrawTool('square')}
                    title="Rectangle (R)"
                  >
                    ⬛
                  </button>
                  <button
                    className={`tool-btn ${drawTool === 'eraser' ? 'active' : ''}`}
                    aria-pressed={drawTool === 'eraser'}
                    onClick={() => setDrawTool('eraser')}
                    title="Eraser (E)"
                  >
                    🧽
                  </button>
                </div>

                <div className="tool-group">
                  <span className="group-label">Ink</span>
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
                </div>

                <div className="tool-group size-control">
                  <label>Size:</label>
                  <input
                    type="range"
                    min="2"
                    max="40"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="size-slider"
                    aria-label="Brush size"
                  />
                  <span>{brushSize}px</span>
                </div>

                <div className="tool-group toggle-buttons">
                  <span className="group-label">Toggles</span>
                  <button
                    className="tool-btn"
                    aria-pressed={smoothBrush}
                    onClick={() => setSmoothBrush(v => !v)}
                    title="Stroke smoothing"
                  >
                    ✨
                  </button>
                  <button
                    className="tool-btn"
                    aria-pressed={showGrid}
                    onClick={() => setShowGrid(v => !v)}
                    title="Grid (G)"
                  >
                    #️⃣
                  </button>
                </div>

                <div className="tool-group symmetry-buttons">
                  <span className="group-label">Symmetry</span>
                  <button
                    className="tool-btn"
                    aria-pressed={symmetryH}
                    onClick={() => setSymmetryH(v => !v)}
                    title="Horizontal symmetry (H)"
                  >
                    ⇆
                  </button>
                  <button
                    className="tool-btn"
                    aria-pressed={symmetryV}
                    onClick={() => setSymmetryV(v => !v)}
                    title="Vertical symmetry (V)"
                  >
                    ⇵
                  </button>
                </div>

                <div className="tool-group">
                  <span className="group-label">ControlNet</span>
                  <div className="controlnet-control" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label title="Understanding controlnets">
                      <a
                        href="https://stable-diffusion-art.com/controlnet/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="controlnet-help"
                        style={{ textDecoration: 'none', color: '#fff', opacity: 0.7 }}
                      >
                        (?)
                      </a>
                    </label>
                    <select
                      value={controlnetType}
                      onChange={(e) => setControlnetType(e.target.value)}
                      className="controlnet-dropdown"
                      title="Select ControlNet type for guidance"
                    >
                      <option value="scribble">scribble</option>
                      <option value="canny">canny</option>
                      <option value="inpaint">inpaint</option>
                      <option value="instrp2p">instrp2p</option>
                      <option value="lineart">lineart</option>
                      <option value="lineartanime">lineartanime</option>
                      <option value="shuffle">shuffle</option>
                      <option value="softedge">softedge</option>
                      <option value="tile">tile</option>
                    </select>
                  </div>
                </div>

                <div className="tool-group undo-redo-buttons">
                  <span className="group-label">History</span>
                  <button className="tool-btn" onClick={undo} title="Undo (⌘/Ctrl+Z)">↶</button>
                  <button className="tool-btn" onClick={redo} title="Redo (⌘/Ctrl+Shift+Z)">↷</button>
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

              {/* Canvas with DnD & overlays */}
              <div className="drawing-canvas-wrapper">
                <canvas
                  ref={canvasRef}
                  className="drawing-canvas"
                  onPointerDown={startDrawingPointer}
                  onPointerMove={drawPointer}
                  onPointerUp={endDrawingPointer}
                  onPointerCancel={endDrawingPointer}
                  onDragOver={handleCanvasDragOver}
                  onDragLeave={handleCanvasDragLeave}
                  onDrop={handleCanvasDrop}
                  aria-label="Drawing canvas"
                />
                {showGrid && <div className="grid-overlay" />}
                {(symmetryH || symmetryV) && (
                  <div className={`sym-guides ${symmetryH ? 'h' : ''} ${symmetryV ? 'v' : ''}`} />
                )}
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
          )}
        </div>
      )}

      {/* Main Mode (unchanged, minor cosmetics only in comments) */}
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

      {/* Edit Modal */}
      {showEditModal && (
        <div className="edit-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Edit Generation Parameters</h3>
              <button onClick={() => setShowEditModal(false)} className="edit-modal-close">×</button>
            </div>
            
            <div className="edit-modal-content">
              <div className="edit-field">
                <label>Prompt:</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="edit-prompt-input"
                  rows={3}
                  placeholder="Describe your tattoo idea..."
                />
              </div>

              <div className="edit-field">
                <label>Style:</label>
                <input
                  type="text"
                  value={editStyle}
                  onChange={(e) => setEditStyle(e.target.value)}
                  className="edit-style-input"
                  placeholder="e.g. Japanese Irezumi, Neo-Traditional, etc."
                />
              </div>

              {currentSession?.isControlnet && (
                <div className="edit-field">
                  <label>ControlNet Type:</label>
                  <select
                    value={editControlnetType}
                    onChange={(e) => setEditControlnetType(e.target.value)}
                    className="edit-controlnet-select"
                  >
                    <option value="scribble">scribble</option>
                    <option value="canny">canny</option>
                    <option value="inpaint">inpaint</option>
                    <option value="instrp2p">instrp2p</option>
                    <option value="lineart">lineart</option>
                    <option value="lineartanime">lineartanime</option>
                    <option value="shuffle">shuffle</option>
                    <option value="softedge">softedge</option>
                    <option value="tile">tile</option>
                  </select>
                </div>
              )}
            </div>

            <div className="edit-modal-actions">
              <button onClick={() => setShowEditModal(false)} className="edit-cancel-btn">
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (editPrompt.trim()) {
                    setControlnetType(editControlnetType);
                    if (currentSession?.isControlnet) {
                      startHeroGeneration(editPrompt.trim(), editStyle, '', undefined, true, heroImage?.url);
                    } else {
                      startHeroGeneration(editPrompt.trim(), editStyle, '');
                    }
                    setShowEditModal(false);
                  }
                }}
                disabled={!editPrompt.trim()}
                className="edit-generate-btn"
              >
                Generate 16 Variations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
