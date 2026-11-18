"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiDelete,
  apiGet,
  apiPost,
  type BetAction,
  type BlackjackAction,
  type RoomResponse,
  type SessionResponse,
  type StateResponse,
} from "@/lib/api-client";
import type { Card, CulSecRule, GameState, Player, RoundTypeId, VoteChoice } from "@/lib/game/types";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import RoundIntroScreen from "./screens/RoundIntroScreen";
import BettingScreen from "./screens/BettingScreen";
import ShowdownScreen from "./screens/ShowdownScreen";
import FinalScreen from "./screens/FinalScreen";
import QuizScreen from "./screens/QuizScreen";
import QuizRecapScreen from "./screens/QuizRecapScreen";
import DuelRevealScreen from "./screens/DuelRevealScreen";
import VoteScreen from "./screens/VoteScreen";
import MemeCaptionScreen from "./screens/MemeCaptionScreen";
import MemeVoteScreen from "./screens/MemeVoteScreen";
import DiceScreen from "./screens/DiceScreen";
import UndercoverClueScreen from "./screens/UndercoverClueScreen";
import UndercoverVoteScreen from "./screens/UndercoverVoteScreen";
import UndercoverGuessScreen from "./screens/UndercoverGuessScreen";
import BlackjackScreen from "./screens/BlackjackScreen";
import GolfScreen from "./screens/GolfScreen";
import ArcheryScreen from "./screens/ArcheryScreen";
import type { ArcheryPoint, GolfPoint } from "@/lib/game/types";

const POLL_MS = 1500;

