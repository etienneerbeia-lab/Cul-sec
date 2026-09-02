"use client";

import { useState } from "react";
import HomeMark from "../HomeMark";

export default function HomeScreen({
  onCreate,
  onJoin,
  busy,
  error,
  clearError,
}: {
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  busy: boolean;
  error: string;
  clearError: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  return (
    <>
      <div className="title">Cul-Sec</div>
      <div className="subtitle">
        Cartes, culture G et cul secs. Un code, une soirée, zéro alibi.
      </div>

      {mode === "choose" ? (
        <>
          <div className="home-mark">
            <HomeMark />
          </div>

          <div className="how-it-works">
            <div className="how-it-works-row">
              <div className="how-it-works-num">1</div>
              <div className="how-it-works-text">
                Crée une partie ou rejoins avec le code d&apos;un ami.
              </div>
            </div>
            <div className="how-it-works-row">
              <div className="how-it-works-num">2</div>
              <div className="how-it-works-text">
                Chacun son tour : un mini-jeu différent, tiré au hasard, à chaque manche.
              </div>
            </div>
            <div className="how-it-works-row">
              <div className="how-it-works-num">3</div>
              <div className="how-it-works-text">
                À la fin, le classement désigne qui fait le cul sec.
              </div>
            </div>
          </div>

          <div className="spacer" />
          <button
            className="btn-primary"
            onClick={() => {
              setMode("create");
              clearError();
            }}
          >
            Créer une partie
          </button>
          <button
            className="btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => {
              setMode("join");
              clearError();
            }}
          >
            Rejoindre une partie
          </button>
        </>
      ) : (
        <>
          <div className="name-inputs">
            <div>
              <label className="field-label">Ton prénom</label>
              <input
                type="text"
                placeholder="Prénom"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {mode === "join" && (
              <div>
                <label className="field-label">Code de la partie</label>
                <input
                  type="text"
                  placeholder="Ex. B7KQ"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            )}
          </div>
          {error && <div className="hint error-text">{error}</div>}
          <div className="spacer" />
          <button
            className="btn-primary"
            disabled={busy || !name.trim() || (mode === "join" && !code.trim())}
            onClick={() => (mode === "create" ? onCreate(name) : onJoin(name, code))}
          >
            {mode === "create" ? "Créer et obtenir un code" : "Rejoindre"}
          </button>
          <button
            className="btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => {
              setMode("choose");
              clearError();
            }}
          >
            Retour
          </button>
        </>
      )}
    </>
  );
}
