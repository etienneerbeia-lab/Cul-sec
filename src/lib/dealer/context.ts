import { basicStrategyMove, handValue } from "../blackjack/rules";
import { BJT_RULES } from "../bjtable/config";
import { fromCodes } from "../casino/cards";
import type { Card, GameState } from "../game/types";

// Ce que la croupière « voit » de la table, en clair, pour l'IA. Seulement
// ce qui est visible de tous : jamais la carte cachée du croupier (elle est
// rangée à part dans l'état, `hole` / `hiddenCard`, et n'est pas lue ici).

const SUIT: Record<string, string> = { "♠": "♠", "♥": "♥", "♦": "♦", "♣": "♣" };
const RANK: Record<number, string> = { 11: "V", 12: "D", 13: "R", 14: "A" };
const cardText = (c: Card) => `${RANK[c.value] ?? c.value}${SUIT[c.suit.sym] ?? ""}`;
const handText = (cards: Card[]) => (cards.length ? `${cards.map(cardText).join(" ")} = ${handValue(cards)}` : "pas encore de cartes");
const MOVE: Record<string, string> = { hit: "tirer une carte", stand: "rester", double: "doubler", split: "séparer" };
const cleanName = (n: string) => (n.endsWith(" 🤖") ? n.slice(0, -3) : n);
// « au tour de Sarah », « au tour d'Étienne ».
const de = (n: string) => (/^[aeiouyhàâäéèêëîïôöûüAEIOUYHÀÂÄÉÈÊËÎÏÔÖÛÜ]/.test(n) ? `d'${n}` : `de ${n}`);

export function rulesText(soiree: boolean): string {
  if (soiree)
    return [
      "Règles (Blackjack Soirée) : chacun mise de 1 à 5 gorgées contre la banque, puis s'approche de 21 sans dépasser.",
      "Carte, rester, doubler (une seule carte de plus, mise doublée) ou séparer une paire.",
      "La banque tire jusqu'à 17 ; avec un As ou un 10 visible, elle vérifie son blackjack.",
      "Perdu ou sauté : on boit sa mise. Gagné : on fait boire sa mise à qui on veut (blackjack : ×1,5).",
    ].join(" ");
  const R = BJT_RULES;
  return [
    `Règles (Blackjack Table, mode Chill, sans alcool) : ${R.startingBankroll} € chacun au départ, mise de ${R.minBet} € minimum, ${R.decks} jeux dans le sabot.`,
    "Blackjack payé 3 pour 2. La croupière reste sur 17, même soft, et vérifie son blackjack avec un As ou un 10 visible.",
    "Doubler sur les 2 premières cartes (aussi après un split). Séparer jusqu'à 4 mains ; As séparés : une carte chacun, pas de re-split.",
    "Assurance (moitié de la mise) quand la croupière montre un As, payée 2 contre 1. Pas d'abandon.",
    "Sous la mise minimum, on est éliminé et on regarde la fin. Le joueur le plus riche à la fin gagne.",
  ].join(" ");
}

