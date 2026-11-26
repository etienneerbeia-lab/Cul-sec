import { fail, notNow } from "../errors";
import type { GameModule } from "../game/module";
import type { GameState } from "../game/types";
import { ACTION_MS } from "../poker/blinds";
import { pokerBotMove } from "../poker/bot";
import {
  afterHandEnd,
  applyPokerMove,
  defaultMove,
  HAND_END_FOLD_MS,
  HAND_END_SHOWDOWN_MS,
  RUNOUT_STREET_MS,
  runoutStep,
  startPokerTournament,
} from "../poker/engine";
import type { PokerMove } from "../poker/types";

const MOVES: PokerMove[] = ["fold", "check", "call", "raise"];
const BETTING = ["preflop", "flop", "turn", "river"];

// Poker casino : Texas Hold'em No Limit, tournoi express (univers Chill).
export const pokerModule: GameModule = {
  id: "poker",
  minPlayers: 2,
  start: (g, ctx) => startPokerTournament(g, ctx.now),
  act(g, slug, a) {
    if (g.phase !== "poker" || !g.poker) notNow();
    if (a.type !== "poker") fail(400, "Action inconnue.");
    const move = a.move as PokerMove;
    if (!MOVES.includes(move)) fail(400, "Coup inconnu.");
    applyPokerMove(g, slug, move, a.to as number | undefined);
  },
  pending(g) {
    const p = g.poker;
    if (!p || g.phase !== "poker") return null;
    if (BETTING.includes(p.stage) && p.toAct) return { key: `pk:${p.handNo}:${p.actSeq}`, actors: [p.toAct], timeoutMs: ACTION_MS };
    if (p.stage === "runout") return { key: `pr:${p.handNo}:${p.board.length}`, actors: [], timeoutMs: RUNOUT_STREET_MS };
    if (p.stage === "handEnd")
      return {
        key: `pe:${p.handNo}`,
        actors: [],
        timeoutMs: p.result?.uncontested ? HAND_END_FOLD_MS : HAND_END_SHOWDOWN_MS,
      };
    return null;
  },
  auto(g, slug, _ctx, { bot }) {
    const p = g.poker;
    if (!p || p.toAct !== slug) return null;
    if (!bot) return { type: "poker", move: defaultMove(g, slug) };
    const d = pokerBotMove(g, slug);
    return { type: "poker", move: d.move, to: d.to };
  },
  botDelay(g) {
    // Les décisions préflop sont plus rapides que celles du turn/river.
    return g.poker && g.poker.board.length === 0 ? [1000, 2800] : [1600, 4200];
  },
  onDeadline(g, ctx) {
    const p = g.poker;
    if (!p) return;
    if (BETTING.includes(p.stage) && p.toAct) applyPokerMove(g, p.toAct, defaultMove(g, p.toAct), undefined);
    else if (p.stage === "runout") runoutStep(g);
    else if (p.stage === "handEnd") afterHandEnd(g, ctx.now);
  },
  redact(g, slug) {
    const p = g.poker;
    if (!p) return g;
    // Chacun ne voit que ses cartes, plus celles retournées (tapis,
    // abattage). Le paquet ne sort jamais.
    const hole: Record<string, string[]> = {};
    for (const [s, cards] of Object.entries(p.hole)) if (s === slug || p.exposed.includes(s)) hole[s] = cards;
    return { ...g, poker: { ...p, deck: "", hole } } as GameState;
  },
};
