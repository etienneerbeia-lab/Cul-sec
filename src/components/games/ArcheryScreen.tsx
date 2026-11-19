"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { useGame } from "../GameContext";
import { TimerBar } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerName, PlayerRow } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";
import type { ArcheryPoint, ArcheryShotRecord, ArcheryWind, GameState } from "@/lib/game/types";
import { ARCHERY_ARROWS_PER_TURN } from "@/lib/game/types";
import {
  ARCHERY_BOARD_HEIGHT,
  ARCHERY_CENTER,
  ARCHERY_LAUNCH_POINT,
  ARCHERY_RINGS,
  ARCHERY_TARGET_SIZE,
  ARCHERY_WIND_ANGLES,
  ARCHERY_WIND_LABELS,
  clampToTarget,
  windIntensityLabel,
} from "@/lib/archery/physics";

const ARROW_COLORS = ["#e0568c", "#3ecf8e", "#f4c95d", "#6fb1f0", "#e0568c", "#3ecf8e"];

// How long (ms) the player has to hold a tap before the charge ring reads
// full power — releasing sooner fires (or cancels) at whatever fraction it
// reached, releasing later just holds at 1.
const ARCHERY_CHARGE_MS = 1000;
// Below this fraction of full charge, releasing cancels the shot instead
// of firing it: a bare
// tap-and-release never counts as a real attempt.
const ARCHERY_CANCEL_POWER = 0.08;


export default function ArcheryScreen() {
  const { game, mySlug, busy, act } = useGame();
  const ar = game.archery!;
  const activePlayer = game.playersPublic[ar.playerIdx];
  const isMeActive = activePlayer.slug === mySlug && game.phase === "archery";

  // Rejoue les flèches une à une (pas de rejeu complet au rechargement).
  const [shownCount, setShownCount] = useState(() => ar.shots.length);
  const pendingShot = shownCount < ar.shots.length ? ar.shots[shownCount] : null;
  const resolved = game.phase === "showdown" && !pendingShot;
  const r = resolved ? game.lastResults : undefined;

  // Pendant un replay, on montre le vent qui soufflait pour CETTE flèche.
  const displayedWind: ArcheryWind = pendingShot ? pendingShot.wind : ar.wind;
  const progressSlug = pendingShot ? pendingShot.slug : activePlayer.slug;
  const progressName = pendingShot ? pendingShot.name : activePlayer.name;
  const progressShots = ar.shots.filter((s) => s.slug === progressSlug && (!pendingShot || ar.shots.indexOf(s) <= ar.shots.indexOf(pendingShot)));
  const displayArrowNumber = pendingShot ? pendingShot.arrowNumber : ar.arrowNumber;

  const impactBySlug: Record<string, ArcheryPoint> = {};
  ar.shots.forEach((s, i) => {
    if (i < shownCount) impactBySlug[`${s.slug}:${s.arrowNumber}`] = s.impact;
  });

  if (resolved && r?.archeryRanking) {
    return (
      <Screen actions={<NextRoundActions />}>
        <div className="mb-4 text-center">
          <div className="animate-pop text-5xl">🏹</div>
          <h2 className="font-display text-2xl font-extrabold">Résultats du tir</h2>
        </div>
        <div className="stagger mb-5 flex flex-col gap-2">
          {r.archeryRanking.map((e) => (
            <PlayerRow
              key={e.slug}
              name={e.name}
              slug={e.slug}
              me={e.slug === mySlug}
              active={e.rank === 1}
              detail={ar.shots.filter((s) => s.slug === e.slug).map((s) => s.points).join(" + ")}
              right={<span className="font-display text-xl font-extrabold">{e.totalScore} pts</span>}
            />
          ))}
        </div>
        <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
      </Screen>
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={progressName} slug={progressSlug} size={34} />
        <div className="min-w-0 flex-1">
          <Kicker>
            Flèche {displayArrowNumber} / {ARCHERY_ARROWS_PER_TURN}
          </Kicker>
          <PlayerName name={progressName} me={progressSlug === mySlug} />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: ARCHERY_ARROWS_PER_TURN }).map((_, i) => (
            <span
              key={i}
              className={`grid h-8 w-8 place-items-center rounded-full font-display text-sm font-extrabold ${
                progressShots[i] ? "bg-beer text-[#2a1600]" : "border border-white/20 text-mute"
              }`}
            >
              {progressShots[i]?.points ?? "·"}
            </span>
          ))}
        </div>
      </div>
      <WindBanner wind={displayedWind} />
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <ArcheryBoard
          key={pendingShot ? `${pendingShot.slug}:${pendingShot.arrowNumber}` : `turn-${ar.shots.length}`}
          impacts={impactBySlug}
          players={game.playersPublic}
          pendingShot={pendingShot}
          onShotAnimDone={() => setShownCount((n) => n + 1)}
          interactive={isMeActive && !pendingShot}
          busy={busy}
          onFire={(aim, power) => {
            haptic("impact");
            act({ type: "archeryShot", aim, power });
          }}
        />
      </div>
      <div className="cs-actionbar pt-2!">
        {isMeActive && !pendingShot && <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={40000} />}
        <p className={`text-center text-[0.95rem] ${isMeActive && !pendingShot ? "font-semibold" : "text-ink-2"}`}>
          {pendingShot
            ? `${cleanName(pendingShot.name)} décoche…`
            : isMeActive
              ? "Pose le doigt pour viser, maintiens pour bander l'arc, relâche pour tirer. Le viseur tremble : sois rapide !"
              : `${cleanName(activePlayer.name)} vise…`}
        </p>
      </div>
    </>
  );
}

