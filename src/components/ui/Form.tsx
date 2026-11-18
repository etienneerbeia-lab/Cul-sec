"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { haptic } from "@/lib/haptics";

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" autoComplete="off" autoCorrect="off" spellCheck={false} {...props} className={`cs-input ${props.className ?? ""}`} />;
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="cs-chip flex-1"
          aria-pressed={o.value === value}
          onClick={() => {
            haptic("select");
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  format = (v) => String(v),
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => ReactNode;
}) {
  const btn =
    "grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-2xl font-bold transition active:scale-90 disabled:opacity-30";
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        aria-label="Moins"
        onClick={() => {
          haptic("select");
          onChange(value - 1);
        }}
      >
        −
      </button>
      <span className="min-w-[2.5ch] text-center font-display text-2xl font-extrabold tabular-nums">{format(value)}</span>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        aria-label="Plus"
        onClick={() => {
          haptic("select");
          onChange(value + 1);
        }}
      >
        +
      </button>
    </div>
  );
}

// Grande option sélectionnable (vote, choix de règle...).
export function OptionCard({
  selected,
  onClick,
  disabled,
  children,
  className = "",
}: {
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        haptic("select");
        onClick();
      }}
      className={`cs-card w-full px-5 py-5 text-left text-[1.05rem] font-semibold leading-snug transition active:scale-[0.98] disabled:opacity-50 ${
        selected ? "border-neon! bg-neon/15! shadow-[0_0_30px_-10px_rgba(255,61,139,0.9)]" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
