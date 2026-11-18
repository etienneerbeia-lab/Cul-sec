"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, type RoomResponse, type SessionResponse, type StateResponse } from "@/lib/api-client";
import { syncClock } from "@/lib/clock";
import { haptic } from "@/lib/haptics";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { roundTypeById } from "@/lib/game/roundTypes";
import type { Card, CulSecRule, GameState, Player, RoundTypeId, VoteChoice } from "@/lib/game/types";
import { GameContext, type GameCtx } from "./GameContext";
import { Button, IconButton } from "./ui/Button";
import { CountUp, Sheet } from "./ui/Feedback";
import { Kicker, Screen } from "./ui/Layout";
import { PlayerRow } from "./ui/Players";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameRouter from "./GameRouter";

const POLL_MS = 1200;

export default function GameApp() {
  useViewportHeight();
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "quit" | "lobby">(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomCodeRef = useRef("");
  // Dernière version reçue : une réponse plus ancienne (arrivée en retard)
  // est ignorée, pour que l'écran ne recule jamais.
  const versionRef = useRef(0);
  const pollCountRef = useRef(0);

  const reset = useCallback(() => {
    versionRef.current = 0;
    roomCodeRef.current = "";
    setRoomCode("");
    setMySlug("");
    setIsHost(false);
    setPlayers([]);
    setGame(null);
    setMyHand(null);
    setMyVoteChoice(null);
    setMyUndercoverWord(null);
    setError("");
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const refresh = useCallback(
    async (code: string) => {
      try {
        const beat = pollCountRef.current++ % 3 === 0 ? "?beat=1" : "";
        const startedAt = Date.now();
        const data = await apiGet<StateResponse>(`/api/rooms/${code}/state${beat}`);
        if (code !== roomCodeRef.current) return;
        syncClock(data.serverNow, startedAt);
        if (!data.mySlug) {
          // Session expirée : retour à l'accueil.
          stopPolling();
          reset();
          return;
        }
        if (data.v < versionRef.current) return;
        versionRef.current = data.v;
        setPlayers(data.players);
        setGame(data.game);
        setMyHand(data.myHand);
        setMyVoteChoice(data.myVoteChoice);
        setMyUndercoverWord(data.myUndercoverWord);
        setIsHost(data.isHost);
        setMySlug(data.mySlug);
      } catch (e) {
        if ((e as Error).message === "Code introuvable.") {
          stopPolling();
          reset();
        }
        // sinon : coupure réseau passagère, le prochain rafraîchissement réessaie
      }
    },
    [reset, stopPolling]
  );

  const startPolling = useCallback(
    (code: string) => {
      roomCodeRef.current = code;
      stopPolling();
      refresh(code);
      // Rien n'est demandé quand l'appli est en arrière-plan (économise le
      // quota Upstash) ; on rafraîchit dès qu'elle revient au premier plan.
      pollRef.current = setInterval(() => {
        if (!document.hidden) refresh(code);
      }, POLL_MS);
    },
    [refresh, stopPolling]
  );

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && roomCodeRef.current) refresh(roomCodeRef.current);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

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
      } catch {
        // pas de session
      } finally {
        setBooting(false);
      }
    })();
    return stopPolling;
  }, [startPolling, stopPolling]);

  async function enterRoom(path: string, body: unknown) {
    setError("");
    setBusy(true);
    try {
      const data = await apiPost<RoomResponse>(path, body);
      haptic("success");
      setRoomCode(data.code);
      setMySlug(data.slug);
      setIsHost(data.isHost);
      startPolling(data.code);
    } catch (e) {
      haptic("warn");
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
      // le cookie expirera de lui-même
    }
    reset();
  }

  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError("");
      try {
        await fn();
        await refresh(roomCodeRef.current);
      } catch (e) {
        haptic("warn");
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const act = useCallback(
    (action: { type: string; [key: string]: unknown }) =>
      void runAction(() => apiPost(`/api/rooms/${roomCodeRef.current}/action`, action)),
    [runAction]
  );

  // L'erreur s'efface toute seule au bout de quelques secondes.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const me = game?.playersPublic.find((p) => p.slug === mySlug);
  const myGulps = me?.gulpsTotal ?? 0;
  const drinkToast = useDrinkToast(game, myGulps, !!me);

  const ctx: GameCtx | null = useMemo(
    () =>
      game ? { roomCode, game, players, mySlug, isHost, busy, myHand, myVoteChoice, myUndercoverWord, act } : null,
    [roomCode, game, players, mySlug, isHost, busy, myHand, myVoteChoice, myUndercoverWord, act]
  );

  if (booting) {
    return (
      <div id="app">
        <div className="flex flex-1 items-center justify-center">
          <div
            className="h-10 w-10 rounded-full border-4 border-white/10 border-t-neon"
            style={{ animation: "cs-spin 0.8s linear infinite" }}
          />
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div id="app" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
        <HomeScreen
          onCreate={(name) => enterRoom("/api/rooms", { name })}
          onJoin={(name, code) => enterRoom(`/api/rooms/${code.trim().toUpperCase()}/join`, { name })}
          busy={busy}
          error={error}
          clearError={() => setError("")}
        />
      </div>
    );
  }

  const phase = game?.phase ?? "lobby";
  const inGame = !!game && phase !== "lobby";
  const rt = game?.roundTypeId ? roundTypeById(game.roundTypeId) : null;

  return (
    <div id="app" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
      <header className="flex shrink-0 items-center gap-3 pb-3">
        {inGame && phase !== "final" && rt ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl">
              {rt.icon}
            </span>
            <div className="min-w-0">
              <Kicker>
                Manche {game!.round}
                {game!.totalRounds ? ` / ${game!.totalRounds}` : ""}
              </Kicker>
              <div className="truncate font-display text-[1.08rem] font-bold leading-tight">{rt.label}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <span className="font-display text-[1.35rem] font-extrabold tracking-tight">
              Cul<span className="cs-neon-text">·</span>Sec
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-display text-sm font-bold tracking-[0.2em] text-ink-2">
              {roomCode}
            </span>
          </div>
        )}
        {inGame && me && (
          <div className={`cs-gulp ${myGulps === 0 ? "cs-gulp-zero" : ""}`} aria-label="Mes gorgées">
            🍺 <CountUp value={myGulps} />
          </div>
        )}
        <IconButton label="Menu" onClick={() => setMenuOpen(true)}>
          ☰
        </IconButton>
      </header>

      {drinkToast && (
        <div
          key={drinkToast.id}
          className="animate-pop pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full px-5 py-2.5 font-display text-lg font-extrabold text-[#2a1600] shadow-[0_10px_40px_-6px_rgba(255,182,39,0.9)]"
          style={{ top: "calc(var(--safe-top) + 66px)", background: "linear-gradient(180deg,#ffe08a,#ffb627)" }}
        >
          🍺 Tu bois {drinkToast.n} gorgée{drinkToast.n > 1 ? "s" : ""} !
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
      ) : !game.playersPublic.some((p) => p.slug === mySlug) && phase !== "final" ? (
        <Screen center>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="animate-float text-6xl">🍻</div>
            <h1 className="font-display text-3xl font-extrabold">Tu arrives en cours de partie</h1>
            <p className="text-ink-2">Tu prends place à la table dès la prochaine manche.</p>
          </div>
        </Screen>
      ) : (
        <GameContext.Provider value={ctx}>
          <GameRouter key={`${game.round}:${game.roundTypeId}`} onQuit={handleQuit} />
        </GameContext.Provider>
      )}

      {error && phase !== "lobby" && (
        <div
          className="animate-pop fixed inset-x-4 z-50 mx-auto max-w-[480px] rounded-2xl border border-danger/40 bg-[#2a0d1c] px-4 py-3 text-center text-danger"
          style={{ bottom: "calc(var(--safe-bottom) + 100px)" }}
          onClick={() => setError("")}
        >
          {error}
        </div>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        {game && game.playersPublic.length > 0 && phase !== "lobby" && (
          <>
            <Kicker className="mb-2">Classement</Kicker>
            <div className="mb-5 flex flex-col gap-2">
              {[...game.playersPublic]
                .sort((a, b) => b.gulpsTotal - a.gulpsTotal)
                .map((p) => (
                  <PlayerRow
                    key={p.slug}
                    name={p.name}
                    slug={p.slug}
                    me={p.slug === mySlug}
                    right={<span className="font-display text-lg font-extrabold tabular-nums">{p.gulpsTotal} 🍺</span>}
                  />
                ))}
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          {isHost && inGame && phase !== "final" && (
            <Button variant="secondary" onClick={() => setConfirm("lobby")}>
              ↺ Revenir au salon
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirm("quit")}>
            Quitter la partie
          </Button>
          <Button variant="ghost" onClick={() => setMenuOpen(false)}>
            Fermer
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)}>
        <h2 className="mb-2 text-center font-display text-2xl font-extrabold">
          {confirm === "quit" ? "Quitter la partie ?" : "Revenir au salon ?"}
        </h2>
        <p className="mb-5 text-center text-ink-2">
          {confirm === "quit"
            ? inGame
              ? `Tes tours seront joués automatiquement. Pour revenir, rejoins avec le code ${roomCode} et le même prénom.`
              : "Tu pourras revenir avec le code de la partie."
            : "La partie en cours s'arrête pour tout le monde et les scores repartent à zéro."}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              const what = confirm;
              setConfirm(null);
              setMenuOpen(false);
              if (what === "quit") handleQuit();
              else act({ type: "restart" });
            }}
          >
            {confirm === "quit" ? "Quitter" : "Revenir au salon"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Annuler
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

// Affiche « Tu bois N gorgées » (avec vibration) quand mon total augmente.
function useDrinkToast(game: GameState | null, myGulps: number, seated: boolean) {
  const [toast, setToast] = useState<{ n: number; id: number } | null>(null);
  const last = useRef<number | null>(null);
  const active = !!game && game.phase !== "lobby" && seated;
  useEffect(() => {
    if (!active) {
      last.current = null;
      return;
    }
    const prev = last.current;
    last.current = myGulps;
    if (prev === null || myGulps <= prev) return;
    haptic("drink");
    const id = Date.now();
    const show = setTimeout(() => setToast({ n: myGulps - prev, id }), 0);
    const hide = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2800);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [myGulps, active]);
  return toast;
}
