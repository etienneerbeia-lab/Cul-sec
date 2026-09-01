"use client";

import { useState } from "react";
import type { CulSecRule, Player } from "@/lib/game/types";

const ROUND_OPTIONS = [5, 10, 20];

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
  onLaunch: (totalRounds: number, culSecRule: CulSecRule) => void;
}) {
  const enough = players.length >= 3;
  const [totalRounds, setTotalRounds] = useState(10);
  const [culSecRule, setCulSecRule] = useState<CulSecRule>("last");

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
        </>
      )}

      <div className="spacer" />
      {error && <div className="hint error-text">{error}</div>}
      {isHost ? (
        <>
          <button
            className="btn-primary"
            disabled={!enough || busy}
            onClick={() => onLaunch(totalRounds, culSecRule)}
          >
            Lancer la partie
          </button>
          {!enough && <div className="hint">Il faut au moins 3 joueurs pour commencer.</div>}
        </>
      ) : (
        <div className="hint">En attente que l&apos;hôte lance la partie...</div>
      )}
    </>
  );
}
