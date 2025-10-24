// web/src/components/HeroMode.tsx
import React from 'react';
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
    onNavigate, onClose, onRefineClick, onOpenEdit, onSelectOrbitImage,
    originalSketch, getLastNonOriginalIndex, handleSpacebarToggle, autoFocus
  } = props;

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
      <div className="hero-center">
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
        style={{ cursor: 'pointer' }}
        aria-label="Toggle compare (Space or Enter)"
      >
        {heroIndex + 1} / {(heroSession || currentSession)?.images.length || 0}
        {isMobile && <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '0.25rem' }}>Swipe to navigate</div>}

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
                onClick={() => onRefineClick(option)}
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
          })}
        </div>
      )}
    </div>
  );
}
