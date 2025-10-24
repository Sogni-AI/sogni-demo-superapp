// web/src/components/MobileStyles.tsx
import React from 'react';

/**
 * MobileStyles
 *
 * This is the original CSS token & layout injection from App.tsx,
 * preserved verbatim so Draw Mode and desktop "pro" layout render identically.
 */
export default function MobileStyles() {
  return (
    <style>{`
    :root {
      --brand: #ff6b35;
      --bg-app: #0e0f11;
      --bg-app-2: #101113;
      --card-bg: #ffffff;
      --text-strong: #0f1115;
      --text: #dee1e7;
      --text-muted: #9aa0a6;

      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;

      --radius-2: 12px;
      --radius-3: 16px;

      --shadow-1: 0 4px 12px rgba(0,0,0,.18);
      --shadow-2: 0 10px 30px rgba(0,0,0,.22);
      --border-soft: 1px solid rgba(0,0,0,.06);
      --border-soft-dark: 1px solid rgba(255,255,255,.06);
    }

    /* Fullscreen shell for Draw Mode (native app vibe) */
    .draw-mode {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background:
        radial-gradient(1200px 800px at 50% -10%, var(--bg-app-2) 0%, var(--bg-app) 60%, #0b0c0e 100%);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: stretch;
      padding: calc(env(safe-area-inset-top) + var(--space-4)) var(--space-4)
               calc(env(safe-area-inset-bottom) + var(--space-6));
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    /* Center column with mobile maximum; scales up on tablets/desktop */
    .draw-center {
      width: 100%;
      max-width: 520px; /* iPhone "app card" width */
      display: grid;
      grid-template-rows: auto auto auto 1fr auto;
      row-gap: var(--space-4);
      position: relative;
    }

    /* Header (app bar) */
    .mobile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .mobile-title {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: .2px;
      color: #f3f5f9;
      margin: 0 auto;
    }
    .icon-btn {
      inline-size: 40px;
      block-size: 40px;
      display: inline-grid;
      place-items: center;
      border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.04);
      color: #f3f5f9;
      cursor: pointer;
      transition: transform .06s ease;
    }
    .icon-btn:active { transform: scale(.98); }

    /* Input + tools */
    .vision-input {
      width: 100%;
      height: 44px;
      border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.05);
      color: #f3f5f9;
      padding: 0 var(--space-3);
      outline: none;
    }

    .draw-controls .tools-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-3);
      align-items: center;
    }
    .tool-buttons, .color-buttons, .size-control, .io-buttons, .toggle-buttons, .undo-redo-buttons, .symmetry-buttons {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .tool-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .tool-group .group-label {
      font-size: 0.8rem;
      opacity: .7;
      margin-right: 6px;
    }

    .tool-btn, .color-btn, .clear-btn {
      min-width: 40px;
      height: 40px;
      border-radius: 10px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.05);
      color: #f3f5f9;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      transition: transform .06s ease, background .2s ease;
      user-select: none;
    }
    .tool-btn.active, .color-btn.active,
    .tool-btn[aria-pressed="true"] {
      background: rgba(255,255,255,.12);
      outline: 1px solid rgba(255,255,255,.12);
    }
    .tool-btn:active, .color-btn:active, .clear-btn:active { transform: scale(.98); }
    .color-btn.white { color: #fff; }
    .color-btn.black { color: #000; background: #fff; }

    .size-control label { opacity: .75; margin-right: var(--space-2); }
    .size-control span { opacity: .75; margin-left: var(--space-2); }

    /* Canvas card */
    .mobile-card {
      background: transparent;
      color: var(--text);
      border-radius: var(--radius-3);
      box-shadow: none;
      padding: 0;
      border: none;
    }

    .drawing-canvas-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin-inline: auto;
      position: relative;
    }
    .drawing-canvas {
      display: block;
      margin: 0 auto;
      width: 100%;
      height: auto;
      aspect-ratio: 1 / 1; /* 🔒 always square in CSS */
      border-radius: 14px;
      box-shadow:
        inset 0 0 0 1px rgba(0,0,0,.06),
        0 1px 0 rgba(255,255,255,.5);
      touch-action: none; /* ensure no scroll/zoom interference while drawing */
      user-select: none;
      -webkit-user-select: none;
      background: #ffffff;
      cursor: crosshair;
    }

    /* Grid & guides overlay */
    .grid-overlay, .sym-guides {
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: 14px;
    }
    .grid-overlay {
      background:
        linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 100%),
        repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 32px),
        repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 32px);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
    }
    .sym-guides::before, .sym-guides::after {
      content: "";
      position: absolute;
      background: rgba(255,107,53,0.25);
    }
    .sym-guides.h::before {
      top: 50%; left: 0; right: 0; height: 2px; transform: translateY(-1px);
    }
    .sym-guides.v::after {
      left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-1px);
    }

    /* Subtle drop target */
    .drop-overlay { border-radius: 14px !important; }

    /* Footer CTA */
    .create-btn {
      width: 100%;
      height: 48px;
      border-radius: 12px;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      letter-spacing: .2px;
      border: none;
      box-shadow: 0 8px 20px rgba(255,107,53,.35);
    }
    .create-btn:disabled { opacity: .6; box-shadow: none; }

    /* Legacy close visible on desktop */
    .draw-close {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      inline-size: 40px;
      block-size: 40px;
      border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,.05);
      color: #f3f5f9;
      display: none;
    }

    /* Non-hero list images polish (keeps perf) */
    .circle-img, .orbit-img { border-radius: 12px; background: #fff; }

    /* Edit Modal Styles (unchanged) */
    .edit-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 2000;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
    }
    .edit-modal {
      background: var(--bg-app);
      border-radius: var(--radius-3);
      border: var(--border-soft-dark);
      box-shadow: var(--shadow-2);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .edit-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-5) var(--space-3);
      border-bottom: var(--border-soft-dark);
    }
    .edit-modal-header h3 {
      margin: 0;
      color: #f3f5f9;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .edit-modal-close {
      background: none;
      border: none;
      color: #f3f5f9;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .edit-modal-close:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .edit-modal-content { padding: var(--space-4) var(--space-5); }
    .edit-field { margin-bottom: var(--space-4); }
    .edit-field label {
      display: block;
      color: #f3f5f9;
      font-weight: 600;
      margin-bottom: var(--space-2);
      font-size: 0.9rem;
    }
    .edit-prompt-input, .edit-style-input, .edit-controlnet-select {
      width: 100%;
      padding: var(--space-3);
      border-radius: 8px;
      border: var(--border-soft-dark);
      background: rgba(255, 255, 255, 0.05);
      color: #f3f5f9;
      font-size: 0.9rem;
      resize: vertical;
    }
    .edit-prompt-input:focus, .edit-style-input:focus, .edit-controlnet-select:focus {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.2);
    }
    .edit-modal-actions {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5) var(--space-5);
      border-top: var(--border-soft-dark);
    }
    .edit-cancel-btn, .edit-generate-btn {
      flex: 1;
      padding: var(--space-3) var(--space-4);
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .edit-cancel-btn {
      background: rgba(255, 255, 255, 0.1);
      border: var(--border-soft-dark);
      color: #f3f5f9;
    }
    .edit-cancel-btn:hover { background: rgba(255, 255, 255, 0.15); }
    .edit-generate-btn {
      background: var(--brand);
      border: none;
      color: #fff;
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
    }
    .edit-generate-btn:hover:not(:disabled) {
      background: #e55a2b;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4);
    }
    .edit-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }

    @media (min-width: 768px) {
      .draw-center { max-width: 820px; }
      .draw-close { display: inline-grid; place-items: center; }
      .draw-controls .tools-row {
        grid-template-columns: 1fr auto auto 1fr auto auto;
      }
    }

    /* ======== Pro Desktop Layout (>= 1024px) ======== */
    @media (min-width: 1024px) {
      .draw-mode { padding: var(--space-6); }

      .draw-pro {
        display: grid;
        grid-template-areas:
          "topbar topbar topbar"
          "left   canvas right";
        grid-template-columns: 72px 1fr 340px;
        grid-template-rows: 56px 1fr;
        width: 100%;
        max-width: 1600px;
        gap: var(--space-4);
      }

      .topbar {
        grid-area: topbar;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
        padding: 8px;
      }
      .tb-left, .tb-center, .tb-right {
        display: flex; align-items: center; gap: var(--space-2);
      }
      .tb-center { flex: 1 1 auto; }
      .tb-title { font-weight: 700; letter-spacing: .3px; opacity: .9; }
      .vision-input.pro {
        height: 40px; width: 100%;
        border-radius: 10px;
      }
      .create-btn.pro { width: auto; padding: 0 var(--space-4); height: 40px; }

      .left-rail {
        grid-area: left;
        display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
        padding: var(--space-2);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
      }
      .left-rail .tool-btn { width: 44px; height: 44px; }
      .rail-divider {
        width: 100%; height: 1px; background: rgba(255,255,255,.1);
        margin: var(--space-2) 0;
      }

      .canvas-region {
        grid-area: canvas;
        display: flex; flex-direction: column;
        gap: var(--space-3);
        align-items: center; justify-content: center;
      }
      .canvas-holder {
        width: 100%;
        max-width: 1000px;
        margin-inline: auto;
        position: relative;
      }
      .canvas-holder .drawing-canvas {
        max-height: calc(100vh - 220px);
        width: min(100%, 1000px);
        aspect-ratio: 1 / 1;
      }
      .shortcut-hint { font-size: .85rem; opacity: .7; text-align: center; }

      .right-panel {
        grid-area: right;
        display: flex; flex-direction: column; gap: var(--space-3);
        padding: var(--space-3);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
        min-width: 0;
      }
      .panel-section {
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 10px;
        padding: var(--space-3);
      }
      .panel-section h4 {
        margin: 0 0 var(--space-2);
        font-size: .9rem; opacity: .85;
      }
      .row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
      .kv { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    }
  `}</style>
  );
}
