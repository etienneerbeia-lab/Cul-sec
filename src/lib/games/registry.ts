import type { GameModule } from "../game/module";
import type { RoundTypeId } from "../game/types";
import { duelModule } from "./duel";
import { holdemModule } from "./poker";
import { highlowModule } from "./highlow";
import { memeModule, undercoverModule, voteModule } from "./party";
import { qcmModule } from "./qcm";
import { archeryModule, blackjackModule } from "./skill";
import { dice421Module } from "./dice421";
import { reflexModule } from "./reflex";

export const MODULES: Record<RoundTypeId, GameModule> = {
  high: highlowModule,
  holdem: holdemModule,
  duel: duelModule,
  quiz: qcmModule,
  vote: voteModule,
  meme: memeModule,
  dice: dice421Module,
  undercover: undercoverModule,
  blackjack: blackjackModule,
  archery: archeryModule,
  reflex: reflexModule,
};
