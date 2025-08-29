// classification.ts
import {
  BASE_API_URL,
  FAILED_STATUS_PREFIX,
  PREDICTED_STATUS,
  PredictionTaskState,
  PredictionTaskUUID,
  PredictionType,
  sleep,
} from "./common";
import {
  PredictionTaskBeginError,
  PredictionTaskError,
  PredictionTaskResultsUnavailableError,
  PredictionUploadError,
} from "./exception";
import type { Dragoneye } from "./index";
import { Image, Video, type Media } from "./media";
import type {
  ClassificationPredictImageResponse,
  ClassificationPredictVideoResponse,
  PredictionTaskStatusResponse,
} from "./models";

// ---- Internal API shapes ----
interface PresignedPostRequest {
  url: string;
  fields: Record<string, unknown>;
}

interface MediaUploadUrl {
  blob_path: string;
  presigned_post_request: PresignedPostRequest;
}

interface PredictionTaskBeginResponse {
  prediction_task_uuid: PredictionTaskUUID;
  prediction_type: PredictionType;
  signed_urls: MediaUploadUrl[];
}

// ---- Internal helpers ----
function isTaskSuccessful(status: PredictionTaskState): boolean {
  return status === PREDICTED_STATUS;
}

function isTaskFailed(status: PredictionTaskState): boolean {
  return status.startsWith(FAILED_STATUS_PREFIX);
}

function isTaskComplete(status: PredictionTaskState): boolean {
  return isTaskSuccessful(status) || isTaskFailed(status);
}
export class Classification {
  protected _client: Dragoneye;

  constructor(private client: Dragoneye) {
    this._client = client;
  }

  // ---------- PUBLIC API ----------

  async predictImage(
    media: Image,
    modelName: string,
    timeoutSeconds?: number
  ): Promise<ClassificationPredictImageResponse> {
    return this._predictUnified(media, modelName, undefined, timeoutSeconds);
  }

  async predictVideo(
    media: Video,
    modelName: string,
    framesPerSecond: number = 1,
    timeoutSeconds?: number
  ): Promise<ClassificationPredictVideoResponse> {
    return this._predictUnified(
      media,
      modelName,
      framesPerSecond,
      timeoutSeconds
    );
  }

