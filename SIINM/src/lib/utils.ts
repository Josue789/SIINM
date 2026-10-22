import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Función estándar de shadcn/ui para combinar y resolver colisiones de clases en Tailwind CSS.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
