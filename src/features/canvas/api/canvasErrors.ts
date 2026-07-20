/** 与 app/exceptions/codes.py ErrorCode 对齐 */
export const CANVAS_API_CODE = {
  PROJECT_BUSY: 40902,
  REVISION_CONFLICT: 40903,
  NODE_GENERATION_IN_PROGRESS: 40905,
  SUBMIT_REF_MISMATCH: 40906,
} as const;

export class CanvasApiError extends Error {
  readonly code: number;
  readonly details: Record<string, unknown> | null | undefined;

  constructor(message: string, code: number, details?: Record<string, unknown> | null) {
    super(message);
    this.name = 'CanvasApiError';
    this.code = code;
    this.details = details;
  }
}

export function isCanvasApiError(err: unknown): err is CanvasApiError {
  return err instanceof CanvasApiError;
}
