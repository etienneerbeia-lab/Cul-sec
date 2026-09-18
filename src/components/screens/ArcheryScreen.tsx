"use client";

import { useEffect, useRef, useState } from "react";
import type { ArcheryPoint, ArcheryShotRecord, ArcheryWind, GameState } from "@/lib/game/types";
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

// How far (in board units) the finger has to travel straight down from
// wherever the gesture started before it stops adjusting the aim reticle
// and starts drawing the bowstring instead — small enough to feel
// immediate, big enough that a slightly wobbly tap-to-aim never
// accidentally triggers a draw.
const ARCHERY_AIM_DEADZONE = 10;
// Extra downward distance beyond the deadzone for full draw power.
const ARCHERY_MAX_PULL = 220;
// Below this fraction of full draw, releasing cancels the shot instead of
// firing it — same idea (and threshold) as golf's own release-to-cancel
// zone: low enough that a deliberately soft draw still goes through, high
// enough to bail out of a draw you didn't mean to start.
const ARCHERY_CANCEL_POWER = 0.08;
// Fixed screen anchor for the bowstring gauge — stays put no matter where
// on the board the draw gesture actually started, so the player always
// knows where to look to read their own power.
const ARCHERY_BOW_ANCHOR: ArcheryPoint = { x: ARCHERY_CENTER.x, y: ARCHERY_TARGET_SIZE + 25 };

