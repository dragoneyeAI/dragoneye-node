// models.ts
import type {
  NormalizedBbox,
  PredictionTaskState,
  PredictionTaskUUID,
  PredictionType,
  TaxonID,
  TaxonPrediction,
} from "./common";

// ---- Status ----
export interface PredictionTaskStatusResponse {
  prediction_task_uuid: PredictionTaskUUID;
  prediction_type: PredictionType;
  status: PredictionTaskState;
}

// ---- Image predictions ----
export interface ClassificationTraitRootPrediction {
  id: TaxonID;
  name: string;
  displayName: string;
  taxons: TaxonPrediction[];
}

export interface ClassificationObjectPrediction {
  normalizedBbox: NormalizedBbox;
  category: TaxonPrediction;
  traits: ClassificationTraitRootPrediction[];
}

export interface ClassificationPredictImageResponse {
  predictions: ClassificationObjectPrediction[];
  prediction_task_uuid: PredictionTaskUUID;
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
}
