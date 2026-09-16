import { shuffleArr } from "../game/cards";
import type { GameState, MemeVoteTally } from "../game/types";
import { MEME_TEMPLATES } from "./templates";

export function startMemeRound(g: GameState): void {
  const template = MEME_TEMPLATES[Math.floor(Math.random() * MEME_TEMPLATES.length)];
  g.meme = {
    template,
    askedAt: Date.now(),
    captions: {},
    captionResponded: [],
    voteOrder: [],
    votes: {},
    voteResponded: [],
  };
  g.phase = "memeCaption";
}

// Called once per player as they submit their caption, or as their own
// client auto-submits an empty caption once the 60s countdown hits zero
// (same "timeout still closes out their turn" pattern as the quiz timer
// and the vote round's answer — and just like those, a timeout is never
// neutral: see resolveMemeRound, which always charges whoever has no
// caption on file). Moves to the voting phase once every player has been
// accounted for.
export function submitMemeCaption(g: GameState, slug: string, caption: string): void {
  const m = g.meme!;
  const trimmed = caption.trim().slice(0, 200);
  if (trimmed) m.captions[slug] = trimmed;
  if (!m.captionResponded.includes(slug)) m.captionResponded.push(slug);
  if (m.captionResponded.length >= g.playersPublic.length) startMemeVote(g);
}

// Host-only escape hatch for when the 60s deadline has passed but some
// player's device never checked in — treats every straggler as having
// written no caption and moves on, same idea as the vote round's reveal.
export function forceMemeCaptionEnd(g: GameState): void {
  const m = g.meme!;
  g.playersPublic.forEach((p) => {
    if (!m.captionResponded.includes(p.slug)) m.captionResponded.push(p.slug);
  });
  startMemeVote(g);
}

function startMemeVote(g: GameState): void {
  const m = g.meme!;
  const authors = Object.keys(m.captions);
  if (authors.length < 2) {
    // Not enough real captions for a contest — nobody has anything fair
    // to be judged against, so nobody drinks.
    resolveMemeRound(g);
    return;
  }
  shuffleArr(authors);
  m.voteOrder = authors;
  g.phase = "memeVote";
  // A player with nobody else's caption to judge (only possible if every
  // other player skipped) can never cast a valid vote — count them as
  // done immediately instead of leaving the round stuck waiting on them.
  g.playersPublic.forEach((p) => {
    const votable = authors.filter((slug) => slug !== p.slug);
    if (votable.length === 0 && !m.voteResponded.includes(p.slug)) {
      m.voteResponded.push(p.slug);
    }
  });
  if (m.voteResponded.length >= g.playersPublic.length) resolveMemeRound(g);
}

// Called once per player as they cast their vote. A player can vote for
// any caption except their own (enforced by the route layer, which also
// guards against double-voting) — passing a null/invalid authorSlug just
// closes out that player's turn without counting toward anyone.
export function submitMemeVote(g: GameState, voterSlug: string, authorSlug: string | null): void {
  const m = g.meme!;
  if (authorSlug && authorSlug in m.captions && authorSlug !== voterSlug) {
    m.votes[voterSlug] = authorSlug;
  }
  if (!m.voteResponded.includes(voterSlug)) m.voteResponded.push(voterSlug);
  if (m.voteResponded.length >= g.playersPublic.length) resolveMemeRound(g);
}

// Host-only escape hatch, same idea as forceMemeCaptionEnd — closes out
// anyone who hasn't voted yet without counting their vote either way.
export function forceMemeVoteEnd(g: GameState): void {
  const m = g.meme!;
  g.playersPublic.forEach((p) => {
    if (!m.voteResponded.includes(p.slug)) m.voteResponded.push(p.slug);
  });
  resolveMemeRound(g);
}

function resolveMemeRound(g: GameState): void {
  const m = g.meme!;
  const byslug = new Map(g.playersPublic.map((p) => [p.slug, p]));

  const tallies: MemeVoteTally[] = Object.entries(m.captions).map(([slug, caption]) => ({
    slug,
    name: byslug.get(slug)!.name,
    caption,
    votes: 0,
  }));
  const tallyBySlug = new Map(tallies.map((t) => [t.slug, t]));
  Object.values(m.votes).forEach((authorSlug) => {
    const t = tallyBySlug.get(authorSlug);
    if (t) t.votes += 1;
  });
  tallies.sort((a, b) => b.votes - a.votes);

  // Need at least 2 captions for "least funny" to mean anything — with a
  // single caption (or none) there was no real contest, so nobody drinks
  // *for their caption's content* (a timeout still costs 2, separately).
  let leastFunny: string[] = [];
  if (tallies.length > 1) {
    const minVotes = Math.min(...tallies.map((t) => t.votes));
    const losers = tallies.filter((t) => t.votes === minVotes);
    losers.forEach((t) => {
      byslug.get(t.slug)!.gulpsTotal += 2;
    });
    leastFunny = losers.map((t) => t.name);
  }

  // Not writing a caption in time is never neutral, same rule as every
  // other timed mini-game's timeout — always costs 2, independent of
  // whether there was even a contest to judge.
  const noCaptioners = g.playersPublic.filter((p) => !(p.slug in m.captions));
  noCaptioners.forEach((p) => {
    p.gulpsTotal += 2;
  });

  g.lastResults = {
    type: "meme",
    memeUrl: m.template.url,
    memeTallies: tallies,
    memeLeastFunny: leastFunny,
    memeNoCaptioners: noCaptioners.map((p) => p.name),
  };
  g.phase = "showdown";
}
