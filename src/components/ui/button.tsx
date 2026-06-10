import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-600 shadow-sm hover:shadow-md hover:shadow-primary/20 active:scale-[0.97]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md active:scale-[0.97]",
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-foreground active:scale-[0.97]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.97]",
        ghost:
          "hover:bg-secondary hover:text-foreground active:scale-[0.97]",
        link:
          "text-primary underline-offset-4 hover:underline",
        soft:
          "bg-primary/10 text-primary hover:bg-primary/20 active:scale-[0.97]",
        gold:
          "bg-gradient-to-r from-gold-500 to-amber-500 text-white hover:from-gold-400 hover:to-amber-400 shadow-sm hover:shadow-md hover:shadow-gold-500/20 active:scale-[0.97]",
        brand:
          "bg-gradient-to-r from-brand-500 via-primary to-gold-500 text-white hover:from-brand-400 hover:via-primary-400 hover:to-gold-400 shadow-sm hover:shadow-md hover:shadow-brand-500/20 active:scale-[0.97]",
      },
      size: {
        default: "h-10 px-4 py-2 rounded-xl",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8 text-base",
        xl: "h-13 rounded-xl px-10 text-base",
        icon: "h-10 w-10 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
