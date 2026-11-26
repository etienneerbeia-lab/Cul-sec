"use client";

import { useEffect, useRef, useState } from "react";
import { ROUND_TYPES } from "@/lib/game/roundTypes";
import {
  MAX_CUSTOM_QUESTIONS_PER_PLAYER,
  MIN_ENABLED_ROUND_TYPES,
  type CulSecRule,
  type CustomQuestion,
  type Player,
  type RoundTypeId,
} from "@/lib/game/types";
import { haptic } from "@/lib/haptics";
import { Button } from "../ui/Button";
import { Chips, Stepper, TextField } from "../ui/Form";
import { Waiting } from "../ui/Feedback";
import { Card, Kicker, Note, Screen, Section } from "../ui/Layout";
import { PlayerRow } from "../ui/Players";
import { casinoBotBounds, CasinoSettings, UniverseSwitch } from "../casino/CasinoLobby";
import { casinoGameById } from "@/lib/casino/catalog";
import type { CasinoGameId, CasinoOptions, Universe } from "@/lib/casino/types";

export type LobbySetupPatch = { universe?: Universe; casinoGameId?: CasinoGameId; casinoOptions?: Partial<CasinoOptions> };

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
  previousAdultMode,
  myQuestions = [],
  tableQuestionCount = 0,
  onAddQuestion,
  onRemoveQuestion,
  onLaunch,
  onRename,
  universe = "party",
  casinoGameId = "poker",
  casinoOptions,
  onSetup,
  onLaunchCasino,
}: {
  roomCode: string;
  players: Player[];
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  error: string;
  previousEnabledRoundTypeIds?: RoundTypeId[];
  previousAdultMode?: boolean;
  myQuestions?: CustomQuestion[];
  tableQuestionCount?: number;
  onAddQuestion: (q: NewQuestion) => Promise<void>;
  onRemoveQuestion: (id: string) => Promise<void>;
  onLaunch: (totalRounds: number, culSecRule: CulSecRule, enabledRoundTypeIds: RoundTypeId[], bots: number, adultMode: boolean) => void;
  onRename: (name: string) => void;
  universe?: Universe;
  casinoGameId?: CasinoGameId;
  casinoOptions?: CasinoOptions;
  onSetup: (patch: LobbySetupPatch) => void;
  onLaunchCasino: (bots: number) => void;
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
  // Mode 18+ : désactivé par défaut, activé seulement après confirmation ;
  // repris de la partie précédente quand on rejoue dans le même salon.
  const [adultMode, setAdultMode] = useState(!!previousAdultMode);
  const [confirmingAdult, setConfirmingAdult] = useState(false);
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

  // ---- Univers Chill ----
  const casino = universe === "casino";
  const [casinoBots, setCasinoBots] = useState(0);
  const casinoMeta = casinoGameById(casinoGameId);
  const bounds = casinoBotBounds(humans.length, casinoGameId);
  const casinoBotCount = Math.max(bounds.min, Math.min(bounds.max, casinoBots));
  const casinoTable = Math.min(8, humans.length) + casinoBotCount;
  const canLaunchCasino = casinoMeta.ready && casinoTable >= casinoMeta.minPlayers && !busy;

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
        casino ? (
          isHost ? (
            <>
              {error && <Note tone="danger">{error}</Note>}
              <Button disabled={!canLaunchCasino} haptics="success" onClick={() => onLaunchCasino(casinoBotCount)}>
                {casinoMeta.ready ? `${casinoMeta.icon} Lancer ${casinoMeta.label} · ${casinoTable} joueurs` : "Bientôt disponible"}
              </Button>
            </>
          ) : (
            <Waiting>L&apos;hôte prépare la table…</Waiting>
          )
        ) : isHost ? (
          <>
            {error && <Note tone="danger">{error}</Note>}
            {enoughGames && playable === 0 && <Note>Aucun jeu choisi n&apos;est jouable à {tableSize} : ajoute des bots.</Note>}
            <Button
              disabled={!canLaunch}
              haptics="success"
              onClick={() => onLaunch(totalRounds, culSecRule, Array.from(enabledIds), botCount, adultMode)}
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

      <UniverseSwitch value={universe} isHost={isHost} onChange={(u) => onSetup({ universe: u })} />

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
          {(casino ? casinoBotCount : botCount) > 0 && (
            <div className="cs-row" data-dim="true">
              <span className="cs-avatar h-10 w-10 bg-violet/40 text-lg">🤖</span>
              <span className="flex-1 font-semibold text-ink-2">
                {(() => {
                  const n = casino ? casinoBotCount : botCount;
                  return `+ ${n} bot${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} au lancement`;
                })()}
              </span>
            </div>
          )}
        </div>
      </Section>

      {casino ? (
        <CasinoSettings
          isHost={isHost}
          humans={humans.length}
          gameId={casinoGameId}
          options={casinoOptions}
          bots={casinoBots}
          onBots={setCasinoBots}
          onSetup={onSetup}
        />
      ) : (
      <>
      <TableQuestions
        mine={myQuestions}
        total={tableQuestionCount}
        busy={busy}
        error={isHost ? "" : error}
        onAdd={onAddQuestion}
        onRemove={onRemoveQuestion}
      />

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

          <Section title="Ambiance">
            <AdultToggle
              on={adultMode}
              confirming={confirmingAdult}
              onToggle={() => {
                haptic("select");
                if (adultMode) setAdultMode(false);
                else setConfirmingAdult(true);
              }}
              onConfirm={() => {
                haptic("success");
                setAdultMode(true);
                setConfirmingAdult(false);
              }}
              onCancel={() => setConfirmingAdult(false)}
            />
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
      </>
      )}
    </Screen>
  );
}

