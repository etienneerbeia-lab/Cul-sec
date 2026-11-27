"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatChips } from "@/lib/chips/format";
import type { Card, GameState } from "@/lib/game/types";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { GameContext, type GameCtx } from "../GameContext";
import BlackjackTableScreen from "../casino/BlackjackTableScreen";
import CasinoPokerScreen from "../casino/PokerScreen";
import BlackjackScreen from "../games/BlackjackScreen";
import PokerScreen from "../games/PokerScreen";
import { IconButton } from "../ui/Button";
import { Sheet } from "../ui/Feedback";
import { Kicker } from "../ui/Layout";
import {
  BJ_SCENARIOS,
  ME,
  PARTY_BJ_SCENARIOS,
  PARTY_POKER_SCENARIOS,
  POKER_SCENARIOS,
  bjGame,
  partyBjGame,
  partyPokerGame,
  pokerGame,
  type BjScenario,
  type PartyBjScenario,
  type PartyPokerScenario,
  type PokerScenario,
} from "./previewData";

// Page /preview/tables : les tables Poker « Néon » et Blackjack « Arc
// sourire », en Chill et en Soirée, avec des données fictives. Rien n'est
// envoyé au serveur. ?t=soiree-poker&s=tour&bare=1 (bare : sans la barre
// d'onglets, pour des captures identiques à l'appli).

type TabId = "chill-poker" | "chill-bj" | "soiree-poker" | "soiree-bj";

const TABS: { id: TabId; label: string; scenarios: { id: string; label: string }[] }[] = [
  { id: "chill-poker", label: "Chill · Poker", scenarios: POKER_SCENARIOS },
  { id: "chill-bj", label: "Chill · Blackjack", scenarios: BJ_SCENARIOS },
  { id: "soiree-poker", label: "Soirée · Poker", scenarios: PARTY_POKER_SCENARIOS },
  { id: "soiree-bj", label: "Soirée · Blackjack", scenarios: PARTY_BJ_SCENARIOS },
];

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const tab = TABS.find((x) => x.id === q.get("t"))?.id ?? "chill-poker";
  return { tab, scenario: q.get("s") ?? "tour", bare: q.get("bare") === "1" };
}

