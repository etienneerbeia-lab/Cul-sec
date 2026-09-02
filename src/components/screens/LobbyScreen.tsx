"use client";

import { useState } from "react";
import { ROUND_TYPES } from "@/lib/game/roundTypes";
import { MIN_ENABLED_ROUND_TYPES, type CulSecRule, type Player, type RoundTypeId } from "@/lib/game/types";

const ROUND_OPTIONS = [5, 10, 20];
const ALL_ROUND_TYPE_IDS = ROUND_TYPES.map((t) => t.id);

export default function LobbyScreen({
  roomCode,
  players,
  mySlug,
  isHost,
  busy,
  error,
  onLaunch,
}: {
  roomCode: string;
  players: Player[];
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  error: string;
  onLaunch: (totalRounds: number, culSecRule: CulSecRule, enabledRoundTypeIds: RoundTypeId[]) => void;
}) {
  const [totalRounds, setTotalRounds] = useState(10);
  const [culSecRule, setCulSecRule] = useState<CulSecRule>("last");
  const [enabledIds, setEnabledIds] = useState<Set<RoundTypeId>>(() => new Set(ALL_ROUND_TYPE_IDS));

  function toggleRoundType(id: RoundTypeId) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const enoughPlayers = players.length >= 3;
  const enoughGames = enabledIds.size >= MIN_ENABLED_ROUND_TYPES;
  const enough = enoughPlayers && enoughGames;

  return (
    <>
      <label className="field-label">Code de la partie</label>
      <div className="pass-name">{roomCode}</div>
      <div className="hint">
        Donne ce code à tes amis pour qu&apos;ils rejoignent depuis leur téléphone.
      </div>

      <h3>Joueurs connectés</h3>
      <div className="players-list">
        {players.map((p) => (
          <div className="player-chip" key={p.slug}>
            <span className="pname">
              {p.name}
              {p.slug === mySlug ? " (toi)" : ""}
            </span>
          </div>
        ))}
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
                  <span className="mt-label">{t.label}</span>
                  <span className="mt-check">{active ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          {!enoughGames && <div className="hint error-text">Choisis au moins 2 mini-jeux.</div>}
        </>
      )}

      <div className="spacer" />
      {error && <div className="hint error-text">{error}</div>}
      {isHost ? (
        <>
          <button
            className="btn-primary"
            disabled={!enough || busy}
            onClick={() => onLaunch(totalRounds, culSecRule, Array.from(enabledIds))}
          >
            Lancer la partie
          </button>
          {!enoughPlayers && <div className="hint">Il faut au moins 3 joueurs pour commencer.</div>}
        </>
      ) : (
        <div className="hint">En attente que l&apos;hôte lance la partie...</div>
      )}
    </>
  );
}
