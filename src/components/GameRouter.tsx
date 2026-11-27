"use client";

import type { ComponentType } from "react";
import type { GamePhase, RoundTypeId } from "@/lib/game/types";
import { useGame } from "./GameContext";
import ArcheryScreen from "./games/ArcheryScreen";
import BlackjackScreen from "./games/BlackjackScreen";
import Dice421Screen from "./games/Dice421Screen";
import DuelScreen from "./games/DuelScreen";
import HighLowScreen from "./games/HighLowScreen";
import MemeScreen from "./games/MemeScreen";
import PokerScreen from "./games/PokerScreen";
import QcmScreen from "./games/QcmScreen";
import ReflexScreen from "./games/ReflexScreen";
import UndercoverScreen from "./games/UndercoverScreen";
import VoteScreen from "./games/VoteScreen";
import FinalScreen from "./screens/FinalScreen";
import RoundIntroScreen from "./screens/RoundIntroScreen";
import CasinoFinalScreen from "./casino/CasinoFinalScreen";
import CasinoPokerScreen from "./casino/PokerScreen";
import BlackjackTableScreen from "./casino/BlackjackTableScreen";
import type { CasinoGameId } from "@/lib/casino/types";

// Écrans des jeux casino : un seul écran par jeu, toutes phases confondues
// (la fin de partie a son écran commun, CasinoFinalScreen).
const CASINO_SCREENS: Partial<Record<CasinoGameId, ComponentType>> = {
  poker: CasinoPokerScreen,
  bjtable: BlackjackTableScreen,
};

// Écran de chaque mini-jeu : il couvre ses propres phases ET son écran de
// résultats (phase « showdown »), pour que rien ne disparaisse entre les deux.
const SCREENS: Record<RoundTypeId, { phases: GamePhase[]; Screen: ComponentType }> = {
  high: { phases: ["highlow"], Screen: HighLowScreen },
  holdem: { phases: ["betting"], Screen: PokerScreen },
  duel: { phases: ["duel"], Screen: DuelScreen },
  quiz: { phases: ["qcm"], Screen: QcmScreen },
  vote: { phases: ["vote"], Screen: VoteScreen },
  meme: { phases: ["memeCaption", "memeVote"], Screen: MemeScreen },
  dice: { phases: ["dice421"], Screen: Dice421Screen },
  undercover: { phases: ["undercoverClue", "undercoverVote", "undercoverGuess"], Screen: UndercoverScreen },
  blackjack: { phases: ["blackjack"], Screen: BlackjackScreen },
  archery: { phases: ["archery"], Screen: ArcheryScreen },
  reflex: { phases: ["reflex"], Screen: ReflexScreen },
};

export default function GameRouter({ onQuit }: { onQuit: () => void }) {
  const { game, mySlug, isHost, busy, act, openMenu } = useGame();
  const phase = game.phase;

  if (game.universe === "casino") {
    if (phase === "final")
      return (
        <CasinoFinalScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          onReplay={() => act({ type: "casinoReplay" })}
          onLobby={() => act({ type: "restart" })}
          onQuit={onQuit}
        />
      );
    const CasinoScreen = game.casinoGameId ? CASINO_SCREENS[game.casinoGameId] : undefined;
    return CasinoScreen ? <CasinoScreen /> : null;
  }

  if (phase === "roundIntro")
    return (
      <RoundIntroScreen
        game={game}
        isHost={isHost}
        busy={busy}
        onConfirm={() => act({ type: "confirmIntro" })}
        onShowRules={openMenu}
      />
    );

  if (phase === "final")
    return (
      <FinalScreen
        game={game}
        mySlug={mySlug}
        isHost={isHost}
        onAssignCulSec={(targetSlug) => act({ type: "assignCulSec", targetSlug })}
        onRejouer={() => act({ type: "restart" })}
        onNewRoom={onQuit}
      />
    );

  const entry = game.roundTypeId ? SCREENS[game.roundTypeId] : null;
  if (entry && (entry.phases.includes(phase) || phase === "showdown")) return <entry.Screen />;
  return null;
}
