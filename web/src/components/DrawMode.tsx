// web/src/components/DrawMode.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HISTORY_LIMIT, MAX_DPR } from '../constants';
import './MobileDrawStyles.css';
import PreprocessModal from './PreprocessModal';

type DrawModeProps = {
  isMobile: boolean;
  onClose: () => void;
  onCreate: (payload: {
    prompt: string;
    style: string;
    controlnetType: string;
    controlBlob: Blob;
    sketchDataUrl: string;
  }) => void;
  announce?: (msg: string) => void;
  defaultControlnetType?: string;
  initialImage?: { url: string; prompt: string } | null;
};

type PendingImport = {
  img: HTMLImageElement;
  scale: number;
  minScale: number;
  maxScale: number;
  baseScale: number;
  centerX: number;
  centerY: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const resolveApiUrl = (path: string) => {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
};

const getCanvas2DContext = (
  canvas: HTMLCanvasElement | null,
  options?: CanvasRenderingContext2DSettings
): CanvasRenderingContext2D | null => {
  if (!canvas) return null;
  const context = options ? canvas.getContext('2d', options) : canvas.getContext('2d');
  return context && 'getImageData' in context ? context : null;
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    const reject = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'range']);
    return !reject.has(target.type?.toLowerCase?.() || '');
  }
  return false;
};

/**
 * Draw Mode component (desktop "pro" and mobile layouts)
 *
 * ✅ Pointer capture + off-canvas persistence
 * ✅ Square DPR canvas (MAX_DPR)
 * ✅ Tools: brush, calligraphy, square, circle, eraser
 * ✅ Symmetry (H/V), grid, undo/redo, invert
 * ✅ Upload / paste / drag-drop / download
 * ✅ Prompt enhancer button
 *
 * ✨ New (Oct 2025): optional preprocessing step (B/W + high contrast + posterize)
 *    shown immediately after a user uploads/drops/pastes an image into the canvas.
 */
