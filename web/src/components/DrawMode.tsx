// web/src/components/DrawMode.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HISTORY_LIMIT, MAX_DPR } from '../constants';
import './MobileDrawStyles.css';

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
 */
export default function DrawMode({
  isMobile,
  onClose,
  onCreate,
  announce,
  defaultControlnetType = 'scribble'
}: DrawModeProps) {
  // Prompt
  const [visionPrompt, setVisionPrompt] = useState('');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

  // Tools
  const [brushSize, setBrushSize] = useState(8);
  const [drawColor, setDrawColor] = useState('#000000');
  const [drawTool, setDrawTool] = useState<'brush' | 'square' | 'circle' | 'calligraphy' | 'eraser'>('brush');
  const [smoothBrush, setSmoothBrush] = useState(false);
  const [symmetryH, setSymmetryH] = useState(false);
  const [symmetryV, setSymmetryV] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [controlnetType, setControlnetType] = useState(defaultControlnetType);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Brush smoothing helpers
  const brushPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastPressureRef = useRef<number>(1);
  const activePointerIdRef = useRef<number | null>(null);

  // -------- Utilities --------

  const resizeCanvasToDisplaySize = useCallback((preserve = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cssSide = Math.max(1, Math.floor(rect.width));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const target = Math.max(1, Math.floor(cssSide * dpr));

    if (canvas.width === target && canvas.height === target) return;

    let prevUrl: string | null = null;
    if (preserve) {
      try { prevUrl = canvas.toDataURL('image/png'); } catch { prevUrl = null; }
    }

    canvas.width = target;
    canvas.height = target;

    const ctx = canvas.getContext('2d');
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

  const getCanvasCoordsFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return null;
    return { x, y };
  };

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
      setRedoStack([]);
    } catch {}
  }, []);

  const applyImageData = (img: ImageData | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !img) return;
    ctx.putImageData(img, 0, 0);
    setDrips([]);
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
        } catch { return rp; }
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
        } catch { return up; }
      });
      const last = prev[prev.length - 1];
      applyImageData(last);
      return prev.slice(0, -1);
    });
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
    const ctx = canvas.getContext('2d');
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
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    activePointerIdRef.current = e.pointerId;

    setIsDrawing(true);
    setIsOutsideCanvas(false);

    const coords = getCanvasCoordsFromClient(e.clientX, e.clientY);
    if (!coords) return;

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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const coords = getCanvasCoordsFromClient(clientX, clientY);
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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const coords = getCanvasCoordsFromClient(clientX, clientY);
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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
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
    if (!isDrawing) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

    e.preventDefault();

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
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
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    activePointerIdRef.current = null;

    setIsDrawing(false);
    setStartPos(null);
    setBaseImageData(null);
    setLastPos(null);
    setIsOutsideCanvas(false);
    brushPointsRef.current = [];
    lastBrushPointRef.current = null;
  };

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

  // Drips animator (calligraphy effect)
  useEffect(() => {
    if (drips.length === 0) return;
    const timer = setInterval(() => {
      setDrips(prevDrips => {
        const canvas = canvasRef.current;
        if (!canvas) return prevDrips;
        const ctx = canvas.getContext('2d');
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    pushUndoSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setDrips([]);
  };

  const invertCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
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
    const octx = off.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, off.width, off.height);
    octx.drawImage(src, 0, 0);
    return await new Promise<Blob | null>(resolve => off.toBlob(b => resolve(b), type));
  };

  // I/O: upload / paste / drag
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFilePicker = () => fileInputRef.current?.click();

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
  };

  const loadFileIntoCanvas = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      announce?.('Unsupported file type — please use an image');
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      drawImageContain(img);
      URL.revokeObjectURL(objectUrl);
      announce?.('Image loaded into canvas');
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
    announce?.('Drawing downloaded');
  };

  const handleDrawKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key.toLowerCase();

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

    if (key === 'g') { setShowGrid(v => !v); return; }
    if (key === 'h') { setSymmetryH(v => !v); return; }
    if (key === 'v') { setSymmetryV(v => !v); return; }
    if (key === 'escape') { onClose(); return; }
  };

  const handleCreate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !visionPrompt.trim()) return;

    const blob = await flattenCanvasToBlob('image/png');
    if (!blob) return;

    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.readAsDataURL(blob);
    });

    // Parent will close the Draw Mode and start controlnet generation
    onCreate({
      prompt: visionPrompt.trim(),
      style: 'Simple Ink',
      controlnetType,
      controlBlob: blob,
      sketchDataUrl: dataUrl
    });
  };

  const handleDisabledCreateClick = () => {
    // Only show hint if user has drawn something but hasn't entered a prompt
    if (!visionPrompt.trim() && undoStack.length > 0) {
      setShowPromptHint(true);

      // Focus the input to make it even more obvious
      const promptInput = document.querySelector('.mobile-prompt-input') as HTMLInputElement;
      if (promptInput) {
        promptInput.focus();
      }

      // Auto-hide the hint after 3 seconds
      setTimeout(() => {
        setShowPromptHint(false);
      }, 3000);
    }
  };

  // Initialize base white background + baseline undo snapshot
  useEffect(() => {
    const id = setTimeout(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
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
            <div className="tb-center" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                value={visionPrompt}
                onChange={(e) => setVisionPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && visionPrompt.trim()) handleCreate(); }}
                placeholder="Describe your vision…"
                className="vision-input pro"
                disabled={isEnhancingPrompt}
              />
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
                  } catch (error) {
                    console.error('Failed to enhance prompt:', error);
                  } finally {
                    setIsEnhancingPrompt(false);
                  }
                }}
                disabled={!visionPrompt.trim() || isEnhancingPrompt}
                title="Prompt Enhancer"
                style={{
                  fontSize: '1.2rem',
                  opacity: !visionPrompt.trim() || isEnhancingPrompt ? 0.5 : 1,
                  cursor: !visionPrompt.trim() || isEnhancingPrompt ? 'not-allowed' : 'pointer'
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
            <button className={`tool-btn ${drawTool === 'brush' ? 'active' : ''}`} aria-pressed={drawTool === 'brush'} onClick={() => setDrawTool('brush')} title="Brush (B)">🖌️</button>
            <button className={`tool-btn ${drawTool === 'calligraphy' ? 'active' : ''}`} aria-pressed={drawTool === 'calligraphy'} onClick={() => setDrawTool('calligraphy')} title="Calligraphy Pen (P)">🖋️</button>
            <button className={`tool-btn ${drawTool === 'square' ? 'active' : ''}`} aria-pressed={drawTool === 'square'} onClick={() => setDrawTool('square')} title="Rectangle (R)">⬛</button>
            <button className={`tool-btn ${drawTool === 'circle' ? 'active' : ''}`} aria-pressed={drawTool === 'circle'} onClick={() => setDrawTool('circle')} title="Circle (C)">⭕</button>
            <button className={`tool-btn ${drawTool === 'eraser' ? 'active' : ''}`} aria-pressed={drawTool === 'eraser'} onClick={() => setDrawTool('eraser')} title="Eraser (E)">🧽</button>

            <div className="rail-divider" />

            <button className={`color-btn black ${drawColor === '#000000' ? 'active' : ''}`} onClick={() => setDrawColor('#000000')} title="Black ink">⚫</button>
            <button className={`color-btn white ${drawColor === '#ffffff' ? 'active' : ''}`} onClick={() => setDrawColor('#ffffff')} title="White ink">⚪</button>
          </aside>

          {/* Canvas Region */}
          <main className="canvas-region">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} style={{ display: 'none' }} />
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
                } catch (error) {
                  console.error('Failed to enhance prompt:', error);
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
          <div className="mobile-canvas-area">
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
              aria-label="Drawing canvas"
            />
            {showGrid && <div className="mobile-grid-overlay" />}
            {(symmetryH || symmetryV) && (
              <div className={`mobile-sym-guides ${symmetryH ? 'h' : ''} ${symmetryV ? 'v' : ''}`} />
            )}
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
              className="mobile-fab-primary"
              onClick={visionPrompt.trim() ? handleCreate : handleDisabledCreateClick}
              disabled={!visionPrompt.trim()}
              style={{ pointerEvents: 'auto' }}
            >
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <span style={{ fontSize: '0.7rem', marginTop: '2px' }}>Create</span>
            </button>
          </div>

          {/* Bottom Toolbar */}
          <div className="mobile-bottom-toolbar">
            {/* Primary Tools */}
            <div className="toolbar-section">
              <button
                className={`toolbar-btn ${drawTool === 'brush' ? 'active' : ''}`}
                onClick={() => setDrawTool('brush')}
              >
                🖌️
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'calligraphy' ? 'active' : ''}`}
                onClick={() => setDrawTool('calligraphy')}
              >
                🖋️
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'square' ? 'active' : ''}`}
                onClick={() => setDrawTool('square')}
              >
                ⬛
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'circle' ? 'active' : ''}`}
                onClick={() => setDrawTool('circle')}
              >
                ⭕
              </button>
              <button
                className={`toolbar-btn ${drawTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setDrawTool('eraser')}
              >
                🧽
              </button>
            </div>

            {/* Divider */}
            <div className="toolbar-divider" />

            {/* Color & Size */}
            <div className="toolbar-section">
              <button
                className={`toolbar-btn ${drawColor === '#000000' ? 'active' : ''}`}
                onClick={() => setDrawColor('#000000')}
              >
                ⚫
              </button>
              <button
                className={`toolbar-btn ${drawColor === '#ffffff' ? 'active' : ''}`}
                onClick={() => setDrawColor('#ffffff')}
              >
                ⚪
              </button>
              <div className="brush-size-control">
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="mobile-size-slider"
                />
                <span className="size-label">{brushSize}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="toolbar-divider" />

            {/* Actions */}
            <div className="toolbar-section">
              <button className="toolbar-btn" onClick={undo}>↶</button>
              <button className="toolbar-btn" onClick={redo}>↷</button>
              <button className="toolbar-btn" onClick={clearCanvas}>🗑️</button>
            </div>

            {/* More Options */}
            <button
              className="toolbar-btn more-btn"
              onClick={() => {
                // Toggle advanced options panel
                const panel = document.querySelector('.mobile-options-panel');
                if (panel) {
                  panel.classList.toggle('open');
                }
              }}
            >
              ⋮
            </button>
          </div>

          {/* Sliding Options Panel */}
          <div className="mobile-options-panel">
            <div className="options-handle"></div>
            <div className="options-content">
              <div className="option-group">
                <label>Symmetry</label>
                <div className="option-buttons">
                  <button
                    className={`option-btn ${symmetryH ? 'active' : ''}`}
                    onClick={() => setSymmetryH(v => !v)}
                  >
                    H
                  </button>
                  <button
                    className={`option-btn ${symmetryV ? 'active' : ''}`}
                    onClick={() => setSymmetryV(v => !v)}
                  >
                    V
                  </button>
                </div>
              </div>

              <div className="option-group">
                <label>Guides</label>
                <div className="option-buttons">
                  <button
                    className={`option-btn ${showGrid ? 'active' : ''}`}
                    onClick={() => setShowGrid(v => !v)}
                  >
                    Grid
                  </button>
                  <button
                    className={`option-btn ${smoothBrush ? 'active' : ''}`}
                    onClick={() => setSmoothBrush(v => !v)}
                  >
                    Smooth
                  </button>
                </div>
              </div>

              <div className="option-group">
                <label>ControlNet</label>
                <select
                  value={controlnetType}
                  onChange={(e) => setControlnetType(e.target.value)}
                  className="mobile-controlnet-select"
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

              <div className="option-group">
                <button className="option-btn" onClick={invertCanvas}>
                  Invert Colors
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
