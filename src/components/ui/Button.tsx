import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.scss";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly children: ReactNode;
}

export function Button({ variant = "primary", size = "md", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={[styles.root, styles[variant], styles[size]].join(" ")}
    >
      {children}
    </button>
  );
}
