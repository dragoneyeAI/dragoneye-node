// common.ts
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type NormalizedBbox = [number, number, number, number];

export type PredictionType = "image" | "video";

export type PredictionTaskState = Brand<string, "PredictionTaskState">;

export type PredictionTaskUUID = Brand<string, "PredictionTaskUUID">;

export const BASE_API_URL = "https://api.dragoneye.ai";

export const PREDICTED_STATUS = "predicted" as PredictionTaskState;
export const FAILED_STATUS_PREFIX = "failed" as const;

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
