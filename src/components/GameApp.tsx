"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiDelete,
  apiGet,
  apiPost,
  type BetAction,
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomCodeRef = useRef("");

  const refresh = useCallback(async (code: string) => {
    try {
      const data = await apiGet<StateResponse>(`/api/rooms/${code}/state`);
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
      await apiDelete("/api/session");
    } catch {
      // cookie will just expire on its own
    }
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

      {!game || phase === "lobby" ? (
        <LobbyScreen
          roomCode={roomCode}
          players={players}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          error={error}
          onLaunch={(totalRounds: number, culSecRule: CulSecRule, enabledRoundTypeIds: RoundTypeId[]) =>
            runAction(() =>
              apiPost(`/api/rooms/${roomCode}/launch`, { totalRounds, culSecRule, enabledRoundTypeIds })
            )
          }
        />
      ) : phase === "roundIntro" ? (
        <RoundIntroScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onConfirm={() => runAction(() => apiPost(`/api/rooms/${roomCode}/confirm-intro`))}
        />
      ) : phase === "betting" ? (
        <BettingScreen
          game={game}
          myHand={myHand}
          mySlug={mySlug}
          busy={busy}
          onAct={(action: BetAction) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/act`, { action }))
          }
        />
      ) : phase === "duelReveal" || (phase === "showdown" && game.lastResults?.type === "duel") ? (
        <DuelRevealScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onReveal={() => runAction(() => apiPost(`/api/rooms/${roomCode}/duel-reveal`))}
          onNextRound={() => runAction(() => apiPost(`/api/rooms/${roomCode}/next-round`))}
          onEndNight={() => runAction(() => apiPost(`/api/rooms/${roomCode}/end-night`))}
        />
      ) : phase === "showdown" ? (
        <ShowdownScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onNextRound={() => runAction(() => apiPost(`/api/rooms/${roomCode}/next-round`))}
          onEndNight={() => runAction(() => apiPost(`/api/rooms/${roomCode}/end-night`))}
        />
      ) : phase === "quiz" ? (
        <QuizScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onSubmitAnswer={(answer) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/quiz-answer`, { answer }))
          }
          onDistribute={(targets) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/quiz-distribute`, { targets }))
          }
          onNext={() => runAction(() => apiPost(`/api/rooms/${roomCode}/quiz-next`))}
          onEndNight={() => runAction(() => apiPost(`/api/rooms/${roomCode}/end-night`))}
        />
      ) : phase === "vote" ? (
        <VoteScreen
          game={game}
          myVoteChoice={myVoteChoice}
          busy={busy}
          onSubmitVote={(choice) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/vote-answer`, { choice }))
          }
        />
      ) : phase === "memeCaption" ? (
        <MemeCaptionScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          onSubmitCaption={(caption) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/meme-caption`, { caption }))
          }
          onForceReveal={() => runAction(() => apiPost(`/api/rooms/${roomCode}/meme-caption-reveal`))}
        />
      ) : phase === "memeVote" ? (
        <MemeVoteScreen
          game={game}
          mySlug={mySlug}
          busy={busy}
          onSubmitVote={(authorSlug) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/meme-vote`, { authorSlug }))
          }
        />
      ) : phase === "dice" ? (
        <DiceScreen
          game={game}
          mySlug={mySlug}
          busy={busy}
          onRoll={() => runAction(() => apiPost(`/api/rooms/${roomCode}/dice-roll`))}
        />
      ) : phase === "undercoverClue" ? (
        <UndercoverClueScreen
          game={game}
          mySlug={mySlug}
          myWord={myUndercoverWord}
          busy={busy}
          onSubmitClue={(text) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/undercover-clue`, { text }))
          }
          onAdvance={() => runAction(() => apiPost(`/api/rooms/${roomCode}/undercover-clue-advance`))}
        />
      ) : phase === "undercoverVote" ? (
        <UndercoverVoteScreen
          game={game}
          mySlug={mySlug}
          busy={busy}
          onSubmitVote={(targetSlug) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/undercover-vote`, { targetSlug }))
          }
        />
      ) : phase === "undercoverGuess" ? (
        <UndercoverGuessScreen
          game={game}
          myWord={myUndercoverWord}
          busy={busy}
          onSubmitGuess={(guess) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/undercover-guess`, { guess }))
          }
        />
      ) : phase === "quizRecap" ? (
        <QuizRecapScreen
          game={game}
          isHost={isHost}
          busy={busy}
          onContinue={() => runAction(() => apiPost(`/api/rooms/${roomCode}/quiz-recap-continue`))}
          onEndNight={() => runAction(() => apiPost(`/api/rooms/${roomCode}/end-night`))}
        />
      ) : phase === "final" ? (
        <FinalScreen
          game={game}
          mySlug={mySlug}
          isHost={isHost}
          onAssignCulSec={(targetSlug) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/assign-cul-sec`, { targetSlug }))
          }
          onRejouer={() => runAction(() => apiPost(`/api/rooms/${roomCode}/restart`))}
          onNewRoom={handleQuit}
        />
      ) : null}

      {error && phase !== "lobby" && <div className="hint error-text">{error}</div>}
    </div>
  );
}
