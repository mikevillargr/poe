import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// All API failures return `{ error, code }` (CLAUDE.md Dev Conventions).
export interface ApiErrorBody {
  error: string
  code: string
  details?: unknown
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const Errors = {
  unauthenticated: () => new ApiError(401, 'UNAUTHENTICATED', 'Sign in required.'),
  pending: () => new ApiError(403, 'ACCOUNT_PENDING', 'Your account is waiting for approval.'),
  disabled: () => new ApiError(403, 'ACCOUNT_DISABLED', 'Your account has been disabled.'),
  forbidden: () => new ApiError(403, 'FORBIDDEN', 'You do not have access to this.'),
  notFound: (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found.`),
  conflict: (message: string) => new ApiError(409, 'CONFLICT', message),
  badRequest: (message: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', message, details),
}

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
      { status: err.status },
    )
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Invalid request.', code: 'VALIDATION_ERROR', details: err.flatten() },
      { status: 400 },
    )
  }
  console.error('Unhandled API error:', err)
  return NextResponse.json({ error: 'Something went wrong.', code: 'INTERNAL_ERROR' }, { status: 500 })
}
