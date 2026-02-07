import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

const variants = {
  primary: "bg-blue-500 text-white hover:bg-blue-400",
  ghost: "bg-transparent text-slate-200 hover:bg-slate-800",
  outline: "border border-slate-700 text-slate-200 hover:bg-slate-800",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50",
        variants[variant],
        className
      )}
    />
  );
}
