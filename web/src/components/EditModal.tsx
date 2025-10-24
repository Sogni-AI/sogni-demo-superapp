// web/src/components/EditModal.tsx
import React from 'react';

type EditModalProps = {
  open: boolean;
  onClose: () => void;
  isControlnet: boolean;

  editPrompt: string;
  setEditPrompt: (v: string) => void;

  editStyle: string;
  setEditStyle: (v: string) => void;

  editControlnetType: string;
  setEditControlnetType: (v: string) => void;

  onGenerate: () => void;
  canGenerate: boolean;
};

export default function EditModal({
  open, onClose, isControlnet,
  editPrompt, setEditPrompt,
  editStyle, setEditStyle,
  editControlnetType, setEditControlnetType,
  onGenerate, canGenerate
}: EditModalProps) {
  if (!open) return null;

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h3>Edit Generation Parameters</h3>
          <button onClick={onClose} className="edit-modal-close">×</button>
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

          {isControlnet && (
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
          <button onClick={onClose} className="edit-cancel-btn">Cancel</button>
          <button onClick={onGenerate} disabled={!canGenerate} className="edit-generate-btn">
            Generate 16 Variations
          </button>
        </div>
      </div>
    </div>
  );
}
