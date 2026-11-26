// Affichage des montants : « 1 250 » jetons ou « 1 250 € ».
export type ChipUnit = "chips" | "euro";

export function formatChips(n: number, unit: ChipUnit = "chips"): string {
  const s = Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
  return unit === "euro" ? `${s} €` : s;
}
