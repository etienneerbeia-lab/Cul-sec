import { valueLabel } from "@/lib/game/cards";
import { bestOf7, handLabel5 } from "@/lib/game/evaluate";
import { roundTypeById } from "@/lib/game/roundTypes";
import type { GameState } from "@/lib/game/types";
import PlayingCard from "../PlayingCard";

export default function ShowdownScreen({
  game,
  isHost,
  busy,
  onNextRound,
  onEndNight,
}: {
  game: GameState;
  isHost: boolean;
  busy: boolean;
  onNextRound: () => void;
  onEndNight: () => void;
}) {
  const r = game.lastResults!;
  const foldedPlayers = game.playersPublic.filter((p) => p.folded);

  return (
    <>
      {r.type === "duel" ? (
        <>
          <h2>Duel éclair</h2>
          <div className="community-row">
            {Object.entries(r.cards!).map(([name, card]) => (
              <PlayingCard key={name} card={card} small />
            ))}
          </div>
          {r.tie ? (
            <div className="subtitle">
              {r.names![0]} et {r.names![1]} tirent la même carte. Les deux boivent 1 🥃.
            </div>
          ) : (
            <div className="subtitle">
              {r.winner} bat {r.loser}. {r.loser} boit 2 🥃.
            </div>
          )}
        </>
      ) : r.soleSurvivor ? (
        <>
          <h2>Tout le monde s&apos;est couché</h2>
          <div className="subtitle">{r.winners![0]} remporte la manche.</div>
        </>
      ) : r.type === "holdem" ? (
        <>
          <h2>Showdown</h2>
          <div className="subtitle">Pot final : {r.potAtEnd} 🥃, réparti entre les perdants.</div>
          <div className="community-row">
            {game.community!.map((c, i) => (
              <PlayingCard key={i} card={c} small />
            ))}
          </div>
          <div className="players-list">
            {Object.entries(r.hands!).map(([name, hand]) => {
              const isW = r.winners!.includes(name);
              const evalHand = bestOf7([...hand, ...game.community!]);
              return (
                <div className="player-chip" key={name}>
                  <div>
                    <div className="pname">{name}</div>
                    <div className="pmeta">
                      {(isW ? "Gagne — " : `Boit ${r.share} — `) + handLabel5(evalHand)}
                    </div>
                  </div>
                  <div className="community-row" style={{ margin: 0 }}>
                    {hand.map((c, i) => (
                      <PlayingCard key={i} card={c} small />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="mode-label">{roundTypeById(r.type).label}</div>
          <h2>Showdown</h2>
          <div className="subtitle">Mise engagée : {r.betAmount} 🥃 pour les perdants.</div>
          <div className="players-list">
            {Object.entries(r.hands!).map(([name, hand]) => {
              const isW = r.winners!.includes(name);
              const card = hand[0];
              return (
                <div className="player-chip" key={name}>
                  <div>
                    <div className="pname">{name}</div>
                    <div className="pmeta">{isW ? "Gagne la manche" : `Boit ${r.betAmount} 🥃`}</div>
                  </div>
                  <div className={card.suit.color === "red" ? "pcard suit-red" : "pcard suit-black"}>
                    {valueLabel(card.value)}
                    {card.suit.sym}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {foldedPlayers.length > 0 && (
        <>
          <h3>Couchés</h3>
          <div className="players-list">
            {foldedPlayers.map((p) => (
              <div className="player-chip folded" key={p.slug}>
                <span className="pname">{p.name}</span>
                <span className="pmeta">Boit {p.foldCost || 1} 🥃</span>
              </div>
            ))}
          </div>
        </>
      )}

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
  );
}
