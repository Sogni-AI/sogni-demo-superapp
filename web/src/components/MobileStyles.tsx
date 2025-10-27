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

      /* Tablets can show 3 columns */
      .mobile-image-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        padding: calc(180px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom)) 16px;
      }

      .mobile-image-grid.has-images {
        padding-top: calc(80px + env(safe-area-inset-top));
      }
    }

    /* Larger tablets can show 4 columns */
    @media (min-width: 900px) {
      .mobile-image-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
    }

    /* ======== Pro Desktop Layout (>= 1024px) ======== */
    /* ======== Mobile Image Grid Styles ======== */
    .mobile-image-grid {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: calc(180px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom)) 12px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: 1fr;
      gap: 12px;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      z-index: 50;
      transition: padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      scroll-behavior: smooth;
    }

    /* When images are present, header collapses and we need less padding */
    .mobile-image-grid.has-images {
      padding-top: calc(80px + env(safe-area-inset-top));
    }

    /* Mobile progress bar */
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

    /* When header is collapsed, move progress bar up */
    .mobile-image-grid.has-images ~ .mobile-progress-bar,
    .mobile-image-grid.has-images .mobile-progress-bar {
      top: calc(20px + env(safe-area-inset-top));
    }

    .progress-bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background: linear-gradient(90deg, var(--brand) 0%, #ff8855 100%);
      border-radius: 20px;
      transition: width 0.5s ease-out;
      box-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
    }

    .progress-text {
      position: relative;
      color: white;
      font-weight: 600;
      font-size: 0.85rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      z-index: 1;
    }

    .mobile-image-grid.is-mobile {
      animation: mobileGridSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    @keyframes mobileGridSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .grid-image-item {
      position: relative;
      aspect-ratio: 1;
      border-radius: 16px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      animation: gridItemAppear 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      animation-delay: var(--appear-delay, 0s);
      transform: scale(0.95);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    @keyframes gridItemAppear {
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .grid-image-item:active {
      transform: scale(0.97);
    }

    .grid-image-item.selected {
      border-color: var(--brand);
      box-shadow: 0 0 20px rgba(255, 107, 53, 0.4);
      z-index: 10;
      transform: scale(1.05);
    }

    .grid-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .grid-image-item:hover .grid-image {
      transform: scale(1.1);
    }

    .image-number {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 8px;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .image-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255, 107, 53, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: overlayFadeIn 0.3s ease;
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .overlay-text {
      color: white;
      font-weight: 600;
      font-size: 0.85rem;
      text-align: center;
    }

    .grid-image-placeholder {
      position: relative;
      aspect-ratio: 1;
      border-radius: 16px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.03);
      border: 2px solid rgba(255, 255, 255, 0.08);
      opacity: 0;
      animation: gridItemAppear 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      animation-delay: var(--appear-delay, 0s);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .placeholder-shimmer {
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.05) 50%,
        rgba(255, 255, 255, 0) 100%
      );
      background-size: 200% 100%;
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* Stack View for Very Small Screens */
    .mobile-image-stack {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: calc(160px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom)) 12px;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      z-index: 50;
    }

    .stack-image-card {
      margin-bottom: 16px;
      border-radius: 16px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      opacity: 0;
      animation: stackCardSlide 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      animation-delay: var(--appear-delay, 0s);
      transform: translateY(20px);
    }

    @keyframes stackCardSlide {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .stack-image-wrapper {
      position: relative;
      cursor: pointer;
    }

    .stack-image {
      width: 100%;
      height: auto;
      aspect-ratio: 1;
      object-fit: cover;
    }

    .stack-image-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .stack-image-number {
      color: white;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .stack-view-btn {
      background: var(--brand);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .stack-view-btn:active {
      transform: scale(0.95);
    }

    .stack-loading-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      border: 2px dashed rgba(255, 255, 255, 0.2);
    }

    .stack-loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top-color: var(--brand);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    .stack-loading-text {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }

    /* NSFW placeholders */
    .nsfw-placeholder, .nsfw-placeholder-stack {
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.6);
    }

    .nsfw-icon {
      font-size: 1.5rem;
      margin-bottom: 4px;
      opacity: 0.8;
    }

    .nsfw-text {
      font-size: 0.65rem;
      text-align: center;
      opacity: 0.7;
    }

    .nsfw-placeholder-stack {
      aspect-ratio: 1;
    }

    .nsfw-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* Compare overlay for mobile */
    .mobile-compare-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: calc(140px + env(safe-area-inset-top)) 16px 80px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
      background: rgba(0, 0, 0, 0.6);
    }

    .mobile-compare-image {
      max-width: 90%;
      max-height: 70%;
      object-fit: contain;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.2);
    }

    .mobile-compare-label {
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      backdrop-filter: blur(10px);
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .mobile-image-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: calc(170px + env(safe-area-inset-top)) 6px calc(20px + env(safe-area-inset-bottom)) 6px;
      }

      .mobile-image-grid.has-images {
        padding-top: calc(75px + env(safe-area-inset-top));
      }

      .mobile-progress-bar {
        top: calc(145px + env(safe-area-inset-top));
      }
    }

    @media (max-width: 480px) {
      .mobile-image-grid {
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: calc(165px + env(safe-area-inset-top)) 4px calc(20px + env(safe-area-inset-bottom)) 4px;
      }

      .mobile-image-grid.has-images {
        padding-top: calc(70px + env(safe-area-inset-top));
      }

      .mobile-progress-bar {
        top: calc(140px + env(safe-area-inset-top));
      }
    }

    @media (max-width: 360px) {
      .mobile-image-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 768px) and (orientation: landscape) {
      .mobile-image-grid {
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(2, 1fr);
        padding: calc(100px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom)) 12px;
      }
    }

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