export type NewQuestion = { mode: "tp"; promptA: string; promptB: string } | { mode: "qui"; prompt: string };

// « Questions de la table » : en attendant le lancement, chacun écrit
// jusqu'à 2 questions (Tu préfères ou Qui de nous), anonymes, mélangées
// aux pools pendant la partie. Chacun ne voit que les siennes.
function TableQuestions({
  mine,
  total,
  busy,
  error,
  onAdd,
  onRemove,
}: {
  mine: CustomQuestion[];
  total: number;
  busy: boolean;
  error: string;
  onAdd: (q: NewQuestion) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"tp" | "qui">("tp");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [qui, setQui] = useState("");
  const full = mine.length >= MAX_CUSTOM_QUESTIONS_PER_PLAYER;
  const valid = mode === "tp" ? a.trim().length >= 2 && b.trim().length >= 2 : qui.trim().length >= 2;
  const others = total - mine.length;

  async function submit() {
    if (!valid || busy) return;
    await onAdd(mode === "tp" ? { mode, promptA: a.trim(), promptB: b.trim() } : { mode, prompt: qui.trim() });
    setA("");
    setB("");
    setQui("");
  }

  return (
    <Section title={`Questions de la table ✍️${total ? ` · ${total}` : ""}`}>
      <Card>
        <p className="mb-3 text-[0.88rem] leading-snug text-ink-2">
          En attendant le lancement, glisse jusqu&apos;à {MAX_CUSTOM_QUESTIONS_PER_PLAYER} questions sur les gens présents. Elles
          sortiront en anonyme pendant les votes.
          {others > 0 && ` ${others} déjà écrite${others > 1 ? "s" : ""} par les autres 👀`}
        </p>
        {mine.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {mine.map((q) => (
              <div key={q.id} className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-[0.9rem] leading-snug">
                <span className="flex-1">
                  {q.mode === "qui" ? `Qui de nous ${q.prompt} ?` : `${q.promptA} — ou — ${q.promptB}`}
                </span>
                <button
                  type="button"
                  aria-label="Supprimer"
                  disabled={busy}
                  onClick={() => onRemove(q.id)}
                  className="shrink-0 px-1 text-mute"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {!full && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Chips
              options={[
                { value: "tp" as const, label: "Tu préfères" },
                { value: "qui" as const, label: "Qui de nous" },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === "tp" ? (
              <>
                <TextField placeholder="Option 1 (ex. Rouler une pelle à Jules)" maxLength={90} value={a} onChange={(e) => setA(e.target.value)} />
                <TextField placeholder="Option 2 (ex. Lécher la barre du métro)" maxLength={90} value={b} onChange={(e) => setB(e.target.value)} />
              </>
            ) : (
              <TextField
                placeholder="Qui de nous… (ex. finit chez l'ex de Léa ?)"
                maxLength={120}
                value={qui}
                onChange={(e) => setQui(e.target.value)}
              />
            )}
            <Button type="submit" variant="secondary" size="sm" disabled={!valid || busy}>
              Ajouter ma question
            </Button>
          </form>
        )}
        {error && <div className="mt-2"><Note tone="danger">{error}</Note></div>}
      </Card>
    </Section>
  );
}

function AdultToggle({
  on,
  confirming,
  onToggle,
  onConfirm,
  onCancel,
}: {
  on: boolean;
  confirming: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (confirming) confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [confirming]);
  return (
    <Card className={on ? "border-danger/60! bg-danger/10!" : ""}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block font-display text-[1.05rem] font-bold">Mode 18+ 🌶️</span>
          <span className="block text-[0.82rem] leading-snug text-ink-2">
            {on
              ? "Votes, Undercover et Mèmes version trash. Âmes sensibles s'abstenir."
              : "Contenu cru pour Tu préfères, Qui de nous, Undercover et Mèmes."}
          </span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-danger" : "bg-white/15"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
        </span>
      </button>
      {confirming && !on && (
        <div ref={confirmRef} className="animate-pop mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3">
          <p className="text-[0.92rem] font-semibold leading-snug">
            Tous les joueurs ont 18 ans ou plus et sont OK avec du contenu sexuel/trash ?
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Non, on reste sages
            </Button>
            <Button variant="danger" size="sm" haptics={false} onClick={onConfirm}>
              Oui, on est tous OK
            </Button>
          </div>
        </div>
      )}
    </Card>
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
