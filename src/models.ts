// models.ts
import type {
  NormalizedBbox,
  PredictionTaskState,
  PredictionTaskUUID,
  PredictionType,
} from "./common.js";

// ---- Status ----
export interface PredictionTaskStatusResponse {
  prediction_task_uuid: PredictionTaskUUID;
  prediction_type: PredictionType;
  status: PredictionTaskState;
}

// ---- Object-forward prediction types ----
// The server returns one tracked object (a DetectedObject) per parquet row.
// Everything about that object — its lifetime, every bbox observation over
// time, its categories, and each category's attribute timestamp ranges — is nested
// inside that single object. Images are encoded the same way as video, with
// all timestamps equal to 0.

// Inclusive microsecond timestamp bounds. For images, start == end == 0.
export interface TimestampRange {
  timestamp_start_us_inclusive: number;
  timestamp_end_us_inclusive: number;
}

// A timestamp range that also carries the confidence the winning option held over it
// (the mean of its raw per-frame scores).
export interface ScoredTimestampRange {
  timestamp_start_us_inclusive: number;
  timestamp_end_us_inclusive: number;
  score: number;
}

// One observation per timestamp the object was seen at (timestamp_microseconds
// is 0 for images). normalized_bbox is [x1, y1, x2, y2] in 0..1.
export interface BboxObservation {
  timestamp_microseconds: number;
  normalized_bbox: NormalizedBbox;
  bbox_score: number;
}

// One entry per (attribute, option) the object resolved to at some point, with
// the scored timestamp ranges over which that option won. The same attribute_id can
// appear multiple times with different options across an object's life.
export interface AttributePrediction {
  attribute_id: number;
  attribute_name: string;
  option_id: number;
  option_name: string;
  timestamp_ranges: ScoredTimestampRange[];
}

export interface CategoryPrediction {
  category_id: number;
  name: string;
  score: number;
  attributes: AttributePrediction[];
}

// A single tracked entity. object_id is stable within this response;
// timestamp_ranges are the object's presence ranges over time (one range per
// contiguous on-screen interval — today a single first → last lifespan range).
export interface DetectedObject {
  object_id: number;
  timestamp_ranges: TimestampRange[];
  bbox_observations: BboxObservation[];
  categories: CategoryPrediction[];
}

// ---- Image predictions ----
export interface ClassificationPredictImageResponse {
  objects: DetectedObject[];
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}

// ---- Video predictions ----
export interface ClassificationPredictVideoResponse {
  objects: DetectedObject[];
  frames_per_second: number;
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}
