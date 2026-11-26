'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-9 w-full rounded-lg border border-[#D4CEBC] bg-[#FFFFFF] px-3 text-sm text-[#202723] placeholder:text-[#8E9690] focus:border-[#285943] focus:outline-none focus:ring-2 focus:ring-[#285943]/15 disabled:bg-[#EDE9DD] disabled:text-[#646D67]',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-9 w-full rounded-lg border border-[#D4CEBC] bg-[#FFFFFF] px-3 text-sm text-[#202723] focus:border-[#285943] focus:outline-none focus:ring-2 focus:ring-[#285943]/15 disabled:bg-[#EDE9DD]',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-lg border border-[#D4CEBC] bg-[#FFFFFF] px-3 py-2 text-sm text-[#202723] placeholder:text-[#8E9690] focus:border-[#285943] focus:outline-none focus:ring-2 focus:ring-[#285943]/15',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function FieldLabel({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-[#202723] tracking-tight"
      >
        {children}
      </label>
      {hint && <span className="text-[11px] text-[#646D67]">{hint}</span>}
    </div>
  );
}
