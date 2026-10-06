import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-sm tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mark)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--mark)] hover:text-[var(--bg)]",
        outline:
          "border border-[var(--line)] bg-transparent text-[var(--fg)] hover:border-[var(--mark)] hover:text-[var(--mark)]",
        ghost: "text-[var(--muted)] hover:text-[var(--fg)]",
        mark: "border border-[var(--mark)] text-[var(--mark)] hover:bg-[var(--mark)] hover:text-[var(--bg)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