  async getStatus(
    predictionTaskUuid: PredictionTaskUUID
  ): Promise<PredictionTaskStatusResponse> {
    const url = `${BASE_API_URL}/prediction-task/status?predictionTaskUuid=${encodeURIComponent(
      predictionTaskUuid as unknown as string
    )}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this._client.apiKey}`,
      },
    });

    if (!resp.ok) {
      throw new PredictionTaskError(
        `Error getting prediction task status: ${resp.status} ${resp.statusText}`
      );
    }

    return (await resp.json()) as PredictionTaskStatusResponse;
  }

  async getImageResults(
    predictionTaskUuid: PredictionTaskUUID
  ): Promise<ClassificationPredictImageResponse> {
    return await this._getResultsUnified(predictionTaskUuid, "image");
  }

  async getVideoResults(
    predictionTaskUuid: PredictionTaskUUID
  ): Promise<ClassificationPredictVideoResponse> {
    return await this._getResultsUnified(predictionTaskUuid, "video");
  }

  // ---------- INTERNALS ----------

  private _predictUnified(
    media: Image,
    modelName: string,
    framesPerSecond?: number,
    timeoutSeconds?: number
  ): Promise<ClassificationPredictImageResponse>;

  private _predictUnified(
    media: Video,
    modelName: string,
    framesPerSecond?: number,
    timeoutSeconds?: number
  ): Promise<ClassificationPredictVideoResponse>;

  private async _predictUnified(
    media: Media,
    modelName: string,
    framesPerSecond?: number,
    timeoutSeconds?: number
  ): Promise<
    ClassificationPredictImageResponse | ClassificationPredictVideoResponse
  > {
    // 1) Begin task
    const beginResp = await this._beginPredictionTask(
      media.mimeType,
      framesPerSecond
    );

    // 2) Upload media (first signed URL)
    await this._uploadMediaToPredictionTask(media, beginResp.signed_urls[0]);

    // 3) Kick off predict
    await this._initiatePredict(modelName, beginResp.prediction_task_uuid);

    // 4) Poll for completion
    const status = await this._waitForPredictionTaskCompletion(
      beginResp.prediction_task_uuid,
      timeoutSeconds
    );

    if (isTaskFailed(status.status)) {
      throw new PredictionTaskError(
        `Prediction task failed: ${status.status as unknown as string}`
      );
    }

    // 5) Fetch results
    return await this._getResultsUnified(
      status.prediction_task_uuid,
      beginResp.prediction_type
    );
  }

  private async _beginPredictionTask(
    mimeType: string,
    framesPerSecond?: number
  ): Promise<PredictionTaskBeginResponse> {
    const url = `${BASE_API_URL}/prediction-task/begin`;

    const form = new FormData();
    form.append("mimetype", mimeType);
    if (typeof framesPerSecond === "number") {
      form.append("frames_per_second", String(framesPerSecond));
    }

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        body: form,
        headers: {
          Authorization: `Bearer ${this._client.apiKey}`,
        },
      });
    } catch (error) {
      throw new PredictionTaskBeginError(
        "Error beginning prediction task:",
        error
      );
    }

    if (!resp.ok) {
      throw new PredictionTaskBeginError(
        `Error beginning prediction task: ${resp.status} ${resp.statusText}`
      );
    }

    return (await resp.json()) as PredictionTaskBeginResponse;
  }

  private async _uploadMediaToPredictionTask(
    media: Media,
    signedUrl: MediaUploadUrl
  ): Promise<void> {
    // Construct multipart form: presigned fields + file
    const form = new FormData();
    for (const [k, v] of Object.entries(
      signedUrl.presigned_post_request.fields
    )) {
      form.append(k, String(v));
    }

    form.append("file", media.toBlob(), "file");

    let resp: Response;
    try {
      resp = await fetch(signedUrl.presigned_post_request.url, {
        method: "POST",
        body: form,
      });
    } catch (error) {
      throw new PredictionUploadError(
        "Error uploading media to prediction task:",
        error
      );
    }

    if (!resp.ok) {
      throw new PredictionUploadError(
        `Error uploading media to prediction task: ${resp.status} ${resp.statusText}`
      );
    }
  }

  private async _initiatePredict(
    modelName: string,
    predictionTaskUuid: PredictionTaskUUID
  ): Promise<void> {
    const url = `${BASE_API_URL}/predict`;
    const form = new FormData();
    form.append("model_name", modelName);
    form.append(
      "prediction_task_uuid",
      predictionTaskUuid as unknown as string
    );

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        body: form,
        headers: {
          Authorization: `Bearer ${this._client.apiKey}`,
        },
      });
    } catch (error) {
      throw new PredictionTaskError("Error initiating prediction:", error);
    }

    if (!resp.ok) {
      throw new PredictionTaskError(
        `Error initiating prediction: ${resp.status} ${resp.statusText}`
      );
    }
  }

  private async _waitForPredictionTaskCompletion(
    predictionTaskUuid: PredictionTaskUUID,
    timeoutSeconds?: number,
    pollingIntervalMs: number = 1000
  ): Promise<PredictionTaskStatusResponse> {
    const startTime = performance.now();

    while (
      timeoutSeconds === undefined ||
      performance.now() - startTime < timeoutSeconds * 1000
    ) {
      const status = await this.getStatus(predictionTaskUuid);
      if (isTaskComplete(status.status)) return status;
      await sleep(pollingIntervalMs);
    }

    throw new PredictionTaskError(
      `Prediction task ${predictionTaskUuid} did not complete within ${timeoutSeconds} seconds.`
    );
  }

  private async _getResultsUnified(
    predictionTaskUuid: PredictionTaskUUID,
    predictionType: "image"
  ): Promise<ClassificationPredictImageResponse>;

  private async _getResultsUnified(
    predictionTaskUuid: PredictionTaskUUID,
    predictionType: "video"
  ): Promise<ClassificationPredictVideoResponse>;

  private async _getResultsUnified(
    predictionTaskUuid: PredictionTaskUUID,
    predictionType: PredictionType
  ): Promise<
    ClassificationPredictImageResponse | ClassificationPredictVideoResponse
  >;

  private async _getResultsUnified(
    predictionTaskUuid: PredictionTaskUUID,
    predictionType: PredictionType
  ): Promise<
    ClassificationPredictImageResponse | ClassificationPredictVideoResponse
  > {
    const url = `${BASE_API_URL}/prediction-task/results?predictionTaskUuid=${encodeURIComponent(
      predictionTaskUuid as unknown as string
    )}`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this._client.apiKey}`,
        },
      });
    } catch (error) {
      throw new PredictionTaskResultsUnavailableError(
        `Error getting prediction task results: ${(error as Error).message}`,
        error
      );
    }

    if (!resp.ok) {
      throw new PredictionTaskResultsUnavailableError(
        `Error getting prediction task results: ${resp.status} ${resp.statusText}`
      );
    }

    const payload = await resp.json();

    // Add the prediction task uuid to the response before returning
    const augmented = {
      ...payload,
      prediction_task_uuid: predictionTaskUuid,
    };

    switch (predictionType) {
      case "image":
        return augmented as ClassificationPredictImageResponse;
      case "video":
        return augmented as ClassificationPredictVideoResponse;
    }
  }
}
