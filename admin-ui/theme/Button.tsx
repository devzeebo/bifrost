import { tailwind } from "./tailwind";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = {
  Default: tailwind(
    "button",
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ) as (props: ButtonProps) => React.ReactNode,
  Primary: tailwind(
    "button",
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--accent)] text-white hover:opacity-90 focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ) as (props: ButtonProps) => React.ReactNode,
  Danger: tailwind(
    "button",
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--danger)] text-white hover:opacity-90 focus:outline-2 focus:outline-[var(--danger)] focus:outline-offset-2",
  ) as (props: ButtonProps) => React.ReactNode,
  Success: tailwind(
    "button",
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors bg-[var(--success)] text-white hover:opacity-90 focus:outline-2 focus:outline-[var(--success)] focus:outline-offset-2",
  ) as (props: ButtonProps) => React.ReactNode,
  Small: tailwind(
    "button",
    "inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded cursor-pointer transition-colors bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] focus:outline-2 focus:outline-[var(--accent)] focus:outline-offset-2",
  ) as (props: ButtonProps) => React.ReactNode,
} as const;
