"use client";

import { useState } from "react";
import { CLUE_REVEAL_MS } from "@/lib/game/types";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Form";
import { TimerBar, Verdict, Waiting } from "../ui/Feedback";
import { Card, Kicker, Screen } from "../ui/Layout";
import { Avatar, cleanName, PlayerRow } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

const OUTCOME: Record<string, string> = {
  caught_direct: "Imposteur démasqué !",
  caught_wrong_guess: "Mister White démasqué… et il se trompe de mot !",
  caught_correct_guess: "Mister White démasqué… mais il trouve le mot !",
  survived: "L'imposteur a survécu jusqu'au bout !",
};

export default function UndercoverScreen() {
  const { game, mySlug, busy, act, myUndercoverWord } = useGame();
  const u = game.undercover!;
  const done = game.phase === "showdown";
  const [shown, setShown] = useState(false);
  const [text, setText] = useState("");
  const name = (slug: string) => game.playersPublic.find((p) => p.slug === slug)?.name ?? slug;
  const eliminated = u.eliminatedSlugs.includes(mySlug);

  // Indices groupés par joueur, dans l'ordre de parole.
  const byPlayer = new Map<string, string[]>();
  u.clues.forEach((c) => byPlayer.set(c.slug, [...(byPlayer.get(c.slug) ?? []), c.text]));

  const clueList = (
    <div className="mt-4 flex flex-col gap-2">
      <Kicker className="px-1">Indices</Kicker>
      {game.playersPublic
        .filter((p) => byPlayer.has(p.slug) || u.remainingSlugs.includes(p.slug))
        .map((p) => (
          <PlayerRow
            key={p.slug}
            name={p.name}
            slug={p.slug}
            me={p.slug === mySlug}
            dim={u.eliminatedSlugs.includes(p.slug)}
            active={!done && game.phase === "undercoverClue" && u.clueOrder[u.cluePointer] === p.slug && u.revealUntil === undefined}
            detail={(byPlayer.get(p.slug) ?? []).map((t) => `« ${t} »`).join("  ·  ") || "…"}
          />
        ))}
    </div>
  );

  if (done) {
    const r = game.lastResults!;
    return (
      <Screen actions={<NextRoundActions />}>
        <Verdict tone={r.undercoverOutcome === "survived" || r.undercoverOutcome === "caught_correct_guess" ? "bad" : "good"}>
          {OUTCOME[r.undercoverOutcome ?? "survived"]}
        </Verdict>
        <Card className="mt-4 text-center">
          <Kicker>Le mot des civils</Kicker>
          <div className="font-display text-3xl font-extrabold">{r.undercoverWord}</div>
          <div className="mt-3 text-ink-2">
            {cleanName(r.undercoverImpostorName ?? "")} était{" "}
            {r.undercoverIsMisterWhite ? (
              <b>Mister White</b>
            ) : (
              <>
                l&apos;Undercover avec <b>{r.undercoverImpostorWord}</b>
              </>
            )}
            {r.undercoverGuessText && <> · il a proposé « {r.undercoverGuessText} »</>}
          </div>
        </Card>
        {clueList}
        <div className="mt-5">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
        </div>
      </Screen>
    );
  }

  const wordCard = (
    <button
      type="button"
      onClick={() => setShown((s) => !s)}
      className="cs-card w-full p-4 text-center transition active:scale-[0.98]"
    >
      <Kicker>Ton mot secret {shown ? "· touche pour cacher" : "· touche pour voir"}</Kicker>
      <div className={`mt-1 font-display text-3xl font-extrabold transition ${shown ? "" : "blur-md select-none"}`}>
        {myUndercoverWord ?? "Tu es Mister White 🤫"}
      </div>
      {shown && !myUndercoverWord && <div className="mt-1 text-sm text-ink-2">Pas de mot : écoute les autres et bluffe !</div>}
    </button>
  );

  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (game.phase === "undercoverClue") {
    const speaker = u.clueOrder[u.cluePointer];
    const last = u.clues[u.clues.length - 1];
    if (u.revealUntil !== undefined && last) {
      body = (
        <Card key={u.clues.length} className="animate-pop mt-4 border-cyan/40! text-center">
          <Kicker>{cleanName(last.name)} a dit</Kicker>
          <div className="my-2 font-display text-[2rem] font-extrabold leading-tight">« {last.text} »</div>
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={CLUE_REVEAL_MS} label={false} />
        </Card>
      );
      actions = (
        <Button variant="secondary" disabled={busy} onClick={() => act({ type: "ucAdvance" })}>
          Suivant
        </Button>
      );
    } else if (speaker === mySlug) {
      actions = (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              act({ type: "ucClue", text: text.trim() });
              setText("");
            }
          }}
        >
          <TextField value={text} maxLength={40} placeholder="Ton indice (un mot ou deux)" enterKeyHint="send" onChange={(e) => setText(e.target.value)} />
          <Button
            disabled={busy || !text.trim()}
            onClick={() => {
              act({ type: "ucClue", text: text.trim() });
              setText("");
            }}
          >
            Donner mon indice
          </Button>
        </form>
      );
      body = <Note>À toi : dis ton indice à voix haute et tape-le, sans jamais dire le mot.</Note>;
    } else {
      body = (
        <div className="mt-4">
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={60000} />
        </div>
      );
      actions = <Waiting>{eliminated ? "Tu es éliminé, observe…" : `${cleanName(name(speaker))} cherche un indice…`}</Waiting>;
    }
  } else if (game.phase === "undercoverVote") {
    const voted = u.voteResponded.includes(mySlug);
    const pool = (u.tieBreakCandidates ?? u.remainingSlugs).filter((s) => s !== mySlug);
    body = (
      <div className="mt-4">
        {u.tieBreakCandidates && <Note>Égalité ! Revote entre {u.tieBreakCandidates.map((s) => cleanName(name(s))).join(" et ")}.</Note>}
        <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={45000} />
        {!eliminated && !voted && (
          <div className="mt-3 flex flex-col gap-2">
            <Kicker className="px-1">Qui est l&apos;imposteur ?</Kicker>
            {pool.map((s) => (
              <PlayerRow key={s} name={name(s)} slug={s} disabled={busy} onClick={() => act({ type: "ucVote", targetSlug: s })} right={<span>🎯</span>} />
            ))}
          </div>
        )}
      </div>
    );
    actions = eliminated ? (
      <Waiting>Tu es éliminé : les autres votent…</Waiting>
    ) : voted ? (
      <Waiting>
        Vote enregistré · {u.voteResponded.length}/{u.remainingSlugs.length}
      </Waiting>
    ) : (
      <p className="text-center text-sm text-mute">Discutez à voix haute, puis votez.</p>
    );
  } else if (game.phase === "undercoverGuess") {
    const iAmMw = myUndercoverWord === null && !eliminated;
    body = (
      <Card className="mt-4 text-center">
        <div className="text-4xl">🤫</div>
        <div className="font-display text-xl font-extrabold">Mister White est démasqué !</div>
        <p className="text-ink-2">Il a une chance de deviner le mot des civils.</p>
      </Card>
    );
    actions = iAmMw ? (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) act({ type: "ucGuess", guess: text.trim() });
        }}
      >
        <TextField value={text} maxLength={40} placeholder="Le mot des civils ?" onChange={(e) => setText(e.target.value)} />
        <Button disabled={busy || !text.trim()} onClick={() => act({ type: "ucGuess", guess: text.trim() })}>
          C&apos;est mon dernier mot
        </Button>
      </form>
    ) : (
      <Waiting>Mister White réfléchit…</Waiting>
    );
  }

  return (
    <Screen actions={actions}>
      {wordCard}
      {body}
      {clueList}
      {u.eliminatedSlugs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {u.eliminatedSlugs.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 py-1 pr-3 pl-1 text-sm text-mute line-through">
              <Avatar name={name(s)} slug={s} size={22} />
              {cleanName(name(s))}
            </span>
          ))}
        </div>
      )}
    </Screen>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-center leading-snug text-ink-2">{children}</p>;
}

