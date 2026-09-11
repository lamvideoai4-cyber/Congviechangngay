import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[opacity,transform,background-color] duration-150 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] min-h-12 px-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-surface-2 text-fg shadow-[var(--shadow-border)]",
        outline: "bg-transparent text-fg shadow-[var(--shadow-border)]",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        danger: "bg-danger text-fg",
        ok: "bg-ok text-bg",
      },
      size: {
        default: "h-12",
        sm: "h-10 min-h-10 px-3 text-sm",
        lg: "h-14 min-h-14 px-5 text-base",
        icon: "size-12 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
