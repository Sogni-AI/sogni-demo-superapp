// web/src/components/MobileImageGrid.tsx
import React, { useState, useRef, useEffect } from 'react';
import { TattooImage, GenerationSession } from '../types';

interface MobileImageGridProps {
  currentSession: GenerationSession;
  onImageClick: (image: TattooImage) => void;
  showOriginalSketch: boolean;
  originalSketch: string | null;
  currentHistoryIndex: number;
  isMobile: boolean;
}

const MobileImageGrid: React.FC<MobileImageGridProps> = ({
  currentSession,
  onImageClick,
  showOriginalSketch,
  originalSketch,
  currentHistoryIndex,
  isMobile
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'stack'>('grid');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-detect best view mode based on screen size
  useEffect(() => {
    const checkViewMode = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspectRatio = width / height;

      // Stack view for very narrow screens or portrait orientation
      if (width < 360 || (aspectRatio < 0.6 && height > 700)) {
        setViewMode('stack');
      } else {
        setViewMode('grid');
      }
    };

    checkViewMode();
    window.addEventListener('resize', checkViewMode);
    return () => window.removeEventListener('resize', checkViewMode);
  }, []);

  // Smooth scroll to new images as they appear - but only if user is near the bottom
  useEffect(() => {
    if (currentSession.images.length > 0 && scrollContainerRef.current) {
      // Don't auto-scroll, let user control the scrolling
      // This prevents the rapid-fire scrolling issue
    }
  }, [currentSession.images.length]);

  const handleImageTouch = (image: TattooImage, index: number) => {
    // Quick tap to preview, double tap to open
    if (selectedIndex === index) {
      onImageClick(image);
      setSelectedIndex(null);
    } else {
      setSelectedIndex(index);
      // Auto-clear selection after 3 seconds
      setTimeout(() => setSelectedIndex(null), 3000);
    }
  };

  // Handle compare overlay for controlnet
  const history = currentSession?.controlnetHistory || [];
  const compareUrl = currentSession?.compareAgainstUrl || originalSketch || '';

  if (showOriginalSketch && (history.length > 0 || compareUrl)) {
    let compareSrc = compareUrl;
    let altText = 'Compare image';
    if (history.length > 0 && currentHistoryIndex < history.length) {
      const currentIteration = history[currentHistoryIndex];
      if (currentIteration) {
        compareSrc = currentIteration.imageUrl || compareUrl;
        altText = currentIteration.isOriginalSketch ? 'Original sketch' : 'Previous iteration';
      }
    }

    return (
      <div className="mobile-compare-overlay">
        <img src={compareSrc} alt={altText} className="mobile-compare-image" />
        <div className="mobile-compare-label">{altText}</div>
      </div>
    );
  }

  // Render grid view for tablets and larger phones
  if (viewMode === 'grid') {
    return (
      <div className={`mobile-image-grid ${isMobile ? 'is-mobile' : ''} ${currentSession.images.length > 0 ? 'has-images' : ''}`}>
        {currentSession.images.map((image, index) => (
          <div
            key={image.id}
            className={`grid-image-item ${selectedIndex === index ? 'selected' : ''}`}
            style={{ '--appear-delay': `${index * 0.1}s` } as React.CSSProperties}
            onClick={() => onImageClick(image)}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleImageTouch(image, index);
            }}
          >
            {image.isNSFW ? (
              <div className="nsfw-placeholder">
                <div className="nsfw-icon">🚫</div>
                <div className="nsfw-text">Content Filtered</div>
              </div>
            ) : (
              <>
                <img
                  src={image.url}
                  alt={`Tattoo design ${index + 1}`}
                  className="grid-image"
                  loading="lazy"
                  decoding="async"
                />
                {selectedIndex === index && (
                  <div className="image-overlay">
                    <div className="overlay-text">Tap again to view</div>
                  </div>
                )}
              </>
            )}
            <div className="image-number">{index + 1}</div>
          </div>
        ))}

      </div>
    );
  }

  // Render stack view for very small screens
  return (
    <div className="mobile-image-stack" ref={scrollContainerRef}>
      {currentSession.images.map((image, index) => (
        <div
          key={image.id}
          className={`stack-image-card ${selectedIndex === index ? 'expanded' : ''}`}
          style={{ '--appear-delay': `${index * 0.08}s` } as React.CSSProperties}
        >
          {image.isNSFW ? (
            <div className="nsfw-placeholder-stack">
              <div className="nsfw-content">
                <div className="nsfw-icon">🚫</div>
                <div className="nsfw-text">Content Filtered</div>
              </div>
            </div>
          ) : (
            <div className="stack-image-wrapper" onClick={() => onImageClick(image)}>
              <img
                src={image.url}
                alt={`Tattoo design ${index + 1}`}
                className="stack-image"
                loading="lazy"
                decoding="async"
              />
              <div className="stack-image-info">
                <span className="stack-image-number">Design #{index + 1}</span>
                <button className="stack-view-btn">View Full</button>
              </div>
            </div>
          )}
        </div>
      ))}

    </div>
  );
};

export default MobileImageGrid;