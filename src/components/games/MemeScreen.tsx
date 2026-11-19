"use client";

/* eslint-disable @next/next/no-img-element -- images de mèmes hébergées par Imgflip, pas d'optimisation */
import { useEffect, useRef, useState } from "react";
import { serverNow } from "@/lib/clock";
import { MEME_CAPTION_MS, MEME_VOTE_MS } from "@/lib/game/types";
import { useGame } from "../GameContext";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Form";
import { TimerBar, Waiting } from "../ui/Feedback";
import { Kicker, Screen } from "../ui/Layout";
import { cleanName } from "../ui/Players";
import { GulpList, NextRoundActions, sumGulps } from "../ui/Results";

// L'image du mème avec la légende incrustée, façon générateur de mèmes.
// La place est réservée au bon format ; si l'image ne charge pas, on
// affiche un cadre de secours (la partie continue).
function Meme({ url, caption, ratio = 1, small = false }: { url: string; caption?: string; ratio?: number; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black"
      style={{ aspectRatio: String(ratio), maxHeight: small ? "34vh" : "42vh", maxWidth: "100%" }}
    >
      {failed ? (
        <div className="grid h-full w-full place-items-center p-4 text-center text-sm text-mute">
          Image indisponible : imagine la scène et lâche ta meilleure vanne 😅
        </div>
      ) : (
        <img src={url} alt="Mème" className="block h-full w-full object-contain" onError={() => setFailed(true)} />
      )}
      {caption && (
        <div
          className="absolute inset-x-2 bottom-2 text-center font-display font-extrabold uppercase leading-tight text-white"
          style={{
            fontSize: caption.length > 60 ? "1rem" : "1.3rem",
            textShadow: "2px 2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000, -2px -2px 0 #000, 0 3px 8px rgba(0,0,0,0.8)",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

export default function MemeScreen() {
  const { game, mySlug, busy, act } = useGame();
  const m = game.meme!;
  const done = game.phase === "showdown";
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  if (done) {
    const r = game.lastResults!;
    const tallies = r.memeTallies ?? [];
    const best = tallies[0];
    return (
      <Screen actions={<NextRoundActions />}>
        <Meme url={r.memeUrl!} ratio={m.template.width / m.template.height} caption={best?.caption} />
        {best && <p className="mt-2 text-center text-sm text-mute">🏆 Légende de {cleanName(best.name)}</p>}
        <div className="stagger mt-4 flex flex-col gap-2">
          {tallies.map((t) => (
            <div key={t.slug} className="cs-row items-start!" data-dim={(r.memeLeastFunny ?? []).includes(t.name)}>
              <div className="min-w-0 flex-1 py-1">
                <div className="font-semibold leading-snug">« {t.caption} »</div>
                <div className="text-sm text-mute">{cleanName(t.name)}</div>
              </div>
              <span className="font-display text-lg font-extrabold">{t.votes} 👍</span>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <GulpList rows={sumGulps(game, (game.drinks ?? []).map((d) => ({ slug: d.slug, gulps: d.n })))} />
        </div>
      </Screen>
    );
  }

  if (game.phase === "memeCaption") {
    const sent = m.captionResponded.includes(mySlug);
    return (
      <Screen
        actions={
          sent ? (
            <Waiting>
              Légende envoyée · {m.captionResponded.length}/{game.playersPublic.length}
            </Waiting>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) act({ type: "memeCaption", caption: draft.trim() });
              }}
            >
              <TextField value={draft} maxLength={120} placeholder="Ta légende la plus drôle…" enterKeyHint="send" onChange={(e) => setDraft(e.target.value)} />
              <Button disabled={busy || !draft.trim()} onClick={() => act({ type: "memeCaption", caption: draft.trim() })}>
                Envoyer ma légende
              </Button>
            </form>
          )
        }
      >
        <div className="mb-3">
          <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={MEME_CAPTION_MS} />
        </div>
        {m.theme && (
          <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-danger">Thème 18+ 🌶️</span>
            <div className="font-display text-[1.05rem] font-bold leading-snug">{m.theme}</div>
          </div>
        )}
        <Meme url={m.template.url} ratio={m.template.width / m.template.height} caption={sent ? undefined : draft} />
        <p className="mt-3 text-center text-sm text-mute">Le temps écoulé, ce que tu as tapé est envoyé tel quel.</p>
        <AutoSubmit draft={draft} />
      </Screen>
    );
  }

  // Vote
  const voted = m.voteResponded.includes(mySlug);
  const options = m.voteOrder.filter((s) => s !== mySlug && m.captions[s]);
  return (
    <Screen
      actions={
        voted ? (
          <Waiting>
            Vote enregistré · {m.voteResponded.length}/{game.playersPublic.length}
          </Waiting>
        ) : (
          <Button disabled={busy || !picked} haptics="success" onClick={() => act({ type: "memeVote", authorSlug: picked })}>
            Voter pour cette légende
          </Button>
        )
      }
    >
      <div className="mb-3">
        <TimerBar deadlineAt={game.timer?.deadlineAt} totalMs={MEME_VOTE_MS} />
      </div>
      <Meme small url={m.template.url} ratio={m.template.width / m.template.height} caption={picked ? m.captions[picked] : undefined} />
      <Kicker className="mt-4 mb-2 px-1">La plus drôle ?</Kicker>
      <div className="flex flex-col gap-2">
        {options.map((slug) => (
          <button
            key={slug}
            type="button"
            disabled={voted}
            onClick={() => setPicked(slug)}
            className="cs-row text-left font-semibold"
            data-active={picked === slug}
          >
            « {m.captions[slug]} »
          </button>
        ))}
        {options.length === 0 && <p className="text-center text-mute">Aucune légende des autres à juger.</p>}
      </div>
    </Screen>
  );
}

// Envoie le brouillon juste avant la fin du chrono (le serveur clôt
// ensuite pour les retardataires).
function AutoSubmit({ draft }: { draft: string }) {
  const { game, mySlug, act } = useGame();
  const deadline = game.timer?.deadlineAt;
  const sent = game.meme!.captionResponded.includes(mySlug);
  useDeadlineCallback(deadline ? deadline - 1700 : null, () => {
    if (!sent && draft.trim()) act({ type: "memeCaption", caption: draft.trim() });
  });
  return null;
}

function useDeadlineCallback(at: number | null, cb: () => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    if (!at) return;
    const t = setTimeout(() => cbRef.current(), Math.max(0, at - serverNow()));
    return () => clearTimeout(t);
  }, [at]);
}
