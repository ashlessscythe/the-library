import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[120px] w-full border border-[var(--line)] bg-[var(--panel)] px-3 py-2 font-mono text-sm text-[var(--fg)] placeholder:text-[var(--dim)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mark)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
