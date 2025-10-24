// web/src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sogni Tattoo Ideas — Teaching Demo (Refactor)
 *
 * This refactor breaks the monolithic App into:
 * - components/MobileStyles.tsx  (CSS tokens + draw/pro layout)
 * - components/DrawMode.tsx      (entire draw experience)
 * - components/HeroMode.tsx      (hero viewer + refine/orbit)
 * - components/MainMode.tsx      (home input + orbit)
 * - components/EditModal.tsx     (edit prompt/style/controlnet)
 * - utils/api.ts                 (postJSON/postForm)
 * - utils/misc.ts                (shuffle, clamp01, seeds, history helper)
 * - types.ts                     (shared types)
 * - constants.ts                 (styles, suggestions, options, DPR/history)
 *
 * ✅ All existing features preserved (pointer capture, DPR square canvas, symmetry, grid, undo/redo,
 *    pressure-aware brush, controlnet, hero refine, sticky compare + spacebar toggle, etc.)
 */

import MobileStyles from './components/MobileStyles';
import DrawMode from './components/DrawMode';
import HeroMode from './components/HeroMode';
import MainMode from './components/MainMode';
import EditModal from './components/EditModal';

import { BASE_STYLES, HERO_REFINEMENT_OPTIONS, TATTOO_SUGGESTIONS } from './constants';
import { clamp01, randomSeed, resetHistoryIndexFor, shuffleArray } from './utils/misc';
import { postForm, postJSON } from './utils/api';
import { ControlnetIteration, GenerationSession, TattooImage } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/, '')
  : '';

const STYLES = shuffleArray(BASE_STYLES);

