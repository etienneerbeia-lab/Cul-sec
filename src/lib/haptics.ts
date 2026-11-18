// Retours haptiques (Android, et iOS quand le navigateur le permet). Sans
// effet là où navigator.vibrate n'existe pas.
const PATTERNS = {
  tap: 8,
  select: 14,
  success: [18, 60, 28],
  warn: [40, 40, 40],
  drink: [60, 50, 120],
  turn: [24, 80, 24],
  impact: 30,
} as const;

export type Haptic = keyof typeof PATTERNS;

export function haptic(kind: Haptic = "tap"): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(PATTERNS[kind] as number | number[]);
  } catch {
    // certains navigateurs lèvent une erreur hors geste utilisateur
  }
}
