// models.ts
import type {
  NormalizedBbox,
  PredictionTaskState,
  PredictionTaskUUID,
  PredictionType,
} from "./common";

// ---- Status ----
export interface PredictionTaskStatusResponse {
  prediction_task_uuid: PredictionTaskUUID;
  prediction_type: PredictionType;
  status: PredictionTaskState;
}

// ---- Shared prediction types ----
export interface ClassificationAttributeOption {
  option_id: number;
  name: string;
  score: number;
}

export interface ClassificationAttributeResponse {
  attribute_id: number;
  name: string;
  options: ClassificationAttributeOption[];
}

export interface ClassificationCategory {
  id: number;
  name: string;
  score: number;
}

export interface ClassificationCategoryPrediction {
  category: ClassificationCategory;
  attributes: ClassificationAttributeResponse[];
}

export interface ClassificationObjectPrediction {
  normalizedBbox: NormalizedBbox;
  predictions: ClassificationCategoryPrediction[];
}

// ---- Image predictions ----
export interface ClassificationPredictImageResponse {
  object_predictions: ClassificationObjectPrediction[];
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}

// ---- Video predictions ----
export interface ClassificationVideoObjectPrediction
  extends ClassificationObjectPrediction {
  frame_id: string;
  timestamp_microseconds: number;
}

export interface ClassificationPredictVideoResponse {
  timestamp_us_to_predictions: Record<
    number,
    ClassificationVideoObjectPrediction[]
  >;
  frames_per_second: number;
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}
