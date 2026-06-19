import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-continental-yellow/70 disabled:pointer-events-none disabled:opacity-60 gap-2 shadow-sm',
  {
    variants: {
      variant: {
        default: 'bg-continental-gradient text-white shadow-lg shadow-continental-yellow/40 hover:opacity-90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-continental-gray-3 bg-white hover:bg-continental-gray-4/60 text-continental-black',
        secondary: 'bg-continental-gray-4 text-continental-black hover:bg-continental-gray-3',
        ghost: 'text-continental-gray-1 hover:bg-continental-gray-4/80',
        link: 'text-continental-blue-dark underline-offset-4 hover:underline',
        success: 'bg-continental-green text-white shadow hover:bg-continental-green-dark',
        warning: 'bg-continental-yellow text-continental-black shadow hover:bg-continental-yellow/90',
      },
      size: {
        default: 'min-h-[3.6rem] px-[26px] py-3.5 text-base',
        sm: 'min-h-[3.1rem] rounded-lg px-[22px] py-3 text-sm',
        lg: 'min-h-[4rem] rounded-xl px-[30px] py-4 text-lg',
        icon: 'h-12 w-12 p-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    const isIcon = size === 'icon';
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        data-icon={isIcon ? 'true' : undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Cargando...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
