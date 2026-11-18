"use client";

import type { ArcheryPoint, GolfPoint } from "@/lib/game/types";
import type { BlackjackAction } from "@/lib/api-client";
import { useGame } from "./GameContext";
import HighLowScreen from "./games/HighLowScreen";
import PokerScreen from "./games/PokerScreen";
import DuelScreen from "./games/DuelScreen";
import QcmScreen from "./games/QcmScreen";
import VoteScreenV2 from "./games/VoteScreen";
import MemeScreen from "./games/MemeScreen";
import RoundIntroScreen from "./screens/RoundIntroScreen";
import ShowdownScreen from "./screens/ShowdownScreen";
import FinalScreen from "./screens/FinalScreen";
import DiceScreen from "./screens/DiceScreen";
import UndercoverClueScreen from "./screens/UndercoverClueScreen";
import UndercoverVoteScreen from "./screens/UndercoverVoteScreen";
import UndercoverGuessScreen from "./screens/UndercoverGuessScreen";
import BlackjackScreen from "./screens/BlackjackScreen";
import GolfScreen from "./screens/GolfScreen";
import ArcheryScreen from "./screens/ArcheryScreen";

// Choisit l'écran du mini-jeu en cours (en dehors du salon).
export default function GameRouter({ onQuit }: { onQuit: () => void }) {
  const { game, mySlug, isHost, busy, myUndercoverWord, act } = useGame();
  const phase = game.phase;
  const runAction = (fn: () => void) => fn();
  return (
    <>
      {phase === "memeCaption" || phase === "memeVote" || (phase === "showdown" && game.lastResults?.type === "meme") ? (
        <MemeScreen />
      ) : phase === "vote" || (phase === "showdown" && game.lastResults?.type === "vote") ? (
        <VoteScreenV2 />
      ) : phase === "qcm" || (phase === "showdown" && game.lastResults?.type === "quiz") ? (
        <QcmScreen />
      ) : phase === "betting" || (phase === "showdown" && game.lastResults?.type === "holdem") ? (
        <PokerScreen />
      ) : phase === "duel" || (phase === "showdown" && game.lastResults?.type === "duel") ? (
        <DuelScreen />
      ) : phase === "highlow" || (phase === "showdown" && game.lastResults?.type === "high") ? (
        <HighLowScreen />
      ) : phase === "roundIntro" ? (
        <RoundIntroScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onConfirm={() => runAction(() => act({ type: "confirmIntro" }))}
        />
      ) : phase === "dice" || (phase === "showdown" && game.lastResults?.type === "dice") ? (
        <DiceScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onRoll={() => runAction(() => act({ type: "diceRoll" }))}
          onNextRound={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
        />
      ) : phase === "golf" || (phase === "showdown" && game.lastResults?.type === "golf") ? (
        <GolfScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onShoot={(velocity: GolfPoint) => runAction(() => act({ type: "golfShot", velocity }))}
          onNextRound={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
        />
      ) : phase === "archery" || (phase === "showdown" && game.lastResults?.type === "archery") ? (
        <ArcheryScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onShoot={(aim: ArcheryPoint, power: number) =>
            runAction(() => act({ type: "archeryShot", aim, power }))
          }
          onNextRound={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
        />
      ) : phase === "blackjack" || (phase === "showdown" && game.lastResults?.type === "blackjack") ? (
        <BlackjackScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onBet={(amount) => runAction(() => act({ type: "bjBet", amount }))}
          onAct={(action: BlackjackAction) =>
            runAction(() => act({ type: "bjAct", action }))
          }
          onDistribute={(targets) =>
            runAction(() => act({ type: "bjDistribute", targets }))
          }
          onNextRound={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
        />
      ) : phase === "showdown" ? (
        <ShowdownScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onNextRound={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
        />
      ) : phase === "undercoverClue" ? (
        <UndercoverClueScreen
          game={game}
          mySlug={mySlug}
          myWord={myUndercoverWord}
          busy={busy}
          onSubmitClue={(text) =>
            runAction(() => act({ type: "ucClue", text }))
          }
          onAdvance={() => runAction(() => act({ type: "ucAdvance" }))}
        />
      ) : phase === "undercoverVote" ? (
        <UndercoverVoteScreen
          game={game}
          mySlug={mySlug}
          busy={busy}
          onSubmitVote={(targetSlug) =>
            runAction(() => act({ type: "ucVote", targetSlug }))
          }
        />
      ) : phase === "undercoverGuess" ? (
        <UndercoverGuessScreen
          game={game}
          myWord={myUndercoverWord}
          busy={busy}
          onSubmitGuess={(guess) =>
            runAction(() => act({ type: "ucGuess", guess }))
          }
        />
      ) : phase === "final" ? (
        <FinalScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          onAssignCulSec={(targetSlug) =>
            runAction(() => act({ type: "assignCulSec", targetSlug }))
          }
          onRejouer={() => runAction(() => act({ type: "restart" }))}
          onNewRoom={onQuit}
        />
      ) : null}
    </>
  );
}
