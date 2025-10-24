// web/src/types.ts

export type TattooImage = {
  id: string;
  url: string;
  prompt: string;
  loadTime: number;
  aspectRatio?: number;
  isNSFW?: boolean;
};

export type ControlnetIteration = {
  imageUrl: string;
  prompt: string;
  refinement?: string;
  isOriginalSketch?: boolean;
};

export type GenerationSession = {
  id: string;
  basePrompt: string;
  style: string;
  refinement: string;
  images: TattooImage[];
  generating: boolean;
  progress: number;
  sse?: EventSource | null;
  error?: string | null;
  seed?: number;
  isControlnet?: boolean;
  controlImageBlob?: Blob;
  controlnetHistory?: ControlnetIteration[];
  /** Sticky compare source (server-provided or local sketch) used when history is absent */
  compareAgainstUrl?: string;
};
