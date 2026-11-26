"use client";

import { CASINO_GAMES, casinoGameById } from "@/lib/casino/catalog";
import {
  BJ_ROUND_OPTIONS,
  type CasinoGameId,
  type CasinoOptions,
  DEFAULT_CASINO_OPTIONS,
  MAX_CASINO_SEATS,
  type Universe,
} from "@/lib/casino/types";
import { haptic } from "@/lib/haptics";
import { Chips, Stepper } from "../ui/Form";
import { Card, Note, Section } from "../ui/Layout";

export const MAX_CASINO_BOTS = 6;

// Bornes du nombre de bots en Chill : en solo, assez pour le minimum du jeu ;
// jamais plus que les places libres à la table (8 assis).
export function casinoBotBounds(humans: number, gameId: CasinoGameId) {
  const free = Math.max(0, MAX_CASINO_SEATS - humans);
  const max = Math.min(MAX_CASINO_BOTS, free);
  const min = Math.min(max, Math.max(0, casinoGameById(gameId).minPlayers - humans));
  return { min, max };
}

// Sélecteur d'univers, en haut du salon. Visible par tous, modifiable par
// l'hôte seulement (le choix est partagé via le serveur).
export function UniverseSwitch({
  value,
  isHost,
  onChange,
}: {
  value: Universe;
  isHost: boolean;
  onChange: (u: Universe) => void;
}) {
  const opts: { id: Universe; icon: string; label: string; sub: string }[] = [
    { id: "party", icon: "🍻", label: "Soirée", sub: "Mini-jeux à boire" },
    { id: "casino", icon: "🎲", label: "Chill", sub: "Casino, sans gorgées" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Univers">
      {opts.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!isHost && !on}
            onClick={() => {
              if (!isHost || on) return;
              haptic("select");
              onChange(o.id);
            }}
            className={`cs-card flex min-w-0 flex-col items-start gap-0.5 p-3 text-left transition active:scale-[0.97] ${
              on ? (o.id === "casino" ? "border-cyan/70! bg-cyan/10!" : "border-neon/60! bg-neon/10!") : "opacity-55"
            } ${!isHost ? "cursor-default" : ""}`}
          >
            <span className="text-2xl">{o.icon}</span>
            <span className="font-display text-[1.05rem] font-bold leading-tight">{o.label}</span>
            <span className="truncate text-[0.75rem] text-mute">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CasinoSettings({
  isHost,
  humans,
  gameId,
  options = DEFAULT_CASINO_OPTIONS,
  bots,
  onBots,
  onSetup,
}: {
  isHost: boolean;
  humans: number;
  gameId: CasinoGameId;
  options?: CasinoOptions;
  bots: number;
  onBots: (n: number) => void;
  onSetup: (patch: { casinoGameId?: CasinoGameId; casinoOptions?: Partial<CasinoOptions> }) => void;
}) {
  const meta = casinoGameById(gameId);
  const { min, max } = casinoBotBounds(humans, gameId);
  const endValue = options.bjEndMode === "survivor" ? 0 : options.bjRounds;

  if (!isHost) {
    return (
      <Section title="Au programme">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-tight">{meta.label}</div>
              <div className="text-[0.85rem] text-ink-2">{meta.tagline}</div>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5 text-[0.9rem] leading-snug text-ink-2">
            {meta.rules.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                {l}
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    );
  }

  return (
    <>
      <Section title="Jeu">
        <div className="grid grid-cols-2 gap-2">
          {CASINO_GAMES.map((t) => {
            const on = t.id === gameId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                disabled={!t.ready}
                onClick={() => {
                  haptic("select");
                  onSetup({ casinoGameId: t.id });
                }}
                className={`cs-card flex min-h-[96px] min-w-0 flex-col items-start justify-between gap-1 p-3 text-left transition active:scale-[0.97] disabled:opacity-40 ${
                  on ? "border-cyan/70! bg-cyan/10!" : "opacity-60"
                }`}
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="font-display text-[0.98rem] font-bold leading-tight">{t.label}</span>
                <span className="text-[0.72rem] text-mute">{t.ready ? t.tagline : "Bientôt"}</span>
              </button>
            );
          })}
        </div>
        {!meta.ready && <Note>Ce jeu arrive bientôt.</Note>}
      </Section>

      {gameId === "bjtable" && (
        <Section title="Fin de partie">
          <Chips
            options={[
              ...BJ_ROUND_OPTIONS.map((n) => ({ value: n, label: `${n} manches` })),
              { value: 0, label: "Dernier survivant" },
            ]}
            value={endValue}
            onChange={(v) =>
              onSetup({ casinoOptions: v === 0 ? { bjEndMode: "survivor" } : { bjEndMode: "rounds", bjRounds: v } })
            }
          />
        </Section>
      )}

      <Section title="Bots 🤖">
        <Card className="flex items-center justify-between gap-3">
          <p className="text-[0.9rem] leading-snug text-ink-2">
            {max === 0 ? "Table complète : 8 joueurs assis." : "Complète la table avec des joueurs virtuels."}
          </p>
          <Stepper value={Math.max(min, Math.min(max, bots))} min={min} max={max} onChange={onBots} />
        </Card>
      </Section>

      {humans > MAX_CASINO_SEATS && (
        <Note>
          {MAX_CASINO_SEATS} places assises : les {humans - MAX_CASINO_SEATS} derniers arrivés regardent la partie.
        </Note>
      )}
    </>
  );
}
