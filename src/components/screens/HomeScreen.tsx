"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Form";
import { Kicker, Note, Screen } from "../ui/Layout";

const NAME_KEY = "cs:name";

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// Code passé dans l'URL (lien d'invitation : /?code=ABCD).
function codeFromUrl(): string {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("code") ?? "").toUpperCase().slice(0, 4);
}

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
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"choose" | "create" | "join">(() => (codeFromUrl() ? "join" : "choose"));
  const [name, setName] = useState(() => readStored(NAME_KEY));

  const remember = (n: string) => {
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      // stockage indisponible (navigation privée)
    }
  };
  const canSubmit = name.trim().length > 0 && (mode === "create" || code.trim().length === 4);
  const submit = () => {
    if (!canSubmit || busy) return;
    remember(name.trim());
    if (mode === "create") onCreate(name.trim());
    else onJoin(name.trim(), code);
  };

  if (mode === "choose") {
    return (
      <Screen
        actions={
          <>
            <Button onClick={() => setMode("create")}>Créer une partie</Button>
            <Button variant="secondary" onClick={() => setMode("join")}>
              Rejoindre avec un code
            </Button>
          </>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
          <PintGlass />
          <div>
            <h1 className="font-display text-[3.6rem] font-extrabold leading-[0.9] tracking-[-0.04em]">
              Cul<span className="cs-neon-text">·</span>Sec
            </h1>
            <p className="mx-auto mt-3 max-w-[30ch] text-[1.05rem] leading-snug text-ink-2">
              Les jeux à boire de la soirée, chacun sur son téléphone.
            </p>
          </div>
          <div className="stagger grid w-full gap-2 text-left">
            {[
              ["🎲", "Un mini-jeu tiré au hasard à chaque manche"],
              ["🍺", "Les gorgées sont comptées pour toi"],
              ["🏆", "À la fin, le classement désigne le cul sec"],
            ].map(([icon, text]) => (
              <div key={text} className="cs-row">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.07] text-xl">{icon}</span>
                <span className="font-medium text-ink-2">{text}</span>
              </div>
            ))}
          </div>
          <p className="text-[0.78rem] text-mute">À consommer avec modération. Buvez de l&apos;eau entre deux manches.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      actions={
        <>
          <Button disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "Connexion…" : mode === "create" ? "Ouvrir le salon" : "Entrer dans le salon"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setMode("choose");
              clearError();
            }}
          >
            Retour
          </Button>
        </>
      }
    >
      <div className="flex flex-1 flex-col justify-center gap-5 py-6">
        <div>
          <Kicker>{mode === "create" ? "Nouvelle partie" : "Rejoindre"}</Kicker>
          <h1 className="mt-1 font-display text-[2.2rem] font-extrabold leading-none">
            {mode === "create" ? "Tu ouvres le bar" : "Entre dans la partie"}
          </h1>
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {mode === "join" && (
            <label className="flex flex-col gap-2">
              <Kicker>Code de la partie</Kicker>
              <TextField
                value={code}
                inputMode="text"
                autoCapitalize="characters"
                maxLength={4}
                placeholder="ABCD"
                className="text-center font-display text-3xl! font-extrabold tracking-[0.5em] uppercase"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                  clearError();
                }}
              />
            </label>
          )}
          <label className="flex flex-col gap-2">
            <Kicker>Ton prénom</Kicker>
            <TextField
              value={name}
              maxLength={24}
              placeholder="Ex. Camille"
              autoCapitalize="words"
              enterKeyHint="go"
              onChange={(e) => {
                setName(e.target.value);
                clearError();
              }}
            />
          </label>
          <button type="submit" hidden />
        </form>
        {mode === "join" && (
          <Note>Déjà dans la partie mais déconnecté ? Remets le même prénom pour reprendre ta place.</Note>
        )}
        {error && <Note tone="danger">{error}</Note>}
      </div>
    </Screen>
  );
}

// Pinte animée : mousse et bulles qui montent.
function PintGlass() {
  return (
    <div className="relative h-[150px] w-[110px] animate-float">
      <svg viewBox="0 0 110 150" className="absolute inset-0 h-full w-full drop-shadow-[0_18px_40px_rgba(255,182,39,0.35)]">
        <defs>
          <linearGradient id="beer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd36b" />
            <stop offset="1" stopColor="#e8890c" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.25)" />
          </linearGradient>
        </defs>
        <path d="M14 28 L96 28 L86 140 Q85 146 79 146 L31 146 Q25 146 24 140 Z" fill="url(#beer)" />
        <path d="M10 22 Q20 6 38 14 Q50 2 66 12 Q84 4 98 20 Q104 30 92 34 L18 34 Q4 32 10 22 Z" fill="#fff8ea" />
        <path d="M10 22 L100 22 L88 142 Q87 148 80 148 L30 148 Q23 148 22 142 Z" fill="url(#glass)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        <rect x="28" y="40" width="6" height="90" rx="3" fill="rgba(255,255,255,0.35)" />
      </svg>
      {[18, 36, 52, 66, 44].map((left, i) => (
        <span
          key={i}
          className="absolute bottom-3 h-1.5 w-1.5 rounded-full bg-white/80"
          style={{ left: left + 12, animation: `cs-bubble ${2.2 + i * 0.35}s ${i * 0.5}s ease-in infinite` }}
        />
      ))}
    </div>
  );
}
