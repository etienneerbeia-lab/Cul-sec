export default function HomeMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
      <svg width="132" height="132" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path
          d="M32 24 L88 24 L78 96 Q76 108 60 108 Q44 108 42 96 Z"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M38 40 L82 40 L76 90 Q75 98 60 98 Q45 98 44 90 Z"
          fill="var(--gold)"
          opacity="0.18"
        />
        <line x1="45" y1="56" x2="75" y2="56" stroke="var(--gold)" strokeWidth="3" opacity="0.55" />
      </svg>
      <svg width="144" height="144" viewBox="0 0 130 130" fill="none" aria-hidden="true">
        <rect
          x="22"
          y="14"
          width="70"
          height="98"
          rx="10"
          fill="var(--cream)"
          stroke="var(--gold)"
          strokeWidth="3.5"
          transform="rotate(-8 57 63)"
        />
        <rect
          x="38"
          y="22"
          width="70"
          height="98"
          rx="10"
          fill="var(--cream)"
          stroke="var(--gold)"
          strokeWidth="3.5"
          transform="rotate(6 73 71)"
        />
        <text
          x="73"
          y="80"
          fontFamily="var(--font-fraunces), serif"
          fontSize="46"
          fill="var(--wine)"
          textAnchor="middle"
          transform="rotate(6 73 71)"
        >
          ♠
        </text>
        <text
          x="48"
          y="42"
          fontFamily="var(--font-fraunces), serif"
          fontWeight="700"
          fontSize="16"
          fill="var(--wine)"
          transform="rotate(6 73 71)"
        >
          C
        </text>
        <text
          x="48"
          y="42"
          fontFamily="var(--font-fraunces), serif"
          fontWeight="700"
          fontSize="16"
          fill="var(--wine)"
          transform="rotate(6 73 71) rotate(180 73 71)"
        >
          S
        </text>
      </svg>
    </div>
  );
}
