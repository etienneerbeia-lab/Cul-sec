"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState, GolfPoint, GolfShotRecord, GolfWindZone } from "@/lib/game/types";
import { golfCourseById } from "@/lib/golf/courses";
import { GOLF_MAX_PULL, GOLF_STEP_DT, simulateShot, velocityFromPull } from "@/lib/golf/physics";

const BALL_COLORS = ["#e0568c", "#3ecf8e", "#f4c95d", "#6fb1f0", "#e0568c", "#3ecf8e"];

// Below this fraction of full pull, releasing cancels the shot instead of
// firing it — low enough that a deliberately soft putt (small but real
// pull) still goes through, high enough to reach on purpose when you just
// want to bail out of an aim you started.
const GOLF_CANCEL_POWER = 0.08;

function ordinal(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

export default function GolfScreen({
  game,
  mySlug,
  isHost,
  busy,
  onShoot,
  onNextRound,
  onEndNight,
}: {
  game: GameState;
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  onShoot: (path: GolfPoint[], finalPos: GolfPoint, sunk: boolean, wentInWater: boolean) => void;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const gl = game.golf!;
  const course = golfCourseById(gl.courseId);
  const activePlayer = game.playersPublic[gl.playerIdx];
  const isMeActive = activePlayer.slug === mySlug && game.phase === "golf";
  const amFinished = gl.finishedSlugs.includes(mySlug);

  // Same "replay one shot at a time" mechanism as the dice mini-game's
  // rolls: starts at however many shots already happened (a fresh page
  // load shouldn't replay the whole hole), then only advances as fresh
  // ones land, which is what makes every viewer watch each shot's
  // trajectory live instead of the ball just teleporting to its new spot.
  const [shownCount, setShownCount] = useState(() => gl.shots.length);
  const pendingShot = shownCount < gl.shots.length ? gl.shots[shownCount] : null;

  const resolved = game.phase === "showdown" && !pendingShot;
  const r = resolved ? game.lastResults : undefined;

  return (
    <>
      <div className="table-status">
        <div>
          <div className="label">Manche</div>
          <div className="value">
            {game.round}
            {game.totalRounds ? `/${game.totalRounds}` : ""}
          </div>
        </div>
        <div>
          <div className="label">{course.label}</div>
          <div className="value">{gl.strokeCounts[mySlug] ?? 0} coup(s)</div>
        </div>
      </div>

      <GolfBoard
        key={pendingShot ? `${pendingShot.slug}:${pendingShot.strokeNumber}` : "idle"}
        course={course}
        positions={gl.positions}
        players={game.playersPublic}
        finishedSlugs={gl.finishedSlugs}
        pendingShot={pendingShot}
        onShotAnimDone={() => setShownCount((n) => n + 1)}
        interactive={isMeActive && !pendingShot}
        myBallPos={gl.positions[mySlug] ?? course.start}
        busy={busy}
        onRelease={(velocity) => {
          const result = simulateShot(course, gl.positions[mySlug] ?? course.start, velocity);
          onShoot(result.path, result.finalPos, result.sunk, result.wentInWater);
        }}
      />

      {!resolved && (
        <div className="hint golf-turn-hint">
          {pendingShot
            ? pendingShot.wentInWater
              ? `${pendingShot.name} tombe à l'eau — retour à la position précédente...`
              : `${pendingShot.name} joue son coup n°${pendingShot.strokeNumber}...`
            : amFinished
              ? `Fini en ${gl.strokeCounts[mySlug]} coup(s) — en attente des autres...`
              : isMeActive
                ? "À toi de jouer — glisse ton doigt en arrière pour viser, relâche pour tirer."
                : `En attente de ${activePlayer.name}...`}
        </div>
      )}

      {resolved && (
        <div className="modal-overlay">
          <div className="modal-card golf-results-card">
            <div className="glyph">⛳</div>
            <div className="modal-title">Classement du trou</div>
            <div className="players-list golf-results-list">
              {r!.golfRanking!.map((entry) => (
                <div className="player-chip" key={entry.slug}>
                  <span className="pname">
                    {ordinal(entry.rank)} — {entry.name}
                  </span>
                  <span className="pmeta">
                    {entry.strokes} coup{entry.strokes > 1 ? "s" : ""}
                    {entry.gulps > 0 && ` — Boit ${entry.gulps} 🥃`}
                  </span>
                </div>
              ))}
            </div>
            {isHost ? (
              <div className="modal-actions">
                <button className="btn-primary" disabled={busy} onClick={onNextRound}>
                  Manche suivante
                </button>
                <button className="btn-ghost" disabled={busy} onClick={onEndNight}>
                  Terminer la soirée
                </button>
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 16 }}>
                En attente de l&apos;hôte pour continuer...
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function toCourseSpace(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  width: number,
  height: number
): GolfPoint {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * width;
  const y = ((clientY - rect.top) / rect.height) * height;
  return { x, y };
}

function GolfBoard({
  course,
  positions,
  players,
  finishedSlugs,
  pendingShot,
  onShotAnimDone,
  interactive,
  myBallPos,
  busy,
  onRelease,
}: {
  course: ReturnType<typeof golfCourseById>;
  positions: Record<string, GolfPoint>;
  players: GameState["playersPublic"];
  finishedSlugs: string[];
  pendingShot: GolfShotRecord | null;
  onShotAnimDone: () => void;
  interactive: boolean;
  myBallPos: GolfPoint;
  busy: boolean;
  onRelease: (velocity: GolfPoint) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<GolfPoint | null>(null);
  // Lazily seeded from the shot's own start position rather than set via
  // an effect — the parent remounts this whole component (keyed on
  // slug+strokeNumber) for each new shot, so a fresh instance always
  // starts its replay at the right spot without needing a synchronous
  // setState in an effect body.
  const [animPos, setAnimPos] = useState<GolfPoint | null>(() => pendingShot?.path[0] ?? null);
  // Drives the sink flourish (shrink/pop, particle burst, board shake —
  // see the .golf-ball-sinking/.golf-sink-particle/.golf-course-shaking
  // CSS) once the rolled-in ball reaches the end of its path. Purely
  // cosmetic and CSS-driven (cheap on mobile) — this just flips the class
  // on for the ~420ms the animation runs.
  const [sinking, setSinking] = useState(false);

  // Plays pendingShot.path back in real time (the path was sampled at
  // physics.GOLF_STEP_DT, i.e. 60/s — stepping through it by elapsed wall
  // time rather than one sample per animation frame keeps the replay
  // speed correct regardless of the viewer's display refresh rate). A
  // small hold at the end lets everyone actually see the ball settle (or
  // drop) before handing off to the next turn or the result screen. Runs
  // once per mount — the key-based remount above is what makes a new
  // shot get its own fresh run of this instead of needing a dependency
  // that resets it.
  useEffect(() => {
    if (!pendingShot) return;
    const path = pendingShot.path;
    const start = performance.now();
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    function tick(now: number) {
      const idx = Math.floor(((now - start) / 1000) / GOLF_STEP_DT);
      if (idx >= path.length - 1) {
        setAnimPos(path[path.length - 1]);
        if (pendingShot!.sunk) {
          setSinking(true);
          holdTimer = setTimeout(onShotAnimDone, 420);
        } else {
          holdTimer = setTimeout(onShotAnimDone, 500);
        }
        return;
      }
      setAnimPos(path[idx]);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (holdTimer) clearTimeout(holdTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointerToPull(clientX: number, clientY: number): GolfPoint {
    const svg = svgRef.current!;
    const p = toCourseSpace(clientX, clientY, svg, course.width, course.height);
    return { x: p.x - myBallPos.x, y: p.y - myBallPos.y };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || busy) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag(pointerToPull(e.clientX, e.clientY));
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || drag === null) return;
    setDrag(pointerToPull(e.clientX, e.clientY));
  }
  function handlePointerUp() {
    if (!interactive || drag === null) return;
    const releasedPullLen = Math.min(Math.hypot(drag.x, drag.y), GOLF_MAX_PULL);
    const releasedPower = releasedPullLen / GOLF_MAX_PULL;
    setDrag(null);
    if (releasedPower < GOLF_CANCEL_POWER) return; // released in the cancel zone — no shot, no stroke
    onRelease(velocityFromPull(drag));
  }

  const pullLen = drag ? Math.min(Math.hypot(drag.x, drag.y), GOLF_MAX_PULL) : 0;
  const power = pullLen / GOLF_MAX_PULL;
  const wouldCancel = drag !== null && pullLen > 0 && power < GOLF_CANCEL_POWER;
  const arrowEnd: GolfPoint | null =
    drag && pullLen > 2
      ? {
          x: myBallPos.x + (-drag.x / Math.hypot(drag.x, drag.y)) * pullLen,
          y: myBallPos.y + (-drag.y / Math.hypot(drag.x, drag.y)) * pullLen,
        }
      : null;
  const arrowColor = wouldCancel ? "#8a8a96" : `hsl(${340 - power * 40}, 80%, ${60 + power * 15}%)`;

  return (
    <svg
      ref={svgRef}
      className={sinking ? "golf-course golf-course-shaking" : "golf-course"}
      viewBox={`0 0 ${course.width} ${course.height}`}
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <rect x={0} y={0} width={course.width} height={course.height} className="golf-turf" />
      {course.windZones.map((z, i) => (
        <WindZoneMarker key={i} zone={z} />
      ))}
      {course.sandZones.map((z, i) => (
        <circle key={i} cx={z.x} cy={z.y} r={z.radius} className="golf-sand" />
      ))}
      {course.waterZones.map((z, i) => (
        <circle key={i} cx={z.x} cy={z.y} r={z.radius} className="golf-water" />
      ))}
      {course.teleporters.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={t.radius} className="golf-teleporter" />
      ))}
      {course.walls.map((w, i) => (
        <line key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className="golf-wall" />
      ))}
      <circle cx={course.hole.x} cy={course.hole.y} r={course.holeRadius} className="golf-hole" />
      {course.obstacles.map((o, i) => (
        <circle
          key={i}
          cx={o.x}
          cy={o.y}
          r={o.radius}
          className={o.kind === "tree" ? "golf-obstacle golf-tree" : "golf-obstacle golf-bumper"}
        />
      ))}

      {players.map((p, i) => {
        const isMoving = pendingShot?.slug === p.slug;
        // A finished player's ball has sunk and stays out of the picture
        // from then on — except mid-replay of the very shot that sank it,
        // which everyone (including latecomers polling in) still gets to
        // watch play out before it disappears.
        if (!isMoving && finishedSlugs.includes(p.slug)) return null;
        const pos = isMoving ? (animPos ?? positions[p.slug]) : positions[p.slug];
        if (!pos) return null;
        const isSinkingThisBall = isMoving && sinking;
        return (
          <g key={p.slug}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={course.ballRadius}
              fill={BALL_COLORS[i % BALL_COLORS.length]}
              className={
                isSinkingThisBall
                  ? "golf-ball golf-ball-sinking"
                  : isMoving
                    ? "golf-ball golf-ball-moving"
                    : "golf-ball"
              }
            />
            {isSinkingThisBall && <SinkParticles center={course.hole} />}
          </g>
        );
      })}

      {arrowEnd && (
        <line
          x1={myBallPos.x}
          y1={myBallPos.y}
          x2={arrowEnd.x}
          y2={arrowEnd.y}
          stroke={arrowColor}
          strokeWidth={4}
          strokeLinecap="round"
          markerEnd="url(#golf-arrowhead)"
        />
      )}
      {wouldCancel && (
        <text x={myBallPos.x} y={myBallPos.y - course.ballRadius - 10} textAnchor="middle" className="golf-cancel-label">
          Relâcher pour annuler
        </text>
      )}
      <defs>
        <marker id="golf-arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={arrowColor} />
        </marker>
      </defs>
    </svg>
  );
}

// A short burst of specks around the hole the instant a ball sinks —
// pure CSS (transform + opacity via .golf-sink-particle's keyframes), so
// it's cheap even on a phone, and never re-triggers itself since the
// parent only renders this while golf-ball-sinking's short window is
// active.
function SinkParticles({ center }: { center: GolfPoint }) {
  const specks = [
    { dx: 14, dy: -10 },
    { dx: -13, dy: -11 },
    { dx: 15, dy: 8 },
    { dx: -15, dy: 7 },
    { dx: 3, dy: -16 },
    { dx: -4, dy: 15 },
  ];
  return (
    <>
      {specks.map((s, i) => (
        <circle
          key={i}
          cx={center.x}
          cy={center.y}
          r={2.4}
          className="golf-sink-particle"
          style={{ "--px": `${s.dx}px`, "--py": `${s.dy}px`, animationDelay: `${i * 15}ms` } as React.CSSProperties}
        />
      ))}
    </>
  );
}

// Renders a wind zone as a tinted band with a small grid of chevrons
// pointing the way it pushes — .golf-wind-arrow's CSS animation nudges
// each one forward and back along that same direction to read as motion
// without any JS-driven per-frame work.
function WindZoneMarker({ zone }: { zone: GolfWindZone }) {
  const angle = (Math.atan2(zone.dirY, zone.dirX) * 180) / Math.PI;
  const cols = Math.max(1, Math.round(zone.width / 90));
  const rows = Math.max(1, Math.round(zone.height / 90));
  const points: GolfPoint[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push({
        x: zone.x + ((c + 0.5) * zone.width) / cols,
        y: zone.y + ((r + 0.5) * zone.height) / rows,
      });
    }
  }
  return (
    <>
      <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} className="golf-wind" />
      {points.map((p, i) => (
        <path
          key={i}
          d="M-7,-6 L5,0 L-7,6"
          className="golf-wind-arrow"
          transform={`translate(${p.x} ${p.y}) rotate(${angle})`}
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </>
  );
}
