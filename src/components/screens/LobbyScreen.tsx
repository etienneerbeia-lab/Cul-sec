"use client";

import { useState } from "react";
import { ROUND_TYPES } from "@/lib/game/roundTypes";
import { MIN_ENABLED_ROUND_TYPES, type CulSecRule, type Player, type RoundTypeId } from "@/lib/game/types";

const ROUND_OPTIONS = [5, 10, 15, 20];
const ALL_ROUND_TYPE_IDS = ROUND_TYPES.map((t) => t.id);

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
  // Set from the game's last launch (e.g. after "Rejouer" sends everyone
  // back here) so the host doesn't have to re-tick every mini-game by
  // hand — undefined/empty for a brand-new room, which falls back to
  // "everything on" like before.
  previousEnabledRoundTypeIds?: RoundTypeId[];
  onLaunch: (totalRounds: number, culSecRule: CulSecRule, enabledRoundTypeIds: RoundTypeId[], bots: number) => void;
  onRename: (name: string) => void;
}) {
  const [totalRounds, setTotalRounds] = useState(10);
  const [culSecRule, setCulSecRule] = useState<CulSecRule>("last");
  const [enabledIds, setEnabledIds] = useState<Set<RoundTypeId>>(
    () => new Set(previousEnabledRoundTypeIds?.length ? previousEnabledRoundTypeIds : ALL_ROUND_TYPE_IDS)
  );

  function toggleRoundType(id: RoundTypeId) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Plus de minimum de 3 : on peut lancer seul (mode solo / test). En solo
  // le serveur ajoute automatiquement assez de bots pour que chaque jeu
  // choisi soit jouable ; à plusieurs, l'hôte peut en ajouter lui-même.
  const [extraBots, setExtraBots] = useState(0);
  const humans = players.filter((p) => !p.bot).length;
  const solo = humans === 1;
  const autoBots = solo
    ? Math.max(0, ...ROUND_TYPES.filter((t) => enabledIds.has(t.id)).map((t) => t.minPlayers)) - 1
    : 0;
  const botCount = Math.min(6, Math.max(autoBots, extraBots));
  const tableSize = humans + botCount;
  const enoughPlayers = humans >= 1;
  const enoughGames = enabledIds.size >= MIN_ENABLED_ROUND_TYPES;
  const playable = ROUND_TYPES.filter((t) => enabledIds.has(t.id) && t.minPlayers <= tableSize).length;
  const enough = enoughPlayers && enoughGames && playable > 0;

  return (
    <>
      <label className="field-label">Code de la partie</label>
      <div className="pass-name">{roomCode}</div>
      <div className="hint">
        Donne ce code à tes amis pour qu&apos;ils rejoignent depuis leur téléphone.
      </div>

      <h3>Joueurs connectés</h3>
      <div className="players-list">
        {players.map((p) =>
          p.slug === mySlug ? (
            <OwnNameRow key={p.slug} name={p.name} busy={busy} onRename={onRename} />
          ) : (
            <div className="player-chip" key={p.slug}>
              <span className="pname">{p.name}</span>
            </div>
          )
        )}
      </div>

      {isHost && (
        <>
          <label className="field-label" style={{ marginTop: 14 }}>
            Nombre de manches
          </label>
          <div className="chip-row">
            {ROUND_OPTIONS.map((n) => (
              <button
                key={n}
                className={n === totalRounds ? "chip chip-selected" : "chip"}
                onClick={() => setTotalRounds(n)}
                type="button"
              >
                {n}
              </button>
            ))}
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>
            Cul sec final
          </label>
          <div className="rule-options">
            <button
              className={culSecRule === "last" ? "rule-option rule-option-selected" : "rule-option"}
              onClick={() => setCulSecRule("last")}
              type="button"
            >
              Le dernier boit un cul sec
            </button>
            <button
              className={culSecRule === "first" ? "rule-option rule-option-selected" : "rule-option"}
              onClick={() => setCulSecRule("first")}
              type="button"
            >
              Le premier distribue un cul sec
            </button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="field-label" style={{ marginTop: 14 }}>
              Mini-jeux actifs
            </label>
            <div className="minigame-toggle-list">
              {ROUND_TYPES.map((t) => {
                const active = enabledIds.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={active ? "minigame-toggle active" : "minigame-toggle"}
                    onClick={() => toggleRoundType(t.id)}
                  >
                    <span className="mt-icon">{t.icon}</span>
                    <span className="mt-label">
                      {t.label}
                      {t.minPlayers > tableSize && <small> · {t.minPlayers} joueurs min, sauté</small>}
                    </span>
                    <span className="mt-check">{active ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
            {!enoughGames && <div className="hint error-text">Choisis au moins 2 mini-jeux.</div>}
          </div>

          <label className="field-label">Bots 🤖</label>
          <div className="chip-row">
            <button className="chip" type="button" onClick={() => setExtraBots(Math.max(autoBots, botCount) - 1)} disabled={botCount <= autoBots}>
              −
            </button>
            <span className="chip chip-selected">{botCount}</span>
            <button className="chip" type="button" onClick={() => setExtraBots(botCount + 1)} disabled={botCount >= 6}>
              +
            </button>
          </div>
          <div className="hint">
            {solo
              ? `Mode solo : ${botCount} bot${botCount > 1 ? "s" : ""} joueront contre toi.`
              : "Ajoute des bots pour compléter la table si vous êtes peu nombreux."}
          </div>
        </>
      )}

      <div className="spacer" />
      {error && <div className="hint error-text">{error}</div>}
      {isHost ? (
        <>
          <button
            className="btn-primary"
            disabled={!enough || busy}
            onClick={() => onLaunch(totalRounds, culSecRule, Array.from(enabledIds), botCount)}
          >
            Lancer la partie
          </button>
          {enoughGames && playable === 0 && (
            <div className="hint">Aucun jeu choisi n&apos;est jouable à {tableSize} : ajoute des bots.</div>
          )}
        </>
      ) : (
        <div className="hint">En attente que l&apos;hôte lance la partie...</div>
      )}
    </>
  );
}

// Own entry in the lobby's player list, editable in place — click the
// name (or the pencil) to turn it into a text field, same "click to
// edit" pattern used nowhere else yet in this codebase but simple enough
// not to need a shared component for it.
function OwnNameRow({
  name,
  busy,
  onRename,
}: {
  name: string;
  busy: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  function startEditing() {
    setValue(name);
    setEditing(true);
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="player-chip">
        <input
          type="text"
          autoFocus
          value={value}
          maxLength={40}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={submit}
          style={{ flex: 1, marginRight: 8 }}
        />
      </div>
    );
  }

  return (
    <div className="player-chip">
      <span className="pname">{name} (toi)</span>
      <button
        type="button"
        className="btn-ghost"
        style={{ padding: "4px 10px" }}
        disabled={busy}
        onClick={startEditing}
      >
        Modifier
      </button>
    </div>
  );
}
