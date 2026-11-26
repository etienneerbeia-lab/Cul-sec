import type { PokerLogEntry } from "./types";

// Texte d'une ligne de l'historique de la main (« Étienne relance à 120 »).
export function logText(e: PokerLogEntry, name: (slug: string) => string): string {
  const who = e.s ? name(e.s) : "";
  switch (e.k) {
    case "sb":
      return `${who} paie la petite blinde (${e.n})`;
    case "bb":
      return `${who} paie la grosse blinde (${e.n})`;
    case "fold":
      return `${who} se couche`;
    case "check":
      return `${who} checke`;
    case "call":
      return `${who} suit (${e.n})`;
    case "bet":
      return `${who} mise ${e.n}`;
    case "raise":
      return `${who} relance à ${e.n}`;
    case "allin":
      return `${who} fait tapis (${e.n})`;
    case "street":
      return e.st === "flop" ? "Flop" : e.st === "turn" ? "Turn" : "River";
    case "return":
      return `${who} récupère ${e.n} non suivis`;
    case "win":
      return `${who} remporte ${e.n}`;
  }
}

// Montant d'une relance « ½ pot » / « pot » : on suit d'abord, puis on
// relance d'une fraction du pot (mise à suivre comprise). Résultat en
// montant total sur la rue, borné par le min-raise et le tapis.
export function potRaiseTo(opts: {
  pot: number;
  currentBet: number;
  myStreetBet: number;
  fraction: number;
  min: number;
  max: number;
}): number {
  const toCall = Math.max(0, opts.currentBet - opts.myStreetBet);
  const to = opts.currentBet + Math.round(opts.fraction * (opts.pot + toCall));
  return Math.max(opts.min, Math.min(opts.max, to));
}
