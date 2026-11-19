"use client";

import { useEffect, useRef, useState } from "react";
import { serverNow } from "@/lib/clock";
import { haptic } from "@/lib/haptics";
import { playSound } from "@/lib/sound";
import type { ReflexTap } from "@/lib/game/types";
import { useGame } from "../GameContext";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

function fmt(t: ReflexTap | undefined): string {
  if (t === "early") return "Faux départ";
  if (t === null || t === undefined) return "Trop lent";
  return `${t} ms`;
}

export default function ReflexScreen() {
  const { game, mySlug, act } = useGame();
  const r = game.reflex!;
  const done = game.phase === "showdown";

  if (done) {
    const rows = game.playersPublic.map((p) => {
      const times = r.history.map((h) => h.taps[p.slug]);
      const valid = times.filter((t): t is number => typeof t === "number");
      const best = valid.length ? Math.min(...valid) : null;
      return { p, times, best };
    });
    rows.sort((a, b) => (a.best ?? 1e9) - (b.best ?? 1e9));
    return (
      <Screen actions={<NextRoundActions />}>
        <div className="mb-4 text-center">
          <div className="animate-pop text-5xl">⚡</div>
          <h2 className="font-display text-2xl font-extrabold">Réflexes</h2>
        </div>
        <div className="stagger mb-5 flex flex-col gap-2">
          {rows.map(({ p, times, best }, i) => (
            <div key={p.slug} className="cs-row" data-active={i === 0 && best !== null}>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {cleanName(p.name)}
                {p.slug === mySlug && <span className="ml-1.5 text-xs text-mute">(toi)</span>}
              </span>
              <div className="flex gap-1.5 text-right text-[0.78rem] tabular-nums">
                {times.map((t, k) => (
                  <span key={k} className={`w-[4.4rem] rounded-md px-1 py-0.5 ${typeof t === "number" ? "bg-white/8" : "bg-danger/20 text-danger"}`}>
                    {typeof t === "number" ? `${t} ms` : t === "early" ? "Trop tôt" : "Raté"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
      </Screen>
    );
  }

  return <ReflexPlay key={r.coup} onTap={(payload) => act({ type: "reflexTap", ...payload })} />;
}

// Un coup : rouge → vert. Le chrono part à l'image où le vert s'affiche
// sur CE téléphone, et s'arrête au toucher : pas de latence réseau.
function ReflexPlay({ onTap }: { onTap: (p: { ms: number } | { early: true }) => void }) {
  const { game, mySlug } = useGame();
  const r = game.reflex!;
  const myTap = r.taps[mySlug];
  const [green, setGreen] = useState(false);
  const greenAtRef = useRef<number | null>(null);
  const [local, setLocal] = useState<ReflexTap | undefined>(undefined);
  const tapped = local !== undefined || myTap !== undefined;
  const shown = local !== undefined ? local : myTap;

  useEffect(() => {
    if (r.stage !== "wait" || tapped) return;
    let raf = 0;
    const loop = () => {
      if (serverNow() >= r.goAt) {
        greenAtRef.current = performance.now();
        setGreen(true);
        haptic("tap");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.goAt, r.stage]);

  function handleDown() {
    if (r.stage !== "wait" || tapped) return;
    if (!green || greenAtRef.current === null) {
      setLocal("early");
      haptic("warn");
      playSound("buzz");
      onTap({ early: true });
      return;
    }
    const ms = Math.round(performance.now() - greenAtRef.current);
    setLocal(ms);
    haptic("impact");
    playSound("tap");
    onTap({ ms });
  }

  const coupLabel = `Coup ${r.coup + 1} / ${r.coups}`;

  if (r.stage === "reveal") {
    const h = r.history[r.history.length - 1];
    const order = [...game.playersPublic].sort((a, b) => rank(h.taps[a.slug]) - rank(h.taps[b.slug]));
    return (
      <Screen>
        <Kicker className="mb-3 text-center">{coupLabel}</Kicker>
        <div className="stagger flex flex-col gap-2">
          {order.map((p) => {
            const t = h.taps[p.slug];
            const bad = h.slowest.includes(p.slug) || h.early.includes(p.slug);
            return (
              <div key={p.slug} className="cs-row" data-active={h.fastest === p.slug}>
                <span className="flex-1 font-semibold">
                  {h.fastest === p.slug && "⚡ "}
                  {cleanName(p.name)}
                </span>
                <span className={`font-display font-extrabold tabular-nums ${bad ? "text-danger" : ""}`}>{fmt(t)}</span>
                {h.early.includes(p.slug) && <span className="text-sm text-danger">+2 🍺</span>}
                {h.slowest.includes(p.slug) && <span className="text-sm text-danger">+1 🍺</span>}
              </div>
            );
          })}
        </div>
      </Screen>
    );
  }

  const state = tapped ? (shown === "early" ? "early" : "done") : green ? "go" : "wait";
  return (
    <>
      <Kicker className="mb-2 text-center">{coupLabel}</Kicker>
      <button
        type="button"
        onPointerDown={handleDown}
        className={`reflex-pad reflex-pad-${state}`}
        style={{ touchAction: "manipulation" }}
      >
        {state === "wait" && (
          <>
            <span className="reflex-big">Attends…</span>
            <span className="reflex-small">Tape dès que ça passe au vert</span>
          </>
        )}
        {state === "go" && <span className="reflex-big">TAPE !</span>}
        {state === "early" && (
          <>
            <span className="reflex-big">Trop tôt !</span>
            <span className="reflex-small">Faux départ : 2 gorgées</span>
          </>
        )}
        {state === "done" && (
          <>
            <span className="reflex-big tabular-nums">{shown} ms</span>
            <span className="reflex-small">On attend les autres…</span>
          </>
        )}
      </button>
      <div style={{ height: "calc(12px + var(--safe-bottom))" }} className="shrink-0" />
    </>
  );
}

function rank(t: ReflexTap | undefined): number {
  if (typeof t === "number") return t;
  return t === "early" ? 1e7 : 1e6;
}
