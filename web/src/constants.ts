// web/src/constants.ts

export const BASE_STYLES = [
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
  'Blackout', 'Solid Black', 'Simple Ink', 'Negative Space',
  'Lettering', 'Script', 'Gothic Lettering', 'Typography',
  'Horror', 'Dark Art', 'Gothic Style',
  'Nature', 'Botanical', 'Floral',
  'Religious', 'Spiritual', 'Mythology'
];

export const TATTOO_SUGGESTIONS = [
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

export const HERO_REFINEMENT_OPTIONS = [
  { label: 'More Realistic', value: 'photorealistic, detailed shading, lifelike rendering', lockSeed: true, emoji: '📸' },
  { label: 'More Geometric', value: 'geometric patterns, angular shapes, precise lines', lockSeed: true, emoji: '📐' },
  { label: 'More Organic', value: 'flowing curves, natural forms, soft edges', lockSeed: true, emoji: '🌿' },
  { label: 'More Color', value: 'vibrant colors, rich palette, colorful design', lockSeed: true, emoji: '🎨' },
  { label: 'More Traditional', value: 'classic tattoo style, bold outlines, traditional approach', lockSeed: true, emoji: '⚓' },
  { label: 'More Minimal', value: 'clean design, negative space, simple forms', lockSeed: true, emoji: '⚪' },
  { label: 'More Detailed', value: 'intricate elements, complex textures, rich detail', lockSeed: true, emoji: '🔍' },
  { label: 'More Abstract', value: 'abstract interpretation, artistic expression, creative style', lockSeed: true, emoji: '🌀' },
  { label: 'More Bold', value: 'strong outlines, high contrast, dramatic impact', lockSeed: true, emoji: '💪' },
  { label: 'More Delicate', value: 'fine lines, subtle details, gentle approach', lockSeed: true, emoji: '🪶' },
  { label: 'More Dark', value: 'deep shadows, black ink, moody atmosphere', lockSeed: true, emoji: '🌑' },
  { label: 'More Ornate', value: 'decorative elements, ornamental design, elaborate details', lockSeed: true, emoji: '👑' },
  { label: 'More Stylized', value: 'artistic interpretation, unique style, creative approach', lockSeed: true, emoji: '🎭' },
  { label: 'More Dynamic', value: 'movement, energy, dynamic composition', lockSeed: true, emoji: '⚡' },
  { label: 'More Textured', value: 'rich textures, surface details, tactile quality', lockSeed: true, emoji: '🧱' },
  { label: 'More Variations', value: 'same concept, different interpretation', lockSeed: false, emoji: '🔄' }
];

// Max device pixel ratio to cap canvas buffers (perf/memory)
export const MAX_DPR = 2;
// Undo/redo cap
export const HISTORY_LIMIT = 20;
