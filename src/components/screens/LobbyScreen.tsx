import type { Player } from "@/lib/game/types";

export default function LobbyScreen({
  roomCode,
  players,
  mySlug,
  isHost,
  busy,
  error,
  onLaunch,
}: {
  roomCode: string;
  players: Player[];
  mySlug: string;
  isHost: boolean;
  busy: boolean;
  error: string;
  onLaunch: () => void;
}) {
  const enough = players.length >= 3;
  return (
    <>
      <label className="field-label">Code de la partie</label>
      <div className="pass-name">{roomCode}</div>
      <div className="hint">
        Donne ce code à tes amis pour qu&apos;ils rejoignent depuis leur téléphone.
      </div>

      <h3>Joueurs connectés</h3>
      <div className="players-list">
        {players.map((p) => (
          <div className="player-chip" key={p.slug}>
            <span className="pname">
              {p.name}
              {p.slug === mySlug ? " (toi)" : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="spacer" />
      {error && <div className="hint error-text">{error}</div>}
      {isHost ? (
        <>
          <button className="btn-primary" disabled={!enough || busy} onClick={onLaunch}>
            Lancer la partie
          </button>
          {!enough && <div className="hint">Il faut au moins 3 joueurs pour commencer.</div>}
        </>
      ) : (
        <div className="hint">En attente que l&apos;hôte lance la partie...</div>
      )}
    </>
  );
}
