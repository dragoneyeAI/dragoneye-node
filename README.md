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

> **Note — Module format (v3+)**: `dragoneye-node` is published as an **ES module** and requires **Node.js 18+**. Import it with `import { Dragoneye } from "dragoneye-node"`.
>
> If your project is CommonJS, load it with a dynamic import instead: `const { Dragoneye } = await import("dragoneye-node");`

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
// The server returns one detected object per detection. Each object has a single
// bounding box and its categories; each category lists the attributes that were
// predicted, with the chosen option and a score for each.
for (const obj of imageResult.objects) {
  const bbox = obj.bbox_observation;
  console.log("Bbox:", bbox.normalized_bbox, "(score:", bbox.bbox_score, ")");
  for (const category of obj.categories) {
    console.log(`  Category: ${category.name} (score: ${category.score})`);
    for (const attr of category.attributes) {
      console.log(
        `      ${attr.attribute_name}: ${attr.option_name} (score: ${attr.score})`
      );
    }
  }
}
```

> **Note — Model names**: Model names follow the format `recognize_anything/model_name`. Use the name you specified when creating the model — see [Creating a Custom Vision Model](https://docs.dragoneye.ai/vision-models/create-a-custom-vision-model) for more details.

## How predictions are structured

Both endpoints return a list of **objects** the model detected. Each object has:

- A **bounding box** — where the object is, in normalized `[x_min, y_min, x_max, y_max]` coordinates.
- One or more **categories** — what the object is, each with a confidence `score`.
- A list of **attributes** on each category — additional properties the model predicted (for example, a building's exterior color), each as the chosen option plus a score.

Images and videos return slightly different object shapes. An **image** is a single moment, so each object has one bounding box and one score per attribute. A **video** adds a time dimension: the same object is tracked across frames, so it carries the timestamps where it appeared, a bounding box per sampled frame, and attribute scores that can change over time.

### Example Image Response

Below is an example of what a `ClassificationPredictImageResponse` looks like for a Building Detection model. The response is a flat list of `objects`, where each `ImageDetectedObject` is a single detected object with one bounding box and a score per attribute:

```typescript
{
  prediction_task_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  original_file_name: "any-file-name",
  objects: [
    {
      // Stable id for this detected object within the response.
      object_id: 1,
      // The object's single bounding box, normalized to 0..1.
      bbox_observation: { normalized_bbox: [0.12, 0.25, 0.55, 0.78], bbox_score: 0.94 },
      categories: [
        {
          category_id: 2084323334,
          name: "House (detached)",
          score: 0.92,
          // Each attribute prediction is a chosen option with a single score.
          attributes: [
            {
              attribute_id: 1371766615,
              attribute_name: "Building Exterior Color",
              option_id: 3498033303,
              option_name: "White / Off-white",
              score: 0.85,
            },
            {
              attribute_id: 448392115,
              attribute_name: "Building Exterior Material",
              option_id: 3887467550,
              option_name: "Wood (incl. timber siding)",
              score: 0.78,
            },
          ],
        },
      ],
    },
    {
      object_id: 2,
      bbox_observation: { normalized_bbox: [0.60, 0.30, 0.88, 0.75], bbox_score: 0.87 },
      categories: [
        {
          category_id: 3212613421,
          name: "Garage (detached)",
          score: 0.87,
          attributes: [
            // ... attributes omitted for brevity
          ],
        },
      ],
    },
  ],
}
```

Each `ImageDetectedObject` has an `object_id`, a single `bbox_observation`, and its `categories`. The `bbox_observation` holds its location, `categories` holds the predicted category with a confidence score, and each attribute is the chosen option with a single `score`.

### Example Video Response

Below is an example of what a `ClassificationPredictVideoResponse` looks like for the same model. The response is a flat list of `objects`, where each `VideoDetectedObject` is a single object tracked across the whole video. Each object carries everything about its lifetime — every bounding-box observation over time, its categories, and each attribute's value over contiguous timestamp ranges:

```typescript
{
  prediction_task_uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  original_file_name: "any-file-name",
  frames_per_second: 1,
  // Every processed frame's timestamp (microseconds), sorted ascending,
  // including frames with zero detections.
  frame_timestamps_microseconds: [0, 1000000, 2000000, 3000000],
  objects: [
    {
      // Stable tracking id for this object within the response.
      object_id: 1,
      // When this object was on screen, as one or more inclusive-microsecond
      // ranges (one per contiguous on-screen interval).
      timestamp_ranges: [
        { timestamp_start_us_inclusive: 0, timestamp_end_us_inclusive: 3000000 },
      ],
      // One observation per processed frame in the object's lifespan. Detected
      // frames carry a real bbox under `observation`; gap frames (predicted
      // present but not detected on that frame) carry `observation: null`.
      bbox_observations: [
        { timestamp_microseconds: 0, observation: { normalized_bbox: [0.12, 0.25, 0.55, 0.78], bbox_score: 0.94 } },
        { timestamp_microseconds: 1000000, observation: { normalized_bbox: [0.13, 0.26, 0.56, 0.79], bbox_score: 0.91 } },
        // Gap frame: the object is still on screen, but the model didn't predict
        // a box for it this frame, so the whole observation is null.
        { timestamp_microseconds: 2000000, observation: null },
        { timestamp_microseconds: 3000000, observation: { normalized_bbox: [0.14, 0.27, 0.57, 0.80], bbox_score: 0.95 } },
      ],
      categories: [
        {
          category_id: 2084323334,
          name: "House (detached)",
          score: 0.92,
          // Each attribute prediction is a chosen option with the scored
          // timestamp ranges over which it held. The same attribute_id can
          // appear more than once if its value changed during the object's life.
          attributes: [
            {
              attribute_id: 1371766615,
              attribute_name: "Building Exterior Color",
              option_id: 3498033303,
              option_name: "White / Off-white",
              timestamp_ranges: [
                { timestamp_start_us_inclusive: 0, timestamp_end_us_inclusive: 3000000, score: 0.85 },
              ],
            },
            {
              attribute_id: 448392115,
              attribute_name: "Building Exterior Material",
              option_id: 3887467550,
              option_name: "Wood (incl. timber siding)",
              timestamp_ranges: [
                { timestamp_start_us_inclusive: 0, timestamp_end_us_inclusive: 3000000, score: 0.78 },
              ],
            },
          ],
        },
      ],
    },
    {
      object_id: 2,
      timestamp_ranges: [
        { timestamp_start_us_inclusive: 0, timestamp_end_us_inclusive: 1000000 },
      ],
      bbox_observations: [
        { timestamp_microseconds: 0, observation: { normalized_bbox: [0.60, 0.30, 0.88, 0.75], bbox_score: 0.87 } },
        { timestamp_microseconds: 1000000, observation: { normalized_bbox: [0.61, 0.31, 0.89, 0.76], bbox_score: 0.89 } },
      ],
      categories: [
        {
          category_id: 3212613421,
          name: "Garage (detached)",
          score: 0.87,
          attributes: [
            // ... attributes omitted for brevity
          ],
        },
      ],
    },
  ],
}
```

Read a video response one object at a time. Each `VideoDetectedObject` is one object the model tracked through the video, and it tells you:

- `object_id` — a stable id, so you can follow the same object from frame to frame.
- `timestamp_ranges` — when the object was on screen, in microseconds.
- `bbox_observations` — where the object was, with one observation per processed frame in its lifespan.
- `categories` — what the object is, plus its attribute predictions.

The response also carries `frame_timestamps_microseconds`: the sorted list of **every** frame the model processed, in microseconds — including frames where nothing was detected. This is the full timeline of the video, broader than any single object's `timestamp_ranges` or `bbox_observations` (which only cover the frames where that object appeared). Use it to line a playback position up with a real frame: snap an arbitrary scrub time to the nearest value in this list, then look up detections at that timestamp. It's video-only — image responses don't have it.

> **Note — Gap frames**: A tracked object can stay on screen across frames where the model didn't predict a box for it. These are **gap frames**: the object is still within its `timestamp_ranges`, but for that frame the model produced no detection. The SDK keeps one `VideoBboxObservation` per processed frame in the lifespan and sets its `observation` to `null` on gap frames, so a track's observations stay aligned to the frames it spans. Any code that draws or denormalizes coordinates must **skip observations where `observation` is `null`**:
>
> ```typescript
> for (const obs of obj.bbox_observations) {
>   if (obs.observation === null) continue; // gap frame — on screen but no predicted box
>   const [x1, y1, x2, y2] = obs.observation.normalized_bbox;
>   // ... draw / denormalize
> }
> ```
>
> Gap frames only occur on the video path. Image objects always carry a real bounding box.

Attributes work a little differently in video because the model's answer can change over time. Each `VideoAttributePrediction` is one chosen option together with the time spans where that option applied. If the answer changes partway through (say a traffic light goes from green to red), the same attribute appears again with the new option. Images don't have a time dimension, so they use the simpler `ImageDetectedObject` shape shown above.

---

## Types and Endpoints

### Types

The response types form a nested hierarchy. Both image and video responses are object-forward — a flat list of detected/tracked objects — but image responses are **timestamp-free** while video responses keep the full time dimension. The two families are prefixed `Image*` and `Video*`.

Image responses collapse the time dimension: one bounding box per object and one `score` per attribute.

```
ClassificationPredictImageResponse
└── objects: ImageDetectedObject[]
    ├── object_id: number
    ├── bbox_observation: BboxObservation
    │   └── { normalized_bbox: [x_min, y_min, x_max, y_max], bbox_score }
    └── categories: ImageCategoryPrediction[]
        ├── { category_id, name, score }
        └── attributes: ImageAttributePrediction[]
            └── { attribute_id, attribute_name, option_id, option_name, score }
