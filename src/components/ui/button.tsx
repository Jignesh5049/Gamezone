'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'charcoal' | 'outline' | 'ghost' | 'danger' | 'amber';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#285943] text-[#FCFBF7] hover:bg-[#214A37] border border-[#285943] shadow-[0_1px_2px_rgba(30,36,32,0.05)]',
  charcoal:
    'bg-[#1E2420] text-[#FCFBF7] hover:bg-[#2B342E] border border-[#1E2420] shadow-[0_1px_2px_rgba(30,36,32,0.05)]',
  outline:
    'bg-[#FCFBF7] text-[#1E2420] hover:bg-[#EDE9DD] border border-[#1E2420]/15',
  ghost:
    'bg-transparent text-[#525B55] hover:bg-[#EDE9DD] hover:text-[#1E2420] border border-transparent',
  danger:
    'bg-[#C65D50] text-[#FCFBF7] hover:bg-[#B14D41] border border-[#C65D50] shadow-[0_1px_2px_rgba(30,36,32,0.05)]',
  amber:
    'bg-[#D89B45] text-[#1E2420] hover:bg-[#C58A37] border border-[#D89B45] shadow-[0_1px_2px_rgba(30,36,32,0.05)]',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'h-8 px-3 text-xs rounded-[6px] gap-1',
  sm: 'h-8 px-3 text-xs rounded-[8px] gap-2',
  md: 'h-9 px-4 text-sm rounded-[8px] gap-2',
  lg: 'h-10 px-5 text-sm rounded-[8px] gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-[color,background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
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
