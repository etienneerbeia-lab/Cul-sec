import type { Card, GameState, Street } from "@/lib/game/types";
import MyHandBlock from "../MyHandBlock";
import PlayingCard from "../PlayingCard";

const LABELS: Partial<Record<Street, string>> = {
  flop: "Le flop",
  turn: "Le turn",
  river: "La river",
};

export default function CommunityRevealScreen({
  game,
  myHand,
  isHost,
  busy,
  onContinue,
}: {
  game: GameState;
  myHand: Card[] | null;
  isHost: boolean;
  busy: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      <h2>{(game.street && LABELS[game.street]) || "Cartes communes"}</h2>
      <div className="subtitle">Pot actuel : {game.pot} 🥃</div>
      <div className="community-row">
        {game.community!.slice(0, game.communityRevealed).map((c, i) => (
          <PlayingCard key={i} card={c} small />
        ))}
      </div>
      <MyHandBlock myHand={myHand} />
      <div className="spacer" />
      {isHost ? (
        <button className="btn-primary" disabled={busy} onClick={onContinue}>
          Continuer la mise
        </button>
      ) : (
        <div className="hint">En attente de l&apos;hôte...</div>
      )}
    </>
  );
}