```

Video responses carry every observation over time, plus `frames_per_second`.

```
ClassificationPredictVideoResponse
├── frames_per_second: number
├── frame_timestamps_microseconds: number[]   // every processed frame, sorted ascending
└── objects: VideoDetectedObject[]
    ├── object_id: number
    ├── timestamp_ranges: TimestampRange[] { timestamp_start_us_inclusive, timestamp_end_us_inclusive }
    ├── bbox_observations: VideoBboxObservation[]
    │   └── { timestamp_microseconds, observation: BboxObservation | null }
    │       observation: { normalized_bbox: [x_min, y_min, x_max, y_max], bbox_score } | null (gap frame)
    └── categories: VideoCategoryPrediction[]
        ├── { category_id, name, score }
        └── attributes: VideoAttributePrediction[]
            └── { attribute_id, attribute_name, option_id, option_name,
                  timestamp_ranges: ScoredTimestampRange[] { timestamp_start_us_inclusive, timestamp_end_us_inclusive, score } }
```

---

#### Shared types

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

#### **`TimestampRange`** / **`ScoredTimestampRange`** *(video only)*

A span of time given as **inclusive microsecond** bounds. `TimestampRange` describes one contiguous interval an object was present; `ScoredTimestampRange` adds a `score` — the mean confidence the winning option held over that interval. Both are used as arrays (`timestamp_ranges`) on video responses.

```typescript
export interface TimestampRange {
  timestamp_start_us_inclusive: number;
  timestamp_end_us_inclusive: number;
}

