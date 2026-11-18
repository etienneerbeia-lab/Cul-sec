import type { GameModule } from "../game/module";
import type { RoundTypeId } from "../game/types";
import { duelModule } from "./duel";
import { holdemModule } from "./poker";
import { highlowModule } from "./highlow";
import { memeModule, quizModule, undercoverModule, voteModule } from "./party";
import { archeryModule, blackjackModule, diceModule, golfModule } from "./skill";

export const MODULES: Record<RoundTypeId, GameModule> = {
  high: highlowModule,
  holdem: holdemModule,
  duel: duelModule,
  quiz: quizModule,
  vote: voteModule,
  meme: memeModule,
  dice: diceModule,
  undercover: undercoverModule,
  blackjack: blackjackModule,
  golf: golfModule,
  archery: archeryModule,
};
