// Lightweight inline SVG icons (stroke = currentColor) so the UI needs no icon
// dependency and stays within the app's strict content-security policy.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const BankIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 21h18M4 10h16M12 3 4 7h16l-8-4Z" />
    <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
  </svg>
);

export const WalletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
    <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const ArrowDownLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M17 7 7 17M17 17H7V7" />
  </svg>
);

export const ArrowUpRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
);

export const SwapIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h14a4 4 0 0 1 0 8h-1" />
    <path d="M17 20l4-4-4-4" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const ArrowLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const CheckCircle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const LogOutIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);
