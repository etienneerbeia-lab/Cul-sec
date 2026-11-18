import type { ReactNode } from "react";

const PALETTE = [
  ["#ff3d8b", "#b51f63"],
  ["#9b6bff", "#5d34c9"],
  ["#45e3ff", "#1d8fb8"],
  ["#ff9f43", "#c9631a"],
  ["#9ff27a", "#4e9e2e"],
  ["#ffc94d", "#c98e12"],
  ["#ff6a5c", "#b3352a"],
  ["#5ce1b0", "#1f8f69"],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function playerColor(slug: string): string {
  return PALETTE[hash(slug) % PALETTE.length][0];
}

// Les bots ont « 🤖 » dans leur nom (voir lib/bots/names.ts) : on l'affiche
// sous forme de badge plutôt que dans le texte.
export function isBotName(name: string): boolean {
  return name.endsWith(" 🤖");
}
export function cleanName(name: string): string {
  return isBotName(name) ? name.slice(0, -3) : name;
}

export function Avatar({ name, slug, size = 40 }: { name: string; slug: string; size?: number }) {
  const [a, b] = PALETTE[hash(slug) % PALETTE.length];
  const bot = isBotName(name);
  return (
    <span
      className="cs-avatar relative"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(145deg, ${a}, ${b})` }}
    >
      {bot ? "🤖" : cleanName(name).charAt(0).toUpperCase()}
    </span>
  );
}

export function PlayerName({ name, me = false }: { name: string; me?: boolean }) {
  const bot = isBotName(name);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate font-semibold">{cleanName(name)}</span>
      {me && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-2">toi</span>}
      {bot && <span className="rounded-full bg-violet/25 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-violet">bot</span>}
    </span>
  );
}

// Ligne joueur réutilisable : avatar, nom, détail, et un élément à droite.
export function PlayerRow({
  name,
  slug,
  me,
  detail,
  right,
  active,
  dim,
  onClick,
  disabled,
  selected,
}: {
  name: string;
  slug: string;
  me?: boolean;
  detail?: ReactNode;
  right?: ReactNode;
  active?: boolean;
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const content = (
    <>
      <Avatar name={name} slug={slug} />
      <span className="flex min-w-0 flex-1 flex-col items-start text-left">
        <PlayerName name={name} me={me} />
        {detail && <span className="truncate text-[0.82rem] text-mute">{detail}</span>}
      </span>
      {right}
    </>
  );
  if (onClick)
    return (
      <button
        type="button"
        className="cs-row w-full"
        data-active={active || selected}
        data-dim={dim}
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </button>
    );
  return (
    <div className="cs-row" data-active={active} data-dim={dim}>
      {content}
    </div>
  );
}