// ---------- App ----------
export default function App() {
  // Stable counters
  const sessionIdRef = useRef(0);
  const imageIdRef = useRef(0);
  const nextSessionId = useCallback(() => `session_${++sessionIdRef.current}`, []);
  const nextImageId = useCallback(() => `image_${++imageIdRef.current}`, []);

  // Core prompt/style
  const [prompt, setPrompt] = useState(
    () => TATTOO_SUGGESTIONS[Math.floor(Math.random() * TATTOO_SUGGESTIONS.length)]
  );
  const [selectedStyle, setSelectedStyle] = useState(
    () => STYLES[Math.floor(Math.random() * STYLES.length)]
  );

  // Sessions
  const [currentSession, setCurrentSession] = useState<GenerationSession | null>(null);
  const [heroImage, setHeroImage] = useState<TattooImage | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSession, setHeroSession] = useState<GenerationSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<GenerationSession[]>([]);
  const [isInitiatingRefinement, setIsInitiatingRefinement] = useState(false);

  // Draw Mode toggle + stickies for compare
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [originalSketch, setOriginalSketch] = useState<string | null>(null);
  const [originalControlBlob, setOriginalControlBlob] = useState<Blob | null>(null);
  const [controlnetType, setControlnetType] = useState('scribble');

  // Compare state (global so Spacebar works in main + hero)
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [showOriginalSketch, setShowOriginalSketch] = useState(false);

  // Mobile detection (>= 1024 is desktop "pro")
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window || window.innerWidth <= 1023;
      setIsMobile(isMobileDevice);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Live region announcer
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const announce = useCallback((message: string) => {
    if (!liveRegionRef.current) return;
    liveRegionRef.current.textContent = message;
    setTimeout(() => {
      if (liveRegionRef.current) liveRegionRef.current.textContent = '';
    }, 600);
  }, []);

  // Track latest sessions to close SSE on unmount
  const currentSessionRef = useRef<GenerationSession | null>(null);
  const heroSessionRef = useRef<GenerationSession | null>(null);
  useEffect(() => { currentSessionRef.current = currentSession; }, [currentSession]);
  useEffect(() => { heroSessionRef.current = heroSession; }, [heroSession]);
  useEffect(() => {
    return () => {
      try { currentSessionRef.current?.sse?.close(); } catch {}
      try { heroSessionRef.current?.sse?.close(); } catch {}
    };
  }, []);

  // ---------- SSE helpers ----------
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
      try { data = JSON.parse(evt.data); } catch { return; }
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
            const compareFromServer = data.compareAgainstUrl || data.previousUrl || prev.compareAgainstUrl;
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

  // ---------- Network: starters ----------
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
    async (basePrompt: string, style: string, controlImage: File | Blob, sketchDataUrl?: string, cnType?: string) => {
      currentSession?.sse?.close();

      const sessionId = nextSessionId();
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
        controlImageBlob: controlImage as Blob,
        controlnetHistory: [
          { imageUrl: sketchDataUrl || originalSketch || '', prompt: basePrompt, isOriginalSketch: true }
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
        form.append('controlnetType', cnType || controlnetType);

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
      setIsInitiatingRefinement(false);
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
            prompt: basePrompt, style, refinement, seed: seed !== undefined ? seed : undefined
          });
        }

        const { projectId, context } = projectResp;
        if (context?.compareAgainstUrl) {
          setHeroSession(prev => (prev ? { ...prev, compareAgainstUrl: context.compareAgainstUrl } : prev));
        }

        attachSSE(projectId, sessionId, basePrompt, setHeroSession);
      } catch (err: any) {
        setIsInitiatingRefinement(false);
        setHeroSession(prev => (prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null));
      }
    },
    [announce, currentSession, heroSession?.sse, nextSessionId, originalControlBlob, originalSketch, controlnetType]
  );

  // ---------- UI helpers ----------
  const handleGenerate = () => { if (prompt.trim()) startGeneration(prompt.trim(), selectedStyle); };
  const handleSuggest = () => {
    setPrompt(TATTOO_SUGGESTIONS[Math.floor(Math.random() * TATTOO_SUGGESTIONS.length)]);
  };

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

  const getLastNonOriginalIndex = useCallback((hist: ControlnetIteration[] | undefined) => {
    if (!hist || hist.length === 0) return -1;
    for (let i = hist.length - 1; i >= 0; i--) {
      const it = hist[i];
      if (it && !it.isOriginalSketch && it.imageUrl) return i;
    }
    return -1;
  }, []);

  const handleSpacebarToggle = useCallback(() => {
    const activeSession = heroSession || currentSession;
    const historySession = activeSession === heroSession ? heroSession : currentSession;
    const history = historySession?.controlnetHistory || [];
    const compareUrl = historySession?.compareAgainstUrl || originalSketch || '';

    if (heroSession && history.length > 0) {
      const lastIdx = getLastNonOriginalIndex(history);
      if (lastIdx !== -1 || compareUrl) {
        if (lastIdx !== -1) setCurrentHistoryIndex(lastIdx);
        setShowOriginalSketch(prev => !prev);
        return;
      }
    }

    if (history.length > 0 || compareUrl) {
      if (history.length > 0) {
        if (history.length === 1) {
          setCurrentHistoryIndex(0);
          setShowOriginalSketch(prev => !prev);
        } else {
          const totalStates = history.length + 1;
          setCurrentHistoryIndex(prevIndex => {
            const next = (prevIndex + 1) % totalStates;
            setShowOriginalSketch(next < history.length);
            return next;
          });
        }
      } else {
        setShowOriginalSketch(prev => !prev);
      }
    }
  }, [heroSession, currentSession, originalSketch, getLastNonOriginalIndex]);

  useEffect(() => {
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveTarget(e.target)) return;
      if (e.key === ' ') { e.preventDefault(); handleSpacebarToggle(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { handleGenerate(); }
      if (e.key === 'Escape' && heroImage) { closeHeroMode(); }
      if (heroImage && e.key === 'ArrowLeft') { e.preventDefault(); navigateHero('prev'); }
      if (heroImage && e.key === 'ArrowRight') { e.preventDefault(); navigateHero('next'); }
    };
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  }, [handleSpacebarToggle, handleGenerate, heroImage, closeHeroMode]);

  const handleRefinementClick = (option: typeof HERO_REFINEMENT_OPTIONS[number]) => {
    if (!heroImage || !currentSession) return;
    setIsInitiatingRefinement(true);
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

  // ---------- Edit modal state ----------
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editControlnetType, setEditControlnetType] = useState('');
  const confirmEditGenerate = () => {
    if (!editPrompt.trim()) return;
    setControlnetType(editControlnetType);
    if (currentSession?.isControlnet) {
      startHeroGeneration(editPrompt.trim(), editStyle, '', undefined, true, heroImage?.url);
    } else {
      startHeroGeneration(editPrompt.trim(), editStyle, '');
    }
    setShowEditModal(false);
  };

  // ---------- Render ----------
  return (
    <div className="app">
      {/* CSS tokens & pro layout */}
      <MobileStyles />

      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRegionRef} />

      {/* Hero Mode */}
      {heroImage && (
        <HeroMode
          heroImage={heroImage}
          heroIndex={heroIndex}
          currentSession={currentSession}
          heroSession={heroSession}
          selectedStyle={selectedStyle}
          controlnetType={controlnetType}
          isMobile={isMobile}
          showOriginalSketch={showOriginalSketch}
          setShowOriginalSketch={setShowOriginalSketch}
          currentHistoryIndex={currentHistoryIndex}
          setCurrentHistoryIndex={setCurrentHistoryIndex}
          isInitiatingRefinement={isInitiatingRefinement}
          onNavigate={navigateHero}
          onClose={closeHeroMode}
          onRefineClick={handleRefinementClick}
          onOpenEdit={openEditModal}
          onSelectOrbitImage={(image) => {
            if (image.isNSFW) return;
            const newIndex = (heroSession || currentSession)?.images.findIndex(img => img.id === image.id) ?? 0;
            setHeroIndex(newIndex);
            setHeroImage(image);
            const history = heroSession?.controlnetHistory || [];
            setCurrentHistoryIndex(resetHistoryIndexFor(history));
            setShowOriginalSketch(false);
          }}
          originalSketch={originalSketch}
          getLastNonOriginalIndex={getLastNonOriginalIndex}
          handleSpacebarToggle={handleSpacebarToggle}
          autoFocus
        />
      )}

      {/* Draw Mode */}
      {isDrawMode && (
        <DrawMode
          isMobile={isMobile}
          onClose={() => setIsDrawMode(false)}
          onCreate={async ({ prompt: p, style, controlnetType: cnType, controlBlob, sketchDataUrl }) => {
            setOriginalSketch(sketchDataUrl);
            setOriginalControlBlob(controlBlob);
            setSelectedStyle('Simple Ink');
            setIsDrawMode(false);
            setControlnetType(cnType);
            await startGenerationWithControlnet(p, style, controlBlob, sketchDataUrl, cnType);
          }}
          announce={announce}
          defaultControlnetType={controlnetType}
        />
      )}

      {/* Main Mode */}
      {!heroImage && !isDrawMode && (
        <MainMode
          prompt={prompt}
          setPrompt={setPrompt}
          selectedStyle={selectedStyle}
          setSelectedStyle={setSelectedStyle}
          styles={STYLES}
          currentSession={currentSession}
          originalSketch={originalSketch}
          showOriginalSketch={showOriginalSketch}
          currentHistoryIndex={currentHistoryIndex}
          onGenerate={handleGenerate}
          onSuggest={handleSuggest}
          onOpenDraw={() => setIsDrawMode(true)}
          onImageClick={handleImageClick}
        />
      )}

      {/* Edit Modal */}
      <EditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        isControlnet={!!currentSession?.isControlnet}
        editPrompt={editPrompt}
        setEditPrompt={setEditPrompt}
        editStyle={editStyle}
        setEditStyle={setEditStyle}
        editControlnetType={editControlnetType}
        setEditControlnetType={setEditControlnetType}
        onGenerate={confirmEditGenerate}
        canGenerate={!!editPrompt.trim()}
      />
    </div>
  );
}
