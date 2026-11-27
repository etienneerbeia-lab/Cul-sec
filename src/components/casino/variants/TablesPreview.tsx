"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatChips } from "@/lib/chips/format";
import { useViewportHeight } from "@/lib/useViewportHeight";
import { GameContext, type GameCtx } from "../../GameContext";
import { IconButton } from "../../ui/Button";
import { Sheet } from "../../ui/Feedback";
import { Kicker } from "../../ui/Layout";
import BlackjackTableScreen from "../BlackjackTableScreen";
import PokerScreen from "../PokerScreen";
import BlackjackVariantScreen, { type BjVariantId } from "./BlackjackVariant";
import { LabSettings } from "./LabSettings";
import PokerVariantScreen from "./PokerVariant";
import { BJ_SCENARIOS, ME, POKER_SCENARIOS, bjGame, pokerGame, type BjScenario, type PokerScenario } from "./previewData";
import { DECKS, setTablePrefs, type DeckChoice } from "./store";
import type { PokerVariantId } from "./themes";

// Page /preview/tables : toutes les variantes de table avec des données
// fictives, pour comparer avant de choisir. Rien n'est envoyé au serveur.
// ?t=poker-A&s=tour&deck=minimal&4c=1&bare=1 (bare : sans la barre de
// comparaison, pour des captures identiques à l'appli).

type TabId = "poker-actuel" | `poker-${PokerVariantId}` | "bj-actuel" | `bj-${BjVariantId}`;

const TABS: { id: TabId; label: string; desc: string }[] = [
  { id: "poker-actuel", label: "Actuel", desc: "La table en production aujourd'hui (référence)." },
  { id: "poker-A", label: "A Classique", desc: "Pilule verticale, feutre vert profond, rail cuir ; vraies cartes à index en coin et symbole central." },
  { id: "poker-B", label: "B Minimal", desc: "Rectangle arrondi ardoise, sièges plats ; cartes blanches à gros index, jeu 4 couleurs en option." },
  { id: "poker-C", label: "C Club", desc: "Ovale bordeaux, liseré doré lumineux, plaques dorées ; cartes vernies avec reflet et ombre." },
  { id: "poker-D", label: "D Néon", desc: "Ma proposition : la nuit Cul·Sec, bord néon rose → cyan, tuiles en verre, cartes à fond coloré par couleur." },
  { id: "bj-actuel", label: "Actuel", desc: "La table en production aujourd'hui (référence)." },
  { id: "bj-A", label: "A Demi-lune", desc: "Vraie table large et basse : croupier sur le bord droit, joueurs sur l'arc, ma main en grand dessous." },
  { id: "bj-B", label: "B Grille", desc: "Croupier en haut, 2 rangées de 3 cases (nom, mise, cartes, total), ma main en grand en bas." },
  { id: "bj-C", label: "C Arc", desc: "Arc « sourire » : cartes en cascade diagonale vers le croupier, mon spot au centre et plus grand." },
];

const DECK_LABEL: Record<DeckChoice, string> = { auto: "Cartes auto", classic: "Classique", minimal: "Minimal", club: "Club", neon: "Néon" };

function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const t = TABS.find((x) => x.id === q.get("t"))?.id ?? "poker-A";
  const deck = (DECKS as readonly string[]).includes(q.get("deck") ?? "") ? (q.get("deck") as DeckChoice) : "auto";
  return { tab: t, scenario: q.get("s") ?? "tour", deck, fourColor: q.get("4c") === "1", bare: q.get("bare") === "1" };
}