export default function DrawMode({
  isMobile,
  onClose,
  onCreate,
  announce,
  defaultControlnetType = 'scribble',
  initialImage = null
}: DrawModeProps) {
  // Prompt - initialize with the prompt from initialImage if provided
  const [visionPrompt, setVisionPrompt] = useState(initialImage?.prompt || '');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  // Tools
  const [brushSize, setBrushSize] = useState(8);
  const [drawColor, setDrawColor] = useState('#000000');
  const [drawTool, setDrawTool] = useState<'brush' | 'square' | 'circle' | 'calligraphy' | 'eraser' | 'lasso'>('brush');
  const [smoothBrush, setSmoothBrush] = useState(false);
  const [symmetryH, setSymmetryH] = useState(false);
  const [symmetryV, setSymmetryV] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [controlnetType, setControlnetType] = useState(defaultControlnetType);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    pixelWidth: 1024,
    pixelHeight: 1024,
    cssWidth: 1024,
    cssHeight: 1024
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [baseImageData, setBaseImageData] = useState<ImageData | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isOutsideCanvas, setIsOutsideCanvas] = useState(false);

  // Undo/Redo history
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  // Prompt field indicator for mobile
  const [showPromptHint, setShowPromptHint] = useState(false);

  // Calligraphy extras
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [drips, setDrips] = useState<
    Array<{ id: number; x: number; y: number; length: number; speed: number; alpha: number }>
  >([]);
  const dripCounter = useRef(0);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const pendingImportRef = useRef<PendingImport | null>(null);
  const importBaseImageRef = useRef<ImageData | null>(null);
  const importDragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    baseCenterX: number;
    baseCenterY: number;
  }>({ active: false, pointerId: null, startX: 0, startY: 0, baseCenterX: 0, baseCenterY: 0 });

  // Brush smoothing helpers
  const brushPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPressureRef = useRef<number>(1);
  const activePointerIdRef = useRef<number | null>(null);

  // Lasso selection
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);
  const lassoPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const [finalLasso, setFinalLasso] = useState<Array<{ x: number; y: number }> | null>(null);
  const [showLassoPrompt, setShowLassoPrompt] = useState(false);
  const [lassoPrompt, setLassoPrompt] = useState('');
  const [isSubmittingLasso, setIsSubmittingLasso] = useState(false);

  // ===== Preprocess modal state =====
  const [showPreprocess, setShowPreprocess] = useState(false);
  const lastLoadWasUserUploadRef = useRef(false); // true only for file/drag/paste loads
  const PREPROCESS_DEFAULTS = useRef({ levels: 3, contrast: 0.8 });

  // -------- Utilities --------

  const resizeCanvasToDisplaySize = useCallback((preserve = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use clientWidth/clientHeight to exclude borders (works for both desktop and mobile)
    const cssWidth = canvas.clientWidth || 1;
    const cssHeight = canvas.clientHeight || cssWidth;
    const cssSide = Math.max(1, Math.floor(cssWidth));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const target = Math.max(1, Math.floor(cssSide * dpr));

    if (canvas.width === target && canvas.height === target) {
      setCanvasDimensions(prev => {
        const next = {
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          cssWidth: cssWidth,
          cssHeight: cssHeight
        };
        if (
          prev.pixelWidth === next.pixelWidth &&
          prev.pixelHeight === next.pixelHeight &&
          prev.cssWidth === next.cssWidth &&
          prev.cssHeight === next.cssHeight
        ) {
          return prev;
        }
        return next;
      });
      return;
    }

    let prevUrl: string | null = null;
    if (preserve) {
      try { prevUrl = canvas.toDataURL('image/png'); } catch { prevUrl = null; }
    }

    canvas.width = target;
    canvas.height = target;
    setCanvasDimensions({
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      cssWidth: cssWidth,
      cssHeight: cssHeight
    });

    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (prevUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = prevUrl;
    }

    // reset transient effects
    setDrips([]);
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => resizeCanvasToDisplaySize(false));
    const onResize = () => resizeCanvasToDisplaySize(true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [resizeCanvasToDisplaySize]);

  useEffect(() => {
    pendingImportRef.current = pendingImport;
    if (!pendingImport) {
      importDragRef.current.active = false;
      importDragRef.current.pointerId = null;
    }
  }, [pendingImport]);

  useEffect(() => {
    lassoPointsRef.current = lassoPoints;
  }, [lassoPoints]);

  // Load initial image if provided (from "Edit Image" flow).
  // We *do not* prompt for preprocessing here by default; that prompt is intended
  // for user uploads/drops/pastes. You can opt in by flipping the ref below
  // if you want to preprocess AI images too.
  useEffect(() => {
    if (!initialImage?.url) return;

    const timer = setTimeout(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = getCanvas2DContext(canvas);
        if (!ctx) return;

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
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, dx, dy, dw, dh);

        announce?.('Image loaded into canvas');

        // Save initial state to undo stack
        try {
          const imageData = ctx.getImageData(0, 0, cw, ch);
          setUndoStack([imageData]);
        } catch {
          // ignore
        }

        // If you want to also prompt when an AI image is brought into Draw Mode,
        // uncomment the following two lines:
        // lastLoadWasUserUploadRef.current = true;
        // setShowPreprocess(true);
      };

      img.onerror = () => {
        announce?.('Failed to load image');
      };

      img.src = initialImage.url;
    }, 300);

    return () => clearTimeout(timer);
  }, [initialImage, announce]);

  const midpoint = (p1: { x: number; y: number }, p2: { x: number; y: number }) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  });

  const withSymmetryPoints = (p: { x: number; y: number }) => {
    const canvas = canvasRef.current!;
    const w = canvas.width;
    const h = canvas.height;
    const list = [{ x: p.x, y: p.y }];
    if (symmetryV) list.push({ x: w - p.x, y: p.y });
    if (symmetryH) list.push({ x: p.x, y: h - p.y });
    if (symmetryH && symmetryV) list.push({ x: w - p.x, y: h - p.y });
    const key = (pt: { x: number; y: number }) => `${Math.round(pt.x)}|${Math.round(pt.y)}`;
    const seen = new Set<string>();
    const uniq: Array<{ x: number; y: number }> = [];
    for (const pt of list) {
      const k = key(pt);
      if (!seen.has(k)) { seen.add(k); uniq.push(pt); }
    }
    return uniq;
  };

  const tracePolygon = (ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) => {
    if (!points.length) return false;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    return true;
  };

  const getCanvasCoordsFromClient = (clientX: number, clientY: number, clampToBounds = false) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const rawX = (clientX - rect.left) * scaleX;
    const rawY = (clientY - rect.top) * scaleY;
    if (!clampToBounds && (rawX < 0 || rawX > canvas.width || rawY < 0 || rawY > canvas.height)) return null;
    const x = Math.max(0, Math.min(canvas.width, rawX));
    const y = Math.max(0, Math.min(canvas.height, rawY));
    return { x, y };
  };

  const lassoPathData = useMemo(() => {
    const { pixelWidth, pixelHeight } = canvasDimensions;
    if (!pixelWidth || !pixelHeight) return '';
    const pts = finalLasso ?? (drawTool === 'lasso' && lassoPoints.length > 1 ? lassoPoints : null);
    if (!pts || pts.length < 2) return '';
    // Use raw pixel coordinates - no scaling needed since viewBox matches canvas pixel dimensions
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x} ${pts[i].y}`;
    }
    path += ' Z';
    return path;
  }, [canvasDimensions, finalLasso, drawTool, lassoPoints]);

  const hasFinalLasso = !!finalLasso;

  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
    try {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setUndoStack(prev => {
        const next = [...prev, snap];
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
      });
      setRedoStack([]);
    } catch {/* ignore */}
  }, []);

  const applyImageData = (img: ImageData | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) {
      return;
    }
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) {
      return;
    }
    ctx.putImageData(img, 0, 0);
    setDrips([]);
  };

  // ===== Preprocess pipeline =====
  const preprocessCanvasForControlnet = useCallback((levels = 3, contrastStrength = 0.8) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas, { willReadFrequently: true });
    if (!ctx) return;

    // Snapshot so user can undo preprocessing
    pushUndoSnapshot();

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }
    const data = imageData.data;

    // Contrast coefficient C: [0..255]
    const C = Math.max(0, Math.min(255, Math.round(contrastStrength * 255)));
    // Standard contrast formula
    const factor = (259 * (C + 255)) / (255 * (259 - C) || 1);

    // Posterize levels
    const L = Math.max(2, Math.min(6, Math.floor(levels)));
    const step = 255 / (L - 1);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Luminance-based grayscale (sRGB weights)
      let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Contrast boost around mid‑point
      y = factor * (y - 128) + 128;
      if (y < 0) y = 0;
      else if (y > 255) y = 255;

      // Posterize to L gray levels
      const q = Math.round(y / step) * step;

      data[i] = data[i + 1] = data[i + 2] = q;
      data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    setDrips([]);
    announce?.('Image preprocessed for ControlNets');
  }, [announce, pushUndoSnapshot]);

  const undo = () => {
    if (pendingImportRef.current) {
      cancelPendingImport();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;


    // Check if there's anything to undo
    if (undoStack.length === 0) {
      return;
    }

    try {
      // Get current state and last undo state
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const last = undoStack[undoStack.length - 1];


      // Update both stacks
      setRedoStack(prev => [...prev, current].slice(-HISTORY_LIMIT));
      setUndoStack(prev => prev.slice(0, -1));

      // Apply the restored state
      applyImageData(last);

    } catch (err) {
      console.error('[DrawMode] Undo failed:', err);
    }
  };

  const redo = () => {
    if (pendingImportRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;


    // Check if there's anything to redo
    if (redoStack.length === 0) {
      return;
    }

    try {
      // Get current state and last redo state
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const last = redoStack[redoStack.length - 1];


      // Update both stacks
      setUndoStack(prev => [...prev, current].slice(-HISTORY_LIMIT));
      setRedoStack(prev => prev.slice(0, -1));

      // Apply the restored state
      applyImageData(last);

    } catch (err) {
      console.error('[DrawMode] Redo failed:', err);
    }
  };

  const drawQuadraticSegment = (
    ctx: CanvasRenderingContext2D,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
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
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;

    const composite: GlobalCompositeOperation = drawTool === 'eraser' ? 'destination-out' : 'source-over';
    const baseWidth = brushSize;
    const pressureWidth = Number.isFinite(pressureNow) && pressureNow > 0
      ? Math.max(0.3, pressureNow) * baseWidth
      : baseWidth;

    if (!smoothBrush) {
      const prev = lastBrushPointRef.current || current;
      const dx = current.x - prev.x;
      const dy = current.y - prev.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(1, pressureWidth * 0.5);
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

    // Smoothing path (quadratic)
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
    if (pendingImportRef.current) {
      handleImportPointerDown(e);
      return;
    }
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;

    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    activePointerIdRef.current = e.pointerId;

    const coords = getCanvasCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return;

    setIsDrawing(true);
    setIsOutsideCanvas(false);

    if (drawTool === 'lasso') {
      setLassoPoints([coords]);
      setFinalLasso(null);
      setShowLassoPrompt(false);
      setLassoPrompt('');
      return;
    }

    pushUndoSnapshot();

    const { x, y } = coords;

    if (drawTool === 'brush' || drawTool === 'eraser') {
      lastPressureRef.current = e.pressure || 1;
      lastBrushPointRef.current = { x, y };
      brushPointsRef.current = [{ x, y }];

      const width = Math.max(1, (e.pressure || 1) * brushSize);
      const composite: GlobalCompositeOperation = drawTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = composite;
      ctx.fillStyle = drawTool === 'eraser' ? '#000' : drawColor;
      ctx.beginPath();
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

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
    } else if (drawTool === 'square' || drawTool === 'circle') {
      setStartPos({ x, y });
      setBaseImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } else if (drawTool === 'calligraphy') {
      setLastPos({ x, y });
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const processSquare = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
    const coords = getCanvasCoordsFromClient(clientX, clientY, true);
    if (!coords) return;
    if (!(drawTool === 'square' && startPos && baseImageData)) return;
    ctx.putImageData(baseImageData, 0, 0);
    ctx.fillStyle = drawColor;

    const width = coords.x - startPos.x;
    const height = coords.y - startPos.y;
    ctx.fillRect(startPos.x, startPos.y, width, height);

    if (symmetryH || symmetryV) {
      const w = canvas.width;
      const h = canvas.height;
      const rects: Array<{ sx:number; sy:number; ex:number; ey:number }> = [
        { sx: startPos.x, sy: startPos.y, ex: coords.x, ey: coords.y }
      ];
      if (symmetryV) rects.push({ sx: w - startPos.x, sy: startPos.y, ex: w - coords.x, ey: coords.y });
      if (symmetryH) rects.push({ sx: startPos.x, sy: h - startPos.y, ex: coords.x, ey: h - coords.y });
      if (symmetryH && symmetryV) rects.push({ sx: w - startPos.x, sy: h - startPos.y, ex: w - coords.x, ey: h - coords.y });
      rects.forEach((r, idx) => {
        if (idx === 0) return;
        const rw = r.ex - r.sx;
        const rh = r.ey - r.sy;
        ctx.fillRect(r.sx, r.sy, rw, rh);
      });
    }
  };

  const processCircle = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
    const coords = getCanvasCoordsFromClient(clientX, clientY, true);
    if (!coords) return;
    if (!(drawTool === 'circle' && startPos && baseImageData)) return;
    ctx.putImageData(baseImageData, 0, 0);
    ctx.fillStyle = drawColor;

    const dx = coords.x - startPos.x;
    const dy = coords.y - startPos.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    ctx.beginPath();
    ctx.arc(startPos.x, startPos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    const w = canvas.width;
    const h = canvas.height;
    if (symmetryV) { ctx.beginPath(); ctx.arc(w - startPos.x, startPos.y, radius, 0, Math.PI * 2); ctx.fill(); }
    if (symmetryH) { ctx.beginPath(); ctx.arc(startPos.x, h - startPos.y, radius, 0, Math.PI * 2); ctx.fill(); }
    if (symmetryH && symmetryV) { ctx.beginPath(); ctx.arc(w - startPos.x, h - startPos.y, radius, 0, Math.PI * 2); ctx.fill(); }
  };

  const processCalligraphy = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
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

    drawCalPoly(lastPos.x, lastPos.y, x, y);

    const w = canvas.width;
    const h = canvas.height;
    if (symmetryV) drawCalPoly(w - lastPos.x, lastPos.y, w - x, y);
    if (symmetryH) drawCalPoly(lastPos.x, h - lastPos.y, x, h - y);
    if (symmetryH && symmetryV) drawCalPoly(w - lastPos.x, h - lastPos.y, w - x, h - y);

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

  const drawPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pendingImportRef.current) {
      handleImportPointerMove(e);
      return;
    }
    if (!isDrawing) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;

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

      if (!coords) {
        if (!isOutsideCanvas) {
          setIsOutsideCanvas(true);
          lastBrushPointRef.current = null;
          brushPointsRef.current = [];
          ctx.beginPath();
        }
        return;
      }

      if (isOutsideCanvas) {
        setIsOutsideCanvas(false);
        lastBrushPointRef.current = { x: coords.x, y: coords.y };
        brushPointsRef.current = [{ x: coords.x, y: coords.y }];
        return;
      }

      lastPressureRef.current = pressure || lastPressureRef.current || 1;
      drawBrushSegment({ x: coords.x, y: coords.y }, lastPressureRef.current);
    };

    if (drawTool === 'brush' || drawTool === 'eraser') {
      for (const ev of events) processBrushOrEraser(ev.clientX, ev.clientY, ev.pressure ?? 1);
      return;
    }
    if (drawTool === 'lasso') {
      const last = events[events.length - 1];
      const coords = getCanvasCoordsFromClient(last.clientX, last.clientY, true);
      if (!coords) return;
      setLassoPoints(prev => {
        if (prev.length === 0) return prev;
        const p = prev[prev.length - 1];
        const dx = coords.x - p.x;
        const dy = coords.y - p.y;
        if (dx * dx + dy * dy < 9) return prev;
        return [...prev, coords];
      });
      return;
    }
    if (drawTool === 'square') {
      const last = events[events.length - 1];
      processSquare(last.clientX, last.clientY);
      return;
    }
    if (drawTool === 'circle') {
      const last = events[events.length - 1];
      processCircle(last.clientX, last.clientY);
      return;
    }
    if (drawTool === 'calligraphy') {
      for (const ev of events) processCalligraphy(ev.clientX, ev.clientY);
      return;
    }
  };

  const endDrawingPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pendingImportRef.current) {
      handleImportPointerUp(e);
      return;
    }
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    activePointerIdRef.current = null;

    if (drawTool === 'lasso') {
      const points = lassoPointsRef.current;
      if (points.length >= 3) {
        const copy = points.map(p => ({ x: p.x, y: p.y }));
        setFinalLasso(copy);
        setLassoPoints([]);
        setShowLassoPrompt(true);
        setLassoPrompt('');
        setControlnetType('inpaint');
        announce?.('Describe how you want to change the selected area');
      } else {
        if (points.length > 0) {
          announce?.('Selection needs at least three points');
        }
        setFinalLasso(null);
        setLassoPoints([]);
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setBaseImageData(null);
    setLastPos(null);
    setIsOutsideCanvas(false);
    brushPointsRef.current = [];
    lastBrushPointRef.current = null;
  };

  // Drips animator (calligraphy effect)
  useEffect(() => {
    if (drips.length === 0) return;
    const timer = setInterval(() => {
      setDrips(prevDrips => {
        const canvas = canvasRef.current;
        if (!canvas) return prevDrips;
        const ctx = getCanvas2DContext(canvas);
        if (!ctx) return prevDrips;

        const updated = prevDrips
          .map(d => ({ ...d, y: d.y + d.speed, alpha: d.alpha - 0.01, length: d.length + 0.2 }))
          .filter(d => d.alpha > 0);

        ctx.save();
        updated.forEach(d => {
          ctx.globalAlpha = d.alpha;
          ctx.fillStyle = drawColor;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, 1, d.length / 2, 0, 0, 2 * Math.PI);
          ctx.fill();
        });
        ctx.restore();
        return updated;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [drips.length, drawColor]);

  const clearCanvas = () => {
    if (pendingImportRef.current) {
      cancelPendingImport();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
    pushUndoSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDrips([]);
  };

  const invertCanvas = () => {
    if (pendingImportRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
    pushUndoSnapshot();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const flattenCanvasToBlob = async (type: 'image/png' = 'image/png'): Promise<Blob | null> => {
    const src = canvasRef.current;
    if (!src) return null;
    const off = document.createElement('canvas');
    off.width = src.width;
    off.height = src.height;
    const octx = getCanvas2DContext(off);
    if (!octx) return null;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, off.width, off.height);
    octx.drawImage(src, 0, 0);
    return await new Promise<Blob | null>(resolve => off.toBlob(b => resolve(b), type));
  };

  const exportLassoSelection = async (
    polygon: Array<{ x: number; y: number }>,
    type: 'image/png' = 'image/png'
  ): Promise<{ blob: Blob | null; dataUrl: string | null }> => {
    const canvas = canvasRef.current;
    if (!canvas || polygon.length < 3) return { blob: null, dataUrl: null };
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = getCanvas2DContext(off);
    if (!ctx) return { blob: null, dataUrl: null };
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    if (tracePolygon(ctx, polygon)) {
      ctx.fill();
    }
    ctx.restore();

    const blob = await new Promise<Blob | null>(resolve => off.toBlob(b => resolve(b), type));
    if (!blob) return { blob: null, dataUrl: null };

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(blob);
    });

    return { blob, dataUrl };
  };

  const applyInpaintResult = useCallback(
    async (resultBlob: Blob) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not ready');
      const ctx = getCanvas2DContext(canvas);
      if (!ctx) throw new Error('Canvas context unavailable');

      const drawFromImageElement = () =>
        new Promise<void>((resolve, reject) => {
          const url = URL.createObjectURL(resultBlob);
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            try {
              pushUndoSnapshot();
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              setDrips([]);
              resolve();
            } finally {
              URL.revokeObjectURL(url);
            }
          };
          img.onerror = () => {
            console.error('[DrawMode] Image load failed');
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load inpaint result image'));
          };
          img.src = url;
        });

      let applied = false;
      if (typeof window !== 'undefined' && 'createImageBitmap' in window && typeof window.createImageBitmap === 'function') {
        try {
          const bitmap = await createImageBitmap(resultBlob);
          pushUndoSnapshot();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          setDrips([]);
          if (typeof bitmap.close === 'function') {
            bitmap.close();
          }
          applied = true;
        } catch (err) {
          console.warn('[DrawMode] createImageBitmap failed, falling back to Image()', err);
        }
      }

      if (!applied) {
        await drawFromImageElement();
      }
    },
    [pushUndoSnapshot]
  );

  const waitForInpaintResult = useCallback((projectId: string) => {
    return new Promise<Blob>((resolve, reject) => {
      let settled = false;
      const es = new EventSource(resolveApiUrl(`/api/progress/${projectId}`));

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        try {
          es.close();
        } catch {/* ignore */}
        reject(error);
      };

      es.onmessage = async (evt) => {
        if (settled) return;
        let data: any;
        try {
          data = JSON.parse(evt.data);
        } catch {
          return;
        }
        if (!data) return;


        if (data.type === 'jobCompleted') {
          if (data.job?.isNSFW) {
            fail(new Error('Inpaint result flagged as unsafe'));
            return;
          }
          const resultPath: string | undefined = data.proxyUrl || data.job?.resultUrl;
          if (!resultPath) {
            fail(new Error('Missing inpaint result URL'));
            return;
          }

          settled = true;
          try {
            es.close();
          } catch {/* ignore */}

          try {
            const response = await fetch(resolveApiUrl(resultPath));
            if (!response.ok) {
              reject(new Error(`Failed to download inpaint result (${response.status})`));
              return;
            }
            const blob = await response.blob();
            resolve(blob);
          } catch (err) {
            console.error('[DrawMode] Fetch error:', err);
            reject(err instanceof Error ? err : new Error('Failed to download inpaint result'));
          }
          return;
        }

        if (data.type === 'error' || data.type === 'jobFailed' || data.type === 'failed') {
          fail(new Error(data.error || 'Inpaint failed to generate'));
          return;
        }

        // Ignore 'completed' event - we already got the result from 'jobCompleted'
        if (data.type === 'completed') {
          return;
        }
      };

      es.onerror = () => {
        fail(new Error('Connection lost while waiting for inpaint result'));
      };
    });
  }, []);

  // I/O: upload / paste / drag
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFilePicker = () => fileInputRef.current?.click();

  const cancelLassoSelection = useCallback(() => {
    setIsSubmittingLasso(false);
    setShowLassoPrompt(false);
    setFinalLasso(null);
    setLassoPrompt('');
    setLassoPoints([]);
  }, []);

  useEffect(() => {
    if (!isDrawing) return;
    const handleUp = (evt: PointerEvent) => {
      const canvas = canvasRef.current as any;
      const id = activePointerIdRef.current;
      if (canvas && typeof canvas.releasePointerCapture === 'function' && id != null) {
        try { canvas.releasePointerCapture(id); } catch {}
      }
      activePointerIdRef.current = null;
      if (evt.type === 'pointercancel' && drawTool === 'lasso') {
        cancelLassoSelection();
      }
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
  }, [cancelLassoSelection, drawTool, isDrawing]);

  const handleConfirmLasso = useCallback(
    async (evt?: React.FormEvent<HTMLFormElement>) => {
      evt?.preventDefault();
      if (!finalLasso || finalLasso.length < 3) {
        announce?.('Select an area with the lasso first');
        return;
      }
      const trimmedPrompt = lassoPrompt.trim();
      if (!trimmedPrompt) {
        announce?.('Describe what you want to change in the selected area');
        return;
      }
      if (isSubmittingLasso) return;

      setIsSubmittingLasso(true);
      setControlnetType('inpaint');

      try {
        announce?.('Submitting selection for inpainting…');
        const { blob } = await exportLassoSelection(finalLasso, 'image/png');
        if (!blob) {
          throw new Error('Could not prepare the inpaint selection');
        }

        const form = new FormData();
        form.append('prompt', trimmedPrompt);
        form.append('title', trimmedPrompt);
        form.append('style', 'Simple Ink');
        form.append('controlnetType', 'inpaint');
        form.append('numberOfImages', '1');
        form.append('controlImage', blob, 'lasso-selection.png');

        const response = await fetch(resolveApiUrl('/api/generate-controlnet'), {
          method: 'POST',
          body: form
        });

        if (!response.ok) {
          let message = 'Failed to start inpainting';
          try {
            const data = await response.json();
            if (data?.error) {
              message = data.error;
            }
          } catch {
            const text = await response.text();
            if (text) message = text;
          }
          throw new Error(message);
        }

        const payload = await response.json();
        const projectId = payload?.projectId;
        if (!projectId) {
          throw new Error('Missing project reference for inpainting');
        }

        const resultBlob = await waitForInpaintResult(String(projectId));
        if (!isMountedRef.current) {
          return;
        }
        await applyInpaintResult(resultBlob);

        if (isMountedRef.current) {
          setVisionPrompt(trimmedPrompt);
          cancelLassoSelection();
        }
        announce?.('Selection updated');
      } catch (err) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Failed to inpaint selection';
        announce?.(message);
      } finally {
        if (isMountedRef.current) {
          setIsSubmittingLasso(false);
        }
      }
    },
    [
      announce,
      applyInpaintResult,
      cancelLassoSelection,
      exportLassoSelection,
      finalLasso,
      isSubmittingLasso,
      lassoPrompt,
      setControlnetType,
      setVisionPrompt,
      waitForInpaintResult
    ]
  );

  const drawImageContain = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;

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
  };

  const renderPendingImport = useCallback((state: PendingImport) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const destW = state.img.naturalWidth * state.scale;
    const destH = state.img.naturalHeight * state.scale;
    const dx = state.centerX - destW / 2;
    const dy = state.centerY - destH / 2;
    ctx.drawImage(state.img, dx, dy, destW, destH);
  }, []);

  const beginImagePlacement = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCanvas2DContext(canvas);
    if (!ctx) return;

    try {
      importBaseImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      importBaseImageRef.current = null;
    }

    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const containScale = Math.min(canvas.width / iw, canvas.height / ih) || 1;
    const baseScale = containScale || 1;
    const minScale = Math.max(baseScale * 0.25, 0.05);
    const maxScale = Math.max(baseScale * 6, baseScale * 1.5);

    setIsDrawing(false);
    setStartPos(null);
    setBaseImageData(null);
    setLastPos(null);
    setIsOutsideCanvas(false);
    brushPointsRef.current = [];
    lastBrushPointRef.current = null;
    lastPressureRef.current = 1;
    activePointerIdRef.current = null;
    setDrips([]);

    const initialState: PendingImport = {
      img,
      scale: baseScale,
      minScale,
      maxScale,
      baseScale,
      centerX: canvas.width / 2,
      centerY: canvas.height / 2
    };

    pendingImportRef.current = initialState;
    setPendingImport(initialState);
    renderPendingImport(initialState);

    announce?.('Image loaded — drag to position, scroll to zoom, Enter to place');
  }, [announce, getCanvas2DContext]);

  useEffect(() => {
    if (pendingImport) {
      renderPendingImport(pendingImport);
    }
  }, [pendingImport, renderPendingImport]);

  const commitPendingImport = useCallback(() => {
    if (!pendingImportRef.current) return;
    pushUndoSnapshot();
    setPendingImport(null);
    pendingImportRef.current = null;
    importBaseImageRef.current = null;
    lastLoadWasUserUploadRef.current = true;
    setShowPreprocess(true);
    announce?.('Image placed on canvas');
  }, [announce, pushUndoSnapshot, setShowPreprocess]);

  const cancelPendingImport = useCallback(() => {
    const base = importBaseImageRef.current;
    importBaseImageRef.current = null;
    setPendingImport(null);
    pendingImportRef.current = null;
    if (base) applyImageData(base);
    announce?.('Image placement canceled');
  }, [announce, applyImageData]);

  const setImportScale = useCallback((nextScale: number) => {
    setPendingImport(prev => {
      if (!prev) return prev;
      const clamped = Math.max(prev.minScale, Math.min(prev.maxScale, nextScale));
      if (clamped === prev.scale) return prev;
      return { ...prev, scale: clamped };
    });
  }, []);

  const handleImportScaleRatio = useCallback((ratio: number) => {
    const current = pendingImportRef.current;
    if (!current) return;
    setImportScale(current.baseScale * ratio);
  }, [setImportScale]);

  const adjustImportScale = useCallback((multiplier: number) => {
    setPendingImport(prev => {
      if (!prev) return prev;
      const clamped = Math.max(prev.minScale, Math.min(prev.maxScale, prev.scale * multiplier));
      if (clamped === prev.scale) return prev;
      return { ...prev, scale: clamped };
    });
  }, []);

  const nudgePendingImport = useCallback((dx: number, dy: number) => {
    setPendingImport(prev => {
      if (!prev) return prev;
      if (dx === 0 && dy === 0) return prev;
      return { ...prev, centerX: prev.centerX + dx, centerY: prev.centerY + dy };
    });
  }, []);

  const handleImportPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pendingImportRef.current) return false;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    importDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseCenterX: pendingImportRef.current.centerX,
      baseCenterY: pendingImportRef.current.centerY
    };
    return true;
  };

  const handleImportPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pending = pendingImportRef.current;
    if (!pending) return true;
    const drag = importDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return true;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = (e.clientX - drag.startX) * scaleX;
    const dy = (e.clientY - drag.startY) * scaleY;
    setPendingImport(prev => {
      if (!prev) return prev;
      return { ...prev, centerX: drag.baseCenterX + dx, centerY: drag.baseCenterY + dy };
    });
    return true;
  };

  const handleImportPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = importDragRef.current;
    if (drag.pointerId === e.pointerId) {
      drag.active = false;
      drag.pointerId = null;
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    return !!pendingImportRef.current;
  };

  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!pendingImportRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pointerX = (e.clientX - rect.left) * scaleX;
    const pointerY = (e.clientY - rect.top) * scaleY;
    setPendingImport(prev => {
      if (!prev) return prev;
      const zoomFactor = Math.pow(1.05, -e.deltaY / 53);
      let nextScale = prev.scale * zoomFactor;
      nextScale = Math.max(prev.minScale, Math.min(prev.maxScale, nextScale));
      if (nextScale === prev.scale) return prev;
      const ratio = nextScale / prev.scale;
      const nextCenterX = pointerX - (pointerX - prev.centerX) * ratio;
      const nextCenterY = pointerY - (pointerY - prev.centerY) * ratio;
      return { ...prev, scale: nextScale, centerX: nextCenterX, centerY: nextCenterY };
    });
  }, []);

  const renderImportOverlay = useCallback(() => {
    if (!pendingImport) return null;
    const sliderMin = pendingImport.minScale / pendingImport.baseScale;
    const sliderMax = pendingImport.maxScale / pendingImport.baseScale;
    const sliderValue = pendingImport.scale / pendingImport.baseScale;
    const sliderStep = Math.max((sliderMax - sliderMin) / 200, 0.01);
    const percent = Math.round(sliderValue * 100);
    return (
      <div
        className="import-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(17,17,17,0.82)',
            color: '#ffffff',
            padding: '14px 16px',
            borderRadius: 12,
            margin: '12px',
            width: '100%',
            maxWidth: 360,
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
            Drag to position. Scroll or use the slider to zoom. Press Enter to place, Esc to cancel.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => adjustImportScale(1 / 1.1)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8,
                width: 32,
                height: 32,
                fontSize: 18,
                lineHeight: 1
              }}
            >
              -
            </button>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={sliderValue}
              onChange={(evt) => handleImportScaleRatio(Number(evt.target.value))}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => adjustImportScale(1.1)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8,
                width: 32,
                height: 32,
                fontSize: 18,
                lineHeight: 1
              }}
            >
              +
            </button>
            <span style={{ width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {percent}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={cancelPendingImport}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8,
                padding: '6px 14px'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitPendingImport}
              style={{
                background: '#ff6b35',
                color: '#1a1a1a',
                border: 'none',
                borderRadius: 8,
                padding: '6px 16px',
                fontWeight: 600
              }}
            >
              Place Image
            </button>
          </div>
        </div>
      </div>
    );
  }, [adjustImportScale, cancelPendingImport, commitPendingImport, handleImportScaleRatio, pendingImport]);

  const loadFileIntoCanvas = (file: File) => {
    if (pendingImportRef.current) {
      announce?.('Finish placing the current image before loading another');
      return;
    }
    if (!file || !file.type.startsWith('image/')) {
      announce?.('Unsupported file type — please use an image');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      beginImagePlacement(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      announce?.('Failed to load image');
    };
    img.src = objectUrl;
  };

  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFileIntoCanvas(file);
    e.currentTarget.value = '';
  };
  const handleCanvasDragOver: React.DragEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    if (pendingImportRef.current) {
      setIsDraggingOver(false);
      return;
    }
    setIsDraggingOver(true);
  };
  const handleCanvasDragLeave: React.DragEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };
  const handleCanvasDrop: React.DragEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (pendingImportRef.current) {
      announce?.('Finish placing the current image before loading another');
      return;
    }
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFileIntoCanvas(file);
  };
  const handlePaste: React.ClipboardEventHandler<HTMLDivElement> = (e) => {
    if (pendingImportRef.current) {
      announce?.('Finish placing the current image before pasting another');
      return;
    }
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
    announce?.('Drawing downloaded');
  };

  const handleDrawKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (isTypingTarget(e.target)) return;
    const key = e.key.toLowerCase();

    if (showLassoPrompt) {
      if (key === 'escape') {
        e.preventDefault();
        cancelLassoSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && key === 'enter') {
        e.preventDefault();
        void handleConfirmLasso();
        return;
      }
    }

    if (pendingImportRef.current) {
      if ((e.metaKey || e.ctrlKey) && key === 'o') { e.preventDefault(); return; }
      if ((e.metaKey || e.ctrlKey) && key === 's') { e.preventDefault(); return; }
      if ((e.metaKey || e.ctrlKey) && key === 'z') { e.preventDefault(); cancelPendingImport(); return; }
      if (key === 'enter') { e.preventDefault(); commitPendingImport(); return; }
      if (key === 'escape') { e.preventDefault(); cancelPendingImport(); return; }
      if (key === '=' || key === '+') { e.preventDefault(); adjustImportScale(e.shiftKey ? 1.2 : 1.1); return; }
      if (key === '-' || key === '_') { e.preventDefault(); adjustImportScale(e.shiftKey ? 1 / 1.2 : 1 / 1.1); return; }
      const nudgeStep = e.shiftKey ? 40 : 12;
      if (key === 'arrowup') { e.preventDefault(); nudgePendingImport(0, -nudgeStep); return; }
      if (key === 'arrowdown') { e.preventDefault(); nudgePendingImport(0, nudgeStep); return; }
      if (key === 'arrowleft') { e.preventDefault(); nudgePendingImport(-nudgeStep, 0); return; }
      if (key === 'arrowright') { e.preventDefault(); nudgePendingImport(nudgeStep, 0); return; }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && key === 'o') { e.preventDefault(); openFilePicker(); return; }
    if ((e.metaKey || e.ctrlKey) && key === 's') { e.preventDefault(); void handleDownloadDrawing(); return; }
    if ((e.metaKey || e.ctrlKey) && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }

    if (key === '[') { e.preventDefault(); setBrushSize(v => Math.max(2, v - 1)); return; }
    if (key === ']') { e.preventDefault(); setBrushSize(v => Math.min(40, v + 1)); return; }

    if (key === 'b') { setDrawTool('brush'); return; }
    if (key === 'e') { setDrawTool('eraser'); return; }
    if (key === 'p') { setDrawTool('calligraphy'); return; }
    if (key === 'r') { setDrawTool('square'); return; }
    if (key === 'c') { setDrawTool('circle'); return; }
    if (key === 'l') { setDrawTool('lasso'); return; }

    if (key === 'g') { setShowGrid(v => !v); return; }
    if (key === 'h') { setSymmetryH(v => !v); return; }
    if (key === 'v') { setSymmetryV(v => !v); return; }
    if (key === 'escape') {
      if (finalLasso) {
        cancelLassoSelection();
        return;
      }
      onClose();
      return;
    }
  };

  const handleCreate = async () => {
    if (pendingImportRef.current) {
      announce?.('Place the imported image before creating variations');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !visionPrompt.trim()) return;

    const blob = await flattenCanvasToBlob('image/png');
    if (!blob) return;

    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.readAsDataURL(blob);
    });

    onCreate({
      prompt: visionPrompt.trim(),
      style: 'Simple Ink',
      controlnetType,
      controlBlob: blob,
      sketchDataUrl: dataUrl
    });
  };

  const handleDisabledCreateClick = () => {
    if (!visionPrompt.trim() && undoStack.length > 0) {
      setShowPromptHint(true);
      const promptInput = document.querySelector('.mobile-prompt-input') as HTMLInputElement;
      if (promptInput) promptInput.focus();
      setTimeout(() => setShowPromptHint(false), 3000);
    }
  };

  const handleDesktopDisabledClick = () => {
    if (!visionPrompt.trim() && undoStack.length > 0) {
      setShowPromptHint(true);
      const promptInput = document.querySelector('.vision-input') as HTMLInputElement;
      if (promptInput) promptInput.focus();
      setTimeout(() => setShowPromptHint(false), 3000);
    }
  };

  // Initialize base white background + baseline undo snapshot
  useEffect(() => {
    const id = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = getCanvas2DContext(canvas);
      if (ctx) {
        resizeCanvasToDisplaySize(false);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    return () => clearTimeout(id);
  }, [resizeCanvasToDisplaySize]);

  // -------- UI --------
  return (
    <div
      className="draw-mode"
      onKeyDown={handleDrawKeyDown}
      onPaste={handlePaste}
    >
      {/* ======= Desktop Pro Layout ======= */}
      {!isMobile ? (
        <div className="draw-pro">
          {/* Top Bar */}
          <div className="topbar">
            <div className="tb-left">
              <button className="icon-btn" onClick={onClose} aria-label="Close draw mode" title="Close">‹</button>
              <div className="tb-title">Draw</div>
            </div>
            <div className="tb-center" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div
                className={`desktop-prompt-wrapper ${showPromptHint ? 'hint-active' : ''}`}
                style={{ position: 'relative', flex: 1, minWidth: 0 }}
              >
                <input
                  type="text"
                  value={visionPrompt}
                  onChange={(e) => setVisionPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && visionPrompt.trim()) handleCreate(); }}
                  placeholder="Describe your vision…"
                  className="vision-input pro"
                  disabled={isEnhancingPrompt}
                />
                {showPromptHint && (
                  <div className="desktop-prompt-hint">
                    <span className="hint-arrow">👆</span>
                    <span>Add a description</span>
                  </div>
                )}
              </div>
              <button
                className="tool-btn"
                onClick={async () => {
                  if (!visionPrompt.trim() || isEnhancingPrompt) return;
                  setIsEnhancingPrompt(true);
                  try {
                    const response = await fetch(`https://prompt.sogni.ai/?query=${encodeURIComponent(visionPrompt)}`);
                    if (response.status === 200) {
                      const enhancedPrompt = await response.text();
                      if (enhancedPrompt) setVisionPrompt(enhancedPrompt);
                    }
                  } catch {
                  } finally {
                    setIsEnhancingPrompt(false);
                  }
                }}
                disabled={!visionPrompt.trim() || isEnhancingPrompt}
                title="Prompt Enhancer"
                style={{
                  fontSize: '1.2rem',
                  opacity: !visionPrompt.trim() || isEnhancingPrompt ? 0.5 : 1,
                  cursor: !visionPrompt.trim() || isEnhancingPrompt ? 'not-allowed' : 'pointer',
                  flexShrink: 0
                }}
              >
                {isEnhancingPrompt ? '⏳' : '🪄'}
              </button>
            </div>
            <div className="tb-right">
              <button className="tool-btn" onClick={undo} title="Undo (⌘/Ctrl+Z)">↶</button>
              <button className="tool-btn" onClick={redo} title="Redo (⌘/Ctrl+Shift+Z)">↷</button>
              <button className="tool-btn" onClick={invertCanvas} title="Invert colors">🔄</button>
              <div className="rail-divider" style={{ width: 1, height: 28, margin: '0 8px' }} />
              <button className="tool-btn" onClick={openFilePicker} title="Upload image (⌘/Ctrl+O)">⬆️</button>
              <button className="tool-btn" onClick={handleDownloadDrawing} title="Download PNG (⌘/Ctrl+S)">⬇️</button>
              <button
                onClick={() => {
                  if (visionPrompt.trim()) {
                    handleCreate();
                  } else {
                    handleDesktopDisabledClick();
                  }
                }}
                className={`create-btn pro ${!visionPrompt.trim() ? 'disabled' : ''}`}
                title="Create 16 variations"
              >
                Create
              </button>
            </div>
          </div>

          {/* Left Rail — primary tools */}
          <aside className="left-rail" aria-label="Tools">
            <button className={`tool-btn ${drawTool === 'brush' ? 'active' : ''}`} aria-pressed={drawTool === 'brush'} onClick={() => setDrawTool('brush')} title="Brush (B)">🖌️</button>
            <button className={`tool-btn ${drawTool === 'calligraphy' ? 'active' : ''}`} aria-pressed={drawTool === 'calligraphy'} onClick={() => setDrawTool('calligraphy')} title="Calligraphy Pen (P)">🖋️</button>
            <button className={`tool-btn ${drawTool === 'square' ? 'active' : ''}`} aria-pressed={drawTool === 'square'} onClick={() => setDrawTool('square')} title="Rectangle (R)">⬛</button>
            <button className={`tool-btn ${drawTool === 'circle' ? 'active' : ''}`} aria-pressed={drawTool === 'circle'} onClick={() => setDrawTool('circle')} title="Circle (C)">⭕</button>
            <button className={`tool-btn ${drawTool === 'lasso' ? 'active' : ''}`} aria-pressed={drawTool === 'lasso'} onClick={() => setDrawTool('lasso')} title="Lasso Inpaint (L)">➰</button>
            <button className={`tool-btn ${drawTool === 'eraser' ? 'active' : ''}`} aria-pressed={drawTool === 'eraser'} onClick={() => setDrawTool('eraser')} title="Eraser (E)">🧽</button>

            <div className="rail-divider" />

            <button className={`color-btn black ${drawColor === '#000000' ? 'active' : ''}`} onClick={() => setDrawColor('#000000')} title="Black ink">⚫</button>
            <button className={`color-btn white ${drawColor === '#ffffff' ? 'active' : ''}`} onClick={() => setDrawColor('#ffffff')} title="White ink">⚪</button>
          </aside>

          {/* Canvas Region */}
          <main className="canvas-region">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} style={{ display: 'none' }} />
            <div className="canvas-holder" style={{ position: 'relative' }}>
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
                onWheel={handleCanvasWheel}
                aria-label="Drawing canvas"
              />
              {lassoPathData && (
                <svg
                  className={`lasso-overlay ${hasFinalLasso ? 'lasso-overlay--final' : ''}`}
                  viewBox={`0 0 ${Math.max(1, canvasDimensions.pixelWidth)} ${Math.max(1, canvasDimensions.pixelHeight)}`}
                  preserveAspectRatio="none"
                  style={{
                    width: `${canvasDimensions.cssWidth}px`,
                    height: `${canvasDimensions.cssHeight}px`
                  }}
                >
                  <path className={`lasso-overlay__fill ${hasFinalLasso ? 'is-final' : ''}`} d={lassoPathData} />
                  <path className={`lasso-overlay__stroke ${hasFinalLasso ? 'is-final' : ''}`} d={lassoPathData} />
                </svg>
              )}
              {showGrid && <div className="grid-overlay" />}
              {(symmetryH || symmetryV) && (
                <div className={`sym-guides ${symmetryH ? 'h' : ''} ${symmetryV ? 'v' : ''}`} />
              )}
              {renderImportOverlay()}
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
                <button className={`color-btn black ${drawColor === '#000000' ? 'active' : ''}`} onClick={() => setDrawColor('#000000')} title="Black">⚫</button>
                <button className={`color-btn white ${drawColor === '#ffffff' ? 'active' : ''}`} onClick={() => setDrawColor('#ffffff')} title="White">⚪</button>
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
                <button className="tool-btn" aria-pressed={symmetryH} onClick={() => setSymmetryH(v => !v)} title="Horizontal symmetry (H)">⇆</button>
                <button className="tool-btn" aria-pressed={symmetryV} onClick={() => setSymmetryV(v => !v)} title="Vertical symmetry (V)">⇵</button>
                <button className="tool-btn" aria-pressed={showGrid} onClick={() => setShowGrid(v => !v)} title="Grid (G)">#️⃣</button>
                <button className="tool-btn" aria-pressed={smoothBrush} onClick={() => setSmoothBrush(v => !v)} title="Stroke smoothing">✨</button>
              </div>
            </section>

            <section className="panel-section">
              <h4>
                ControlNet{' '}
                <a
                  href="https://stable-diffusion-art.com/controlnet/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="What is ControlNet?"
                  style={{ textDecoration: 'none', color: '#fff', opacity: 0.7 }}
                >
                  (?)
                </a>
              </h4>
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
                <button className="tool-btn" onClick={invertCanvas} title="Invert colors">🔄</button>
                <button onClick={clearCanvas} className="clear-btn" title="Clear canvas">🗑️</button>
              </div>
            </section>
          </aside>
        </div>
      ) : (
        /* ======= Mobile Native App Layout ======= */
        <div className="draw-mobile-native">
          {/* Compact Top Bar */}
          <div className="mobile-draw-header">
            <button className="mobile-header-btn" onClick={onClose} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={`mobile-prompt-wrapper ${showPromptHint ? 'hint-active' : ''}`}>
              <input
                type="text"
                value={visionPrompt}
                onChange={(e) => setVisionPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && visionPrompt.trim()) handleCreate(); }}
                placeholder="Describe your tattoo..."
                className="mobile-prompt-input"
                disabled={isEnhancingPrompt}
              />
              {showPromptHint && (
                <div className="prompt-hint-indicator">
                  <span className="hint-arrow">👆</span>
                  <span className="hint-text">Add a description</span>
                </div>
              )}
            </div>
            <button
              className="mobile-header-btn"
              onClick={async () => {
                if (!visionPrompt.trim() || isEnhancingPrompt) return;
                setIsEnhancingPrompt(true);
                try {
                  const response = await fetch(`https://prompt.sogni.ai/?query=${encodeURIComponent(visionPrompt)}`);
                  if (response.status === 200) {
                    const enhancedPrompt = await response.text();
                    if (enhancedPrompt) setVisionPrompt(enhancedPrompt);
                  }
                } catch {
                } finally {
                  setIsEnhancingPrompt(false);
                }
              }}
              disabled={!visionPrompt.trim() || isEnhancingPrompt}
              title="Enhance"
            >
              {isEnhancingPrompt ? '⏳' : '✨'}
            </button>
          </div>

          {/* Canvas Area */}
          <div className="mobile-canvas-area" style={{ position: 'relative' }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} style={{ display: 'none' }} />
            <canvas
              ref={canvasRef}
              className="mobile-drawing-canvas"
              onPointerDown={startDrawingPointer}
              onPointerMove={drawPointer}
              onPointerUp={endDrawingPointer}
              onPointerCancel={endDrawingPointer}
              onDragOver={handleCanvasDragOver}
              onDragLeave={handleCanvasDragLeave}
              onDrop={handleCanvasDrop}
              onWheel={handleCanvasWheel}
              aria-label="Drawing canvas"
            />
            {lassoPathData && (
              <svg
                className={`lasso-overlay ${hasFinalLasso ? 'lasso-overlay--final' : ''}`}
                viewBox={`0 0 ${Math.max(1, canvasDimensions.pixelWidth)} ${Math.max(1, canvasDimensions.pixelHeight)}`}
                preserveAspectRatio="none"
                style={{
                  width: `${canvasDimensions.cssWidth}px`,
                  height: `${canvasDimensions.cssHeight}px`
                }}
              >
                <path className={`lasso-overlay__fill ${hasFinalLasso ? 'is-final' : ''}`} d={lassoPathData} />
                <path className={`lasso-overlay__stroke ${hasFinalLasso ? 'is-final' : ''}`} d={lassoPathData} />
              </svg>
            )}
            {showGrid && <div className="mobile-grid-overlay" />}
            {(symmetryH || symmetryV) && (
              <div className={`mobile-sym-guides ${symmetryH ? 'h' : ''} ${symmetryV ? 'v' : ''}`} />
            )}
            {renderImportOverlay()}
            {isDraggingOver && (
              <div className="mobile-drop-overlay">
                Drop image here
              </div>
            )}
          </div>

          {/* Floating Action Buttons */}
          <div className="mobile-fab-container">
            <button
              className="mobile-fab-secondary"
              onClick={openFilePicker}
              title="Upload"
            >
              📷
            </button>
            <button
              className="mobile-fab-secondary"
              onClick={handleDownloadDrawing}
              title="Download"
            >
              💾
            </button>
            <button
              className={`mobile-fab-primary ${!visionPrompt.trim() ? 'disabled' : ''}`}
              onClick={() => {
                if (visionPrompt.trim()) {
                  handleCreate();
                } else {
                  handleDisabledCreateClick();
                }
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <span style={{ fontSize: '0.7rem', marginTop: '2px' }}>Create</span>
            </button>
          </div>

          {/* Multi-Row Bottom Toolbar */}
          <div className="mobile-bottom-toolbar-multi">
            {/* Row 1: Drawing Tools */}
            <div className="toolbar-row">
              <button
                className={`toolbar-btn ${drawTool === 'brush' ? 'active' : ''}`}
                onClick={() => setDrawTool('brush')}
                title="Brush"
              >
                🖌️
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'calligraphy' ? 'active' : ''}`}
                onClick={() => setDrawTool('calligraphy')}
                title="Calligraphy"
              >
                🖋️
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'square' ? 'active' : ''}`}
                onClick={() => setDrawTool('square')}
                title="Rectangle"
              >
                ⬛
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'circle' ? 'active' : ''}`}
                onClick={() => setDrawTool('circle')}
                title="Circle"
              >
                ⭕
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'lasso' ? 'active' : ''}`}
                onClick={() => setDrawTool('lasso')}
                title="Lasso Inpaint"
              >
                ➰
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setDrawTool('eraser')}
                title="Eraser"
              >
                🧽
              </button>

              {/* Actions */}
              <div className="toolbar-spacer" />
              <button className="toolbar-btn" onClick={undo} title="Undo">↶</button>
              <button className="toolbar-btn" onClick={redo} title="Redo">↷</button>
              <button className="toolbar-btn danger" onClick={clearCanvas} title="Clear">🗑️</button>
            </div>

            {/* Row 2: Color, Size, and Effects */}
            <div className="toolbar-row">
              {/* Color selection */}
              <button
                className={`toolbar-btn color-btn ${drawColor === '#000000' ? 'active' : ''}`}
                onClick={() => setDrawColor('#000000')}
                title="Black"
              >
                ⚫
              </button>
              <button
                className={`toolbar-btn color-btn ${drawColor === '#ffffff' ? 'active' : ''}`}
                onClick={() => setDrawColor('#ffffff')}
                title="White"
              >
                ⚪
              </button>

              {/* Brush size slider */}
              <div className="brush-size-control-multi">
                <span className="size-icon">◉</span>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="mobile-size-slider"
                  aria-label="Brush size"
                />
                <span className="size-label">{brushSize}</span>
              </div>

              {/* Symmetry and effects */}
              <div className="toolbar-spacer" />
              <button
                className={`toolbar-btn ${symmetryH ? 'active' : ''}`}
                onClick={() => setSymmetryH(v => !v)}
                title="H-Symmetry"
              >
                ⇄
              </button>
              <button
                className={`toolbar-btn ${symmetryV ? 'active' : ''}`}
                onClick={() => setSymmetryV(v => !v)}
                title="V-Symmetry"
              >
                ⇅
              </button>
              <button
                className={`toolbar-btn ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid(v => !v)}
                title="Grid"
              >
                #
              </button>
            </div>

            {/* Row 3: Advanced Options */}
            <div className="toolbar-row compact">
              {/* ControlNet selector */}
              <div className="controlnet-compact">
                <label className="mini-label">AI Mode:</label>
                <select
                  value={controlnetType}
                  onChange={(e) => setControlnetType(e.target.value)}
                  className="mobile-controlnet-inline"
                >
                  <option value="scribble">Scribble</option>
                  <option value="canny">Canny</option>
                  <option value="lineart">Line Art</option>
                  <option value="softedge">Soft Edge</option>
                  <option value="inpaint">Inpaint</option>
                  <option value="tile">Tile</option>
                </select>
              </div>

              {/* Additional options */}
              <button
                className={`toolbar-btn mini ${smoothBrush ? 'active' : ''}`}
                onClick={() => setSmoothBrush(v => !v)}
                title="Smooth"
              >
                ✨
              </button>
              <button
                className="toolbar-btn mini"
                onClick={invertCanvas}
                title="Invert"
              >
                ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {showLassoPrompt && (
        <div className="lasso-modal-backdrop" role="dialog" aria-modal="true">
          <form
            className="lasso-modal"
            onSubmit={(evt) => {
              void handleConfirmLasso(evt);
            }}
          >
            <h3>Inpaint Selection</h3>
            <p className="lasso-modal__hint">Describe how you want the highlighted area to change.</p>
            <textarea
              className="lasso-modal__input"
              value={lassoPrompt}
              onChange={(evt) => setLassoPrompt(evt.target.value)}
              placeholder="e.g. replace the sword with a bouquet of flowers"
              rows={4}
              disabled={isSubmittingLasso}
              autoFocus
              onKeyDown={(evt) => {
                if (evt.key === 'Enter' && !evt.shiftKey) {
                  // Enter submits (Shift+Enter adds new line)
                  evt.preventDefault();
                  void handleConfirmLasso();
                } else if (evt.key === 'Escape') {
                  evt.preventDefault();
                  cancelLassoSelection();
                }
              }}
            />
            <div className="lasso-modal__actions">
              <button
                type="button"
                className="lasso-modal__btn secondary"
                onClick={cancelLassoSelection}
                disabled={isSubmittingLasso}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="lasso-modal__btn primary"
                disabled={isSubmittingLasso || !lassoPrompt.trim()}
              >
                {isSubmittingLasso ? 'Rendering…' : 'Inpaint Selection'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ✨ Preprocess Modal */}
      <PreprocessModal
        open={showPreprocess && lastLoadWasUserUploadRef.current}
        onClose={() => {
          lastLoadWasUserUploadRef.current = false;
          setShowPreprocess(false);
        }}
        onConfirm={({ levels, contrast }) => {
          PREPROCESS_DEFAULTS.current = { levels, contrast };
          preprocessCanvasForControlnet(levels, contrast);
          lastLoadWasUserUploadRef.current = false;
          setShowPreprocess(false);
        }}
        defaultLevels={PREPROCESS_DEFAULTS.current.levels}
        defaultContrast={PREPROCESS_DEFAULTS.current.contrast}
      />
    </div>
  );
}
