import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 py-2 font-mono text-sm text-[var(--fg)] placeholder:text-[var(--dim)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mark)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
