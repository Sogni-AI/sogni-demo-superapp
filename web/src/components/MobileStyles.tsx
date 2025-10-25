// web/src/components/MobileStyles.tsx
import React from 'react';

/**
 * MobileStyles
 *
 * Injects CSS tokens, base app theme, and responsive layouts.
 * Originally only covered Draw mode; this expands styling so:
 *  - The whole app boots dark on mobile
 *  - MainMode inputs/buttons are themed (no white fields)
 *  - HeroMode overlay and mobile sheets are themed
 */
export default function MobileStyles() {
  return (
    <style>{`
    /* =========================
       Tokens + Global Dark Theme
       ========================= */
    :root {
      --brand: #ff6b35;
      --bg-app: #0e0f11;
      --bg-app-2: #101113;
      --card-bg: #0f1115;

      --text: #dee1e7;
      --text-strong: #f3f5f9;
      --text-secondary: #a7afbd; /* added */
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
      --border-soft-dark: 1px solid rgba(255,255,255,.08);
    }

    :root { color-scheme: dark; }

    * { box-sizing: border-box; }
    html, body, #root { height: 100%; background: var(--bg-app); }
    body { margin: 0; color: var(--text); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    .app { min-height: 100%; background:
      radial-gradient(1200px 800px at 50% -10%, var(--bg-app-2) 0%, var(--bg-app) 60%, #0b0c0e 100%); }

    .sr-only {
      position: absolute !important;
      width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    ::selection { background: rgba(255,107,53,0.25); color: var(--text-strong); }

    /* =========================
       Form Controls - Global
       ========================= */
    input, textarea, select, button {
      font: inherit;
    }

    input, textarea, select {
      background: rgba(255,255,255,0.05);
      color: var(--text-strong);
      border: var(--border-soft-dark);
      border-radius: 12px;
      outline: none;
      transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
    }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.5); }

    input:focus, textarea:focus, select:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 2px rgba(255,107,53,0.20);
      background: rgba(255,255,255,0.07);
    }

    /* iOS/Android autofill fixes (prevent yellow/white fill) */
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus,
    textarea:-webkit-autofill,
    select:-webkit-autofill {
      -webkit-text-fill-color: var(--text-strong);
      transition: background-color 10000s ease-in-out 0s;
      box-shadow: 0 0 0px 1000px rgba(255,255,255,0.06) inset;
      caret-color: var(--text-strong);
    }

    /* Buttons - common */
    .btn {
      height: 44px;
      border-radius: 12px;
      padding: 0 14px;
      border: none;
      font-weight: 700;
      letter-spacing: .2px;
      cursor: pointer;
      transition: transform .06s ease, box-shadow .2s ease, background .2s ease, opacity .2s ease;
    }
    .btn:active { transform: translateY(1px); }
    .btn[disabled] { opacity: .6; cursor: not-allowed; }

    .btn-primary {
      background: var(--brand);
      color: #fff;
      box-shadow: 0 8px 20px rgba(255,107,53,.35);
    }
    .btn-primary:hover:not([disabled]) { background: #e55a2b; box-shadow: 0 10px 24px rgba(229,90,43,.40); }

    .btn-ghost {
      background: rgba(255,255,255,0.08);
      color: var(--text-strong);
      border: var(--border-soft-dark);
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.12); }

    .button-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff; display: inline-block; margin-right: 8px;
      animation: spin 0.9s linear infinite;
      vertical-align: -2px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* =========================
       Main Mode (home screen)
       ========================= */
    .main-mode { padding-bottom: 80px; }

    .center-input {
      max-width: 720px;
      margin: 60px auto 24px;
      text-align: center;
      padding: 0 16px;
    }

    .center-input.collapsed {
      margin-top: 16px;
      transition: margin-top .3s ease;
    }

    .mascot {
      width: 56px; height: 56px; border-radius: 12px;
      display: block; margin: 0 auto 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }

    .brand h1 {
      margin: 0 0 12px;
      font-size: clamp(1.15rem, 1.4vw + 1rem, 1.6rem);
      font-weight: 800;
      letter-spacing: .2px;
      color: var(--text-strong);
    }

    .input-controls {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin: 0 auto;
    }

    .input-group {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }

    .prompt-input {
      height: 48px;
      padding: 0 14px;
      width: 100%;
    }

    .suggest-btn {
      width: 48px; height: 48px; border-radius: 12px;
      border: var(--border-soft-dark);
      background: rgba(255,255,255,0.05);
      color: var(--text-strong);
      cursor: pointer;
      transition: background .2s ease, transform .06s ease;
    }
    .suggest-btn:hover { background: rgba(255,255,255,0.1); }
    .suggest-btn:active { transform: scale(.98); }

    .style-select {
      height: 44px; padding: 0 12px;
      background: rgba(255,255,255,0.05);
      color: var(--text-strong);
    }

    .button-group {
      display: grid;
      grid-template-columns: auto 40px auto;
      gap: 8px;
      align-items: center;
      justify-content: center;
      margin-top: 4px;
    }

    .generate-btn { composes: btn btn-primary; } /* for clarity */
    .generate-btn.btn, .draw-btn.btn { height: 48px; }
    .generate-btn { background: var(--brand); color: #fff; border: none; border-radius: 12px; }
    .draw-btn { background: rgba(255,255,255,0.08); color: var(--text-strong); border: var(--border-soft-dark); border-radius: 12px; }
    .draw-btn:hover { background: rgba(255,255,255,0.12); }

    .button-separator {
      display: grid; place-items: center;
      color: var(--text-secondary);
      opacity: .8;
    }
    .or-text {
      font-size: .8rem;
      border-radius: 999px;
      padding: 4px 0;
      opacity: .8;
    }

    .error-message {
      color: #ff9b9b;
      background: rgba(255,0,0,0.08);
      border: 1px solid rgba(255,0,0,0.25);
      padding: 10px 12px;
      border-radius: 10px;
      margin: 10px auto 0;
      max-width: 720px;
    }

    .tips-text { color: var(--text-secondary); }

    /* Floating mobile controls when header collapses */
    .mobile-floating-controls {
      position: fixed; z-index: 60;
      left: 50%; transform: translateX(-50%);
      bottom: calc(16px + env(safe-area-inset-bottom));
      display: flex; gap: 10px;
    }
    .floating-new-btn, .floating-cancel-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-radius: 999px; border: var(--border-soft-dark);
      background: rgba(255,255,255,0.08); color: var(--text-strong);
      box-shadow: var(--shadow-1); cursor: pointer;
    }
    .floating-new-btn:hover, .floating-cancel-btn:hover {
      background: rgba(255,255,255,0.12);
    }
    .floating-btn-icon { font-weight: 700; }
    .floating-btn-text { font-weight: 700; letter-spacing: .3px; }

    /* =========================
       Desktop circle orbit (MainMode)
       ========================= */
    .circle-container {
      position: relative;
      width: min(1000px, 90vw);
      height: min(1000px, 90vw);
      margin: 20px auto 40px;
    }
    .circle-image {
      position: absolute;
      inset: 0;
      transform: rotate(var(--angle)) translateY(-48%);
      transform-origin: 50% 50%;
      display: grid; place-items: center;
      animation: orbitIn .6s ease var(--delay, 0s) both;
      cursor: pointer;
    }
    .circle-img {
      width: clamp(90px, 13vw, 150px);
      height: clamp(90px, 13vw, 150px);
      object-fit: cover;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,0.1);
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      transition: transform .2s ease, box-shadow .2s ease;
    }
    .circle-image:hover .circle-img { transform: scale(1.04); box-shadow: 0 12px 26px rgba(0,0,0,0.45); }

    @keyframes orbitIn {
      from { opacity: 0; transform: rotate(var(--angle)) translateY(-40%) scale(.92); }
      to { opacity: 1; transform: rotate(var(--angle)) translateY(-48%) scale(1); }
    }

    .compare-overlay {
      position: absolute; inset: 0; display: grid; place-items: center;
      background: rgba(0,0,0,0.55);
      border-radius: 20px;
    }
    .circle-compare-image {
      max-width: 90%; max-height: 90%;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.2);
      background: #fff;
    }
    .compare-label {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.75); color: #fff; padding: 8px 12px; border-radius: 999px;
      font-weight: 700; font-size: .85rem; letter-spacing: .2px; backdrop-filter: blur(8px);
    }

    /* =========================
       Hero Mode Overlay
       ========================= */
    .hero-mode {
      position: fixed; inset: 0; z-index: 120;
      background:
        radial-gradient(1200px 800px at 50% -10%, var(--bg-app-2) 0%, var(--bg-app) 60%, #0b0c0e 100%);
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
      place-items: center;
      animation: heroFadeIn .25s ease-out both;
    }
    @keyframes heroFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes heroFadeOut { to { opacity: 0; transform: scale(.985); } }

    .hero-center {
      position: relative;
      width: min(92vw, 1280px);
      height: min(92vh, 1280px);
      display: grid; place-items: center;
    }
    .hero-main-image {
      max-width: 100%; max-height: 100%;
      object-fit: contain; border-radius: 14px;
      background: #fff;
      box-shadow: 0 12px 36px rgba(0,0,0,0.45);
      border: 2px solid rgba(255,255,255,0.1);
    }

    .hero-nav {
      position: fixed; top: 50%; transform: translateY(-50%);
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(0,0,0,0.55);
      color: #fff; border: 1px solid rgba(255,255,255,0.15);
      display: grid; place-items: center; cursor: pointer; z-index: 130;
      backdrop-filter: blur(6px);
      transition: background .2s ease, transform .06s ease;
    }
    .hero-nav:hover { background: rgba(0,0,0,0.7); }
    .hero-nav:active { transform: translateY(-50%) scale(.96); }
    .hero-nav-left { left: 12px; }
    .hero-nav-right { right: 12px; }

    .hero-counter {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      color: var(--text-strong);
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 999px;
      padding: 8px 14px;
      font-weight: 700;
      backdrop-filter: blur(6px);
      z-index: 130;
      text-align: center;
      min-width: 140px;
    }

    .hero-loading {
      position: absolute; inset: 0; display: grid; place-items: center;
      background: rgba(0,0,0,0.4); border-radius: 14px;
    }
    .hero-loading-spinner {
      width: 42px; height: 42px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.25); border-top-color: #fff;
      animation: spin 1s linear infinite;
    }

    /* Prompt chip */
    .hero-prompt-container {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center;
      background: rgba(0,0,0,0.65);
      border: 1px solid rgba(255,255,255,0.15);
      color: var(--text-strong);
      padding: 10px 12px; border-radius: 12px;
      max-width: min(92vw, 680px);
      backdrop-filter: blur(8px);
      z-index: 130;
    }
    .hero-prompt-text { line-height: 1.25; }
    .hero-prompt-close {
      width: 36px; height: 36px; border-radius: 8px; border: none;
      background: rgba(255,255,255,0.08); color: var(--text-strong);
      cursor: pointer;
    }

    /* Mobile-specific hero affordances */
    .mobile-hero-close {
      position: fixed; top: 10px; right: 10px; z-index: 140;
      width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);
      background: rgba(0,0,0,0.55); color: #fff; cursor: pointer; backdrop-filter: blur(6px);
    }

    .mobile-swipe-hint {
      position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.65); color: #fff;
      padding: 6px 12px; border-radius: 999px; font-weight: 700;
      border: 1px solid rgba(255,255,255,0.15);
    }
    @keyframes hintFadeInOut {
      0% { opacity: 0; transform: translate(-50%, 6px); }
      10% { opacity: 1; transform: translate(-50%, 0); }
      85% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, 6px); }
    }

    /* Desktop hero refinement ring */
    .hero-options-grid {
      position: absolute; inset: 0; pointer-events: none;
      display: grid; place-items: center;
    }
    .hero-option {
      position: absolute; left: 50%; top: 50%;
      transform: rotate(var(--angle)) translateY(-48%);
      transform-origin: 0 0;
      pointer-events: auto; cursor: pointer;
      color: #fff; font-weight: 700; letter-spacing: .2px;
      padding: 8px 10px; border-radius: 999px;
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.15);
      transition: transform .2s ease, background .2s ease, color .2s ease, box-shadow .2s ease;
      animation: optionPop .35s ease var(--delay, 0s) both;
      box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    }
    .hero-option:hover {
      background: var(--rainbow-color);
      color: #0d0f14;
      box-shadow: 0 10px 26px rgba(0,0,0,0.45);
    }
    .option-label { white-space: nowrap; }

    @keyframes optionPop { from { opacity: 0; transform: rotate(var(--angle)) translateY(-45%) scale(.92); } to { opacity: 1; transform: rotate(var(--angle)) translateY(-48%) scale(1); } }

    /* Mobile hero bottom sheet (Refine Design) */
    .mobile-hero-options {
      position: fixed; bottom: calc(env(safe-area-inset-bottom) + 10px); left: 0; right: 0;
      margin: 0 auto; width: min(720px, 96vw);
      background: rgba(0,0,0,0.65);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 16px;
      padding: 12px;
      z-index: 140; backdrop-filter: blur(10px);
    }
    .mobile-options-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; margin-bottom: 8px; color: var(--text-strong);
    }
    .options-title { font-weight: 800; letter-spacing: .3px; }
    .options-edit-btn {
      height: 36px; border-radius: 10px; border: var(--border-soft-dark);
      background: rgba(255,255,255,0.08); color: var(--text-strong);
      padding: 0 10px; font-weight: 700; cursor: pointer;
    }
    .mobile-options-scroll {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; max-height: 42vh; overflow: auto;
    }
    .mobile-option-btn {
      display: grid; grid-template-columns: 32px 1fr; align-items: center; gap: 8px;
      padding: 10px; border-radius: 12px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: var(--text-strong); font-weight: 700; cursor: pointer;
      transition: transform .06s ease, background .15s ease, border-color .15s ease;
      animation: gridItemAppear .35s ease var(--appear-delay, 0s) both;
    }
    .mobile-option-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
    .option-emoji { font-size: 1.1rem; text-align: center; }
    .option-text { font-size: .95rem; }

    /* Mobile hero results grid (after refine) */
    .mobile-hero-results {
      position: fixed; inset: 0; z-index: 135; display: grid; grid-template-rows: auto 1fr;
      background:
        radial-gradient(1200px 800px at 50% -10%, var(--bg-app-2) 0%, var(--bg-app) 60%, #0b0c0e 100%);
      padding: 12px 12px calc(84px + env(safe-area-inset-bottom));
    }
    .mobile-results-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; color: var(--text-strong);
      padding: 6px 2px 10px;
    }
    .results-title { font-weight: 800; letter-spacing: .3px; }
    .results-count { opacity: .75; font-weight: 700; }
    .mobile-results-grid {
      display: grid; gap: 6px; grid-template-columns: repeat(3, 1fr); align-content: start;
    }
    .mobile-result-item {
      position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden;
      background: rgba(255,255,255,0.06);
      border: 2px solid rgba(255,255,255,0.1);
      animation: gridItemAppear .35s ease var(--appear-delay, 0s) both;
      cursor: pointer;
    }
    .mobile-result-item img { width: 100%; height: 100%; object-fit: cover; display: block; background: #fff; }
    .result-number {
      position: absolute; top: 6px; right: 6px;
      background: rgba(0,0,0,0.7); color: white; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; backdrop-filter: blur(4px);
    }
    .nsfw-placeholder { display: grid; place-items: center; background: rgba(0,0,0,0.75); color: #eee; }
    .nsfw-placeholder .orbit-img { background: rgba(0,0,0,0.75); }

    .orbit-container {
      position: absolute; inset: 0; display: grid; place-items: center;
    }
    .orbit-image {
      position: absolute; left: 50%; top: 50%; transform-origin: 0 0;
      transform: rotate(var(--angle)) translateY(-48%);
      animation: orbitIn .6s ease var(--delay, 0s) both;
      cursor: pointer;
    }
    .orbit-img {
      width: clamp(90px, 12.5vw, 150px);
      height: clamp(90px, 12.5vw, 150px);
      object-fit: cover;
      border-radius: 12px;
      border: 2px solid rgba(255,255,255,0.12);
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }

    @keyframes gridItemAppear {
      from { opacity: 0; transform: scale(.96); }
      to { opacity: 1; transform: scale(1); }
    }

    /* =========================
       (Existing) Draw Mode — unchanged
       ========================= */
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

    /* (…existing Draw styles stay as in your original file) */

    /* Non-hero list images polish (keeps perf) */
    .circle-img, .orbit-img { border-radius: 12px; background: #fff; }

    /* Edit Modal Styles (unchanged except variables now exist) */
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

    /* =========================
       Mobile Image Grid (unchanged from your version)
       ========================= */
    /* (Your existing Mobile Image Grid styles from earlier remain below) */

    /* ======== Mobile Image Grid Styles ======== */
    .mobile-image-grid {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: calc(180px + env(safe-area-inset-top)) 8px calc(20px + env(safe-area-inset-bottom)) 8px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-auto-rows: 1fr;
      gap: 8px;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      z-index: 50;
      transition: padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .mobile-image-grid.has-images { padding-top: calc(80px + env(safe-area-inset-top)); }

    .mobile-progress-bar {
      position: fixed;
      top: calc(150px + env(safe-area-inset-top));
      left: 16px;
      right: 16px;
      height: 36px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 20px;
      overflow: hidden;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 107, 53, 0.3);
      transition: top 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .mobile-image-grid.has-images ~ .mobile-progress-bar,
    .mobile-image-grid.has-images .mobile-progress-bar { top: calc(20px + env(safe-area-inset-top)); }
    .progress-bar-fill {
      position: absolute; left: 0; top: 0; bottom: 0;
      background: linear-gradient(90deg, var(--brand) 0%, #ff8855 100%);
      border-radius: 20px;
      transition: width 0.5s ease-out;
      box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
    }
    .progress-text { position: relative; color: white; font-weight: 600; font-size: 0.85rem; text-shadow: 0 1px 2px rgba(0,0,0,0.5); z-index: 1; }
    .mobile-image-grid.is-mobile { animation: mobileGridSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    @keyframes mobileGridSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    .grid-image-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: 12px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      animation: gridItemAppear 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      animation-delay: var(--appear-delay, 0s);
      transform: scale(0.95);
    }
    .grid-image-item:active { transform: scale(0.97); }
    .grid-image-item.selected {
      border-color: var(--brand);
      box-shadow: 0 0 20px rgba(255, 107, 53, 0.4);
      z-index: 10;
      transform: scale(1.05);
    }
    .grid-image { width: 100%; height: 100%; object-fit: cover; transition: transform .3s cubic-bezier(.4,0,.2,1); background: #fff; }
    .grid-image-item:hover .grid-image { transform: scale(1.1); }
    .image-number {
      position: absolute; top: 6px; right: 6px;
      background: rgba(0,0,0,0.7); color: white; font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 6px; backdrop-filter: blur(4px);
    }
    .image-overlay {
      position: absolute; inset: 0; background: rgba(255, 107, 53, 0.9);
      display: flex; align-items: center; justify-content: center; animation: overlayFadeIn .3s ease;
    }
    @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .overlay-text { color: white; font-weight: 600; font-size: 0.85rem; text-align: center; }

    .grid-image-placeholder {
      position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden;
      background: rgba(255, 255, 255, 0.03); border: 2px solid rgba(255, 255, 255, 0.05);
      opacity: 0; animation: gridItemAppear .5s cubic-bezier(.4,0,.2,1) forwards; animation-delay: var(--appear-delay, 0s);
    }
    .placeholder-shimmer {
      width: 100%; height: 100%;
      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%);
      background-size: 200% 100%; animation: shimmer 2s infinite;
    }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    .mobile-image-stack {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      padding: calc(160px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom)) 12px;
      overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; z-index: 50;
    }
    .stack-image-card { margin-bottom: 16px; border-radius: 16px; overflow: hidden; background: rgba(255,255,255,0.95); box-shadow: 0 4px 20px rgba(0,0,0,0.3); opacity: 0; animation: stackCardSlide .6s cubic-bezier(.4,0,.2,1) forwards; animation-delay: var(--appear-delay, 0s); transform: translateY(20px); }
    @keyframes stackCardSlide { to { opacity: 1; transform: translateY(0); } }
    .stack-image-wrapper { position: relative; cursor: pointer; }
    .stack-image { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; }
    .stack-image-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%); display: flex; justify-content: space-between; align-items: center; }
    .stack-image-number { color: white; font-weight: 600; font-size: 0.9rem; }
    .stack-view-btn { background: var(--brand); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: transform .2s ease; }
    .stack-view-btn:active { transform: scale(.95); }
    .stack-loading-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 2px dashed rgba(255,255,255,0.2); }
    .stack-loading-spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--brand); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
    .stack-loading-text { color: rgba(255,255,255,0.6); font-size: 0.9rem; }

    /* Compare overlay for mobile */
    .mobile-compare-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      padding: calc(140px + env(safe-area-inset-top)) 16px 80px 16px;
      display: flex; align-items: center; justify-content: center;
      z-index: 50; background: rgba(0,0,0,0.6);
    }
    .mobile-compare-image {
      max-width: 90%; max-height: 70%; object-fit: contain; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.2); background: #fff;
    }
    .mobile-compare-label {
      position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: white; padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; backdrop-filter: blur(10px);
    }

    /* Responsive tweaks */
    @media (max-width: 768px) {
      .mobile-results-grid { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 480px) {
      .mobile-results-grid { grid-template-columns: repeat(3, 1fr); }
    }

    /* Keep your already-present responsive grid rules intact */
    @media (max-width: 768px) {
      .mobile-image-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; padding: calc(170px + env(safe-area-inset-top)) 6px calc(20px + env(safe-area-inset-bottom)) 6px; }
      .mobile-image-grid.has-images { padding-top: calc(75px + env(safe-area-inset-top)); }
      .mobile-progress-bar { top: calc(145px + env(safe-area-inset-top)); }
    }
    @media (max-width: 480px) {
      .mobile-image-grid { grid-template-columns: repeat(3, 1fr); gap: 4px; padding: calc(165px + env(safe-area-inset-top)) 4px calc(20px + env(safe-area-inset-bottom)) 4px; }
      .mobile-image-grid.has-images { padding-top: calc(70px + env(safe-area-inset-top)); }
      .mobile-progress-bar { top: calc(140px + env(safe-area-inset-top)); }
    }
    @media (max-width: 360px) { .mobile-image-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 768px) and (orientation: landscape) {
      .mobile-image-grid { grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(2, 1fr);
        padding: calc(100px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom)) 12px; }
    }

    /* ======== Pro Desktop Draw layout (kept from your original) ======== */
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
      .tb-left, .tb-center, .tb-right { display: flex; align-items: center; gap: var(--space-2); }
      .tb-center { flex: 1 1 auto; }
      .tb-title { font-weight: 700; letter-spacing: .3px; opacity: .9; }
      .vision-input.pro { height: 40px; width: 100%; border-radius: 10px; }
      .create-btn.pro { width: auto; padding: 0 var(--space-4); height: 40px; }

      .left-rail {
        grid-area: left; display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
        padding: var(--space-2);
        background: rgba(255,255,255,.04);
        border: var(--border-soft-dark);
        border-radius: 12px;
      }
      .left-rail .tool-btn { width: 44px; height: 44px; }
      .rail-divider { width: 100%; height: 1px; background: rgba(255,255,255,.1); margin: var(--space-2) 0; }

      .canvas-region { grid-area: canvas; display: flex; flex-direction: column; gap: var(--space-3); align-items: center; justify-content: center; }
      .canvas-holder { width: 100%; max-width: 1000px; margin-inline: auto; position: relative; }
      .canvas-holder .drawing-canvas { max-height: calc(100vh - 220px); width: min(100%, 1000px); aspect-ratio: 1 / 1; }
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
      .panel-section { border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: var(--space-3); }
      .panel-section h4 { margin: 0 0 var(--space-2); font-size: .9rem; opacity: .85; }
      .row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
      .kv { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    }
  `}</style>
  );
}
