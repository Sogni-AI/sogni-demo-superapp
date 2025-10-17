import React, { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Award-winning Tattoo Brainstorming App
 * - Streamlined UX: single input → 16 instant variations
 * - "More like this" refinement system for iterative exploration
 * - Beautiful masonry grid with streaming animations
 * - Hero view with directional refinement options
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/+$/,'') : '';

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

// Shuffle function
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create randomized styles array
const STYLES = shuffleArray(BASE_STYLES);

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

type TattooImage = {
  id: string;
  url: string;
  prompt: string;
  loadTime: number;
  aspectRatio?: number;
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
};

export default function App() {
  // Core app state - randomize initial values
  const [prompt, setPrompt] = useState(() => {
    const randomSuggestion = TATTOO_SUGGESTIONS[Math.floor(Math.random() * TATTOO_SUGGESTIONS.length)];
    return randomSuggestion;
  });
  const [selectedStyle, setSelectedStyle] = useState(() => {
    const randomStyle = STYLES[Math.floor(Math.random() * STYLES.length)];
    return randomStyle;
  });
    const [currentSession, setCurrentSession] = useState<GenerationSession | null>(null);
  const [heroImage, setHeroImage] = useState<TattooImage | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSession, setHeroSession] = useState<GenerationSession | null>(null); // For variations in hero mode
  const [sessionHistory, setSessionHistory] = useState<GenerationSession[]>([]);

  // Draw mode state
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [visionPrompt, setVisionPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(8);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [originalSketch, setOriginalSketch] = useState<string | null>(null);
  const [showOriginalSketch, setShowOriginalSketch] = useState(false);

  const liveRegionRef = useRef<HTMLDivElement>(null);
  const sessionCounter = useRef(0);
  const imageCounter = useRef(0);

  // Mobile gesture support
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const nextSessionId = () => `session_${++sessionCounter.current}`;
  const nextImageId = () => `image_${++imageCounter.current}`;

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        ('ontouchstart' in window) ||
        (window.innerWidth <= 768);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
      setTimeout(() => {
        if (liveRegionRef.current) liveRegionRef.current.textContent = '';
      }, 600);
    }
  }, []);

  const startHeroGeneration = useCallback(async (basePrompt: string, style: string, refinement: string, seed?: number) => {
    // Close any existing SSE connection
    heroSession?.sse?.close();

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
      seed
    };

    setHeroSession(newSession);
    announce('Generating 16 variations...');

    try {
      const resp = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: basePrompt,
          style,
          refinement,
          seed: seed !== undefined ? seed : undefined
        })
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${resp.status}`);
      }

      const { projectId } = await resp.json();

      // Listen to SSE events for this project
      const es = new EventSource(`${API_BASE}/api/progress/${projectId}`);

      es.onmessage = (evt) => {
        let data;
        try {
          data = JSON.parse(evt.data);
        } catch (err) {
          console.error('[SSE] Invalid JSON:', evt.data);
          return;
        }

        setHeroSession(prev => {
          if (!prev || prev.id !== sessionId) return prev;

          if (data.type === 'connected') {
            return prev;
          }

          if (data.type === 'progress') {
            return { ...prev, progress: Number(data.progress) || 0 };
          }

          if (data.type === 'jobCompleted' && data.job?.resultUrl) {
            const newImage: TattooImage = {
              id: nextImageId(),
              url: data.job.resultUrl,
              prompt: data.job.positivePrompt || basePrompt,
              loadTime: Date.now()
            };

            const updatedImages = [...prev.images, newImage];
            announce(`${updatedImages.length} of 16 variations ready`);

            return { ...prev, images: updatedImages };
          }

          if (data.type === 'completed') {
            es.close();
            announce('All 16 variations complete!');
            return { ...prev, generating: false, sse: null };
          }

          if (data.type === 'error' || data.type === 'jobFailed') {
            es.close();
            announce('Generation failed');
            return { ...prev, generating: false, sse: null, error: data.error || 'Generation failed' };
          }

          return prev;
        });
      };

      es.onerror = () => {
        es.close();
        setHeroSession(prev => prev ? { ...prev, generating: false, sse: null, error: 'Connection error' } : null);
      };

      setHeroSession(prev => prev ? { ...prev, sse: es } : null);
    } catch (err: any) {
      setHeroSession(prev => prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null);
    }
  }, [heroSession?.sse, announce]);

  const startGeneration = useCallback(async (basePrompt: string, style: string, refinement = '') => {
    // Close any existing SSE connection
    currentSession?.sse?.close();

    const sessionId = nextSessionId();
    // Generate a random seed for this session
    const sessionSeed = Math.floor(Math.random() * 1000000);

    const newSession: GenerationSession = {
      id: sessionId,
      basePrompt,
      style,
      refinement,
      images: [],
      generating: true,
      progress: 0,
      error: null,
      seed: sessionSeed
    };

    setCurrentSession(newSession);
    setHeroImage(null);
    announce('Generating 16 tattoo variations...');

    try {
      const resp = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: basePrompt,
          style,
          refinement
        })
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${resp.status}`);
      }

      const { projectId } = await resp.json();

      // Listen to SSE events for this project
      const es = new EventSource(`${API_BASE}/api/progress/${projectId}`);

      es.onmessage = (evt) => {
        let data;
        try {
          data = JSON.parse(evt.data);
        } catch (err) {
          console.error('[SSE] Invalid JSON:', evt.data);
          return;
        }

        setCurrentSession(prev => {
          if (!prev || prev.id !== sessionId) return prev;

          if (data.type === 'connected') {
            return prev;
          }

          if (data.type === 'progress') {
            return { ...prev, progress: Number(data.progress) || 0 };
          }

          if (data.type === 'jobCompleted' && data.job?.resultUrl) {
            const newImage: TattooImage = {
              id: nextImageId(),
              url: data.job.resultUrl,
              prompt: data.job.positivePrompt || basePrompt,
              loadTime: Date.now()
            };

            const updatedImages = [...prev.images, newImage];
            announce(`${updatedImages.length} of 16 tattoos ready`);

            return { ...prev, images: updatedImages };
          }

          if (data.type === 'completed') {
            es.close();
            announce('All 16 variations complete!');

            // Add to history
            setSessionHistory(history => [prev, ...history.slice(0, 9)]); // Keep last 10 sessions

            return { ...prev, generating: false, sse: null };
          }

          if (data.type === 'error' || data.type === 'jobFailed') {
            es.close();
            announce('Generation failed');
            return { ...prev, generating: false, sse: null, error: data.error || 'Generation failed' };
          }

          return prev;
        });
      };

      es.onerror = () => {
        es.close();
        setCurrentSession(prev => prev ? { ...prev, generating: false, sse: null, error: 'Connection error' } : null);
      };

      setCurrentSession(prev => prev ? { ...prev, sse: es } : null);
    } catch (err: any) {
      setCurrentSession(prev => prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null);
    }
  }, [currentSession?.sse, announce]);

  const handleGenerate = () => {
    if (prompt.trim()) {
      startGeneration(prompt.trim(), selectedStyle);
    }
  };

  // Drawing functionality
  const getEventPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getEventPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getEventPosition(e);
    
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleDrawModeToggle = () => {
    setIsDrawMode(!isDrawMode);
    if (!isDrawMode) {
      // Initialize canvas when entering draw mode
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }, 100);
    }
  };

  const handleCreate = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !visionPrompt.trim()) return;

    // Convert canvas to blob for controlnet
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      // Create a file from the blob
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
      
      // Store the original sketch as data URL for later toggle
      const dataUrl = canvas.toDataURL('image/png');
      setOriginalSketch(dataUrl);
      
      // Exit draw mode and start generation with controlnet
      setIsDrawMode(false);
      
      // Start generation with controlnet
      await startGenerationWithControlnet(visionPrompt.trim(), selectedStyle, file);
    }, 'image/png');
  };

  const startGenerationWithControlnet = async (basePrompt: string, style: string, controlImage: File) => {
    // Close any existing SSE connection
    currentSession?.sse?.close();

    const sessionId = nextSessionId();
    // Use the hardcoded style that the backend actually applies for controlnet
    const controlnetStyle = "Bold Black Ink Tattoo Design";
    const newSession: GenerationSession = {
      id: sessionId,
      basePrompt,
      style: controlnetStyle,
      refinement: '',
      images: [],
      generating: true,
      progress: 0,
      error: null
    };

    // Update UI to show "custom" prompt and "Solid Black" style
    setPrompt("custom");
    setSelectedStyle("Solid Black");

    setCurrentSession(newSession);
    setHeroImage(null);
    announce('Generating 16 tattoo variations from your drawing...');

    try {
      const formData = new FormData();
      formData.append('prompt', basePrompt);
      formData.append('style', style);
      formData.append('controlImage', controlImage);

      const resp = await fetch(`${API_BASE}/api/generate-controlnet`, {
        method: 'POST',
        body: formData
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${resp.status}`);
      }

      const { projectId } = await resp.json();

      // Listen to SSE events for this project (same as regular generation)
      const es = new EventSource(`${API_BASE}/api/progress/${projectId}`);

      es.onmessage = (evt) => {
        let data;
        try {
          data = JSON.parse(evt.data);
        } catch (err) {
          console.error('[SSE] Invalid JSON:', evt.data);
          return;
        }

        setCurrentSession(prev => {
          if (!prev || prev.id !== sessionId) return prev;

          if (data.type === 'connected') {
            return prev;
          }

          if (data.type === 'progress') {
            return { ...prev, progress: Number(data.progress) || 0 };
          }

          if (data.type === 'jobCompleted' && data.job?.resultUrl) {
            const newImage: TattooImage = {
              id: nextImageId(),
              url: data.job.resultUrl,
              prompt: data.job.positivePrompt || basePrompt,
              loadTime: Date.now()
            };

            const updatedImages = [...prev.images, newImage];
            announce(`${updatedImages.length} of 16 tattoos ready`);

            return { ...prev, images: updatedImages };
          }

          if (data.type === 'completed') {
            es.close();
            announce('All 16 variations complete!');

            // Add to history
            setSessionHistory(history => [prev, ...history.slice(0, 9)]);

            return { ...prev, generating: false, sse: null };
          }

          if (data.type === 'error' || data.type === 'jobFailed') {
            es.close();
            announce('Generation failed');
            return { ...prev, generating: false, sse: null, error: data.error || 'Generation failed' };
          }

          return prev;
        });
      };

      es.onerror = () => {
        es.close();
        setCurrentSession(prev => prev ? { ...prev, generating: false, sse: null, error: 'Connection error' } : null);
      };

      setCurrentSession(prev => prev ? { ...prev, sse: es } : null);
    } catch (err: any) {
      setCurrentSession(prev => prev ? { ...prev, generating: false, error: err?.message || 'Failed to start generation' } : null);
    }
  };

  const handleRefinementClick = (option: typeof HERO_REFINEMENT_OPTIONS[0]) => {
    if (!heroImage || !currentSession) return;

    const seed = option.lockSeed ? currentSession.seed : -1; // -1 for random seed
    startHeroGeneration(heroImage.prompt, selectedStyle, option.value, seed);
  };

  const handleImageClick = (image: TattooImage) => {
    if (!currentSession) return;

    const index = currentSession.images.findIndex(img => img.id === image.id);

    // Get the clicked image element for smooth transition
    const clickedImage = document.querySelector(`[data-image-index="${index}"]`) as HTMLElement;
    if (clickedImage) {
      // Add a smooth scale-up animation to the clicked image
      clickedImage.style.transform = 'scale(1.2)';
      clickedImage.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      clickedImage.style.zIndex = '500';

      // Slight delay before showing hero mode for smoother transition
      setTimeout(() => {
        setHeroImage(image);
        setHeroIndex(index);
        setHeroSession(null); // Clear any previous hero session
      }, 200);
    } else {
      setHeroImage(image);
      setHeroIndex(index);
      setHeroSession(null);
    }
  };

  const navigateHero = (direction: 'prev' | 'next') => {
    // Use heroSession images if we're in refinement mode, otherwise use currentSession
    const activeSession = heroSession || currentSession;
    if (!activeSession || activeSession.images.length === 0) return;

    let newIndex;
    if (direction === 'prev') {
      newIndex = heroIndex > 0 ? heroIndex - 1 : activeSession.images.length - 1;
    } else {
      newIndex = heroIndex < activeSession.images.length - 1 ? heroIndex + 1 : 0;
    }

    setHeroIndex(newIndex);
    setHeroImage(activeSession.images[newIndex]);
    // Don't clear heroSession when navigating within refinement mode
  };

  // Mobile touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !heroImage) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }, [isMobile, heroImage]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !heroImage || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Reset touch start
    touchStartRef.current = null;

    // Only process swipes (not taps or long presses)
    if (deltaTime > 500 || Math.abs(deltaY) > Math.abs(deltaX)) return;

    // Minimum swipe distance (in pixels)
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - go to previous image
        navigateHero('prev');
      } else {
        // Swipe left - go to next image
        navigateHero('next');
      }

      // Prevent default to avoid any scrolling
      e.preventDefault();
    }
  }, [isMobile, heroImage, navigateHero]);

  const handleSuggest = () => {
    const randomSuggestion = TATTOO_SUGGESTIONS[Math.floor(Math.random() * TATTOO_SUGGESTIONS.length)];
    setPrompt(randomSuggestion);
  };

  // Handle smooth hero mode exit
  const closeHeroMode = useCallback(() => {
    const heroElement = document.querySelector('.hero-mode') as HTMLElement;
    if (heroElement) {
      heroElement.style.animation = 'heroFadeOut 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards';
      setTimeout(() => {
        setHeroImage(null);
        setHeroSession(null);
      }, 600);
    } else {
      setHeroImage(null);
      setHeroSession(null);
    }
  }, []);

  // Exit refinement mode and return to original batch
  const exitRefinementMode = useCallback(() => {
    if (!currentSession || !heroSession) return;

    // Find the original image in the current session that matches the hero image prompt
    const originalImage = currentSession.images.find(img => img.prompt === heroImage?.prompt);
    if (originalImage) {
      const originalIndex = currentSession.images.findIndex(img => img.id === originalImage.id);
      setHeroIndex(originalIndex);
      setHeroImage(originalImage);
    }
    setHeroSession(null);
  }, [currentSession, heroSession, heroImage]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    if (e.key === ' ' && heroImage && originalSketch) {
      e.preventDefault();
      setShowOriginalSketch(!showOriginalSketch);
    }
  };

    return (
    <div className="app" onKeyDown={handleKeyDown}>
      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" ref={liveRegionRef} />

      {/* Hero Mode */}
      {heroImage && (
        <div
          className="hero-mode"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Central Hero Image */}
          <div className="hero-center">
            {showOriginalSketch && originalSketch ? (
              <img
                src={originalSketch}
                alt="Original sketch"
                className="hero-main-image"
              />
            ) : (
              <img
                src={heroImage.url}
                alt="Selected tattoo design"
                className="hero-main-image"
              />
            )}
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
                <button
                  className="hero-prompt-close"
                  onClick={closeHeroMode}
                  aria-label="Close hero view"
                >
                  ×
                </button>
              </div>
            )}
            {/* Exit refinement mode button - positioned inside hero-center */}
            {heroSession && !heroSession.generating && (
              <div className="refinement-exit-container">
                <div className="refinement-combined-container">
                  <div className="refinement-combined-text">
                    <strong>Add {heroSession.refinement.includes('Color') ? 'More Color' : heroSession.refinement.replace('More ', '')}</strong>
                  </div>
                  <button
                    className="refinement-close-btn"
                    onClick={exitRefinementMode}
                    aria-label="Return to original hero"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

                    {/* Navigation arrows */}
          <button
            className="hero-nav hero-nav-left"
            onClick={() => navigateHero('prev')}
            aria-label="Previous image"
          >
            ←
          </button>
          <button
            className="hero-nav hero-nav-right"
            onClick={() => navigateHero('next')}
            aria-label="Next image"
          >
            →
          </button>

          {/* Image counter */}
          <div className="hero-counter">
            {heroIndex + 1} / {(heroSession || currentSession)?.images.length || 0}
            {isMobile && (
              <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem' }}>
                Swipe to navigate
              </div>
            )}
            {/* Spacebar toggle indicator for controlnet sessions */}
            {originalSketch && (
              <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem', color: '#ff6b35' }}>
                <span style={{ background: 'rgba(255,107,53,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                  SPACE
                </span> {showOriginalSketch ? 'Show design' : 'Show sketch'}
              </div>
            )}
          </div>

          {/* Show either refinement options or generated variations */}
          {!heroSession ? (
            /* Refinement Options Grid */
            <div className="hero-options-grid">
              {HERO_REFINEMENT_OPTIONS.map((option, index) => {
                const angle = (index * 360) / 16;
                // Generate rainbow colors across the full spectrum
                const hue = (index * 360) / HERO_REFINEMENT_OPTIONS.length;
                const rainbowColor = `hsl(${hue}, 70%, 60%)`;
                const rainbowColorHover = `hsl(${hue}, 80%, 50%)`;

                return (
                  <div
                    key={option.label}
                    className="hero-option"
                    style={{
                      '--angle': `${angle}deg`,
                      '--delay': `${index * 0.05}s`,
                      '--rainbow-color': rainbowColor,
                      '--rainbow-color-hover': rainbowColorHover
                    } as React.CSSProperties}
                    onClick={() => handleRefinementClick(option)}
                  >
                    <span className="option-label">{option.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Generated Variations Orbit */
            <div className="orbit-container">
              {heroSession.images.map((image, index) => {
                const angle = (index * 360) / 16;
                return (
                  <div
                    key={image.id}
                    className="orbit-image"
                    style={{
                      '--angle': `${angle}deg`,
                      '--delay': `${index * 0.1}s`
                    } as React.CSSProperties}
                    onClick={() => {
                      const newIndex = heroSession.images.findIndex(img => img.id === image.id);
                      setHeroIndex(newIndex);
                      setHeroImage(image);
                      // Keep heroSession active when clicking on refinement images
                    }}
                  >
                    <img
                      src={image.url}
                      alt={`Variation ${index + 1}`}
                      className="orbit-img"
                    />
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
          <div className="draw-center">
            <div className="draw-controls">
              <input
                type="text"
                value={visionPrompt}
                onChange={(e) => setVisionPrompt(e.target.value)}
                placeholder="describe your vision"
                className="vision-input"
              />
              
              <div className="draw-tools">
                <div className="brush-size-control">
                  <label>Brush Size:</label>
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="brush-slider"
                  />
                  <span>{brushSize}px</span>
                </div>
                
                <button onClick={clearCanvas} className="clear-btn">
                  Clear Canvas
                </button>
              </div>
              
              <button
                onClick={handleCreate}
                disabled={!visionPrompt.trim()}
                className="create-btn"
              >
                Create
              </button>
            </div>
            
            <canvas
              ref={canvasRef}
              width={1024}
              height={1024}
              className="drawing-canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            
            <button
              className="draw-close"
              onClick={() => setIsDrawMode(false)}
              aria-label="Close draw mode"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Mode - Circular Layout */}
      {!heroImage && !isDrawMode && (
        <div className="main-mode">
                    {/* Central Input Area */}
          <div className="center-input">
            <img
              src="/slothi.png"
              alt="Slothicorn mascot"
              className="mascot"
            />
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
                <button
                  onClick={handleSuggest}
                  className="suggest-btn"
                  disabled={currentSession?.generating}
                  title="Get a random suggestion"
                >
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
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>

                                <div className="button-group">
                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || currentSession?.generating}
                      className="generate-btn"
                    >
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
                    <button
                      onClick={handleDrawModeToggle}
                      disabled={currentSession?.generating}
                      className="draw-btn"
                    >
                      Draw
                    </button>
                  </div>
                </div>



            {/* Error Display */}
            {currentSession?.error && (
              <div className="error-message">
                {currentSession.error}
              </div>
            )}
          </div>

          {/* Circular Image Layout */}
          {currentSession && (
            <div className="circle-container">
              {currentSession.images.map((image, index) => {
                const angle = (index * 360) / 16;
                return (
                  <div
                    key={image.id}
                    className="circle-image"
                    style={{
                      '--angle': `${angle}deg`,
                      '--delay': `${index * 0.1}s`
                    } as React.CSSProperties}
                    onClick={() => handleImageClick(image)}
                  >
                    <img
                      src={image.url}
                      alt={`Tattoo concept ${index + 1}`}
                      className="circle-img"
                      data-image-index={index}
                    />
                  </div>
                );
              })}


            </div>
          )}
        </div>
      )}
    </div>
  );
}
