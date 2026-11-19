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

// Couleur d'empennage par joueur (ordre de la table) ; le fût reste neutre.
const ARROW_COLORS = ["#e0568c", "#3ecf8e", "#f4c95d", "#6fb1f0", "#ff8a3d", "#b07cff", "#5ce1e6", "#f0f0f0"];

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

  // Flèches déjà plantées, dans l'ordre de tir (la dernière est dessinée
  // par-dessus et mise en avant).
  const planted = ar.shots.slice(0, shownCount);

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
          planted={planted}
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
// enough to see the arrow quiver and read its score, not so tight that
// the neighbouring arrows vanish.
const ARCHERY_ZOOM_SCALE = 2;
const ARCHERY_FLIGHT_MS = 600;
const ARCHERY_WOBBLE_MS = 320;
const ARCHERY_ZOOM_MS = 350;
const ARCHERY_SCORE_DELAY_MS = 180;
const ARCHERY_SCORE_FADE_IN_MS = 180;
const ARCHERY_SCORE_HOLD_MS = 1000;
const ARCHERY_SCORE_FADE_OUT_MS = 260;
const ARCHERY_HOLD_AFTER_IMPACT_MS =
  ARCHERY_SCORE_DELAY_MS + ARCHERY_SCORE_FADE_IN_MS + ARCHERY_SCORE_HOLD_MS + ARCHERY_SCORE_FADE_OUT_MS;
// Taille apparente de la flèche au départ du vol : elle part « près de
// l'œil » et rétrécit jusqu'à sa taille plantée en atteignant la cible.
const ARCHERY_FLIGHT_START_SCALE = 2.6;

interface CameraState {
  cx: number;
  cy: number;
  scale: number;
}
const NEUTRAL_CAMERA: CameraState = { cx: ARCHERY_CENTER.x, cy: ARCHERY_CENTER.y, scale: 1 };

interface FlightState {
  pos: ArcheryPoint;
  scale: number; // > 1 en vol, 1 une fois plantée
  wobble: number; // degrés, oscillation amortie de l'empennage après l'impact
  landed: boolean;
}

