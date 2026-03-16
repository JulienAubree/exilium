interface IconProps {
  className?: string;
  size?: number;
}

export function MineraiIcon({ className = '', size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2L3 9l3 11h12l3-11L12 2z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M12 2L3 9l3 11h12l3-11L12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 2v7M3 9h18M6 20l6-11 6 11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function SiliciumIcon({ className = '', size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 3l7 4v10l-7 4-7-4V7l7-4z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M12 3l7 4v10l-7 4-7-4V7l7-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v18M5 7l7 4 7-4M5 17l7-4 7 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function HydrogeneIcon({ className = '', size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="8"
        cy="10"
        r="4"
        fill="currentColor"
        opacity="0.2"
      />
      <circle
        cx="16"
        cy="10"
        r="4"
        fill="currentColor"
        opacity="0.2"
      />
      <circle cx="8" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M11.5 10h1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="21"
        textAnchor="middle"
        fill="currentColor"
        fontSize="6"
        fontWeight="bold"
        fontFamily="monospace"
      >
        H₂
      </text>
    </svg>
  );
}
