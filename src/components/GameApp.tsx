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
import type { Card, CulSecRule, GameState, Player } from "@/lib/game/types";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import RoundIntroScreen from "./screens/RoundIntroScreen";
import BettingScreen from "./screens/BettingScreen";
import CommunityRevealScreen from "./screens/CommunityRevealScreen";
import ShowdownScreen from "./screens/ShowdownScreen";
import FinalScreen from "./screens/FinalScreen";
import QuizScreen from "./screens/QuizScreen";
import QuizRecapScreen from "./screens/QuizRecapScreen";
import DuelRevealScreen from "./screens/DuelRevealScreen";

const POLL_MS = 1500;

export default function GameApp() {
  const [booting, setBooting] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [mySlug, setMySlug] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomCodeRef = useRef("");

  const refresh = useCallback(async (code: string) => {
    try {
      const data = await apiGet<StateResponse>(`/api/rooms/${code}/state`);
      setPlayers(data.players);
      setGame(data.game);
      setMyHand(data.myHand);
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
          className="btn-ghost"
          onClick={() => {
            if (confirm("Quitter la partie ?")) handleQuit();
          }}
        >
          Quitter
        </button>
      </div>

      {!game || phase === "lobby" ? (
        <LobbyScreen
          roomCode={roomCode}
          players={players}
          mySlug={mySlug}
          isHost={isHost}
          busy={busy}
          error={error}
          onLaunch={(totalRounds: number, culSecRule: CulSecRule) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/launch`, { totalRounds, culSecRule }))
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
      ) : phase === "duelReveal" ? (
        <DuelRevealScreen
          game={game}
          mySlug={mySlug}
          myHand={myHand}
          busy={busy}
          onReveal={() => runAction(() => apiPost(`/api/rooms/${roomCode}/duel-reveal`))}
        />
      ) : phase === "communityReveal" ? (
        <CommunityRevealScreen
          game={game}
          myHand={myHand}
          isHost={isHost}
          busy={busy}
          onContinue={() => runAction(() => apiPost(`/api/rooms/${roomCode}/continue-community`))}
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
          onAssignCulSec={(targetSlug) =>
            runAction(() => apiPost(`/api/rooms/${roomCode}/assign-cul-sec`, { targetSlug }))
          }
          onRestart={handleQuit}
        />
      ) : null}

      {error && phase !== "lobby" && <div className="hint error-text">{error}</div>}
    </div>
  );
}
