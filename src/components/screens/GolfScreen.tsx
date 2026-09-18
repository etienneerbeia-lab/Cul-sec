"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GameState,
  GolfCourse,
  GolfDecor,
  GolfObstacle,
  GolfPoint,
  GolfShotRecord,
  GolfStruckBallResult,
  GolfWindZone,
} from "@/lib/game/types";
import { golfCourseById } from "@/lib/golf/courses";
import { GOLF_MAX_PULL, GOLF_STEP_DT, simulateShot, velocityFromPull } from "@/lib/golf/physics";

// One color per player, reused for their ball on the course AND their
// score pill/avatar ring in the header — that pairing is what lets
// everyone tell whose ball is whose at a glance once several are on
// screen together.
const PLAYER_COLORS = ["#e0483f", "#9b5de5", "#3ecf8e", "#f4c95d", "#6fb1f0", "#ff8fc7"];

// Below this fraction of full pull, releasing cancels the shot instead of
// firing it — low enough that a deliberately soft putt (small but real
// pull) still goes through, high enough to reach on purpose when you just
// want to bail out of an aim you started.
const GOLF_CANCEL_POWER = 0.08;

// Drawn bigger than course.ballRadius (which stays the true physics/
// collision size) purely so balls stay easy to spot now that the whole
// course is visible at once instead of a zoomed-in camera window — a
// cosmetic-only embellishment, never fed back into simulateShot.
const BALL_VISUAL_SCALE = 1.35;

