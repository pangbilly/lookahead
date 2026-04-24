import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-12 w-full border border-[color:var(--border)] bg-transparent px-4 py-2 text-sm text-[color:var(--foreground-strong)] placeholder:text-[color:var(--foreground)]/50',
          'focus-visible:outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
