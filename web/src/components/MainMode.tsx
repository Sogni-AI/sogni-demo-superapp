// web/src/components/MainMode.tsx
import React, { useState, useEffect } from 'react';
import { GenerationSession, TattooImage } from '../types';
import { BASE_STYLES, TATTOO_SUGGESTIONS } from '../constants';
import MobileImageGrid from './MobileImageGrid';

type MainModeProps = {
  prompt: string;
  setPrompt: (v: string) => void;
  selectedStyle: string;
  setSelectedStyle: (v: string) => void;
  styles: string[];

  currentSession: GenerationSession | null;
  originalSketch: string | null;
  showOriginalSketch: boolean;
  currentHistoryIndex: number;

  onGenerate: () => void;
  onSuggest: () => void;
  onOpenDraw: () => void;
  onImageClick: (image: TattooImage) => void;
};

export default function MainMode({
  prompt, setPrompt, selectedStyle, setSelectedStyle, styles,
  currentSession, originalSketch, showOriginalSketch, currentHistoryIndex,
  onGenerate, onSuggest, onOpenDraw, onImageClick
}: MainModeProps) {
  // Detect mobile/tablet for layout switching
  const [isMobile, setIsMobile] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window ||
        width <= 1023;
      setIsMobile(isMobileDevice);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Auto-collapse header when images appear on mobile
  useEffect(() => {
    if (isMobile && currentSession?.images && currentSession.images.length > 0) {
      setHeaderCollapsed(true);
    }
    // Reset when session is cleared
    if (!currentSession || currentSession.images.length === 0) {
      setHeaderCollapsed(false);
    }
  }, [isMobile, currentSession?.images]);

  return (
    <div className="main-mode">
      <div className={`center-input ${isMobile && headerCollapsed ? 'collapsed' : ''}`}>
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
            <button
              onClick={onSuggest}
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
            {styles.map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>

          <div className="button-group">
            <button onClick={onGenerate} disabled={!prompt.trim() || currentSession?.generating} className="generate-btn">
              {currentSession?.generating ? (<><div className="button-spinner"></div>Creating...</>) : 'Generate'}
            </button>
            <div className="button-separator"><span className="or-text">or</span></div>
            <button onClick={onOpenDraw} disabled={currentSession?.generating} className="draw-btn">Draw</button>
          </div>
        </div>

        {currentSession?.error && <div className="error-message">{currentSession.error}</div>}

        {!currentSession?.images?.length && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.7, textAlign: 'center' }}>
            Try something like “{TATTOO_SUGGESTIONS[0]}”, “{BASE_STYLES[0]}”, or paste in a photo in Draw mode.
          </div>
        )}

        {/* Spacebar hint (non-hero) */}
        {currentSession && (() => {
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

      {/* Floating button to show header when collapsed on mobile */}
      {isMobile && headerCollapsed && (
        <div className="mobile-floating-controls">
          <button
            className="floating-new-btn"
            onClick={() => setHeaderCollapsed(false)}
            title="New Generation"
          >
            <span className="floating-btn-icon">+</span>
            <span className="floating-btn-text">New</span>
          </button>
          {currentSession?.generating && (
            <button
              className="floating-cancel-btn"
              onClick={() => {
                // Cancel generation logic would go here
                currentSession?.sse?.close();
              }}
              title="Cancel Generation"
            >
              <span className="floating-btn-icon">×</span>
            </button>
          )}
        </div>
      )}

      {currentSession && (
        <>
          {/* Use MobileImageGrid for mobile/tablet, circular layout for desktop */}
          {isMobile ? (
            <MobileImageGrid
              currentSession={currentSession}
              onImageClick={onImageClick}
              showOriginalSketch={showOriginalSketch}
              originalSketch={originalSketch}
              currentHistoryIndex={currentHistoryIndex}
              isMobile={isMobile}
            />
          ) : (
            (() => {
              const history = currentSession?.controlnetHistory || [];
              const compareUrl = currentSession?.compareAgainstUrl || originalSketch || '';

              if (showOriginalSketch && (history.length > 0 || compareUrl)) {
                let compareSrc = compareUrl;
                let altText = 'Compare image';
                if (history.length > 0 && currentHistoryIndex < history.length) {
                  const currentIteration = history[currentHistoryIndex];
                  if (currentIteration) {
                    compareSrc = currentIteration.imageUrl || compareUrl;
                    altText = currentIteration.isOriginalSketch ? 'Original sketch' : `Previous iteration`;
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

              return (
                <div className="circle-container">
                  {currentSession.images.map((image, index) => {
                    const angle = (index * 360) / 16;
                    return (
                      <div
                        key={image.id}
                        className="circle-image"
                        style={{ '--angle': `${angle}deg`, '--delay': `${index * 0.1}s` } as React.CSSProperties}
                        onClick={() => onImageClick(image)}
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
            })()
          )}
        </>
      )}
    </div>
  );
}
