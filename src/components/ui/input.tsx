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
      'h-9 w-full rounded-[8px] border border-[#1E2420]/15 bg-white px-3 text-sm text-[#1E2420] placeholder:text-[#707973] transition-[border-color,background-color] duration-150 focus:border-[#285943] focus:outline-none focus:ring-2 focus:ring-[#285943]/15 disabled:bg-[#EDE9DD] disabled:text-[#707973]',
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
      'h-9 w-full rounded-[8px] border border-[#1E2420]/15 bg-white px-3 text-sm text-[#1E2420] transition-[border-color,background-color] duration-150 focus:border-[#285943] focus:outline-none focus:ring-2 focus:ring-[#285943]/15 disabled:bg-[#EDE9DD]',
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
      'w-full rounded-[8px] border border-[#1E2420]/15 bg-white px-3 py-2 text-sm text-[#1E2420] placeholder:text-[#707973] transition-[border-color,background-color] duration-150 focus:border-[#285943] focus:outline-none focus:ring-2 focus:ring-[#285943]/15',
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
    <div className="flex items-baseline justify-between mb-2">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-[#1E2420]"
      >
        {children}
      </label>
      {hint && <span className="text-xs text-[#707973]">{hint}</span>}
    </div>
  );
}