function ordinal(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

// Lightens (positive amt) or darkens (negative amt) a "#rrggbb" color —
// used to derive a ball's highlight/shadow stops from its single base
// PLAYER_COLORS entry instead of hand-picking a gradient per player.
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => (amt >= 0 ? Math.round(c + (255 - c) * amt) : Math.round(c * (1 + amt)));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function inWindZone(p: GolfPoint, course: GolfCourse): boolean {
  return course.windZones.some((z) => p.x >= z.x && p.x <= z.x + z.width && p.y >= z.y && p.y <= z.y + z.height);
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
  onShoot: (
    path: GolfPoint[],
    finalPos: GolfPoint,
    sunk: boolean,
    wentInWater: boolean,
    destroyedObstacle?: number,
    struckBalls?: GolfStruckBallResult[]
  ) => void;
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
      <GolfHeader
        game={game}
        gl={gl}
        course={course}
        mySlug={mySlug}
        activeSlug={resolved ? null : activePlayer.slug}
      />

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
        destroyedObstacles={gl.destroyedObstacles}
        busy={busy}
        onRelease={(velocity) => {
          const otherBalls = game.playersPublic
            .filter((p) => p.slug !== mySlug && !gl.finishedSlugs.includes(p.slug))
            .map((p) => ({ slug: p.slug, pos: gl.positions[p.slug] ?? course.start }));
          const result = simulateShot(
            course,
            gl.positions[mySlug] ?? course.start,
            velocity,
            gl.destroyedObstacles,
            otherBalls
          );
          onShoot(result.path, result.finalPos, result.sunk, result.wentInWater, result.destroyedObstacle, result.struckBalls);
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
              {r!.golfRanking!.map((entry) => {
                const pi = game.playersPublic.findIndex((p) => p.slug === entry.slug);
                return (
                  <div className="player-chip" key={entry.slug}>
                    <span className="pname">
                      <span className="golf-rank-dot" style={{ background: PLAYER_COLORS[pi % PLAYER_COLORS.length] }} />
                      {ordinal(entry.rank)} — {entry.name}
                    </span>
                    <span className="pmeta">
                      {entry.strokes} coup{entry.strokes > 1 ? "s" : ""}
                      {entry.gulps > 0 && ` — Boit ${entry.gulps} 🥃`}
                    </span>
                  </div>
                );
              })}
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

// Per-player row of avatar + colored score pill + name + stroke count,
// with the active player's card highlighted — mirrors the reference's top
// bar, adapted to an arbitrary player count (a scrollable row instead of
// a fixed 2-up layout) and to what this app actually tracks: there's no
// per-turn clock or a "max shots" cap in this mini-game, so instead of
// faking a countdown/limit that doesn't correspond to real state, the
// active card just gets a highlighted "turn" badge.
function GolfHeader({
  game,
  gl,
  course,
  mySlug,
  activeSlug,
}: {
  game: GameState;
  gl: NonNullable<GameState["golf"]>;
  course: GolfCourse;
  mySlug: string;
  activeSlug: string | null;
}) {
  return (
    <div className="golf-header">
      <div className="golf-header-meta">
        <span className="golf-header-course">{course.label}</span>
        <span className="golf-header-round">
          Manche {game.round}
          {game.totalRounds ? `/${game.totalRounds}` : ""}
        </span>
      </div>
      <div className="golf-header-players">
        {game.playersPublic.map((p, i) => {
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          const isActive = p.slug === activeSlug;
          const initial = p.name.trim().charAt(0).toUpperCase() || "?";
          return (
            <div
              key={p.slug}
              className={isActive ? "golf-player-card golf-player-card-active" : "golf-player-card"}
              style={{ "--pcolor": color } as React.CSSProperties}
            >
              {isActive && <div className="golf-turn-badge">{p.slug === mySlug ? "À toi" : "En jeu"}</div>}
              <div className="golf-player-avatar-wrap">
                <div className="golf-player-avatar">{initial}</div>
                <div className="golf-player-pill">{p.gulpsTotal}</div>
              </div>
              <div className="golf-player-name">{p.name}</div>
              <div className="golf-player-shots">Coup : {gl.strokeCounts[p.slug] ?? 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// clientX/clientY -> course-space. The board always shows the whole
// course at once (viewBox = 0 0 width height, no camera/pan), so this is
// a plain linear remap from the SVG's on-screen box to its full width/
// height in course units.
function toCourseSpace(clientX: number, clientY: number, svg: SVGSVGElement, course: GolfCourse): GolfPoint {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * course.width;
  const y = ((clientY - rect.top) / rect.height) * course.height;
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
  destroyedObstacles,
  busy,
  onRelease,
}: {
  course: GolfCourse;
  positions: Record<string, GolfPoint>;
  players: GameState["playersPublic"];
  finishedSlugs: string[];
  pendingShot: GolfShotRecord | null;
  onShotAnimDone: () => void;
  interactive: boolean;
  myBallPos: GolfPoint;
  destroyedObstacles: number[];
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
  // Live replay position for every OTHER ball this shot's collisions
  // knocked into motion (slug -> current point), updated in lockstep with
  // animPos each replay frame — see the tick loop below.
  const [struckAnimPos, setStruckAnimPos] = useState<Record<string, GolfPoint>>({});
  // Slugs whose ball is inside a wind zone THIS replay frame — drives the
  // pulsing orange halo ring (.golf-wind-halo) while it's true, cleared
  // the instant that ball leaves the zone.
  const [windySlugs, setWindySlugs] = useState<Set<string>>(new Set());
  // Drives the sink flourish (shrink/pop, particle burst, board shake —
  // see the .golf-ball-sinking/.golf-sink-particle/.golf-course-shaking
  // CSS) for whichever ball(s) reach the hole once the replay catches up
  // to that frame — almost always just the shooter's own, but a struck
  // ball can occasionally get knocked in too.
  const [sinkingSlugs, setSinkingSlugs] = useState<Set<string>>(new Set());
  // Which bumper/roulette (by index in course.obstacles) just got hit, for
  // the brief impact-ring flash — see hitAtPathIndex below for how the
  // trigger frame is found.
  const [flashObstacle, setFlashObstacle] = useState<number | null>(null);
  // Flips true the instant the replaying ball reaches the end of its path
  // for a shot that destroyed a tree (pendingShot.destroyedObstacle) —
  // until then that tree still renders standing, exactly like animPos
  // keeps the ball itself at its pre-shot spot until the replay catches
  // up. Once true, the shatter animation plays instead (see TreeShatter).
  const [treeShattering, setTreeShattering] = useState(false);

  // Precomputes, once per shot, which path index each bumper/roulette
  // collision happens at (comparing consecutive samples' distance to each
  // one — a "just entered contact range" rising edge) so the replay loop
  // below can just check "is this the frame" instead of doing geometry
  // every frame for every obstacle.
  const [hitAtPathIndex] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    if (!pendingShot) return map;
    const path = pendingShot.path;
    course.obstacles.forEach((o, oi) => {
      if (o.kind === "tree") return;
      const contactDist = o.radius + course.ballRadius + 3;
      let wasNear = false;
      for (let i = 0; i < path.length; i++) {
        const near = Math.hypot(path[i].x - o.x, path[i].y - o.y) < contactDist;
        if (near && !wasNear) map.set(i, oi);
        wasNear = near;
      }
    });
    return map;
  });

  // Plays pendingShot.path back in real time (the path was sampled at
  // physics.GOLF_STEP_DT, i.e. 60/s — stepping through it by elapsed wall
  // time rather than one sample per animation frame keeps the replay
  // speed correct regardless of the viewer's display refresh rate). Any
  // struck balls' own paths were sampled on the exact same step timeline
  // (see simulateShot), so the same idx indexes straight into them too —
  // just clamped to each one's own (possibly shorter) length once it's
  // come to rest. A small hold at the end lets everyone actually see the
  // ball(s) settle (or drop) before handing off to the next turn or the
  // result screen. Runs once per mount — the key-based remount above is
  // what makes a new shot get its own fresh run of this instead of
  // needing a dependency that resets it.
  useEffect(() => {
    if (!pendingShot) return;
    const path = pendingShot.path;
    const struck = pendingShot.struckBalls ?? [];
    const start = performance.now();
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    function frame(idx: number) {
      const shooterPos = path[Math.min(idx, path.length - 1)];
      setAnimPos(shooterPos);
      const windy = new Set<string>();
      if (inWindZone(shooterPos, course)) windy.add(pendingShot!.slug);
      if (struck.length > 0) {
        const positions: Record<string, GolfPoint> = {};
        struck.forEach((sb) => {
          const p = sb.path[Math.min(idx, sb.path.length - 1)];
          positions[sb.slug] = p;
          if (inWindZone(p, course)) windy.add(sb.slug);
        });
        setStruckAnimPos(positions);
      }
      setWindySlugs(windy);
    }
    function tick(now: number) {
      const idx = Math.floor(((now - start) / 1000) / GOLF_STEP_DT);
      if (idx >= path.length - 1) {
        frame(path.length - 1);
        if (pendingShot!.destroyedObstacle !== undefined) setTreeShattering(true);
        const sunkSlugs = new Set<string>();
        if (pendingShot!.sunk) sunkSlugs.add(pendingShot!.slug);
        struck.forEach((sb) => {
          if (sb.sunk) sunkSlugs.add(sb.slug);
        });
        if (sunkSlugs.size > 0) {
          setSinkingSlugs(sunkSlugs);
          holdTimer = setTimeout(onShotAnimDone, 420);
        } else {
          holdTimer = setTimeout(onShotAnimDone, 500);
        }
        return;
      }
      frame(idx);
      const hitObstacle = hitAtPathIndex.get(idx);
      if (hitObstacle !== undefined) {
        setFlashObstacle(hitObstacle);
        flashTimer = setTimeout(() => setFlashObstacle((cur) => (cur === hitObstacle ? null : cur)), 220);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (holdTimer) clearTimeout(holdTimer);
      if (flashTimer) clearTimeout(flashTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointerToPull(clientX: number, clientY: number): GolfPoint {
    const svg = svgRef.current!;
    const p = toCourseSpace(clientX, clientY, svg, course);
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
      className={sinkingSlugs.size > 0 ? "golf-course golf-course-shaking" : "golf-course"}
      viewBox={`0 0 ${course.width} ${course.height}`}
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <pattern id="golf-grass-pattern" width={64} height={64} patternUnits="userSpaceOnUse">
          <rect width={64} height={64} className="golf-grass-base" />
          <rect width={64} height={32} className="golf-grass-stripe" />
        </pattern>
        <pattern id="golf-water-ice" width={18} height={18} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={18} height={18} className="golf-water-ice-bg" />
          <rect width={9} height={9} className="golf-water-ice-tile" />
          <rect x={9} y={9} width={9} height={9} className="golf-water-ice-tile" />
        </pattern>
        <radialGradient id="golf-tree-gradient" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#55b378" />
          <stop offset="60%" stopColor="#2f8f52" />
          <stop offset="100%" stopColor="#1a5c33" />
        </radialGradient>
        <radialGradient id="golf-tree-gradient-back" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3a9a5d" />
          <stop offset="100%" stopColor="#1a5c33" />
        </radialGradient>
        <radialGradient id="golf-bumper-gradient" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#ffb0d3" />
          <stop offset="55%" stopColor="#e0568c" />
          <stop offset="100%" stopColor="#a83864" />
        </radialGradient>
        <radialGradient id="golf-water-gradient" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#5da3dd" />
          <stop offset="65%" stopColor="#2a6fb0" />
          <stop offset="100%" stopColor="#1c4d7d" />
        </radialGradient>
        <radialGradient id="golf-hole-gradient" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#333338" />
          <stop offset="70%" stopColor="#111114" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        {PLAYER_COLORS.map((c, i) => (
          <radialGradient key={i} id={`golf-ball-gradient-${i}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={shade(c, 0.55)} />
            <stop offset="55%" stopColor={c} />
            <stop offset="100%" stopColor={shade(c, -0.3)} />
          </radialGradient>
        ))}
        <marker id="golf-arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={arrowColor} />
        </marker>
      </defs>

      <rect x={0} y={0} width={course.width} height={course.height} fill="url(#golf-grass-pattern)" />

      {course.decor.map((d, i) => (
        <DecorItem key={i} item={d} />
      ))}

      {course.windZones.map((z, i) => (
        <WindZoneMarker key={i} zone={z} />
      ))}
      {course.sandZones.map((z, i) => (
        <circle key={i} cx={z.x} cy={z.y} r={z.radius} className="golf-sand" />
      ))}
      {course.waterZones.map((z, i) => (
        <g key={i}>
          {course.theme === "labyrinthe" ? (
            <circle cx={z.x} cy={z.y} r={z.radius} className="golf-water golf-water-ice-fill" fill="url(#golf-water-ice)" />
          ) : (
            <>
              <circle cx={z.x} cy={z.y} r={z.radius} className="golf-water" />
              <circle cx={z.x} cy={z.y} r={z.radius * 0.55} className="golf-water-ripple" style={{ animationDelay: "0s" }} />
              <circle cx={z.x} cy={z.y} r={z.radius * 0.55} className="golf-water-ripple" style={{ animationDelay: "1.3s" }} />
              <rect
                x={z.x - z.radius * 0.55}
                y={z.y - z.radius * 0.1}
                width={z.radius * 0.7}
                height={4}
                rx={2}
                className="golf-water-shine"
                style={{ animationDelay: "0s" }}
              />
              <rect
                x={z.x - z.radius * 0.15}
                y={z.y + z.radius * 0.3}
                width={z.radius * 0.5}
                height={3}
                rx={1.5}
                className="golf-water-shine"
                style={{ animationDelay: "0.9s" }}
              />
            </>
          )}
        </g>
      ))}
      {course.teleporters.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r={t.radius} className="golf-teleporter" />
      ))}
      {course.walls.map((w, i) => (
        <line
          key={i}
          x1={w.x1}
          y1={w.y1}
          x2={w.x2}
          y2={w.y2}
          className={course.theme === "labyrinthe" ? "golf-wall golf-wall-fence" : "golf-wall"}
        />
      ))}

      <circle cx={course.hole.x} cy={course.hole.y} r={course.holeRadius} fill="url(#golf-hole-gradient)" className="golf-hole" />
      <HoleFlag hole={course.hole} holeRadius={course.holeRadius} />

      {course.obstacles.map((o, i) => {
        const isPendingDestroy = pendingShot?.destroyedObstacle === i;
        // Gone from a past shot this hole — stays gone, no animation to
        // replay for someone watching after the fact.
        if (o.kind === "tree" && destroyedObstacles.includes(i) && !isPendingDestroy) return null;
        if (o.kind === "tree" && isPendingDestroy && treeShattering) {
          return <TreeShatter key={i} obstacle={o} />;
        }
        if (o.kind === "tree") {
          return (
            <g key={i}>
              <ellipse cx={o.x + o.radius * 0.25} cy={o.y + o.radius * 0.55} rx={o.radius * 0.85} ry={o.radius * 0.3} className="golf-tree-shadow" />
              <rect x={o.x - o.radius * 0.1} y={o.y + o.radius * 0.15} width={o.radius * 0.2} height={o.radius * 0.5} className="golf-tree-trunk" />
              <circle cx={o.x - o.radius * 0.28} cy={o.y + o.radius * 0.05} r={o.radius * 0.62} className="golf-tree-canopy-back" />
              <circle cx={o.x} cy={o.y} r={o.radius} className="golf-tree-canopy" />
            </g>
          );
        }
        if (o.kind === "roulette") {
          return <RouletteWheel key={i} obstacle={o} flashing={flashObstacle === i} />;
        }
        return (
          <g key={i}>
            <ellipse cx={o.x + o.radius * 0.2} cy={o.y + o.radius * 0.45} rx={o.radius * 0.8} ry={o.radius * 0.28} className="golf-bumper-shadow" />
            <circle cx={o.x} cy={o.y} r={o.radius} className="golf-bumper" />
            {flashObstacle === i && <circle cx={o.x} cy={o.y} r={o.radius} className="golf-bumper-flash" />}
          </g>
        );
      })}

      {players.map((p, i) => {
        const isShooter = pendingShot?.slug === p.slug;
        const isStruck = !isShooter && pendingShot?.struckBalls?.some((sb) => sb.slug === p.slug);
        const isMoving = isShooter || isStruck;
        // A finished player's ball has sunk and stays out of the picture
        // from then on — except mid-replay of the very shot that sank it,
        // which everyone (including latecomers polling in) still gets to
        // watch play out before it disappears.
        if (!isMoving && finishedSlugs.includes(p.slug)) return null;
        const pos = isShooter
          ? (animPos ?? positions[p.slug])
          : isStruck
            ? (struckAnimPos[p.slug] ?? positions[p.slug])
            : positions[p.slug];
        if (!pos) return null;
        const isSinkingThisBall = isMoving && sinkingSlugs.has(p.slug);
        const isWindy = isMoving && windySlugs.has(p.slug);
        const ballRadius = course.ballRadius * BALL_VISUAL_SCALE;
        return (
          <g key={p.slug}>
            <ellipse cx={pos.x + ballRadius * 0.25} cy={pos.y + ballRadius * 0.5} rx={ballRadius * 0.85} ry={ballRadius * 0.32} className="golf-ball-shadow" />
            {isWindy && <circle cx={pos.x} cy={pos.y} r={ballRadius * 1.9} className="golf-wind-halo" />}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={ballRadius}
              fill={`url(#golf-ball-gradient-${i % PLAYER_COLORS.length})`}
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
    </svg>
  );
}

// Purely cosmetic scenery — see GolfDecor's own comment in types.ts. Each
// kind is a handful of flat low-poly shapes plus a soft ground shadow,
// cheap enough to sprinkle several per course without any real render cost.
function DecorItem({ item }: { item: GolfDecor }) {
  const transform = item.rotation
    ? `translate(${item.x} ${item.y}) rotate(${item.rotation})`
    : `translate(${item.x} ${item.y})`;
  switch (item.kind) {
    case "cow":
      return (
        <g transform={transform}>
          <ellipse cx={0} cy={11} rx={15} ry={4.5} className="golf-decor-shadow" />
          <ellipse cx={0} cy={0} rx={13} ry={8} className="golf-cow-body" />
          <circle cx={-8} cy={-3} r={2.6} className="golf-cow-spot" />
          <circle cx={4} cy={2.5} r={3.2} className="golf-cow-spot" />
          <circle cx={11} cy={-6} r={6.2} className="golf-cow-head" />
          <rect x={-9} y={5} width={3} height={7} rx={1} className="golf-cow-leg" />
          <rect x={6} y={5} width={3} height={7} rx={1} className="golf-cow-leg" />
        </g>
      );
    case "truck":
      return (
        <g transform={transform}>
          <ellipse cx={0} cy={15} rx={21} ry={5} className="golf-decor-shadow" />
          <rect x={-18} y={-6} width={22} height={17} rx={2} className="golf-truck-bed" />
          <rect x={2} y={-13} width={15} height={23} rx={3} className="golf-truck-cab" />
          <rect x={5} y={-10} width={9} height={7} rx={1} className="golf-truck-window" />
          <circle cx={-10} cy={12} r={4.6} className="golf-truck-wheel" />
          <circle cx={12} cy={12} r={4.6} className="golf-truck-wheel" />
        </g>
      );
    case "tent":
      return (
        <g transform={transform}>
          <ellipse cx={0} cy={16} rx={16} ry={4.2} className="golf-decor-shadow" />
          <polygon points="-16,16 16,16 0,-15" className="golf-tent-body" />
          <polygon points="-4,16 4,16 0,3" className="golf-tent-door" />
        </g>
      );
    case "house":
      return (
        <g transform={transform}>
          <ellipse cx={0} cy={17} rx={18} ry={4.5} className="golf-decor-shadow" />
          <rect x={-14} y={-2} width={28} height={18} className="golf-house-wall" />
          <polygon points="-18,-2 18,-2 0,-21" className="golf-house-roof" />
          <rect x={-4} y={6} width={8} height={10} className="golf-house-door" />
        </g>
      );
    case "bush":
      return (
        <g transform={transform}>
          <ellipse cx={0} cy={7.5} rx={13} ry={3.5} className="golf-decor-shadow" />
          <circle cx={-6} cy={0} r={7} className="golf-bush-leaf" />
          <circle cx={6} cy={0} r={7} className="golf-bush-leaf" />
          <circle cx={0} cy={-5.5} r={7.5} className="golf-bush-leaf" />
        </g>
      );
    case "sparkle":
      return (
        <g transform={transform} className="golf-sparkle">
          <polygon points="0,-6 2,-1 7,0 2,1 0,6 -2,1 -7,0 -2,-1" className="golf-sparkle-shape" />
        </g>
      );
  }
}

function pieWedgePath(r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = r * Math.cos(toRad(startDeg));
  const y1 = r * Math.sin(toRad(startDeg));
  const x2 = r * Math.cos(toRad(endDeg));
  const y2 = r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M0,0 L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
}

const ROULETTE_COLORS = ["#e0483f", "#f4c95d", "#3ecf8e", "#6fb1f0", "#9b5de5", "#ff8fc7"];

// A "roulette wheel" bumper — physics-wise it's an ordinary bounce
// obstacle (simulateShot only special-cases "tree"), this is purely a
// louder-looking skin for course variety: a spinning multicolor disc
// instead of the plain pink dome.
function RouletteWheel({ obstacle, flashing }: { obstacle: GolfObstacle; flashing: boolean }) {
  const step = 360 / ROULETTE_COLORS.length;
  return (
    <g transform={`translate(${obstacle.x} ${obstacle.y})`}>
      <ellipse cx={obstacle.radius * 0.2} cy={obstacle.radius * 0.45} rx={obstacle.radius * 0.8} ry={obstacle.radius * 0.28} className="golf-bumper-shadow" />
      <g className="golf-roulette-spin">
        {ROULETTE_COLORS.map((c, i) => (
          <path key={i} d={pieWedgePath(obstacle.radius, i * step, (i + 1) * step)} fill={c} />
        ))}
        <circle r={obstacle.radius * 0.28} className="golf-roulette-hub" />
      </g>
      <circle r={obstacle.radius} className="golf-roulette-rim" />
      {flashing && <circle r={obstacle.radius} className="golf-bumper-flash" />}
    </g>
  );
}

// The flag planted in the hole — a static pole + triangular cloth, drawn
// once the hole circle underneath it is in place.
function HoleFlag({ hole, holeRadius }: { hole: GolfPoint; holeRadius: number }) {
  const poleHeight = holeRadius * 2.7;
  return (
    <g transform={`translate(${hole.x} ${hole.y})`}>
      <line x1={0} y1={2} x2={0} y2={-poleHeight} className="golf-flag-pole" />
      <polygon
        points={`0,${-poleHeight} ${holeRadius * 1.7},${-poleHeight + holeRadius * 0.75} 0,${-poleHeight + holeRadius * 1.35}`}
        className="golf-flag-cloth"
      />
    </g>
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

// A short burst of canopy/trunk shards the instant a tree gets smashed —
// same cheap CSS-transform-only technique as SinkParticles, just with a
// rotation added so the pieces tumble instead of just drifting. Renders in
// place of the tree for the rest of this shot's replay; the obstacle is
// simply gone (destroyedObstacles) once the next shot mounts.
function TreeShatter({ obstacle }: { obstacle: GolfObstacle }) {
  const shards = [
    { dx: 16, dy: -12, rot: 50 },
    { dx: -15, dy: -16, rot: -40 },
    { dx: 18, dy: 7, rot: 80 },
    { dx: -17, dy: 10, rot: -70 },
    { dx: 3, dy: -20, rot: 20 },
    { dx: -4, dy: 16, rot: -25 },
  ];
  return (
    <>
      {shards.map((s, i) => (
        <rect
          key={i}
          x={obstacle.x - obstacle.radius * 0.16}
          y={obstacle.y - obstacle.radius * 0.16}
          width={obstacle.radius * 0.32}
          height={obstacle.radius * 0.32}
          className="golf-tree-shard"
          style={
            {
              "--sdx": `${s.dx}px`,
              "--sdy": `${s.dy}px`,
              "--srot": `${s.rot}deg`,
              animationDelay: `${i * 12}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

// Renders a wind zone as a tinted band (or diamond, see below) with a
// small cluster of chevrons pointing the way it pushes (.golf-wind-arrow's
// CSS animation pulses each one) plus a handful of small specks drifting
// the same direction on a loop. Two shapes, purely a difference in how the
// arrow points are laid out — the push itself is always one uniform
// direction (zone.dirX/dirY), same physics either way:
// - "corridor" (default): a plain grid tiling the zone's full footprint —
//   used for wind spanning a whole lane/corridor.
// - "diamond": arrows arranged in a rotated-square ring around the zone's
//   center with the middle left empty, meant to sit centered on a point
//   (typically the hole) so the target stays visible in the gap.
function WindZoneMarker({ zone }: { zone: GolfWindZone }) {
  const angle = (Math.atan2(zone.dirY, zone.dirX) * 180) / Math.PI;
  const isDiamond = zone.shape === "diamond";
  const points: GolfPoint[] = [];
  if (isDiamond) {
    const cx = zone.x + zone.width / 2;
    const cy = zone.y + zone.height / 2;
    const step = Math.min(zone.width, zone.height) / 4;
    const ring = 2;
    for (let dxCell = -ring; dxCell <= ring; dxCell++) {
      for (let dyCell = -ring; dyCell <= ring; dyCell++) {
        const dist = Math.abs(dxCell) + Math.abs(dyCell);
        if (dist === 0 || dist > ring) continue; // hollow center — the target stays visible
        points.push({ x: cx + dxCell * step, y: cy + dyCell * step });
      }
    }
  } else {
    const cols = Math.max(1, Math.round(zone.width / 90));
    const rows = Math.max(1, Math.round(zone.height / 90));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        points.push({
          x: zone.x + ((col + 0.5) * zone.width) / cols,
          y: zone.y + ((row + 0.5) * zone.height) / rows,
        });
      }
    }
  }
  const dirLen = Math.hypot(zone.dirX, zone.dirY) || 1;
  const driftDist = Math.min(zone.width, zone.height) * 0.7;
  const dx = (zone.dirX / dirLen) * driftDist;
  const dy = (zone.dirY / dirLen) * driftDist;
  // A handful of particles seeded at varied offsets "upwind" of center so
  // they don't all drift in visual lockstep.
  const particles = points.map((p, i) => ({
    x: p.x - dx * 0.4,
    y: p.y - dy * 0.4,
    delay: (i * 0.35) % 1.8,
  }));
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;

  return (
    <>
      {isDiamond ? (
        <rect
          x={-zone.width / 2}
          y={-zone.height / 2}
          width={zone.width}
          height={zone.height}
          className="golf-wind golf-wind-diamond"
          transform={`translate(${cx} ${cy}) rotate(45)`}
        />
      ) : (
        <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} className="golf-wind" />
      )}
      {particles.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2}
          className="golf-wind-particle"
          style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, animationDelay: `${p.delay}s` } as React.CSSProperties}
        />
      ))}
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
