import 'server-only'
import { CarInputError } from '@/lib/rent-car-errors'

export function rentCarFailure(error: unknown): { error: string; status: number } {
  if (error instanceof CarInputError) return { error: error.message, status: 400 }
  if (error instanceof SyntaxError) return { error: 'Invalid request.', status: 400 }
  return { error: 'This request could not be completed. Please try again.', status: 503 }
}