function WindBanner({ wind }: { wind: ArcheryWind }) {
  const angle = ARCHERY_WIND_ANGLES[wind.direction];
  const label = windIntensityLabel(wind.intensity);
  return (
    <div className="archery-wind-banner">
      <svg viewBox="0 0 24 24" className="archery-wind-icon" style={{ transform: `rotate(${angle}deg)` }}>
        <path
          d="M4 12h14M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="archery-wind-text">
        <div className="archery-wind-label">
          Vent {label.toLowerCase()} {ARCHERY_WIND_LABELS[wind.direction]}
        </div>
        <div className="archery-wind-gauge">
          <div className="archery-wind-gauge-fill" style={{ width: `${wind.intensity * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function toBoardSpace(clientX: number, clientY: number, svg: SVGSVGElement): ArcheryPoint {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * ARCHERY_TARGET_SIZE,
    y: ((clientY - rect.top) / rect.height) * ARCHERY_BOARD_HEIGHT,
  };
}

// How far the camera zooms in on the impact point once an arrow lands —
// picked so the big score number and the exact ring it caught both read
// clearly, without cropping so tight that the target's edges (and other
// players' arrows) vanish entirely.
const ARCHERY_ZOOM_SCALE = 2.3;
const ARCHERY_FLIGHT_MS = 550;
const ARCHERY_ZOOM_MS = 350;
const ARCHERY_SCORE_FADE_IN_MS = 220;
const ARCHERY_SCORE_HOLD_MS = 1050;
const ARCHERY_SCORE_FADE_OUT_MS = 280;
const ARCHERY_HOLD_AFTER_IMPACT_MS =
  ARCHERY_ZOOM_MS + ARCHERY_SCORE_FADE_IN_MS + ARCHERY_SCORE_HOLD_MS + ARCHERY_SCORE_FADE_OUT_MS;

interface CameraState {
  cx: number;
  cy: number;
  scale: number;
}
const NEUTRAL_CAMERA: CameraState = { cx: ARCHERY_CENTER.x, cy: ARCHERY_CENTER.y, scale: 1 };

function ArcheryBoard({
  impacts,
  players,
  pendingShot,
  onShotAnimDone,
  interactive,
  busy,
  onFire,
}: {
  impacts: Record<string, ArcheryPoint>;
  players: GameState["playersPublic"];
  pendingShot: ArcheryShotRecord | null;
  onShotAnimDone: () => void;
  interactive: boolean;
  busy: boolean;
  onFire: (aim: ArcheryPoint, power: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Aiming: a single continuous pointer gesture, startable from anywhere
  // on the board (not just on the target). Pointer-down drops the
  // reticle right where the finger landed and starts a time-based charge
  // (the ring fills over ARCHERY_CHARGE_MS regardless of where the finger
  // is); pointer-move afterwards just repositions the reticle — direction
  // and charge are fully independent axes of the same gesture. Releasing fires at the current
  // aim/power (or cancels below ARCHERY_CANCEL_POWER); the CANCEL button
  // does the same thing without needing to lift the aiming finger.
  const [rawAim, setAim] = useState<ArcheryPoint | null>(null);
  const [sway, setSway] = useState<ArcheryPoint>({ x: 0, y: 0 });
  const aim = rawAim ? clampToTarget({ x: rawAim.x + sway.x, y: rawAim.y + sway.y }) : null;
  const [power, setPower] = useState(0);
  const holdingRef = useRef(false);
  const chargeStartRef = useRef(0);
  const chargeRafRef = useRef(0);

  const [animPos, setAnimPos] = useState<ArcheryPoint | null>(() => pendingShot?.path[0] ?? null);
  const [camera, setCamera] = useState<CameraState>(NEUTRAL_CAMERA);
  const [scoreOpacity, setScoreOpacity] = useState(0);

  // Plays pendingShot.path back in real time, then — once the arrow's
  // landed — eases the camera in on the impact point and fades a big
  // score number in over it, holds long enough to read, fades it back
  // out, then hands off to the next arrow/player. One elapsed-time-driven
  // rAF loop drives the whole sequence instead of several separate
  // timers. Runs once per mount — the per-arrow key on ArcheryBoard above
  // is what gives every single arrow (even the same player's 2nd and 3rd)
  // its own fresh run of this.
  useEffect(() => {
    if (!pendingShot) return;
    const path = pendingShot.path;
    const impact = pendingShot.impact;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const elapsed = now - start;
      if (elapsed < ARCHERY_FLIGHT_MS) {
        const t = elapsed / ARCHERY_FLIGHT_MS;
        const idx = Math.min(path.length - 1, Math.floor(t * (path.length - 1)));
        setAnimPos(path[idx]);
        raf = requestAnimationFrame(tick);
        return;
      }
      setAnimPos(path[path.length - 1]);
      const sinceImpact = elapsed - ARCHERY_FLIGHT_MS;

      const zt = Math.min(1, sinceImpact / ARCHERY_ZOOM_MS);
      const eased = 1 - (1 - zt) * (1 - zt); // ease-out
      setCamera({
        cx: ARCHERY_CENTER.x + eased * (impact.x - ARCHERY_CENTER.x),
        cy: ARCHERY_CENTER.y + eased * (impact.y - ARCHERY_CENTER.y),
        scale: 1 + eased * (ARCHERY_ZOOM_SCALE - 1),
      });

      let opacity = 0;
      if (sinceImpact >= ARCHERY_ZOOM_MS) {
        const s = sinceImpact - ARCHERY_ZOOM_MS;
        if (s < ARCHERY_SCORE_FADE_IN_MS) opacity = s / ARCHERY_SCORE_FADE_IN_MS;
        else if (s < ARCHERY_SCORE_FADE_IN_MS + ARCHERY_SCORE_HOLD_MS) opacity = 1;
        else if (s < ARCHERY_SCORE_FADE_IN_MS + ARCHERY_SCORE_HOLD_MS + ARCHERY_SCORE_FADE_OUT_MS) {
          opacity = 1 - (s - ARCHERY_SCORE_FADE_IN_MS - ARCHERY_SCORE_HOLD_MS) / ARCHERY_SCORE_FADE_OUT_MS;
        }
      }
      setScoreOpacity(opacity);

      if (sinceImpact >= ARCHERY_HOLD_AFTER_IMPACT_MS) {
        onShotAnimDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCharging() {
    holdingRef.current = false;
    cancelAnimationFrame(chargeRafRef.current);
  }

  function chargeTick() {
    if (!holdingRef.current) return;
    const elapsed = performance.now() - chargeStartRef.current;
    setPower(Math.min(1, elapsed / ARCHERY_CHARGE_MS));
    // Le bras tremble en tenant l'arc bandé, de plus en plus avec la fatigue.
    const t = elapsed / 1000;
    const amp = 3 + 9 * Math.max(0, (elapsed - ARCHERY_CHARGE_MS) / 2500) + 2 * Math.min(1, elapsed / ARCHERY_CHARGE_MS);
    setSway({ x: Math.sin(t * 2.3) * amp + Math.sin(t * 5.1) * amp * 0.3, y: Math.cos(t * 1.9) * amp * 0.8 });
    chargeRafRef.current = requestAnimationFrame(chargeTick);
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || busy) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = clampToTarget(toBoardSpace(e.clientX, e.clientY, svgRef.current!));
    setAim(p);
    setSway({ x: 0, y: 0 });
    setPower(0);
    holdingRef.current = true;
    chargeStartRef.current = performance.now();
    chargeRafRef.current = requestAnimationFrame(chargeTick);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || !holdingRef.current) return;
    setAim(clampToTarget(toBoardSpace(e.clientX, e.clientY, svgRef.current!)));
  }

  function handlePointerUp() {
    if (!interactive || !holdingRef.current) return;
    stopCharging();
    if (aim && power >= ARCHERY_CANCEL_POWER) onFire(aim, power);
    setAim(null);
    setPower(0);
  }

  function handleCancel() {
    if (!holdingRef.current) return;
    stopCharging();
    setAim(null);
    setPower(0);
  }

  const baseW = ARCHERY_TARGET_SIZE;
  const baseH = ARCHERY_BOARD_HEIGHT;
  const viewW = baseW / camera.scale;
  const viewH = baseH / camera.scale;
  const viewX = Math.max(0, Math.min(baseW - viewW, camera.cx - viewW / 2));
  const viewY = Math.max(0, Math.min(baseH - viewH, camera.cy - viewH / 2));

  const chargeCircumference = 2 * Math.PI * 18;

  return (
    <div className="archery-board-wrap">
      {aim && (
        <button className="archery-cancel-btn" onClick={handleCancel} type="button">
          Annuler
        </button>
      )}
      <svg
        ref={svgRef}
        className="archery-board"
        viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <rect x={0} y={0} width={ARCHERY_TARGET_SIZE} height={ARCHERY_BOARD_HEIGHT} className="archery-backdrop" />
        {ARCHERY_RINGS.map((ring) => (
          <circle
            key={ring.r}
            cx={ARCHERY_CENTER.x}
            cy={ARCHERY_CENTER.y}
            r={ring.r}
            className={`archery-ring archery-ring-${ring.cls}`}
          />
        ))}
        <circle cx={ARCHERY_LAUNCH_POINT.x} cy={ARCHERY_LAUNCH_POINT.y} r={6} className="archery-archer" />

        {players.map((p, i) =>
          Array.from({ length: ARCHERY_ARROWS_PER_TURN }).map((_, arrowIdx) => {
            const arrowNumber = arrowIdx + 1;
            const pos = impacts[`${p.slug}:${arrowNumber}`];
            if (!pos) return null;
            return <ArrowMark key={`${p.slug}:${arrowNumber}`} pos={pos} color={ARROW_COLORS[i % ARROW_COLORS.length]} />;
          })
        )}

        {pendingShot && animPos && (
          <ArrowMark
            pos={animPos}
            color={ARROW_COLORS[players.findIndex((p) => p.slug === pendingShot.slug) % ARROW_COLORS.length]}
            moving
          />
        )}

        {pendingShot && scoreOpacity > 0 && (
          <text
            x={pendingShot.impact.x}
            y={pendingShot.impact.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="archery-score-pop"
            style={{ opacity: scoreOpacity }}
          >
            {pendingShot.points}
          </text>
        )}

        {aim && (
          <g transform={`translate(${aim.x} ${aim.y})`} className="archery-reticle">
            <circle r={18} className="archery-reticle-track" />
            <circle
              r={18}
              className="archery-reticle-charge"
              strokeDasharray={chargeCircumference}
              strokeDashoffset={chargeCircumference * (1 - power)}
            />
            <line x1={-14} y1={0} x2={14} y2={0} className="archery-reticle-cross" />
            <line x1={0} y1={-14} x2={0} y2={14} className="archery-reticle-cross" />
          </g>
        )}
      </svg>
    </div>
  );
}

function ArrowMark({ pos, color, moving }: { pos: ArcheryPoint; color: string; moving?: boolean }) {
  return (
    <g transform={`translate(${pos.x} ${pos.y})`} className={moving ? "archery-arrow archery-arrow-moving" : "archery-arrow"}>
      <line x1={0} y1={2} x2={0} y2={22} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <path d="M-5,19 L0,26 L5,19" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={0} cy={0} r={3.5} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
    </g>
  );
}
