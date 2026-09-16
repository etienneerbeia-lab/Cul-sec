"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState, GolfPoint, GolfShotRecord } from "@/lib/game/types";
import { golfCourseById } from "@/lib/golf/courses";
import { GOLF_MAX_PULL, GOLF_STEP_DT, simulateShot, velocityFromPull } from "@/lib/golf/physics";

const BALL_COLORS = ["#e0568c", "#3ecf8e", "#f4c95d", "#6fb1f0", "#e0568c", "#3ecf8e"];

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
  onShoot: (path: GolfPoint[], finalPos: GolfPoint, sunk: boolean) => void;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const gl = game.golf!;
  const course = golfCourseById(gl.courseId);
  const activePlayer = game.playersPublic[gl.playerIdx];
  const isMeActive = activePlayer.slug === mySlug && game.phase === "golf";

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
        pendingShot={pendingShot}
        onShotAnimDone={() => setShownCount((n) => n + 1)}
        interactive={isMeActive && !pendingShot}
        myBallPos={gl.positions[mySlug] ?? course.start}
        busy={busy}
        onRelease={(velocity) => {
          const result = simulateShot(course, gl.positions[mySlug] ?? course.start, velocity);
          onShoot(result.path, result.finalPos, result.sunk);
        }}
      />

      {!resolved && (
        <div className="hint golf-turn-hint">
          {pendingShot
            ? `${pendingShot.name} joue son coup n°${pendingShot.strokeNumber}...`
            : isMeActive
              ? "À toi de jouer — glisse ton doigt en arrière pour viser, relâche pour tirer."
              : `En attente de ${activePlayer.name}...`}
        </div>
      )}

      {resolved && (
        <>
          <div className="pass-screen" style={{ flex: "0 0 auto", padding: "8px 0 4px" }}>
            <div className="glyph">⛳</div>
            <div className="subtitle" style={{ marginBottom: 0 }}>
              {r!.winner} rentre la balle en {r!.golfStrokes} coup{r!.golfStrokes! > 1 ? "s" : ""} !
            </div>
            <div className="hint">Les autres boivent 2 🥃.</div>
          </div>
          <div className="spacer" />
          {isHost ? (
            <>
              <button className="btn-primary" disabled={busy} onClick={onNextRound}>
                Manche suivante
              </button>
              <button className="btn-ghost" style={{ marginTop: 12 }} disabled={busy} onClick={onEndNight}>
                Terminer la soirée
              </button>
            </>
          ) : (
            <div className="hint">En attente de l&apos;hôte pour continuer...</div>
          )}
        </>
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
        holdTimer = setTimeout(onShotAnimDone, 500);
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
    const velocity = velocityFromPull(drag);
    setDrag(null);
    if (velocity.x !== 0 || velocity.y !== 0) onRelease(velocity);
  }

  const pullLen = drag ? Math.min(Math.hypot(drag.x, drag.y), GOLF_MAX_PULL) : 0;
  const power = pullLen / GOLF_MAX_PULL;
  const arrowEnd: GolfPoint | null =
    drag && pullLen > 2
      ? {
          x: myBallPos.x + (-drag.x / Math.hypot(drag.x, drag.y)) * pullLen,
          y: myBallPos.y + (-drag.y / Math.hypot(drag.x, drag.y)) * pullLen,
        }
      : null;
  const arrowColor = `hsl(${340 - power * 40}, 80%, ${60 + power * 15}%)`;

  return (
    <svg
      ref={svgRef}
      className="golf-course"
      viewBox={`0 0 ${course.width} ${course.height}`}
      style={{ touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <rect x={0} y={0} width={course.width} height={course.height} className="golf-turf" />
      {course.sandZones.map((z, i) => (
        <circle key={i} cx={z.x} cy={z.y} r={z.radius} className="golf-sand" />
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
          className={o.kind === "tree" ? "golf-obstacle golf-tree" : "golf-obstacle golf-bush"}
        />
      ))}

      {players.map((p, i) => {
        const isMoving = pendingShot?.slug === p.slug;
        const pos = isMoving ? (animPos ?? positions[p.slug]) : positions[p.slug];
        if (!pos) return null;
        return (
          <circle
            key={p.slug}
            cx={pos.x}
            cy={pos.y}
            r={course.ballRadius}
            fill={BALL_COLORS[i % BALL_COLORS.length]}
            className={isMoving ? "golf-ball golf-ball-moving" : "golf-ball"}
          />
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
      <defs>
        <marker id="golf-arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={arrowColor} />
        </marker>
      </defs>
    </svg>
  );
}