export interface ScoredTimestampRange {
  timestamp_start_us_inclusive: number;
  timestamp_end_us_inclusive: number;
  score: number;
}
```

#### **`BboxObservation`**

A single bounding-box detection: the box and its score, always present together. `normalized_bbox` is `[x_min, y_min, x_max, y_max]` in `0..1`. Both fields are **required** — a `BboxObservation` always represents a real detection. The absence of a detection (a video gap frame) is modeled one level up by [`VideoBboxObservation`](#videobboxobservation) making its `observation` field nullable. Images use `BboxObservation` directly; they never have gap frames.

```typescript
export interface BboxObservation {
  normalized_bbox: NormalizedBbox;
  bbox_score: number;
}
```

#### Image types

#### **`ImageAttributePrediction`**

A predicted attribute as a chosen option for an object in an image, with its `score`.

```typescript
export interface ImageAttributePrediction {
  attribute_id: number;
  attribute_name: string;
  option_id: number;
  option_name: string;
  score: number;
}
```

#### **`ImageCategoryPrediction`**

A predicted category for an object in an image, with its associated attribute predictions.

```typescript
export interface ImageCategoryPrediction {
  category_id: number;
  name: string;
  score: number;
  attributes: ImageAttributePrediction[];
}
```

#### **`ImageDetectedObject`**

A single detected object in an image. `object_id` is stable within the response; `bbox_observation` is its single bounding box; `categories` holds its category predictions.

```typescript
export interface ImageDetectedObject {
  object_id: number;
  bbox_observation: BboxObservation;
  categories: ImageCategoryPrediction[];
}
```

#### Video types

#### **`VideoBboxObservation`**

A single bounding-box observation of a tracked object at one timestamp. `timestamp_microseconds` is always present; `observation` is a [`BboxObservation`](#bboxobservation) or `null`.

A video object accumulates one observation per processed frame within its lifespan. Frames where the track was **detected** carry a real bbox under `observation`; **gap frames** — frames inside the lifespan where the track was predicted present but not detected — carry `observation: null`. These observations are kept (not filtered out) so present-but-undetected frames stay visible.

```typescript
export interface VideoBboxObservation {
  timestamp_microseconds: number;
  observation: BboxObservation | null;
}
```

#### **`VideoAttributePrediction`**

A predicted attribute as a chosen option, with the scored timestamp ranges over which that option held. The same `attribute_id` may appear multiple times across an object's life if its value changed.

```typescript
export interface VideoAttributePrediction {
  attribute_id: number;
  attribute_name: string;
  option_id: number;
  option_name: string;
  timestamp_ranges: ScoredTimestampRange[];
}
```

#### **`VideoCategoryPrediction`**

A predicted category for a tracked object, with its associated attribute predictions.

```typescript
export interface VideoCategoryPrediction {
  category_id: number;
  name: string;
  score: number;
  attributes: VideoAttributePrediction[];
}
```

#### **`VideoDetectedObject`**

A single tracked object. `object_id` is stable within the response; `timestamp_ranges` are the object's presence ranges over time (one per contiguous on-screen interval); `bbox_observations` holds its location over time; `categories` holds its category predictions.

```typescript
export interface VideoDetectedObject {
  object_id: number;
  timestamp_ranges: TimestampRange[];
  bbox_observations: VideoBboxObservation[];
  categories: VideoCategoryPrediction[];
}
```

#### Response types

#### **`ClassificationPredictImageResponse`**

Response structure for image predictions.

```typescript
export interface ClassificationPredictImageResponse {
  objects: ImageDetectedObject[];
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
}
```

#### **`ClassificationPredictVideoResponse`**

Response structure for video predictions. Like the image response, plus `frames_per_second` and `frame_timestamps_microseconds`, and with the time-aware `VideoDetectedObject` shape.

`frame_timestamps_microseconds` is the authoritative, ascending list of **every** processed frame's timestamp — including frames with zero detections. This is broader than the per-object `bbox_observations`/`timestamp_ranges`, which only span an object's lifespan. Use it to snap an arbitrary playhead/scrub time to the nearest real frame, then look up detections at that timestamp.

```typescript
export interface ClassificationPredictVideoResponse {
  objects: VideoDetectedObject[];
  frames_per_second: number;
  frame_timestamps_microseconds: number[];
  prediction_task_uuid: PredictionTaskUUID;
  original_file_name?: string | null;
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

**Returns:** `Promise<ClassificationPredictVideoResponse>` — the tracked objects detected across the video.

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

## Cloudflare Workers & edge runtimes

`dragoneye-node` runs in Cloudflare Workers and other runtimes that forbid runtime code generation. Result Parquet is decoded with pure-JavaScript libraries (`hyparquet` + `fzstd`) — no `eval`, no `new Function`, and no runtime WebAssembly compilation (workerd blocks all three).

Two things to know when deploying to Workers:

- **Enable `nodejs_compat`.** The SDK references `node:fs`/`node:path` (only inside the Node-only `fromFilePath` helper), so the bundle needs the flag to resolve:

  ```jsonc
  // wrangler.jsonc
  { "compatibility_flags": ["nodejs_compat"] }
  ```

- **Load media without the filesystem.** `Image.fromFilePath` / `Video.fromFilePath` read from disk and are Node-only. In Workers, use `fromUrl`, `fromBlob`, `fromArrayBuffer`, `fromUint8Array`, or `fromBase64` instead.

---

## Notes

- All methods are **asynchronous** and return Promises.
- For images, always use `predictImage`. For videos, use `predictVideo`. Passing the wrong media type will throw an `IncorrectMediaTypeError`.
- Predictions run as **tasks**: the SDK automatically begins the task, uploads media, initiates prediction, polls for completion, and retrieves results.
