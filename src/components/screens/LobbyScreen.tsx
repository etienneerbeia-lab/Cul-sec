"use client";

import { useState } from "react";
import { ROUND_TYPES } from "@/lib/game/roundTypes";
import { MIN_ENABLED_ROUND_TYPES, type CulSecRule, type Player, type RoundTypeId } from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { Button } from "../ui/Button";
import { Chips, Stepper, TextField } from "../ui/Form";
import { Waiting } from "../ui/Feedback";
import { Card, Kicker, Note, Screen, Section } from "../ui/Layout";
import { PlayerRow } from "../ui/Players";

const ROUND_OPTIONS = [5, 10, 15, 20];
const ALL_ROUND_TYPE_IDS = ROUND_TYPES.map((t) => t.id);
const MAX_BOTS = 6;

export default function LobbyScreen({
  roomCode,
  players,
  mySlug,
  isHost,
  busy,
  error,
  previousEnabledRoundTypeIds,
  onLaunch,
  onRename,
}: {
  roomCode: string;
  players: Player[];
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  error: string;
  previousEnabledRoundTypeIds?: RoundTypeId[];
  onLaunch: (totalRounds: number, culSecRule: CulSecRule, enabledRoundTypeIds: RoundTypeId[], bots: number) => void;
  onRename: (name: string) => void;
}) {
  const [totalRounds, setTotalRounds] = useState(10);
  const [culSecRule, setCulSecRule] = useState<CulSecRule>("last");
  const [enabledIds, setEnabledIds] = useState<Set<RoundTypeId>>(
    () => {
      const prev = previousEnabledRoundTypeIds?.filter((id) => ALL_ROUND_TYPE_IDS.includes(id));
      return new Set(prev?.length ? prev : ALL_ROUND_TYPE_IDS);
    }
  );
  const [extraBots, setExtraBots] = useState(0);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const humans = players.filter((p) => !p.bot);
  const solo = humans.length === 1;
  // En solo, le serveur ajoute assez de bots pour que chaque jeu choisi soit
  // jouable ; à plusieurs, l'hôte en ajoute s'il le souhaite.
  const autoBots = solo
    ? Math.max(0, ...ROUND_TYPES.filter((t) => enabledIds.has(t.id)).map((t) => t.minPlayers)) - 1
    : 0;
  const botCount = Math.min(MAX_BOTS, Math.max(autoBots, extraBots));
  const tableSize = humans.length + botCount;
  const enoughGames = enabledIds.size >= MIN_ENABLED_ROUND_TYPES;
  const playable = ROUND_TYPES.filter((t) => enabledIds.has(t.id) && t.minPlayers <= tableSize).length;
  const canLaunch = enoughGames && playable > 0 && !busy;

  function toggle(id: RoundTypeId) {
    haptic("select");
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function share() {
    const url = `${window.location.origin}/?code=${roomCode}`;
    haptic("tap");
    try {
      if (navigator.share) await navigator.share({ title: "Cul-Sec", text: `Rejoins la partie ${roomCode} !`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // partage annulé
    }
  }

  return (
    <Screen
      actions={
        isHost ? (
          <>
            {error && <Note tone="danger">{error}</Note>}
            {enoughGames && playable === 0 && <Note>Aucun jeu choisi n&apos;est jouable à {tableSize} : ajoute des bots.</Note>}
            <Button
              disabled={!canLaunch}
              haptics="success"
              onClick={() => onLaunch(totalRounds, culSecRule, Array.from(enabledIds), botCount)}
            >
              {solo ? `Jouer contre ${botCount} bot${botCount > 1 ? "s" : ""}` : `Lancer la partie · ${tableSize} joueurs`}
            </Button>
          </>
        ) : (
          <Waiting>L&apos;hôte prépare la partie…</Waiting>
        )
      }
    >
      <Card className="relative overflow-hidden text-center">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-neon/25 blur-3xl" />
        <Kicker>Code de la partie</Kicker>
        <div className="cs-neon-text my-1 font-display text-[3.4rem] font-extrabold leading-none tracking-[0.18em]">
          {roomCode}
        </div>
        <button type="button" onClick={share} className="mt-1 text-sm font-semibold text-ink-2 underline decoration-white/30 underline-offset-4">
          {copied ? "Lien copié ✓" : "Partager le lien d'invitation"}
        </button>
      </Card>

      <Section title={`À table · ${humans.length} joueur${humans.length > 1 ? "s" : ""}`}>
        <div className="stagger flex flex-col gap-2">
          {humans.map((p) =>
            p.slug === mySlug && editing ? (
              <RenameRow
                key={p.slug}
                name={p.name}
                onDone={(n) => {
                  setEditing(false);
                  if (n && n !== p.name) onRename(n);
                }}
              />
            ) : (
              <PlayerRow
                key={p.slug}
                name={p.name}
                slug={p.slug}
                me={p.slug === mySlug}
                detail={p.slug === mySlug ? "Touchez pour changer de prénom" : undefined}
                onClick={p.slug === mySlug ? () => setEditing(true) : undefined}
              />
            )
          )}
          {botCount > 0 && (
            <div className="cs-row" data-dim="true">
              <span className="cs-avatar h-10 w-10 bg-violet/40 text-lg">🤖</span>
              <span className="flex-1 font-semibold text-ink-2">
                + {botCount} bot{botCount > 1 ? "s" : ""} ajouté{botCount > 1 ? "s" : ""} au lancement
              </span>
            </div>
          )}
        </div>
      </Section>

      {isHost ? (
        <>
          <Section title="Nombre de manches">
            <Chips options={ROUND_OPTIONS.map((n) => ({ value: n, label: n }))} value={totalRounds} onChange={setTotalRounds} />
          </Section>

          <Section title="Cul sec final">
            <Chips
              options={[
                { value: "last" as CulSecRule, label: "Le plus arrosé le boit" },
                { value: "first" as CulSecRule, label: "Le plus sobre le donne" },
              ]}
              value={culSecRule}
              onChange={setCulSecRule}
            />
          </Section>

          <Section title={`Mini-jeux · ${enabledIds.size} actifs`}>
            <div className="grid grid-cols-2 gap-2">
              {ROUND_TYPES.map((t) => {
                const on = enabledIds.has(t.id);
                const tooFew = t.minPlayers > tableSize;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    className={`cs-card flex min-h-[84px] flex-col items-start justify-between gap-1 p-3 text-left transition active:scale-[0.97] ${
                      on ? "border-neon/60! bg-neon/10!" : "opacity-55"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-2xl">{t.icon}</span>
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${on ? "bg-neon text-white" : "border border-white/25"}`}
                      >
                        {on ? "✓" : ""}
                      </span>
                    </span>
                    <span className="font-display text-[0.98rem] font-bold leading-tight">{t.label}</span>
                    <span className={`text-[0.72rem] ${tooFew && on ? "text-amber" : "text-mute"}`}>
                      {tooFew ? `${t.minPlayers} joueurs min · sauté` : t.minPlayers > 1 ? `${t.minPlayers}+ joueurs` : "Dès 1 joueur"}
                    </span>
                  </button>
                );
              })}
            </div>
            {!enoughGames && <Note tone="danger">Choisis au moins {MIN_ENABLED_ROUND_TYPES} mini-jeux.</Note>}
          </Section>

          <Section title="Bots 🤖">
            <Card className="flex items-center justify-between gap-3">
              <p className="text-[0.9rem] leading-snug text-ink-2">
                {solo ? "Mode solo : les bots jouent contre toi." : "Complète la table avec des joueurs virtuels."}
              </p>
              <Stepper value={botCount} min={autoBots} max={MAX_BOTS} onChange={setExtraBots} />
            </Card>
          </Section>
        </>
      ) : (
        <Section title="Comment ça marche">
          <Card className="text-[0.95rem] leading-relaxed text-ink-2">
            À chaque manche, un mini-jeu est tiré au hasard. Les règles s&apos;affichent avant chaque jeu, et l&apos;appli
            compte les gorgées de chacun. Garde ton téléphone allumé !
          </Card>
        </Section>
      )}
    </Screen>
  );
}

function RenameRow({ name, onDone }: { name: string; onDone: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(value.trim());
      }}
    >
      <TextField autoFocus value={value} maxLength={24} onChange={(e) => setValue(e.target.value)} onBlur={() => onDone(value.trim())} />
    </form>
  );
}
