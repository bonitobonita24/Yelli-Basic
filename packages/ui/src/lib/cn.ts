import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind-aware conflict resolution.
 * The canonical shadcn/ui helper: clsx composes the conditional class list,
 * tailwind-merge then resolves conflicting Tailwind utilities (last one wins).
 *
 * shadcn primitives land with the app (S4); this shared helper is consumed by
 * every component generated there and by any bespoke component in the apps.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