function ordinal(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

export default function ArcheryScreen({
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
  onShoot: (aim: ArcheryPoint, power: number) => void;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const ar = game.archery!;
  const activePlayer = game.playersPublic[ar.playerIdx];
  const isMeActive = activePlayer.slug === mySlug && game.phase === "archery";
  const haveIShot = ar.shots.some((s) => s.slug === mySlug);

  // Same "replay one shot at a time" mechanism as dice/golf: starts at
  // however many shots already happened (a fresh page load shouldn't
  // replay the whole round), then only advances as fresh ones land.
  const [shownCount, setShownCount] = useState(() => ar.shots.length);
  const pendingShot = shownCount < ar.shots.length ? ar.shots[shownCount] : null;

  const resolved = game.phase === "showdown" && !pendingShot;
  const r = resolved ? game.lastResults : undefined;

  // While a shot is mid-replay, show the wind that was actually blowing
  // for it rather than whatever's already been rolled for the next
  // player — otherwise the banner would spoil (or contradict) what
  // everyone's about to watch land.
  const displayedWind: ArcheryWind = pendingShot ? pendingShot.wind : ar.wind;

  const impactBySlug: Record<string, ArcheryPoint> = {};
  ar.shots.forEach((s) => {
    impactBySlug[s.slug] = s.impact;
  });

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
          <div className="label">Tir à l&apos;arc</div>
          <div className="value">
            {ar.shots.length}/{ar.turnOrder.length}
          </div>
        </div>
      </div>

      <WindBanner wind={displayedWind} />

      <ArcheryBoard
        key={pendingShot ? pendingShot.slug : `turn-${ar.shots.length}`}
        impacts={impactBySlug}
        players={game.playersPublic}
        pendingShot={pendingShot}
        onShotAnimDone={() => setShownCount((n) => n + 1)}
        interactive={isMeActive && !pendingShot && !haveIShot}
        busy={busy}
        onFire={onShoot}
      />

      {!resolved && (
        <div className="hint archery-turn-hint">
          {pendingShot
            ? `${pendingShot.name} décoche sa flèche...`
            : haveIShot
              ? "Flèche tirée — en attente des autres..."
              : isMeActive
                ? "Touche pour viser, glisse vers le bas pour bander l'arc, relâche pour tirer."
                : `En attente de ${activePlayer.name}...`}
        </div>
      )}

      {resolved && (
        <div className="modal-overlay">
          <div className="modal-card archery-results-card">
            <div className="glyph">🏹</div>
            <div className="modal-title">Classement</div>
            <div className="players-list archery-results-list">
              {r!.archeryRanking!.map((entry) => (
                <div className="player-chip" key={entry.slug}>
                  <span className="pname">
                    {ordinal(entry.rank)} — {entry.name}
                  </span>
                  <span className="pmeta">
                    à {entry.distance} du centre
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
  // One continuous gesture serves both roles: dragging around (in any
  // direction, from anywhere — same "start wherever you land" freedom as
  // golf's pull) repositions the aim reticle live, same as before. The
  // instant that drag has gone ARCHERY_AIM_DEADZONE units *straight down*
  // from where it started, the reticle freezes right there and every
  // further bit of downward travel instead charges the bowstring's draw
  // power, shown by the bow gauge anchored below the target. Releasing
  // fires at whatever the frozen aim was, at the power reached — unless
  // that power never cleared ARCHERY_CANCEL_POWER, in which case nothing
  // is sent and the player can just try again, mirroring golf's own
  // release-zone cancel.
  const [aim, setAim] = useState<ArcheryPoint>(ARCHERY_CENTER);
  const [drawing, setDrawing] = useState(false);
  const [power, setPower] = useState(0);
  const startRef = useRef<ArcheryPoint | null>(null);
  const drawingRef = useRef(false);

  const [animPos, setAnimPos] = useState<ArcheryPoint | null>(() => pendingShot?.path[0] ?? null);

  useEffect(() => {
    if (!pendingShot) return;
    const path = pendingShot.path;
    const DURATION_MS = 550;
    const start = performance.now();
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      if (t >= 1) {
        setAnimPos(path[path.length - 1]);
        holdTimer = setTimeout(onShotAnimDone, 550);
        return;
      }
      const idx = Math.min(path.length - 1, Math.floor(t * (path.length - 1)));
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

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || busy) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toBoardSpace(e.clientX, e.clientY, svgRef.current!);
    startRef.current = p;
    drawingRef.current = false;
    setDrawing(false);
    setPower(0);
    setAim(clampToTarget(p));
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || busy || !startRef.current) return;
    const p = toBoardSpace(e.clientX, e.clientY, svgRef.current!);
    const dy = p.y - startRef.current.y;
    if (!drawingRef.current && dy > ARCHERY_AIM_DEADZONE) {
      drawingRef.current = true;
      setDrawing(true);
    }
    if (drawingRef.current) {
      const pull = Math.max(0, Math.min(ARCHERY_MAX_PULL, dy - ARCHERY_AIM_DEADZONE));
      setPower(pull / ARCHERY_MAX_PULL);
    } else {
      setAim(clampToTarget(p));
    }
  }

  function handlePointerUp() {
    if (!interactive || busy || !startRef.current) return;
    if (drawingRef.current && power >= ARCHERY_CANCEL_POWER) {
      onFire(aim, power);
    }
    startRef.current = null;
    drawingRef.current = false;
    setDrawing(false);
    setPower(0);
  }

  const wouldCancel = drawing && power > 0 && power < ARCHERY_CANCEL_POWER;

  return (
    <div className="archery-board-wrap">
      <svg
        ref={svgRef}
        className="archery-board"
        viewBox={`0 0 ${ARCHERY_TARGET_SIZE} ${ARCHERY_BOARD_HEIGHT}`}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <rect x={0} y={0} width={ARCHERY_TARGET_SIZE} height={ARCHERY_BOARD_HEIGHT} className="archery-backdrop" />
        {ARCHERY_RINGS.map((ring) => (
          <circle
            key={ring.cls}
            cx={ARCHERY_CENTER.x}
            cy={ARCHERY_CENTER.y}
            r={ring.r}
            className={`archery-ring archery-ring-${ring.cls}`}
          />
        ))}
        <circle cx={ARCHERY_LAUNCH_POINT.x} cy={ARCHERY_LAUNCH_POINT.y} r={6} className="archery-archer" />

        {players.map((p, i) => {
          if (pendingShot?.slug === p.slug) return null;
          const pos = impacts[p.slug];
          if (!pos) return null;
          return <ArrowMark key={p.slug} pos={pos} color={ARROW_COLORS[i % ARROW_COLORS.length]} />;
        })}

        {pendingShot && animPos && (
          <ArrowMark
            pos={animPos}
            color={ARROW_COLORS[players.findIndex((p) => p.slug === pendingShot.slug) % ARROW_COLORS.length]}
            moving
          />
        )}

        {interactive && (
          <g className="archery-reticle" transform={`translate(${aim.x} ${aim.y})`}>
            <circle r={16} className="archery-reticle-ring" />
            <line x1={-22} y1={0} x2={22} y2={0} className="archery-reticle-cross" />
            <line x1={0} y1={-22} x2={0} y2={22} className="archery-reticle-cross" />
          </g>
        )}

        {interactive && <BowGauge power={power} wouldCancel={wouldCancel} />}
      </svg>
    </div>
  );
}

// A bow, fixed at ARCHERY_BOW_ANCHOR regardless of where the draw gesture
// started, whose string sags further down as `power` climbs — the visual
// stand-in for a power gauge the spec asked for, themed to match. Rests
// flat (string flush with the limb tips) at power 0 so an interactive
// turn always shows the player where to look, even before they've
// touched the screen.
function BowGauge({ power, wouldCancel }: { power: number; wouldCancel: boolean }) {
  const anchor = ARCHERY_BOW_ANCHOR;
  const leftTip = { x: anchor.x - 45, y: anchor.y };
  const rightTip = { x: anchor.x + 45, y: anchor.y };
  const belly = { x: anchor.x, y: anchor.y - 18 };
  const nock = { x: anchor.x, y: anchor.y + power * 45 };
  const color = wouldCancel ? "#8a8a96" : `hsl(${340 - power * 40}, 80%, ${60 + power * 15}%)`;

  return (
    <g className="archery-bow">
      <path
        d={`M ${leftTip.x} ${leftTip.y} Q ${belly.x} ${belly.y} ${rightTip.x} ${rightTip.y}`}
        className="archery-bow-limb"
      />
      <path
        d={`M ${leftTip.x} ${leftTip.y} L ${nock.x} ${nock.y} L ${rightTip.x} ${rightTip.y}`}
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {power > 0 && (
        <line x1={nock.x} y1={nock.y} x2={nock.x} y2={nock.y - 16} stroke={color} strokeWidth={3} strokeLinecap="round" />
      )}
      {wouldCancel && (
        <text x={anchor.x} y={anchor.y - 30} textAnchor="middle" className="archery-cancel-label">
          Relâcher pour annuler
        </text>
      )}
    </g>
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
