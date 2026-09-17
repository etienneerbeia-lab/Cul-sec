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
  onShoot: (aim: ArcheryPoint) => void;
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
        onFire={(aim) => onShoot(aim)}
      />

      {!resolved && (
        <div className="hint archery-turn-hint">
          {pendingShot
            ? `${pendingShot.name} décoche sa flèche...`
            : haveIShot
              ? "Flèche tirée — en attente des autres..."
              : isMeActive
                ? "À toi de viser — glisse ton doigt sur la cible, puis tire."
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

function toTargetSpace(clientX: number, clientY: number, svg: SVGSVGElement): ArcheryPoint {
  const rect = svg.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * ARCHERY_TARGET_SIZE;
  const y = ((clientY - rect.top) / rect.height) * ARCHERY_BOARD_HEIGHT;
  return clampToTarget({ x, y });
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
  onFire: (aim: ArcheryPoint) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Aiming here is "place a reticle, then confirm" rather than golf's
  // pull-and-release: there's no natural "power" reading to derive a
  // cancel threshold from (the reticle is an absolute point, not a pull
  // vector). Nothing is ever sent to the server until the Tirer button is
  // pressed, so freely repositioning the reticle (or just never pressing
  // the button) already covers the "cancel before it counts" need golf
  // solves with a release-zone.
  const [aim, setAim] = useState<ArcheryPoint>(ARCHERY_CENTER);
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
    setAim(toTargetSpace(e.clientX, e.clientY, svgRef.current!));
  }
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || busy || e.buttons === 0) return;
    setAim(toTargetSpace(e.clientX, e.clientY, svgRef.current!));
  }

  return (
    <div className="archery-board-wrap">
      <svg
        ref={svgRef}
        className="archery-board"
        viewBox={`0 0 ${ARCHERY_TARGET_SIZE} ${ARCHERY_BOARD_HEIGHT}`}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
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
      </svg>

      {interactive && (
        <button className="btn-primary archery-fire-btn" disabled={busy} onClick={() => onFire(aim)}>
          Tirer 🏹
        </button>
      )}
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
