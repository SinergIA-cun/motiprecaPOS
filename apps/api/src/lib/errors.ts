/** Códigos de error estandarizados para la respuesta de la API (regla #45). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/** Error de aplicación con código HTTP y código de error legible. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (message: string, details?: unknown): AppError =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'No autenticado'): AppError =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'No tienes permisos para este recurso'): AppError =>
  new AppError(403, 'FORBIDDEN', message);

export const rateLimited = (
  message = 'Demasiados intentos. Intenta de nuevo en unos minutos.',
): AppError => new AppError(429, 'RATE_LIMITED', message);