export default function TablesPreview() {
  useViewportHeight();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabId>("poker-A");
  const [scenario, setScenario] = useState<string>("tour");
  const [deck, setDeck] = useState<DeckChoice>("auto");
  const [fourColor, setFourColor] = useState(false);
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
    setDeck(u.deck);
    setFourColor(u.fourColor);
    setBare(u.bare);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Cet appareil voit désormais le sélecteur caché du menu ☰ en partie.
    setTablePrefs({ lab: true });
  }, []);

  // L'URL suit les choix (lien partageable vers une variante précise).
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams({ t: tab, s: scenario });
    if (deck !== "auto") q.set("deck", deck);
    if (fourColor) q.set("4c", "1");
    if (bare) q.set("bare", "1");
    window.history.replaceState(null, "", `?${q}`);
  }, [ready, tab, scenario, deck, fourColor, bare]);

  const isPoker = tab.startsWith("poker");
  const scenarios = isPoker ? POKER_SCENARIOS : BJ_SCENARIOS;
  const scen = scenarios.some((s) => s.id === scenario) ? scenario : "tour";

  const replay = useCallback(() => {
    setRun((r) => r + 1);
    setNow(Date.now());
    setStep(0);
  }, []);
  useEffect(() => {
    if (!Number.isFinite(step)) return;
    const last = isPoker ? 3 : 1;
    if (step >= last) {
      const id = setTimeout(() => setStep(Infinity), 50);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStep((s) => s + 1), isPoker ? (step === 0 ? 500 : 1100) : 400);
    return () => clearTimeout(id);
  }, [step, isPoker]);

  const game = useMemo(() => {
    if (isPoker) return pokerGame(scen as PokerScenario, now, Number.isFinite(step) ? [0, 3, 4, 5][step] : 5);
    const g = bjGame(scen as BjScenario, now);
    // Rejeu : la donne repart de zéro, puis le journal complet arrive et
    // l'écran le rejoue carte par carte.
    if (step === 0) g.bjt!.log = [];
    return g;
  }, [isPoker, scen, now, step]);

  const act = useCallback((a: { type: string; [k: string]: unknown }) => {
    const what = String(a.op ?? a.move ?? a.type);
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
      myHand: null,
      myVoteChoice: null,
      myUndercoverWord: null,
      away: [],
      act,
      openMenu: () => setMenu(true),
    }),
    [game, act],
  );

  if (!ready) return <div id="app" />;

  const variant = tab.split("-")[1];
  const d = deck === "auto" ? undefined : deck;
  const screen =
    tab === "poker-actuel" ? (
      <PokerScreen />
    ) : tab === "bj-actuel" ? (
      <BlackjackTableScreen />
    ) : isPoker ? (
      <PokerVariantScreen variant={variant as PokerVariantId} deck={d} fourColor={fourColor} />
    ) : (
      <BlackjackVariantScreen variant={variant as BjVariantId} deck={d} fourColor={fourColor} />
    );
  const info = TABS.find((x) => x.id === tab)!;
  const myStack = game.chips!.stacks[ME] ?? 0;

  return (
    <div id="app" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
      {!bare && (
        <div className="lab-bar shrink-0" data-lab-bar>
          <div className="lab-tabs" role="tablist">
            <span className="lab-group">♠ Poker</span>
            {TABS.slice(0, 5).map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className="lab-tab" onClick={() => setTab(x.id)}>
                {x.label}
              </button>
            ))}
            <span className="lab-group">🎰 BJ</span>
            {TABS.slice(5).map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className="lab-tab" onClick={() => setTab(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="lab-opts">
            {scenarios.map((s) => (
              <button key={s.id} type="button" className="lab-opt" aria-pressed={scen === s.id} onClick={() => setScenario(s.id)}>
                {s.label}
              </button>
            ))}
            <select className="lab-opt" value={deck} onChange={(e) => setDeck(e.target.value as DeckChoice)} aria-label="Jeu de cartes">
              {DECKS.map((x) => (
                <option key={x} value={x}>
                  {DECK_LABEL[x]}
                </option>
              ))}
            </select>
            <button type="button" className="lab-opt" aria-pressed={fourColor} onClick={() => setFourColor((f) => !f)}>
              4 couleurs
            </button>
            <button type="button" className="lab-opt" onClick={replay}>
              ↻ Rejouer
            </button>
            <button type="button" className="lab-opt" onClick={() => setBare(true)}>
              ⤢ Plein écran
            </button>
          </div>
          <p className="lab-desc">{info.desc}</p>
        </div>
      )}

      <header className="flex shrink-0 items-center gap-3 pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan/25 bg-cyan/[0.08] text-2xl">{isPoker ? "♠️" : "🎰"}</span>
          <div className="min-w-0">
            <Kicker>Chill · URG3</Kicker>
            <div className="truncate font-display text-[1.08rem] font-bold leading-tight">{isPoker ? "Poker" : "Blackjack Table"}</div>
          </div>
        </div>
        <div className="cs-gulp" aria-label="Mon solde">
          🪙 {formatChips(myStack, isPoker ? "chips" : "euro")}
        </div>
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
        <p className="mb-3 text-[0.9rem] text-ink-2">
          Aperçu avec des données fictives. Ce réglage s&apos;applique à tes vraies parties sur cet appareil (menu ☰ en jeu).
        </p>
        {bare && (
          <button
            type="button"
            className="cs-row mb-3 w-full text-left font-semibold"
            onClick={() => {
              setBare(false);
              setMenu(false);
            }}
          >
            ⤡ Afficher la barre de comparaison
          </button>
        )}
        <LabSettings />
      </Sheet>
    </div>
  );
}
