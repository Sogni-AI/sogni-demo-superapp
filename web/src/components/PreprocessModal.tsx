// web/src/components/PreprocessModal.tsx
import React, { useEffect, useState } from 'react';

type PreprocessModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: { levels: number; contrast: number }) => void;
  /** Defaults if you want to seed from parent */
  defaultLevels?: number;    // 2..6
  defaultContrast?: number;  // 0..1 (strength)
};

/**
 * Simple modal that asks whether to preprocess the image for ControlNets.
 * Uses the same visual language/classes as EditModal for consistency.
 */
export default function PreprocessModal({
  open,
  onClose,
  onConfirm,
  defaultLevels = 3,
  defaultContrast = 0.8
}: PreprocessModalProps) {
  const [levels, setLevels] = useState<number>(defaultLevels);
  const [contrast, setContrast] = useState<number>(defaultContrast);

  // Keep local sliders in sync with parent-supplied defaults each time the modal opens
  useEffect(() => {
    if (!open) return;
    setLevels(defaultLevels);
    setContrast(defaultContrast);
  }, [open, defaultLevels, defaultContrast]);

  if (!open) return null;

  return (
    <div className="edit-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="edit-modal"
        onClick={(e) => e.stopPropagation()}
        aria-label="Preprocess Image Modal"
      >
        <div className="edit-modal-header">
          <h3>Preprocess image for ControlNets?</h3>
          <button onClick={onClose} className="edit-modal-close" aria-label="Close">×</button>
        </div>

        <div className="edit-modal-content">
          <p style={{ color: '#cfd3db', marginTop: 0 }}>
            Convert to high‑contrast black &amp; white and posterize to a few shades. This typically
            improves <strong>scribble/lineart</strong> guidance and reduces muddy results.
          </p>

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: '#cfd3db' }}>
              Advanced (optional)
            </summary>
            <div className="edit-field" style={{ marginTop: 12 }}>
              <label>Shades (posterize levels): <span style={{ opacity: 0.8 }}>{levels}</span></label>
              <input
                type="range"
                min={2}
                max={6}
                value={levels}
                onChange={(e) => setLevels(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div className="edit-field">
              <label>Contrast boost: <span style={{ opacity: 0.8 }}>{Math.round(contrast * 100)}%</span></label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(contrast * 100)}
                onChange={(e) => setContrast(Number(e.target.value) / 100)}
                style={{ width: '100%' }}
              />
            </div>
          </details>

          <div style={{ fontSize: '.85rem', opacity: .7, marginTop: 6 }}>
            You can always <strong>Undo</strong> (⌘/Ctrl+Z).
          </div>
        </div>

        <div className="edit-modal-actions">
          <button onClick={onClose} className="edit-cancel-btn">Keep as‑is</button>
          <button
            onClick={() => onConfirm({ levels, contrast })}
            className="edit-generate-btn"
          >
            Preprocess
          </button>
        </div>
      </div>
    </div>
  );
}