export function describeTable(g: GameState): string {
  const name = (slug: string) => cleanName(g.playersPublic.find((p) => p.slug === slug)?.name ?? slug);
  const lines: string[] = [];

  if (g.universe === "casino" && g.bjt) {
    const t = g.bjt;
    const chips = g.chips;
    const stage = { betting: "les joueurs misent", insurance: "assurance proposée", playerTurns: "les joueurs jouent", roundEnd: "fin de manche" }[t.stage];
    const turn = t.stage === "playerTurns" ? t.seats[t.turn]?.slug : null;
    lines.push(
      `Mode Chill (jetons en euros, pas d'alcool). Manche ${t.round}${t.totalRounds ? `/${t.totalRounds}` : " (dernier survivant)"}. Phase : ${stage}${turn ? ` — c'est au tour ${de(name(turn))}` : ""}.`,
    );
    const up = fromCodes(t.dealer.cards);
    lines.push(
      t.stage === "roundEnd" || up.length >= 2
        ? `Ta main (croupière) : ${handText(up)}.`
        : up.length
          ? `Ta carte visible (croupière) : ${cardText(up[0])} ; ta carte cachée, personne ne la connaît (toi non plus pour l'instant).`
          : "Tu n'as pas encore distribué.",
    );
    lines.push("Joueurs :");
    for (const slug of t.order) {
      const broke = chips?.bustOrder.some((grp) => grp.includes(slug));
      const seat = t.seats.find((s) => s.slug === slug);
      const parts = [`- ${name(slug)} : ${broke ? "à sec, éliminé·e" : `solde ${chips?.stacks[slug] ?? 0} €`}`];
      if (seat) {
        seat.hands.forEach((h, i) => {
          const cards = fromCodes(h.cards);
          let s = `${seat.hands.length > 1 ? `main ${i + 1}` : "main"} ${handText(cards)}, mise ${h.bet} €${h.doubled ? " (doublée)" : ""}`;
          if (h.outcome)
            s += `, ${{ win: "gagnée", lose: "perdue", push: "égalité", blackjack: "blackjack" }[h.outcome]}${h.net ? ` (${h.net > 0 ? "+" : ""}${h.net} €)` : ""}`;
          else if (h.status === "bust") s += ", sautée";
          if (t.stage === "playerTurns" && h.status === "playing" && up[0] && cards.length >= 2 && handValue(cards) < 21)
            s += ` — stratégie de base : ${MOVE[basicStrategyMove(cards, up[0])]}`;
          parts.push(s);
        });
      } else if (t.stage === "betting") parts.push(t.betDone.includes(slug) ? `mise posée ${t.bets[slug] ?? 0} €` : "n'a pas encore misé");
      lines.push(parts.join(" ; "));
    }
    return lines.join("\n");
  }

  const bj = g.blackjack;
  if (bj) {
    const stage = {
      betting: "les joueurs misent",
      playerTurns: "les joueurs jouent",
      dealerTurn: "la banque joue",
      distributing: "les gagnants distribuent leurs gorgées",
      result: "fin de manche",
    }[bj.stage];
    const turn = bj.stage === "playerTurns" ? bj.players[bj.turnPointer]?.slug : null;
    lines.push(`Mode Soirée (on mise des gorgées, c'est un jeu à boire). Phase : ${stage}${turn ? ` — c'est au tour ${de(name(turn))}` : ""}.`);
    const up = bj.dealer.cards;
    lines.push(
      up.length >= 2
        ? `Ta main (banque) : ${handText(up)}.`
        : up.length
          ? `Ta carte visible (banque) : ${cardText(up[0])} ; ta carte cachée, personne ne la connaît.`
          : "Tu n'as pas encore distribué.",
    );
    const results = bj.results ?? [];
    lines.push("Joueurs :");
    for (const p of bj.players) {
      const total = g.playersPublic.find((x) => x.slug === p.slug)?.gulpsTotal ?? 0;
      const parts = [`- ${cleanName(p.name)} : ${total} gorgée${total > 1 ? "s" : ""} bues ce soir`];
      if (bj.stage === "betting") parts.push(bj.betResponded.includes(p.slug) ? `mise ${bj.bets[p.slug] ?? 0} gorgée(s)` : "n'a pas encore misé");
      else
        p.hands.forEach((h, i) => {
          let s = `${p.hands.length > 1 ? `main ${i + 1}` : "main"} ${handText(h.cards)}, mise ${h.bet} gorgée(s)${h.doubled ? " (doublée)" : ""}`;
          const r = results.find((x) => x.slug === p.slug && x.handIdx === i);
          if (r)
            s += `, ${{ win: "gagnée", lose: "perdue", push: "égalité", blackjack: "blackjack" }[r.outcome]}${r.amount ? ` (${r.amount} gorgée(s) ${r.outcome === "lose" ? "à boire" : "à distribuer"})` : ""}`;
          else if (h.status === "bust") s += ", sautée";
          if (bj.stage === "playerTurns" && h.status === "playing" && up[0] && h.cards.length >= 2 && handValue(h.cards) < 21)
            s += ` — stratégie de base : ${MOVE[basicStrategyMove(h.cards, up[0])]}`;
          parts.push(s);
        });
      lines.push(parts.join(" ; "));
    }
    return lines.join("\n");
  }
  return "Pas de partie de blackjack en cours.";
}
