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
// The server returns one tracked object per parquet row. Everything about that
// object — its lifetime, every bbox observation over time, its categories, and
// each category's attribute timestamp ranges — is nested inside that single
// object. The parquet/wire format is identical for images and video; the client
// collapses the time dimension for images so callers get a flat, timestamp-free
// shape (one bbox, one score per attribute) while video keeps the time-aware one.

// Inclusive microsecond timestamp bounds. Video-only.
export interface TimestampRange {
  timestamp_start_us_inclusive: number;
  timestamp_end_us_inclusive: number;
}

// A timestamp range that also carries the confidence the winning option held over it
// (the mean of its raw per-frame scores). Video-only.
export interface ScoredTimestampRange {
  timestamp_start_us_inclusive: number;
  timestamp_end_us_inclusive: number;
  score: number;
}

// ---- Shared value objects ----

// A single bounding-box detection: the box and its score, always present
// together. This is the "real detection" value object — both fields are
// required, so a non-null BboxObservation guarantees both are set. Absence of a
// detection (video gap frames) is modeled at the level above by making the
// containing field nullable.
export interface BboxObservation {
  // [x1, y1, x2, y2] in 0..1.
  normalized_bbox: NormalizedBbox;
  bbox_score: number;
}

// The identity of a chosen attribute option, shared by image and video.
interface AttributePredictionBase {
  attribute_id: number;
  attribute_name: string;
  option_id: number;
  option_name: string;
}

// Fields shared by image and video category predictions.
interface CategoryPredictionBase {
  category_id: number;
  name: string;
  score: number;
}

// ---- Image (timestamp-free) ----

// A chosen attribute option for an object in an image, with its score.
export interface ImageAttributePrediction extends AttributePredictionBase {
  score: number;
}

export interface ImageCategoryPrediction extends CategoryPredictionBase {
  attributes: ImageAttributePrediction[];
}

// One detected object in an image: its bounding box and categories. Unlike
// VideoDetectedObject, an image object has no time dimension — a single
// BboxObservation and a single score per attribute. Images never have gap
// frames, so the bbox is always present.
export interface ImageDetectedObject {
  object_id: number;
  bbox_observation: BboxObservation;
  categories: ImageCategoryPrediction[];
}

// ---- Video (time-aware) ----

// One bounding-box sighting of a tracked object at a single timestamp. The
// timestamp is always present, but `observation` is null on "predicted-but-
// undetected" gap frames — frames inside a track's lifespan where the track
// wasn't detected. Only video produces gap frames; image objects always carry a
// real bbox.
export interface VideoBboxObservation {
  timestamp_microseconds: number;
  observation: BboxObservation | null;
}

// A chosen attribute option together with the time runs over which it won. The
// same attribute_id can appear multiple times across an object's life with
// different options; each entry carries the scored timestamp ranges over which
// its option held.
export interface VideoAttributePrediction extends AttributePredictionBase {
  timestamp_ranges: ScoredTimestampRange[];
}

export interface VideoCategoryPrediction extends CategoryPredictionBase {
  attributes: VideoAttributePrediction[];
}

// One tracked entity: its lifespan, every bbox observation, and categories. The
// server returns one parquet row per VideoDetectedObject; the nesting already
// exists in the schema, so deserialization is a straight structural map.
// object_id is stable within this response; timestamp_ranges are the object's
// presence ranges over time (one per contiguous on-screen interval).
export interface VideoDetectedObject {
  object_id: number;
  timestamp_ranges: TimestampRange[];
  bbox_observations: VideoBboxObservation[];
  categories: VideoCategoryPrediction[];
}

// ---- Image predictions ----
export interface ClassificationPredictImageResponse {
  objects: ImageDetectedObject[];
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}

// ---- Video predictions ----
export interface ClassificationPredictVideoResponse {
  objects: VideoDetectedObject[];
  frames_per_second: number;
  // The authoritative, sorted (ascending) list of every processed frame's
  // timestamp in microseconds — including frames with zero detections. Broader
  // than the per-object bbox/timestamp spans, which only cover an object's
  // lifespan. Use it to snap an arbitrary playhead time to the nearest real
  // frame, then look up detections at that timestamp.
  frame_timestamps_microseconds: number[];
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}
