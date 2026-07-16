import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Conditional classes with conflict resolution (later Tailwind class wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