function ArcheryBoard({
  planted,
  players,
  pendingShot,
  onShotAnimDone,
  interactive,
  busy,
  onFire,
}: {
  planted: ArcheryShotRecord[];
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

  const [flight, setFlight] = useState<FlightState | null>(() =>
    pendingShot ? { pos: pendingShot.path[0], scale: ARCHERY_FLIGHT_START_SCALE, wobble: 0, landed: false } : null
  );
  const [camera, setCamera] = useState<CameraState>(NEUTRAL_CAMERA);
  const [scoreOpacity, setScoreOpacity] = useState(0);

  // Rejoue pendingShot : vol le long de path (la flèche rétrécit en
  // s'éloignant vers la cible), impact + vibration amortie de l'empennage,
  // zoom doux sur l'impact, puis le score apparaît brièvement à côté avant
  // de passer à la flèche suivante. Une seule boucle rAF pilotée par le
  // temps écoulé. Tourne une fois par montage — la clé par flèche posée
  // sur ArcheryBoard plus haut donne à chaque flèche sa propre séquence.
  useEffect(() => {
    if (!pendingShot) return;
    const path = pendingShot.path;
    const impact = pendingShot.impact;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      // L'horodatage rAF peut précéder performance.now() pris au montage.
      const elapsed = Math.max(0, now - start);
      if (elapsed < ARCHERY_FLIGHT_MS) {
        const t = elapsed / ARCHERY_FLIGHT_MS;
        const f = t * (path.length - 1);
        const i = Math.max(0, Math.min(path.length - 2, Math.floor(f)));
        const k = f - i;
        const a = path[i];
        const b = path[i + 1] ?? a;
        // Décélération légère : la flèche « s'enfonce » dans la profondeur.
        const depth = 1 - Math.pow(1 - t, 1.6);
        setFlight({
          pos: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
          scale: ARCHERY_FLIGHT_START_SCALE + (1 - ARCHERY_FLIGHT_START_SCALE) * depth,
          wobble: 0,
          landed: false,
        });
        raf = requestAnimationFrame(tick);
        return;
      }
      const sinceImpact = elapsed - ARCHERY_FLIGHT_MS;
      const w = sinceImpact < ARCHERY_WOBBLE_MS ? sinceImpact / ARCHERY_WOBBLE_MS : 1;
      const wobble = w < 1 ? 7 * Math.exp(-4 * w) * Math.sin(w * Math.PI * 7) : 0;
      setFlight({ pos: impact, scale: 1, wobble, landed: true });

      const zt = Math.min(1, sinceImpact / ARCHERY_ZOOM_MS);
      const eased = 1 - (1 - zt) * (1 - zt); // ease-out
      setCamera({
        cx: ARCHERY_CENTER.x + eased * (impact.x - ARCHERY_CENTER.x),
        cy: ARCHERY_CENTER.y + eased * (impact.y - ARCHERY_CENTER.y),
        scale: 1 + eased * (ARCHERY_ZOOM_SCALE - 1),
      });

      let opacity = 0;
      const s = sinceImpact - ARCHERY_SCORE_DELAY_MS;
      if (s >= 0) {
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

  const colorOf = (slug: string) => {
    const i = players.findIndex((p) => p.slug === slug);
    return ARROW_COLORS[(i < 0 ? 0 : i) % ARROW_COLORS.length];
  };
  // Toutes les flèches visibles, dans l'ordre de tir. Celle en vol (ou
  // plantée à l'instant) est la plus récente ; sinon, la dernière plantée.
  const arrows: { shot: ArcheryShotRecord; flight?: FlightState }[] = planted.map((shot) => ({ shot }));
  if (pendingShot && flight) arrows.push({ shot: pendingShot, flight });
  const latestKey = arrows.length ? shotKey(arrows[arrows.length - 1].shot) : null;

  const scoreSide = pendingShot && pendingShot.impact.x < 60 ? 1 : -1;

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
        shapeRendering="geometricPrecision"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <filter id="arrow-shadow-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <radialGradient id="arrow-hole" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity={0.95} />
            <stop offset="55%" stopColor="#1b1210" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#000" stopOpacity={0} />
          </radialGradient>
          <linearGradient id="arrow-shaft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f6e3bf" />
            <stop offset="55%" stopColor="#d6b07a" />
            <stop offset="100%" stopColor="#9c7446" />
          </linearGradient>
        </defs>
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

        {/* Couche 1 : trous et ombres portées, sous tous les fûts, pour
            qu'aucune flèche voisine ne masque un point d'impact. */}
        {arrows.map(({ shot, flight: f }) =>
          !f || f.landed ? (
            <ArrowGround key={`g-${shotKey(shot)}`} pos={shot.impact} angle={arrowAngle(shot)} dim={shotKey(shot) !== latestKey} />
          ) : null
        )}
        {/* Couche 2 : les flèches elles-mêmes, la plus récente au-dessus. */}
        {arrows.map(({ shot, flight: f }) => {
          const key = shotKey(shot);
          return (
            <ArrowBody
              key={key}
              pos={f ? f.pos : shot.impact}
              angle={arrowAngle(shot)}
              color={colorOf(shot.slug)}
              scale={f ? f.scale : 1}
              wobble={f ? f.wobble : 0}
              inFlight={!!f && !f.landed}
              state={key === latestKey ? "latest" : "old"}
            />
          );
        })}

        {pendingShot && scoreOpacity > 0 && (
          <g
            transform={`translate(${pendingShot.impact.x + scoreSide * 9} ${pendingShot.impact.y + 9})`}
            className="archery-score-pop"
            style={{ opacity: scoreOpacity }}
          >
            <rect x={scoreSide > 0 ? 0 : -24} y={-1} width={24} height={15} rx={7.5} className="archery-score-pill" />
            <text x={scoreSide > 0 ? 12 : -12} y={7} textAnchor="middle" dominantBaseline="central" className="archery-score-text">
              {pendingShot.points > 0 ? `+${pendingShot.points}` : "0"}
            </text>
          </g>
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

function shotKey(s: ArcheryShotRecord): string {
  return `${s.slug}:${s.arrowNumber}`;
}

// Angle (degrés, repère SVG : négatif = vers le haut) du fût vu de 3/4.
// Toujours « en haut à droite », avec une petite variation déterministe
// par flèche : deux flèches proches ne sont jamais parfaitement
// parallèles, donc leurs empennages se distinguent.
function arrowAngle(s: ArcheryShotRecord): number {
  let h = 0;
  const k = shotKey(s);
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return -48 + ((Math.abs(h) % 21) - 10);
}

// Longueur visible du fût (raccourci par la perspective : la flèche
// pointe à moitié vers nous) et dimensions de l'empennage, en unités
// de la cible (une bande d'anneau = 15).
const SHAFT_LEN = 34;
const VANE_LEN = 12;

function ArrowGround({ pos, angle, dim }: { pos: ArcheryPoint; angle: number; dim: boolean }) {
  // Lumière en haut à gauche : l'ombre du fût part de l'impact vers le
  // bas à droite, plus courte que la flèche, et s'élargit en s'éloignant.
  const shadowAngle = angle + 62;
  return (
    <g transform={`translate(${pos.x} ${pos.y})`} opacity={dim ? 0.75 : 1}>
      <g transform={`rotate(${shadowAngle})`} filter="url(#arrow-shadow-blur)">
        <path d={`M0,-0.8 L${SHAFT_LEN * 0.78},-2.4 L${SHAFT_LEN * 0.78},2.4 L0,0.8 Z`} fill="rgba(0,0,0,0.32)" />
        <ellipse cx={SHAFT_LEN * 0.72} cy={0} rx={VANE_LEN * 0.5} ry={4.2} fill="rgba(0,0,0,0.22)" />
      </g>
      <circle r={4.2} fill="url(#arrow-hole)" />
      <ellipse rx={2} ry={1.7} fill="#0b0706" />
    </g>
  );
}

function ArrowBody({
  pos,
  angle,
  color,
  scale,
  wobble,
  inFlight,
  state,
}: {
  pos: ArcheryPoint;
  angle: number;
  color: string;
  scale: number;
  wobble: number;
  inFlight: boolean;
  state: "latest" | "old";
}) {
  const L = SHAFT_LEN;
  const vx = L - VANE_LEN - 1;
  return (
    <g
      transform={`translate(${pos.x} ${pos.y}) scale(${scale}) rotate(${angle + wobble})`}
      className={`archery-arrow archery-arrow-${state}${inFlight ? " archery-arrow-flight" : ""}`}
    >
      {/* Pointe qui dépasse encore un peu, en vol seulement. */}
      {inFlight && <path d="M0,0 L-4.5,-1.6 L-4.5,1.6 Z" fill="#9aa3ad" stroke="#3a3f45" strokeWidth={0.4} />}
      {/* Fût : s'épaissit vers l'encoche (plus proche de l'œil). */}
      <path
        d={`M0,-0.75 L${L},-1.35 L${L},1.35 L0,0.75 Z`}
        fill="url(#arrow-shaft)"
        stroke="rgba(40,24,10,0.75)"
        strokeWidth={0.45}
        strokeLinejoin="round"
      />
      {/* Empennage : plume du dessus, plume du dessous (raccourcie par la
          perspective) et la plume « coq » face à nous, plus sombre. */}
      <path
        d={`M${vx},-1.1 C${vx + 3},-3.2 ${vx + 7},-6.6 ${vx + VANE_LEN - 1},-6.8 L${vx + VANE_LEN},-1.3 Z`}
        fill={color}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={0.45}
        strokeLinejoin="round"
      />
      <path
        d={`M${vx + 1},1.1 C${vx + 4},2.6 ${vx + 7.5},4.6 ${vx + VANE_LEN - 0.5},4.8 L${vx + VANE_LEN},1.3 Z`}
        fill={color}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={0.45}
        strokeLinejoin="round"
      />
      <path
        d={`M${vx + 2},0 C${vx + 5},-0.6 ${vx + 8},-2.2 ${vx + VANE_LEN - 0.5},-2.6 L${vx + VANE_LEN},0.4 C${vx + 8},1.4 ${vx + 5},1 ${vx + 2},0 Z`}
        fill={color}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={0.4}
      />
      <path
        d={`M${vx + 2},0 C${vx + 5},-0.6 ${vx + 8},-2.2 ${vx + VANE_LEN - 0.5},-2.6 L${vx + VANE_LEN},0.4 C${vx + 8},1.4 ${vx + 5},1 ${vx + 2},0 Z`}
        fill="rgba(0,0,0,0.28)"
      />
      {/* Reflet sur la plume du dessus. */}
      <path d={`M${vx + 2},-1.8 C${vx + 5},-3.6 ${vx + 8},-5.4 ${vx + VANE_LEN - 1.5},-5.8`} stroke="rgba(255,255,255,0.55)" strokeWidth={0.5} fill="none" strokeLinecap="round" />
      {/* Encoche. */}
      <rect x={L - 0.2} y={-1.7} width={2.6} height={3.4} rx={0.8} fill="#f4efe6" stroke="rgba(0,0,0,0.5)" strokeWidth={0.4} />
    </g>
  );
}
