// web/src/components/HeroMode.tsx
import React, { useRef, useState, useEffect } from 'react';
import { ControlnetIteration, GenerationSession, TattooImage } from '../types';
import { HERO_REFINEMENT_OPTIONS } from '../constants';

type HeroModeProps = {
  heroImage: TattooImage;
  heroIndex: number;
  currentSession: GenerationSession | null;
  heroSession: GenerationSession | null;
  selectedStyle: string;
  controlnetType: string;
  isMobile: boolean;

  showOriginalSketch: boolean;
  setShowOriginalSketch: React.Dispatch<React.SetStateAction<boolean>>;
  currentHistoryIndex: number;
  setCurrentHistoryIndex: React.Dispatch<React.SetStateAction<number>>;

  isInitiatingRefinement: boolean;

  onNavigate: (dir: 'prev' | 'next') => void;
  onClose: () => void;
  onRefineClick: (option: typeof HERO_REFINEMENT_OPTIONS[number]) => void;
  onOpenEdit: () => void;
  onSelectOrbitImage: (image: TattooImage) => void;

  originalSketch?: string | null;
  getLastNonOriginalIndex: (hist: ControlnetIteration[] | undefined) => number;
  handleSpacebarToggle: () => void;

  // Accessibility helpers (optional)
  autoFocus?: boolean;
};

