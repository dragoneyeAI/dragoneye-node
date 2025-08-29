// exceptions.ts
export class PredictionTaskError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PredictionTaskError";
    if (cause) (this as any).cause = cause;
  }
}

export class PredictionUploadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PredictionUploadError";
    if (cause) (this as any).cause = cause;
  }
}

export class PredictionTaskBeginError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PredictionTaskBeginError";
    if (cause) (this as any).cause = cause;
  }
}

export class PredictionTaskResultsUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PredictionTaskResultsUnavailableError";
    if (cause) (this as any).cause = cause;
  }
}

export class IncorrectMediaTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncorrectMediaTypeError";
  }
}
