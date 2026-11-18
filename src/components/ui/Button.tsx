"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { haptic, type Haptic } from "@/lib/haptics";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "lg",
  block = true,
  haptics = "tap",
  className = "",
  onClick,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "lg" | "sm";
  block?: boolean;
  haptics?: Haptic | false;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`cs-btn cs-btn-${variant} ${size === "sm" ? "cs-btn-sm" : ""} ${block ? "cs-btn-block" : ""} ${className}`}
      onClick={(e) => {
        if (haptics) haptic(haptics);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        haptic("tap");
        onClick();
      }}
      className={`grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.07] text-lg text-ink-2 transition active:scale-90 ${className}`}
    >
      {children}
    </button>
  );
}