export default function HeroMode(props: HeroModeProps) {
  const {
    heroImage, heroIndex, currentSession, heroSession, selectedStyle, controlnetType, isMobile,
    showOriginalSketch, setShowOriginalSketch, currentHistoryIndex, setCurrentHistoryIndex,
    isInitiatingRefinement,
    onNavigate, onClose, onRefineClick, onOpenEdit, onSelectOrbitImage,
    originalSketch, getLastNonOriginalIndex, handleSpacebarToggle, autoFocus
  } = props;

  // Touch gesture handling for mobile swipes
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  // Fade out swipe hint after 3 seconds
  useEffect(() => {
    if (isMobile && showSwipeHint) {
      const timer = setTimeout(() => {
        setShowSwipeHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, showSwipeHint]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsSwipeInProgress(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current) return;

    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Check if horizontal swipe is more significant than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      setIsSwipeInProgress(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current || !isSwipeInProgress) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Swipe threshold (50px minimum)
    const minSwipeDistance = 50;

    // Check for horizontal swipe
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - go to previous image
        onNavigate('prev');
      } else {
        // Swipe left - go to next image
        onNavigate('next');
      }
    }

    // Check for vertical swipe down to close
    if (deltaY > minSwipeDistance * 2 && Math.abs(deltaY) > Math.abs(deltaX)) {
      onClose();
    }

    touchStartX.current = null;
    touchStartY.current = null;
    setIsSwipeInProgress(false);
  };

  // Double tap to toggle original sketch
  const lastTapTime = useRef<number>(0);
  const handleDoubleTap = (e: React.TouchEvent) => {
    const currentTime = new Date().getTime();
    const tapDelay = currentTime - lastTapTime.current;

    if (tapDelay < 300 && tapDelay > 0) {
      // Double tap detected
      e.preventDefault();
      handleSpacebarToggle();
    }

    lastTapTime.current = currentTime;
  };

  // Download current image
  const handleDownload = async () => {
    // Get the current image being displayed
    let imageToDownload = heroImage;
    if (heroSession && heroSession.images[heroIndex]) {
      imageToDownload = heroSession.images[heroIndex];
    }

    if (!imageToDownload || imageToDownload.isNSFW) return;

    // For mobile devices (iOS/Android), open image in new tab for native save
    if (isMobile) {
      // Open the image in a new tab/window
      // This allows users to long-press and save to camera roll on iOS
      // or use the native save options on Android
      window.open(imageToDownload.url, '_blank');

      // Show a brief instruction overlay
      const instruction = document.createElement('div');
      instruction.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        pointer-events: none;
        animation: fadeInOut 3s ease-in-out;
      `;
      instruction.textContent = 'Long press the image to save to camera roll';
      document.body.appendChild(instruction);

      setTimeout(() => {
        instruction.remove();
      }, 3000);

      return;
    }

    // Desktop download behavior (unchanged)
    try {
      const response = await fetch(imageToDownload.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      a.href = url;
      a.download = `sogni-tattoo-${date}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 800);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  return (
    <div
      className="hero-mode"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onNavigate('prev'); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onNavigate('next'); }
        if (e.key === 'Escape') { onClose(); }
        if (e.key === ' ') { e.preventDefault(); handleSpacebarToggle(); }
      }}
      autoFocus={autoFocus}
    >
      {/* Central Hero Image */}
      <div
        className="hero-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchEndCapture={handleDoubleTap}
      >
        {(() => {
          const activeSession = heroSession || currentSession;
          const historySession = activeSession === heroSession ? heroSession : currentSession;
          const history = historySession?.controlnetHistory || [];
          const stickyCompare = historySession?.compareAgainstUrl || originalSketch || '';

          if (showOriginalSketch) {
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

          return <img src={heroImage.url} alt="Selected tattoo design" className="hero-main-image" />;
        })()}

        {heroSession?.generating && (
          <div className="hero-loading">
            <div className="hero-loading-spinner"></div>
          </div>
        )}

        {/* Mobile swipe hint */}
        {isMobile && showSwipeHint && (
          <div className="mobile-swipe-hint" style={{
            animation: 'hintFadeInOut 3.5s forwards'
          }}>
            ← Swipe to navigate →
          </div>
        )}

        {/* Mobile close button */}
        {isMobile && (
          <button
            className="mobile-hero-close"
            onClick={onClose}
            aria-label="Close hero view"
          >
            ×
          </button>
        )}

        {!heroSession && (
          <div className="hero-prompt-container">
            <div
              className="hero-prompt-text"
              onClick={onOpenEdit}
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
            <button className="hero-prompt-close" onClick={onClose} aria-label="Close hero view" tabIndex={-1}>×</button>
          </div>
        )}

        {heroSession && !heroSession.generating && (
          <div className="hero-prompt-container">
            <div
              className="hero-prompt-text"
              onClick={onOpenEdit}
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
            <button className="hero-prompt-close" onClick={onClose} aria-label="Close hero view" tabIndex={-1}>×</button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <button className="hero-nav hero-nav-left" onClick={() => onNavigate('prev')} aria-label="Previous image" tabIndex={-1}>←</button>
      <button className="hero-nav hero-nav-right" onClick={() => onNavigate('next')} aria-label="Next image" tabIndex={-1}>→</button>

      {/* Counter + helper */}
      <div
        className="hero-counter"
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); handleSpacebarToggle(); }}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSpacebarToggle();
          }
        }}
        style={{ cursor: isMobile ? 'default' : 'pointer' }}
        aria-label="Toggle compare (Space or Enter)"
      >
        {isMobile ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{heroIndex + 1} / {(heroSession || currentSession)?.images.length || 0}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Swipe to navigate</span>
            </div>
            {(() => {
              const activeSession = heroSession || currentSession;
              const historySession = activeSession === heroSession ? heroSession : currentSession;
              const history = historySession?.controlnetHistory || [];
              const stickyCompare = historySession?.compareAgainstUrl || originalSketch || '';

              if (heroSession && (history.length > 0 || stickyCompare)) {
                const lastIdx = getLastNonOriginalIndex(history);
                const hasCompare = lastIdx !== -1 || !!stickyCompare;
                if (hasCompare) {
                  const currentLabel = showOriginalSketch ? 'Parent influence' : 'Current design';
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#ff6b35', fontSize: '0.8rem' }}>
                        {currentLabel} ({showOriginalSketch ? '1' : '2'}/2)
                      </span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        Tap to toggle
                      </span>
                    </div>
                  );
                }
              }

              if (history.length > 0) {
                const totalStates = history.length + 1;
                const labelFor = (i: number) => {
                  if (i < history.length) return history[i]?.isOriginalSketch ? 'Original sketch' : `Iteration ${i}`;
                  return 'Current design';
                };
                const currentLabel = labelFor(currentHistoryIndex);

                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ff6b35', fontSize: '0.8rem' }}>
                      {currentLabel} ({currentHistoryIndex + 1}/{totalStates})
                    </span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      Tap to cycle
                    </span>
                  </div>
                );
              } else if (stickyCompare) {
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#ff6b35', fontSize: '0.8rem' }}>
                      Compare mode
                    </span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      Tap to toggle
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </>
        ) : (
          <>
            {heroIndex + 1} / {(heroSession || currentSession)?.images.length || 0}
            {(() => {
              const activeSession = heroSession || currentSession;
              const historySession = activeSession === heroSession ? heroSession : currentSession;
              const history = historySession?.controlnetHistory || [];
              const stickyCompare = historySession?.compareAgainstUrl || originalSketch || '';

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
                        <span style={{ opacity: 0.6, marginLeft: 8 }}>
                          ({showOriginalSketch ? '1' : '2'}/2)
                        </span>
                      </div>
                      <div>
                        <span style={{ background: 'rgba(255,107,53,0.2)', padding: '2px 6px', borderRadius: 4 }}>
                          SPACE or CLICK
                        </span>{' '}
                        Show {nextLabel}
                      </div>
                    </div>
                  );
                }
              }

              if (history.length > 0) {
                const totalStates = history.length + 1;
                const nextIndex = (currentHistoryIndex + 1) % totalStates;

                const labelFor = (i: number) => {
                  if (i < history.length) return history[i]?.isOriginalSketch ? 'original sketch' : `iteration ${i}`;
                  return 'current design';
                };

                const currentLabel = labelFor(currentHistoryIndex).replace(/\b\w/g, s => s.toUpperCase());
                const nextLabel = labelFor(nextIndex);

                return (
                  <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem', color: '#ff6b35' }}>
                    <div style={{ marginBottom: '2px' }}>
                      {currentLabel}
                      <span style={{ opacity: 0.6, marginLeft: 8 }}>
                        ({currentHistoryIndex + 1}/{totalStates})
                      </span>
                    </div>
                    <div>
                      <span style={{ background: 'rgba(255,107,53,0.2)', padding: '2px 6px', borderRadius: 4 }}>
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
                      <span style={{ background: 'rgba(255,107,53,0.2)', padding: '2px 6px', borderRadius: 4 }}>
                        SPACE or CLICK
                      </span>{' '}
                      Toggle compare
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {/* Refinement options or orbit of refinement results */}
      {!heroSession ? (
        isMobile ? (
          // Mobile refinement options - scrollable bottom sheet
          <div className="mobile-hero-options">
            <div className="mobile-options-header">
              <span className="options-title">
                {isInitiatingRefinement ? 'Starting generation...' : 'Refine Design'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="options-edit-btn"
                  onClick={handleDownload}
                  disabled={isInitiatingRefinement}
                  aria-label="Download image"
                >
                  ⬇ Download
                </button>
                <button className="options-edit-btn" onClick={onOpenEdit} disabled={isInitiatingRefinement}>
                  Edit Prompt
                </button>
              </div>
            </div>
            <div className="mobile-options-scroll">
              {isInitiatingRefinement ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  <div className="hero-loading-spinner" style={{ margin: '0 auto 20px' }}></div>
                  <div>Generating variations...</div>
                </div>
              ) : (
                HERO_REFINEMENT_OPTIONS.map((option, index) => {
                  const hue = (index * 360) / HERO_REFINEMENT_OPTIONS.length;
                  const accentColor = `hsl(${hue}, 70%, 55%)`;

                  return (
                    <button
                      key={option.label}
                      className="mobile-option-btn"
                      style={
                        {
                          '--accent-color': accentColor,
                          '--appear-delay': `${index * 0.03}s`
                        } as React.CSSProperties
                      }
                      onClick={() => onRefineClick(option)}
                      disabled={isInitiatingRefinement}
                    >
                      <span className="option-emoji">{option.emoji || '✨'}</span>
                      <span className="option-text">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          // Desktop circular layout
          <div className="hero-options-grid">
            {isInitiatingRefinement ? (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                zIndex: 10
              }}>
                <div className="hero-loading-spinner" style={{ margin: '0 auto 20px' }}></div>
                <div style={{ fontSize: '1.1rem' }}>Generating variations...</div>
              </div>
            ) : null}
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
                      '--rainbow-color-hover': rainbowColorHover,
                      opacity: isInitiatingRefinement ? 0.3 : 1,
                      pointerEvents: isInitiatingRefinement ? 'none' : 'auto'
                    } as React.CSSProperties
                  }
                  onClick={() => !isInitiatingRefinement && onRefineClick(option)}
                >
                  <span className="option-label">{option.label}</span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        isMobile ? (
          // Mobile orbit results - grid layout
          <div className="mobile-hero-results">
            <div className="mobile-results-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="results-title">Refinement Results</span>
                <span className="results-count">
                  {heroSession.generating && heroSession.images.length === 0
                    ? 'Loading...'
                    : `${heroSession.images.length} / 16`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="options-edit-btn"
                  onClick={handleDownload}
                  aria-label="Download image"
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  ⬇ Download
                </button>
                <button
                  className="options-edit-btn"
                  onClick={onOpenEdit}
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  Edit Prompt
                </button>
              </div>
            </div>
            <div className="mobile-results-grid">
              {heroSession.generating && heroSession.images.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#888',
                  fontSize: '0.9rem'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #333',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 15px'
                  }}></div>
                  <div>Generating refinement designs...</div>
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.7 }}>
                    This may take a few moments
                  </div>
                </div>
              ) : (
                heroSession.images.map((image, index) => (
                  <div
                    key={image.id}
                    className="mobile-result-item"
                    style={{ '--appear-delay': `${index * 0.03}s` } as React.CSSProperties}
                    onClick={() => { if (!image.isNSFW) onSelectOrbitImage(image); }}
                  >
                    {image.isNSFW ? (
                      <div className="nsfw-placeholder" style={{ width: '100%', height: '100%' }}>
                        <span style={{ fontSize: '1.5rem' }}>🚫</span>
                      </div>
                    ) : (
                      <img src={image.url} alt={`Result ${index + 1}`} loading="lazy" />
                    )}
                    <span className="result-number">{index + 1}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          // Desktop circular orbit
          <div className="orbit-container">
            {heroSession.generating && heroSession.images.length === 0 ? (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: '#888',
                fontSize: '0.9rem'
              }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '3px solid #333',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px'
                }}></div>
                <div>Generating refinement designs...</div>
                <div style={{ marginTop: '10px', fontSize: '0.85rem', opacity: 0.7 }}>
                  This may take a few moments
                </div>
              </div>
            ) : (
              heroSession.images.map((image, index) => {
                const angle = (index * 360) / 16;
                return (
                  <div
                    key={image.id}
                    className="orbit-image"
                    style={{ '--angle': `${angle}deg`, '--delay': `${index * 0.1}s` } as React.CSSProperties}
                    onClick={() => { if (!image.isNSFW) onSelectOrbitImage(image); }}
                  >
                    {image.isNSFW ? (
                      <div className="nsfw-placeholder orbit-img">
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🚫</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Content Filtered</div>
                      </div>
                    ) : (
                      <img src={image.url} alt={`Variation ${index + 1}`} className="orbit-img" loading="lazy" decoding="async" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )
      )}
    </div>
  );
}