export default function TablesPreview() {
  useViewportHeight();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabId>("chill-poker");
  const [scenario, setScenario] = useState<string>("tour");
  const [bare, setBare] = useState(false);
  // Rejeu des animations : 0 = rien d'affiché, puis le board / la donne
  // arrive étape par étape ; Infinity = état final.
  const [step, setStep] = useState(Infinity);
  const [run, setRun] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const u = readUrl();
    // Lecture de l'URL au premier rendu côté client (la page est statique).
    /* eslint-disable react-hooks/set-state-in-effect */
    setTab(u.tab);
    setScenario(u.scenario);
    setBare(u.bare);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // L'URL suit les choix (lien partageable vers une table précise).
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams({ t: tab, s: scenario });
    if (bare) q.set("bare", "1");
    window.history.replaceState(null, "", `?${q}`);
  }, [ready, tab, scenario, bare]);

  const info = TABS.find((x) => x.id === tab)!;
  const scen = info.scenarios.some((s) => s.id === scenario) ? scenario : "tour";
  const poker = tab.endsWith("poker");

  const replay = useCallback(() => {
    setRun((r) => r + 1);
    setNow(Date.now());
    setStep(0);
  }, []);
  useEffect(() => {
    if (!Number.isFinite(step)) return;
    const last = poker ? 3 : 1;
    if (step >= last) {
      const id = setTimeout(() => setStep(Infinity), 50);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStep((s) => s + 1), poker ? (step === 0 ? 500 : 1100) : 400);
    return () => clearTimeout(id);
  }, [step, poker]);

  const { game, myHand } = useMemo((): { game: GameState; myHand: Card[] | null } => {
    const boardCount = Number.isFinite(step) ? [0, 3, 4, 5][step] : 5;
    if (tab === "chill-poker") return { game: pokerGame(scen as PokerScenario, now, boardCount), myHand: null };
    if (tab === "soiree-poker") return partyPokerGame(scen as PartyPokerScenario, now, boardCount);
    const g = tab === "chill-bj" ? bjGame(scen as BjScenario, now) : partyBjGame(scen as PartyBjScenario, now);
    // Rejeu : la donne repart de zéro, puis le journal complet arrive et
    // l'écran le rejoue carte par carte.
    if (step === 0) {
      if (g.bjt) g.bjt.log = [];
      if (g.blackjack) g.blackjack.dealLog = [];
    }
    return { game: g, myHand: null };
  }, [tab, scen, now, step]);

  const act = useCallback((a: { type: string; [k: string]: unknown }) => {
    const what = String(a.op ?? a.action ?? a.move ?? a.type);
    setToast(`Aperçu : « ${what} » n'est pas envoyé`);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const ctx: GameCtx = useMemo(
    () => ({
      roomCode: "URG3",
      game,
      players: [],
      mySlug: ME,
      isHost: true,
      busy: false,
      myHand,
      myVoteChoice: null,
      myUndercoverWord: null,
      away: [],
      act,
      openMenu: () => setMenu(true),
    }),
    [game, myHand, act],
  );

  if (!ready) return <div id="app" />;

  const chill = tab.startsWith("chill");
  const screen =
    tab === "chill-poker" ? (
      <CasinoPokerScreen />
    ) : tab === "chill-bj" ? (
      <BlackjackTableScreen />
    ) : tab === "soiree-poker" ? (
      <PokerScreen />
    ) : (
      <BlackjackScreen />
    );
  const me = game.playersPublic.find((p) => p.slug === ME);

  return (
    <div id="app" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
      {!bare && (
        <div className="lab-bar shrink-0" data-lab-bar>
          <div className="lab-tabs" role="tablist">
            {TABS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className="lab-tab" onClick={() => setTab(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="lab-opts">
            {info.scenarios.map((s) => (
              <button key={s.id} type="button" className="lab-opt" aria-pressed={scen === s.id} onClick={() => setScenario(s.id)}>
                {s.label}
              </button>
            ))}
            <button type="button" className="lab-opt" onClick={replay}>
              ↻ Rejouer
            </button>
            <button type="button" className="lab-opt" onClick={() => setBare(true)}>
              ⤢ Plein écran
            </button>
          </div>
        </div>
      )}

      <header className="flex shrink-0 items-center gap-3 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-2xl ${chill ? "border-cyan/25 bg-cyan/[0.08]" : "border-white/10 bg-white/[0.06]"}`}
          >
            {poker ? "♠️" : chill ? "🎰" : "🃏"}
          </span>
          <div className="min-w-0">
            <Kicker>{chill ? "Chill · URG3" : `Manche ${game.round} / ${game.totalRounds}`}</Kicker>
            <div className="truncate font-display text-[1.08rem] leading-tight font-bold">{poker ? "Poker" : chill ? "Blackjack Table" : "Blackjack"}</div>
          </div>
        </div>
        {chill ? (
          <div className="cs-gulp" aria-label="Mon solde">
            🪙 {formatChips(game.chips!.stacks[ME] ?? 0, poker ? "chips" : "euro")}
          </div>
        ) : (
          <div className="cs-gulp" aria-label="Mes gorgées">
            🍺 {me?.gulpsTotal ?? 0}
          </div>
        )}
        <IconButton label="Menu" onClick={() => setMenu(true)}>
          ☰
        </IconButton>
      </header>

      <GameContext.Provider value={ctx}>
        <div key={`${tab}:${scen}:${run}`} className="contents">
          {screen}
        </div>
      </GameContext.Provider>

      {toast && (
        <div
          className="animate-pop pointer-events-none fixed inset-x-4 z-50 mx-auto max-w-[360px] rounded-full bg-black/85 px-4 py-2 text-center text-sm text-ink"
          style={{ bottom: "calc(var(--safe-bottom) + 120px)" }}
        >
          {toast}
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <p className="mb-3 text-[0.9rem] text-ink-2">Aperçu des tables avec des données fictives : rien n&apos;est envoyé au serveur.</p>
        <button
          type="button"
          className="cs-row mb-3 w-full text-left font-semibold"
          onClick={() => {
            setBare(false);
            setMenu(false);
          }}
        >
          ⤡ Afficher les onglets
        </button>
      </Sheet>
    </div>
  );
}
