import { BJ_DEALER_MS } from "../blackjack/engine";
import { handValue } from "../blackjack/rules";
import { replayMs, total } from "../bjtable/engine";
import type { DealerChatState, GameState } from "../game/types";
import type { Croupier } from "./croupiers";

// Fin de manche : ce qui mérite un commentaire de la croupière (elle
// chambre). Une seule réplique par manche, sur les deux faits les plus
// savoureux. Fonctions pures : aucune règle de jeu n'est touchée.

export type RoundEventKind = "broke" | "doubleLost" | "splitLost" | "bigDrink" | "dealerBust" | "blackjack" | "dealerBlackjack";

export interface RoundEvent {
  kind: RoundEventKind;
  slug?: string;
  name?: string;
  amount?: number; // € (Chill) ou gorgées (Soirée)
  total?: number;
  allLost?: boolean; // split : toutes les mains perdues
}

const PRIORITY: RoundEventKind[] = ["broke", "doubleLost", "splitLost", "bigDrink", "dealerBust", "blackjack", "dealerBlackjack"];
const cleanName = (n: string) => (n.endsWith(" 🤖") ? n.slice(0, -3) : n);

export interface RoundReaction {
  key: string; // manche commentée (« c3 », « s4 »)
  events: RoundEvent[];
  minAt: number; // pas avant la fin de la distribution côté joueurs
  broke: string[]; // joueurs à sec (Chill)
}

// Manche qui vient de se terminer et pas encore commentée, ou null.
export function roundReaction(g: GameState, chat: DealerChatState | undefined, now: number): RoundReaction | null {
  const nameOf = (slug: string) => cleanName(g.playersPublic.find((p) => p.slug === slug)?.name ?? slug);
  const events: RoundEvent[] = [];

  if (g.universe === "casino" && g.bjt) {
    const t = g.bjt;
    if (t.stage !== "roundEnd") return null;
    const key = `c${t.round}`;
    if (chat?.reacted?.includes(key)) return null;
    for (const seat of t.seats) {
      const name = nameOf(seat.slug);
      for (const h of seat.hands) {
        if (h.outcome === "lose" && h.doubled) events.push({ kind: "doubleLost", slug: seat.slug, name, amount: h.bet, total: total(h.cards) });
        if (h.outcome === "blackjack") events.push({ kind: "blackjack", slug: seat.slug, name });
      }
      const split = seat.hands.filter((h) => h.fromSplit);
      const lost = split.filter((h) => h.outcome === "lose");
      if (split.length > 1 && lost.length > 0)
        events.push({ kind: "splitLost", slug: seat.slug, name, amount: lost.reduce((a, h) => a + h.bet, 0), allLost: lost.length === split.length });
    }
    const seen = new Set(chat?.brokeSeen ?? []);
    const broke = (g.chips?.bustOrder ?? []).flat().filter((s) => !seen.has(s));
    for (const s of broke) events.push({ kind: "broke", slug: s, name: nameOf(s) });
    const dealerTotal = t.dealer.cards.length >= 2 ? total(t.dealer.cards) : 0;
    if (dealerTotal > 21) events.push({ kind: "dealerBust", total: dealerTotal });
    if (t.dealer.blackjack) events.push({ kind: "dealerBlackjack" });
    const tail = t.log.slice(t.replayFrom ?? t.log.length);
    return { key, events: pick(events), minAt: now + replayMs(tail) + 1200, broke };
  }

  const bj = g.blackjack;
  if (g.universe !== "casino" && g.roundTypeId === "blackjack" && bj && (bj.stage === "distributing" || bj.stage === "result")) {
    const key = `s${g.round}`;
    if (chat?.reacted?.includes(key)) return null;
    const results = bj.results ?? g.lastResults?.blackjackResults ?? [];
    for (const r of results) {
      const hand = bj.players.find((p) => p.slug === r.slug)?.hands[r.handIdx];
      const name = cleanName(r.name);
      if (r.outcome === "lose" && hand?.doubled) events.push({ kind: "doubleLost", slug: r.slug, name, amount: r.amount });
      if (r.outcome === "blackjack") events.push({ kind: "blackjack", slug: r.slug, name });
    }
    for (const p of bj.players) {
      const split = p.hands.filter((h) => h.fromSplit);
      const lost = results.filter((r) => r.slug === p.slug && r.outcome === "lose" && p.hands[r.handIdx]?.fromSplit);
      if (split.length > 1 && lost.length > 0)
        events.push({
          kind: "splitLost",
          slug: p.slug,
          name: cleanName(p.name),
          amount: lost.reduce((a, r) => a + r.amount, 0),
          allLost: lost.length === split.length,
        });
      const drunk = results.filter((r) => r.slug === p.slug && r.outcome === "lose").reduce((a, r) => a + r.amount, 0);
      if (drunk >= 4) events.push({ kind: "bigDrink", slug: p.slug, name: cleanName(p.name), amount: drunk });
    }
    const dealerTotal = bj.dealer.cards.length >= 2 ? handValue(bj.dealer.cards) : 0;
    if (dealerTotal > 21) events.push({ kind: "dealerBust", total: dealerTotal });
    // La banque retourne sa carte puis tire, plus lentement : on attend.
    const dealerEvents = bj.dealLog.filter((e) => e.target === "dealer-reveal" || e.target === "dealer-hit").length;
    return { key, events: pick(events), minAt: now + dealerEvents * BJ_DEALER_MS + 1200, broke: [] };
  }
  return null;
}

