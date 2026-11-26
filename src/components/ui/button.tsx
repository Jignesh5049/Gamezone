'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'charcoal' | 'outline' | 'ghost' | 'danger' | 'amber';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#285943] text-[#FCFBF7] hover:bg-[#214a37] border border-[#285943] shadow-xs',
  charcoal:
    'bg-[#202723] text-[#FCFBF7] hover:bg-[#2d3631] border border-[#202723] shadow-xs',
  outline:
    'bg-[#FCFBF7] text-[#202723] hover:bg-[#EDE9DD] border border-[#D4CEBC]',
  ghost: 'bg-transparent text-[#202723] hover:bg-[#EDE9DD] border border-transparent',
  danger:
    'bg-[#C65D50] text-[#FCFBF7] hover:bg-[#b14d41] border border-[#C65D50] shadow-xs',
  amber:
    'bg-[#D89B45] text-[#202723] hover:bg-[#c58a37] border border-[#D89B45] font-semibold shadow-xs',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-md gap-1',
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-10 px-5 text-sm rounded-lg gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
