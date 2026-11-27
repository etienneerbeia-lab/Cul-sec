"use client";

import { useRef } from "react";
import { haptic } from "@/lib/haptics";
import { Kicker } from "../../ui/Layout";
import { BJ_VARIANTS, DECKS, POKER_VARIANTS, setTablePrefs, useTablePrefs, type DeckChoice } from "./store";

// Sélecteur caché du menu ☰ : variante de table (poker, blackjack) pour
// tester en vraie partie, sur cet appareil seulement. Il apparaît après
// une visite de /preview/tables, ou 5 touches sur la ligne de version.

const DECK_LABEL: Record<DeckChoice, string> = { auto: "Auto", classic: "Classique", minimal: "Minimal", club: "Club", neon: "Néon" };

function Choice<T extends string>({
  label,
  list,
  value,
  onPick,
  names,
}: {
  label: string;
  list: readonly T[];
  value: T;
  onPick: (v: T) => void;
  names?: Record<T, string>;
}) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-[0.78rem] font-semibold text-ink-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((x) => (
          <button
            key={x}
            type="button"
            className="cs-chip min-w-[44px] px-2.5!"
            aria-pressed={value === x}
            onClick={() => {
              haptic("select");
              onPick(x);
            }}
          >
            {names?.[x] ?? (x === "actuel" ? "Actuel" : x)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LabSettings() {
  const prefs = useTablePrefs();
  const taps = useRef<number[]>([]);
  const build = process.env.APP_BUILD_ID ?? "dev";
  return (
    <>
      {prefs.lab && (
        <div className="mb-4 rounded-2xl border border-cyan/25 bg-cyan/[0.05] px-3.5 py-3" data-lab>
          <Kicker className="mb-2">🧪 Labo des tables · cet appareil</Kicker>
          <Choice label="Poker" list={POKER_VARIANTS} value={prefs.poker} onPick={(poker) => setTablePrefs({ poker })} />
          <Choice label="Blackjack" list={BJ_VARIANTS} value={prefs.bj} onPick={(bj) => setTablePrefs({ bj })} />
          <Choice label="Cartes" list={DECKS} value={prefs.deck} onPick={(deck) => setTablePrefs({ deck })} names={DECK_LABEL} />
          <button
            type="button"
            role="switch"
            aria-checked={prefs.fourColor}
            onClick={() => setTablePrefs({ fourColor: !prefs.fourColor })}
            className="cs-row mb-2 w-full text-left"
          >
            <span className="flex-1 text-[0.9rem] font-semibold">Jeu 4 couleurs (♦ bleu, ♣ vert)</span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${prefs.fourColor ? "bg-neon" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs.fourColor ? "left-[1.4rem]" : "left-0.5"}`} />
            </span>
          </button>
          <div className="flex items-center justify-between text-[0.78rem]">
            <a href="/preview/tables" className="font-semibold text-cyan underline-offset-2 hover:underline">
              Comparer les variantes →
            </a>
            <button type="button" className="text-mute" onClick={() => setTablePrefs({ lab: false, poker: "actuel", bj: "actuel" })}>
              Masquer le labo
            </button>
          </div>
        </div>
      )}
      {/* Version installée (utile pour vérifier qu'un déploiement est bien
          arrivé sur l'appli) ; 5 touches rapides : labo des tables. */}
      <button
        type="button"
        className="mt-3 block w-full text-center text-[0.65rem] text-mute/70"
        onClick={() => {
          const now = Date.now();
          taps.current = [...taps.current.filter((t) => now - t < 2500), now];
          if (taps.current.length >= 5) {
            taps.current = [];
            haptic("success");
            setTablePrefs({ lab: !prefs.lab });
          }
        }}
      >
        Cul·Sec · version {build}
      </button>
    </>
  );
}
