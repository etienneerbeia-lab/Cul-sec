import { valueLabel } from "@/lib/game/cards";
import { bestOf7, handLabel5 } from "@/lib/game/evaluate";
import { roundTypeById } from "@/lib/game/roundTypes";
import type { GameState } from "@/lib/game/types";
import PlayingCard from "../PlayingCard";

// Note: "duel" and "dice" results never reach this component — GameApp
// keeps each on its own screen (DuelRevealScreen / DiceScreen) for its
// whole lifecycle so the revealed cards / rolls never disappear behind a
// screen change. Every other round type still resolves here as before.

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
      {r.type === "vote" ? (
        <>
          <h2>Tu préfères...</h2>
          <div className="vote-result-labels">
            <span>{r.promptA}</span>
            <span>{r.promptB}</span>
          </div>
          <div className="vote-result-bar">
            {r.countA! > 0 && (
              <div className="vrb-a" style={{ flex: r.countA }} />
            )}
            {r.countB! > 0 && (
              <div className="vrb-b" style={{ flex: r.countB }} />
            )}
          </div>
          <div className="subtitle">
            {r.voteTie
              ? `Égalité parfaite (${r.countA}-${r.countB}) : personne ne boit.`
              : `${r.countA} contre ${r.countB} — le camp minoritaire boit 2 🥃.`}
          </div>
          <div className="players-list">
            {r.voteEntries!.map((entry) => (
              <div className="player-chip" key={entry.name}>
                <span className="pname">{entry.name}</span>
                <span className="pmeta">
                  {entry.choice === "A" ? r.promptA : r.promptB}
                  {!r.voteTie &&
                    ((entry.choice === "A" && r.countA! < r.countB!) ||
                      (entry.choice === "B" && r.countB! < r.countA!)) &&
                    " — Boit 2 🥃"}
                </span>
              </div>
            ))}
            {r.voteNonVoters!.map((name) => (
              <div className="player-chip folded" key={name}>
                <span className="pname">{name}</span>
                <span className="pmeta">N&apos;a pas voté à temps</span>
              </div>
            ))}
          </div>
        </>
      ) : r.type === "meme" ? (
        <>
          <h2>Make It Meme</h2>
          <img className="meme-image" src={r.memeUrl} alt="Mème" />
          <div className="players-list">
            {r.memeTallies!.map((t) => {
              const isLoser = r.memeLeastFunny!.includes(t.name);
              return (
                <div className="player-chip" key={t.slug}>
                  <div>
                    <div className="pname">{t.name}</div>
                    <div className="pmeta">{t.caption}</div>
                  </div>
                  <span className="pmeta">
                    {t.votes} vote{t.votes !== 1 ? "s" : ""}
                    {isLoser && " — Boit 2 🥃"}
                  </span>
                </div>
              );
            })}
            {r.memeNoCaptioners!.map((name) => (
              <div className="player-chip folded" key={name}>
                <span className="pname">{name}</span>
                <span className="pmeta">N&apos;a pas écrit de légende</span>
              </div>
            ))}
          </div>
        </>
      ) : r.type === "undercover" ? (
        <>
          <h2>Undercover</h2>
          <div className="uc-word-banner">
            <div className="uc-word-label">Le mot secret était</div>
            <div className="uc-word-value">{r.undercoverWord}</div>
          </div>
          <div className="subtitle">
            {r.undercoverImpostorName} était l&apos;imposteur
            {r.undercoverIsMisterWhite
              ? " (Mister White, sans mot)"
              : ` (Undercover, avec le mot "${r.undercoverImpostorWord}")`}
            .
          </div>

          {r.undercoverOutcome === "caught_correct_guess" && (
            <div className="subtitle">
              Démasqué, {r.undercoverImpostorName} a deviné le mot avec &quot;{r.undercoverGuessText}
              &quot; ! Personne ne boit.
            </div>
          )}
          {r.undercoverOutcome === "caught_wrong_guess" && (
            <div className="subtitle">
              Démasqué, {r.undercoverImpostorName} a proposé &quot;{r.undercoverGuessText}&quot; — raté.
              Boit 2 🥃.
            </div>
          )}
          {r.undercoverOutcome === "caught_direct" && (
            <div className="subtitle">Démasqué directement, {r.undercoverImpostorName} boit 2 🥃.</div>
          )}
          {r.undercoverOutcome === "survived" && (
            <div className="subtitle">
              Jamais démasqué ! Tout le monde sauf {r.undercoverImpostorName} boit 2 🥃.
            </div>
          )}
          {r.undercoverTieBreakByLottery && (
            <div className="hint">Le dernier vote était à égalité — tranché au tirage au sort.</div>
          )}

          {r.undercoverOutcome === "survived" && (
            <div className="players-list">
              {game.playersPublic
                .filter((p) => p.name !== r.undercoverImpostorName)
                .map((p) => (
                  <div className="player-chip" key={p.slug}>
                    <span className="pname">{p.name}</span>
                    <span className="pmeta">Boit 2 🥃</span>
                  </div>
                ))}
            </div>
          )}

          {r.undercoverEliminationOrder!.length > 0 && (
            <>
              <h3>Éliminés en cours de manche</h3>
              <div className="players-list">
                {r.undercoverEliminationOrder!.map((name) => (
                  <div className="player-chip folded" key={name}>
                    <span className="pname">{name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {r.undercoverClues!.length > 0 && (
            <>
              <h3>Indices donnés</h3>
              <div className="players-list">
                {r.undercoverClues!.map((c, i) => (
                  <div className="player-chip" key={i}>
                    <span className="pname">{c.name}</span>
                    <span className="pmeta">{c.text}</span>
                  </div>
                ))}
              </div>
            </>
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