export default function GameApp() {
  const [booting, setBooting] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [mySlug, setMySlug] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[] | null>(null);
  const [myVoteChoice, setMyVoteChoice] = useState<VoteChoice | null>(null);
  const [myUndercoverWord, setMyUndercoverWord] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showBackToLobbyConfirm, setShowBackToLobbyConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomCodeRef = useRef("");
  // Dernière version reçue : une réponse plus ancienne (arrivée en retard)
  // est ignorée, pour que l'écran ne recule jamais.
  const versionRef = useRef(0);
  const pollCountRef = useRef(0);

  const refresh = useCallback(async (code: string) => {
    try {
      const beat = pollCountRef.current++ % 3 === 0 ? "?beat=1" : "";
      const data = await apiGet<StateResponse>(`/api/rooms/${code}/state${beat}`);
      if (data.v < versionRef.current) return;
      versionRef.current = data.v;
      setPlayers(data.players);
      setGame(data.game);
      setMyHand(data.myHand);
      setMyVoteChoice(data.myVoteChoice);
      setMyUndercoverWord(data.myUndercoverWord);
      setIsHost(data.isHost);
    } catch {
      // transient network hiccup — next poll retries
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (code: string) => {
      roomCodeRef.current = code;
      if (pollRef.current) return;
      refresh(code);
      pollRef.current = setInterval(() => refresh(code), POLL_MS);
    },
    [refresh]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<SessionResponse>("/api/session");
        if (data.loggedIn && data.code && data.slug) {
          setRoomCode(data.code);
          setMySlug(data.slug);
          setIsHost(!!data.isHost);
          startPolling(data.code);
        }
      } finally {
        setBooting(false);
      }
    })();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(name: string) {
    setError("");
    setBusy(true);
    try {
      const data = await apiPost<RoomResponse>("/api/rooms", { name });
      setRoomCode(data.code);
      setMySlug(data.slug);
      setIsHost(true);
      setPlayers([{ name: data.name, slug: data.slug }]);
      setGame({ phase: "lobby", round: 0, startIndex: 0, lastRoundTypeId: null, playersPublic: [] });
      startPolling(data.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(name: string, code: string) {
    setError("");
    setBusy(true);
    try {
      const upper = code.trim().toUpperCase();
      const data = await apiPost<RoomResponse>(`/api/rooms/${upper}/join`, { name });
      setRoomCode(data.code);
      setMySlug(data.slug);
      setIsHost(data.isHost);
      startPolling(data.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleQuit() {
    stopPolling();
    try {
      await apiPost(`/api/rooms/${roomCodeRef.current}/leave`);
      await apiDelete("/api/session");
    } catch {
      // cookie will just expire on its own
    }
    versionRef.current = 0;
    setRoomCode("");
    setMySlug("");
    setIsHost(false);
    setPlayers([]);
    setGame(null);
    setMyHand(null);
    setMyVoteChoice(null);
    setMyUndercoverWord(null);
    setError("");
  }

  const act = useCallback(
    (action: { type: string; [key: string]: unknown }) => apiPost(`/api/rooms/${roomCodeRef.current}/action`, action),
    []
  );

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh(roomCodeRef.current);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <div id="app">
        <div className="pass-screen">
          <div className="hint">Connexion...</div>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div id="app">
        <HomeScreen
          onCreate={handleCreate}
          onJoin={handleJoin}
          busy={busy}
          error={error}
          clearError={() => setError("")}
        />
      </div>
    );
  }

  const phase = game?.phase ?? "lobby";

  return (
    <div id="app">
      <div className="quit-bar">
        {isHost && phase !== "lobby" && phase !== "final" && (
          <button
            className="icon-btn"
            aria-label="Revenir au lobby"
            onClick={() => setShowBackToLobbyConfirm(true)}
          >
            ↺
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Quitter la partie"
          onClick={() => setShowQuitConfirm(true)}
        >
          ✕
        </button>
      </div>

      {showQuitConfirm && (
        <div className="modal-overlay" onClick={() => setShowQuitConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Quitter la partie ?</div>
            <div className="hint">Tu pourras rejoindre à nouveau avec le code si besoin.</div>
            <div className="modal-actions">
              <button
                className="btn-wine"
                onClick={() => {
                  setShowQuitConfirm(false);
                  handleQuit();
                }}
              >
                Quitter
              </button>
              <button className="btn-ghost" onClick={() => setShowQuitConfirm(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackToLobbyConfirm && (
        <div className="modal-overlay" onClick={() => setShowBackToLobbyConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Revenir au lobby ?</div>
            <div className="hint">
              La partie en cours sera interrompue pour tout le monde. Vous reviendrez au lobby de
              cette room, avec le même code, pour relancer un mini-jeu.
            </div>
            <div className="modal-actions">
              <button
                className="btn-wine"
                disabled={busy}
                onClick={() => {
                  setShowBackToLobbyConfirm(false);
                  runAction(() => act({ type: "restart" }));
                }}
              >
                Revenir au lobby
              </button>
              <button className="btn-ghost" onClick={() => setShowBackToLobbyConfirm(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {!game || phase === "lobby" ? (
        <LobbyScreen
          roomCode={roomCode}
          players={players}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          error={error}
          previousEnabledRoundTypeIds={game?.enabledRoundTypeIds}
          onLaunch={(totalRounds: number, culSecRule: CulSecRule, enabledRoundTypeIds: RoundTypeId[], bots: number) =>
            runAction(() =>
              apiPost(`/api/rooms/${roomCode}/launch`, { totalRounds, culSecRule, enabledRoundTypeIds, bots })
            )
          }
          onRename={(name: string) => runAction(() => apiPost(`/api/rooms/${roomCode}/rename`, { name }))}
        />
      ) : phase === "roundIntro" ? (
        <RoundIntroScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onConfirm={() => runAction(() => act({ type: "confirmIntro" }))}
        />
      ) : phase === "betting" ? (
        <BettingScreen
          game={game}
          myHand={myHand}
          mySlug={mySlug}
          busy={busy}
          onAct={(action: BetAction) =>
            runAction(() => act({ type: "bet", action }))
          }
        />
      ) : phase === "duelReveal" || (phase === "showdown" && game.lastResults?.type === "duel") ? (
        <DuelRevealScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onReveal={() => runAction(() => act({ type: "duelReveal" }))}
          onNextRound={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
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
      ) : phase === "quiz" ? (
        <QuizScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onSubmitAnswer={(answer) =>
            runAction(() => act({ type: "quizAnswer", answer }))
          }
          onDistribute={(targets) =>
            runAction(() => act({ type: "quizDistribute", targets }))
          }
          onNext={() => runAction(() => act({ type: "quizNext" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
        />
      ) : phase === "vote" ? (
        <VoteScreen
          game={game}
          myVoteChoice={myVoteChoice}
          busy={busy}
          onSubmitVote={(choice) =>
            runAction(() => act({ type: "vote", choice }))
          }
        />
      ) : phase === "memeCaption" ? (
        <MemeCaptionScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onSubmitCaption={(caption) =>
            runAction(() => act({ type: "memeCaption", caption }))
          }
          onForceReveal={() => runAction(() => act({ type: "memeCaptionReveal" }))}
        />
      ) : phase === "memeVote" ? (
        <MemeVoteScreen
          game={game}
          mySlug={mySlug}
          busy={busy}
          onSubmitVote={(authorSlug) =>
            runAction(() => act({ type: "memeVote", authorSlug }))
          }
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
      ) : phase === "quizRecap" ? (
        <QuizRecapScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onContinue={() => runAction(() => act({ type: "nextRound" }))}
          onEndNight={() => runAction(() => act({ type: "endNight" }))}
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
          onNewRoom={handleQuit}
        />
      ) : null}

      {error && phase !== "lobby" && <div className="hint error-text">{error}</div>}
    </div>
  );
}
