# dragoneye-node

[![npm version](https://img.shields.io/npm/v/dragoneye-node.svg)](https://www.npmjs.com/package/dragoneye-node)
[![Types: TypeScript](https://img.shields.io/npm/types/dragoneye-node.svg)](https://www.npmjs.com/package/dragoneye-node)
[![License: MIT](https://img.shields.io/npm/l/dragoneye-node.svg)](https://github.com/dragoneyeAI/dragoneye-node/blob/main/LICENSE)

The official Node.js / TypeScript SDK for [Dragoneye](https://dragoneye.ai) — build and call custom computer vision models from JavaScript.

Describe what you want to detect in plain English on the [Dragoneye Playground](https://playground.dragoneye.ai/), and the AI Model Builder assembles a vision model with your categories and attributes. This SDK lets you run that model on images and videos and get back structured predictions with bounding boxes, category scores, and attribute scores.

- 📘 **Full documentation:** https://docs.dragoneye.ai/integrating/node-sdk
- 🎮 **Playground:** https://playground.dragoneye.ai/
- 📦 **npm:** https://www.npmjs.com/package/dragoneye-node

---

## Using the Node SDK

The Dragoneye Node.js SDK simplifies integrating with our APIs in your JavaScript/TypeScript projects. This guide covers installation, example usage, type definitions, and available endpoints.

## Installation

Install the SDK using npm:

```bash
npm install dragoneye-node
```

## Quick Start

> **Tip — Prerequisites**: Don't have an API key yet? See [Creating an Access Token](https://docs.dragoneye.ai/account-management/creating-access-token).

Once installed, you can call the classifier using your desired model:

```typescript
import { Dragoneye } from "dragoneye-node";

const dragoneyeClient = new Dragoneye({
  apiKey: "<YOUR_ACCESS_TOKEN>",
});

// Example: predict from an image
const image = await Dragoneye.Image.fromFilePath("example.jpg");
const imageResult = await dragoneyeClient.classification.predictImage(
  image,
  "recognize_anything/your_model_name" // change to your desired model
);

// Example: predict from a video
// NOTE! When loading a file, you can optionally pass a file name or identifier
// that you use to identify your own files.
const video = await Dragoneye.Video.fromFilePath("example.mp4", "any-file-name");
const videoResult = await dragoneyeClient.classification.predictVideo(
  video,
  "recognize_anything/your_model_name"
);

// Accessing image results
for (const obj of imageResult.object_predictions) {
  console.log("Bbox:", obj.normalizedBbox);
  for (const pred of obj.predictions) {
    console.log(
      `  Category: ${pred.category.name} (score: ${pred.category.score})`
    );
    for (const attr of pred.attributes) {
      for (const opt of attr.options) {
        console.log(`      ${opt.name}: ${opt.score}`);
      }
    }
  }
}
```

> **Note — Model names**: Model names follow the format `recognize_anything/model_name`. Use the name you specified when creating the model — see [Creating a Custom Vision Model](https://docs.dragoneye.ai/vision-models/create-a-custom-vision-model) for more details.

### Example Video Response

Below is an example of what a `ClassificationPredictVideoResponse` looks like for a Building Detection model. The response maps each sampled frame's timestamp (in microseconds) to the objects detected in that frame:

```typescript
{
  prediction_task_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  original_file_name: "any-file-name",
  frames_per_second: 1,
  timestamp_us_to_predictions: {
    0: [
      {
        frame_id: "frame_0",
        timestamp_microseconds: 0,
        normalizedBbox: [0.12, 0.25, 0.55, 0.78],
        predictions: [
          {
            category: {
              id: 2084323334,
              name: "House (detached)",
              score: 0.92,
            },
            attributes: [
              {
                attribute_id: 1371766615,
                name: "Building Exterior Color",
                options: [
                  { option_id: 3498033303, name: "White / Off-white", score: 0.85 },
                  { option_id: 496739380, name: "Light gray", score: 0.10 },
                  // ... remaining options omitted for brevity
                ],
              },
              {
                attribute_id: 448392115,
                name: "Building Exterior Material",
                options: [
                  { option_id: 3887467550, name: "Wood (incl. timber siding)", score: 0.78 },
                  { option_id: 562768697, name: "Brick", score: 0.12 },
                  // ...
                ],
              },
              {
                attribute_id: 4240554102,
                name: "Building Size (Stories)",
                options: [
                  { option_id: 3067238669, name: "2 stories", score: 0.91 },
                  { option_id: 2398426374, name: "1 story", score: 0.06 },
                  // ...
                ],
              },
            ],
          },
        ],
      },
      {
        frame_id: "frame_0",
        timestamp_microseconds: 0,
        normalizedBbox: [0.60, 0.30, 0.88, 0.75],
        predictions: [
          {
            category: {
              id: 3212613421,
              name: "Garage (detached)",
              score: 0.87,
            },
            attributes: [
              // ... attributes omitted for brevity
            ],
          },
        ],
      },
    ],
    1000000: [
      // Objects detected at t=1s (1,000,000 microseconds)
      // ...
    ],
  },
}
```

Each timestamp key (e.g., `0`, `1000000`) corresponds to a sampled frame. Within each frame, every detected object has its own bounding box, category prediction with a confidence score, and attribute predictions with scored options.

---

## Types and Endpoints

### Types

The response types form a nested hierarchy. Here's how they fit together for image predictions:

```
ClassificationPredictImageResponse
└── object_predictions: ClassificationObjectPrediction[]
    ├── normalizedBbox: [x_min, y_min, x_max, y_max]
    └── predictions: ClassificationCategoryPrediction[]
        ├── category: ClassificationCategory { id, name, score }
        └── attributes: ClassificationAttributeResponse[]
            └── options: ClassificationAttributeOption[] { option_id, name, score }
```

For video predictions, `ClassificationPredictVideoResponse` maps timestamps to arrays of `ClassificationVideoObjectPrediction` (which extends `ClassificationObjectPrediction` with `frame_id` and `timestamp_microseconds`).

---

#### **`NormalizedBbox`**

Represents the location of an object in an image. It is an array of four numbers: `[x_min, y_min, x_max, y_max]`.

```typescript
export type NormalizedBbox = [number, number, number, number];
```

#### **`PredictionTaskUUID`**

A branded string type representing a prediction task UUID.

```typescript
export type PredictionTaskUUID = Brand<string, "PredictionTaskUUID">;
```

#### **`PredictionType`**

Defines whether a prediction is for an `"image"` or a `"video"`.

```typescript
export type PredictionType = "image" | "video";
```

#### **`ClassificationAttributeOption`**

Represents a single option within an attribute prediction.

```typescript
export interface ClassificationAttributeOption {
  option_id: number;
  name: string;
  score: number;
}
```

#### **`ClassificationAttributeResponse`**

Contains the attribute prediction with its possible options.

```typescript
export interface ClassificationAttributeResponse {
  attribute_id: number;
  name: string;
  options: ClassificationAttributeOption[];
}
```

#### **`ClassificationCategory`**

Represents a predicted category for a detected object.

```typescript
export interface ClassificationCategory {
  id: number;
  name: string;
  score: number;
}
```

#### **`ClassificationCategoryPrediction`**

Combines a category prediction with its associated attribute predictions.

```typescript
export interface ClassificationCategoryPrediction {
  category: ClassificationCategory;
  attributes: ClassificationAttributeResponse[];
}
```

#### **`ClassificationObjectPrediction`**

Represents a predicted object in an image.

```typescript
export interface ClassificationObjectPrediction {
  normalizedBbox: NormalizedBbox;
  predictions: ClassificationCategoryPrediction[];
}
```

#### **`ClassificationPredictImageResponse`**

Response structure for image predictions.

```typescript
export interface ClassificationPredictImageResponse {
  object_predictions: ClassificationObjectPrediction[];
  original_file_name?: string;
  prediction_task_uuid: PredictionTaskUUID;
}
```

#### **`ClassificationVideoObjectPrediction`**

Extends `ClassificationObjectPrediction` with video-specific fields.

```typescript
export interface ClassificationVideoObjectPrediction
  extends ClassificationObjectPrediction {
  frame_id: string;
  timestamp_microseconds: number;
}
```

#### **`ClassificationPredictVideoResponse`**

Response structure for video predictions. Predictions are keyed by timestamp in microseconds.

```typescript
export interface ClassificationPredictVideoResponse {
  timestamp_us_to_predictions: Record<
    number,
    ClassificationVideoObjectPrediction[]
  >;
  frames_per_second: number;
  original_file_name?: string;
  prediction_task_uuid: PredictionTaskUUID;
}
```

#### **`PredictionTaskStatusResponse`**

Represents the status of an async prediction task.

```typescript
export interface PredictionTaskStatusResponse {
  prediction_task_uuid: PredictionTaskUUID;
  prediction_type: PredictionType;
  status: PredictionTaskState; // e.g. "predicted", "failed"
}
```

---

### Endpoints

#### `dragoneyeClient.classification.predictImage`

```typescript
await dragoneyeClient.classification.predictImage(
  media: Image,
  modelName: string,
  timeoutSeconds?: number,
): Promise<ClassificationPredictImageResponse>
```

Performs a classification prediction on a single image.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `media` | `Image` | *required* | An `Image` object (from `fromFilePath`, `fromBlob`, `fromUrl`, etc.). |
| `modelName` | `string` | *required* | The name of the model to use for prediction. |
| `timeoutSeconds` | `number` | `undefined` | Maximum wait time in seconds. Throws `PredictionTaskError` on timeout. `undefined` polls indefinitely. |

**Returns:** `Promise<ClassificationPredictImageResponse>` — detected objects and their predictions.

---

#### `dragoneyeClient.classification.predictVideo`

```typescript
await dragoneyeClient.classification.predictVideo(
  media: Video,
  modelName: string,
  framesPerSecond: number = 1,
  timeoutSeconds?: number,
): Promise<ClassificationPredictVideoResponse>
```

Performs a classification prediction on a video.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `media` | `Video` | *required* | A `Video` object (from `fromFilePath`, `fromBlob`, `fromUrl`, etc.). |
| `modelName` | `string` | *required* | The name of the model to use for prediction. |
| `framesPerSecond` | `number` | `1` | How many frames per second to sample from the video. |
| `timeoutSeconds` | `number` | `undefined` | Maximum wait time in seconds. Throws `PredictionTaskError` on timeout. `undefined` polls indefinitely. |

**Returns:** `Promise<ClassificationPredictVideoResponse>` — frame-level prediction results.

---

#### `dragoneyeClient.classification.getStatus`

```typescript
await dragoneyeClient.classification.getStatus(
  predictionTaskUuid: PredictionTaskUUID,
): Promise<PredictionTaskStatusResponse>
```

Checks the status of an in-progress prediction task.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `predictionTaskUuid` | `PredictionTaskUUID` | *required* | The UUID of the prediction task. |

**Returns:** `Promise<PredictionTaskStatusResponse>` — the task's current status.

---

#### `dragoneyeClient.classification.getImageResults`

```typescript
await dragoneyeClient.classification.getImageResults(
  predictionTaskUuid: PredictionTaskUUID,
): Promise<ClassificationPredictImageResponse>
```

Fetches the results of a completed image prediction task.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `predictionTaskUuid` | `PredictionTaskUUID` | *required* | The UUID of the prediction task. |

**Returns:** `Promise<ClassificationPredictImageResponse>`

---

#### `dragoneyeClient.classification.getVideoResults`

```typescript
await dragoneyeClient.classification.getVideoResults(
  predictionTaskUuid: PredictionTaskUUID,
): Promise<ClassificationPredictVideoResponse>
```

Fetches the results of a completed video prediction task.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `predictionTaskUuid` | `PredictionTaskUUID` | *required* | The UUID of the prediction task. |

**Returns:** `Promise<ClassificationPredictVideoResponse>`

---

## Error Handling

The SDK defines the following error types:

| Error | When it's thrown |
|-------|-----------------|
| `PredictionTaskError` | The prediction task failed on the server or timed out. |
| `PredictionUploadError` | The media file could not be uploaded. |
| `PredictionTaskBeginError` | The prediction task could not be started. |
| `PredictionTaskResultsUnavailableError` | Results were requested for a task that has not completed. |
| `IncorrectMediaTypeError` | Wrong media type was passed (e.g., a `Video` to `predictImage`). |

```typescript
import { Dragoneye } from "dragoneye-node";

try {
  const result = await dragoneyeClient.classification.predictImage(
    image,
    "recognize_anything/your_model_name"
  );
} catch (error) {
  if (error instanceof Dragoneye.Common.PredictionUploadError) {
    console.error("Failed to upload media — check file path and format");
  } else if (error instanceof Dragoneye.Common.PredictionTaskError) {
    console.error("Prediction task failed on the server");
  }
}
```

---

## Notes

- All methods are **asynchronous** and return Promises.
- For images, always use `predictImage`. For videos, use `predictVideo`. Passing the wrong media type will throw an `IncorrectMediaTypeError`.
- Predictions run as **tasks**: the SDK automatically begins the task, uploads media, initiates prediction, polls for completion, and retrieves results.
