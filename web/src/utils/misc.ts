// web/src/utils/misc.ts

/** Fisher–Yates shuffle */
export const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const clamp01 = (x: number) =>
  (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);

export const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export function resetHistoryIndexFor(history: { isOriginalSketch?: boolean }[] | undefined) {
  if (!history?.length) return 0;
  return history.length;
}