// Les deux faits les plus savoureux, un seul par joueur.
function pick(events: RoundEvent[]): RoundEvent[] {
  const sorted = [...events].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  const out: RoundEvent[] = [];
  for (const e of sorted) {
    if (e.slug && out.some((o) => o.slug === e.slug)) continue;
    out.push(e);
    if (out.length === 2) break;
  }
  return out;
}

// Faits, en clair, pour la rédaction par l'IA.
export function eventFacts(events: RoundEvent[], soiree: boolean): string[] {
  const unit = (n?: number) => (soiree ? `${n} gorgée${(n ?? 0) > 1 ? "s" : ""}` : `${n} €`);
  return events.map((e) => {
    switch (e.kind) {
      case "broke":
        return `${e.name} n'a plus un centime : éliminé·e de la table.`;
      case "doubleLost":
        return soiree
          ? `${e.name} a doublé sa mise et a perdu : il/elle boit ${unit(e.amount)}.`
          : `${e.name} a doublé (mise totale ${unit(e.amount)}) et a perdu${e.total ? ` avec ${e.total}` : ""}.`;
      case "splitLost":
        return `${e.name} a séparé sa paire et a perdu ${e.allLost ? "toutes ses mains" : "une des mains"} (${unit(e.amount)}${soiree ? " à boire" : ""}).`;
      case "bigDrink":
        return `${e.name} doit boire ${unit(e.amount)} cette manche.`;
      case "dealerBust":
        return `Toi, la croupière, tu as sauté à ${e.total}.`;
      case "blackjack":
        return `${e.name} a fait blackjack.`;
      case "dealerBlackjack":
        return "Toi, la croupière, tu as fait blackjack.";
    }
  });
}

// Réplique de secours (sans IA), tirée au sort.
export function eventFallback(events: RoundEvent[], croupier: Croupier, soiree: boolean, rng: () => number = Math.random): string {
  const pickOne = (a: string[]) => a[Math.floor(rng() * a.length) % a.length];
  const lines = events.map((e) => {
    const n = e.name ?? "";
    const a = e.amount ?? 0;
    switch (e.kind) {
      case "broke":
        return pickOne([
          `${n} n'a plus un centime. Je t'appelle un taxi ou tu rentres à pied ? 🚪`,
          `Et voilà ${n} à sec. Les jetons, c'était juste pour décorer ?`,
          `${n} quitte la table les poches vides. On applaudit le généreux donateur de la soirée 👏`,
        ]);
      case "doubleLost":
        return soiree
          ? pickOne([
              `${n} a doublé… et boit double : ${a} gorgées. La stratégie de l'éponge.`,
              `Doubler pour boire ${a} gorgées : ${n}, tu joues pour toi ou pour le bar ?`,
            ])
          : pickOne([
              `${n} double à ${a} €… et perd tout. Le courage, c'est beau. Le résultat, beaucoup moins. 😏`,
              `Doubler pour perdre deux fois plus vite : ${n}, c'est une stratégie, je respecte.`,
              `Merci ${n} pour ces ${a} € : la banque t'envoie une carte de fidélité.`,
            ]);
      case "splitLost":
        return e.allLost
          ? pickOne([
              `${n} a séparé ses cartes… et perdu les deux mains. Diviser pour mieux perdre ✂️`,
              `Deux mains, deux défaites : ${n}, au moins t'es régulier.`,
            ])
          : pickOne([`${n} sépare, gagne d'un côté, perd de l'autre. Le split du dimanche.`, `Un split à moitié raté pour ${n}. C'est déjà ça… ou pas.`]);
      case "bigDrink":
        return pickOne([`${n} boit ${a} gorgées. Un verre d'eau entre deux, champion 💧`, `${a} gorgées pour ${n}. La maison offre la tournée… à toi.`]);
      case "dealerBust":
        return pickOne([`J'ai sauté à ${e.total}… profitez-en, ça n'arrivera plus de la soirée.`, `Bust de la banque ! Même moi j'ai droit à un jour sans.`]);
      case "blackjack":
        return pickOne([`Blackjack pour ${n} ! Ne t'habitue pas trop.`, `${n} touche un blackjack. Je vérifie quand même tes manches 😏`]);
      case "dealerBlackjack":
        return "Blackjack de la maison. Désolée… enfin, pas vraiment 😇";
    }
  });
  const text = lines.join(" ");
  return rng() < 0.3 ? `${text} ${pickOne(croupier.flair)}` : text;
}
