// parquetDeserializer.ts
// Dragoneye writes prediction results as Zstd-compressed Parquet. hyparquet's
// core reader only decodes UNCOMPRESSED and SNAPPY in pure JS, so we supply a
// Zstd decompressor. We pull `fzstd` (pure JS) directly rather than
// hyparquet-compressors, whose `compressors` export eagerly instantiates a
// WebAssembly Snappy module — Cloudflare Workers (workerd) blocks runtime WASM
// compilation, so importing it crashes the Worker at startup. fzstd has no WASM
// and no eval, so this decode path runs in Workers and other no-codegen runtimes.
import { parquetReadObjects } from "hyparquet";
import { decompress as zstdDecompress } from "fzstd";
import type {
  BboxObservation,
  ImageAttributePrediction,
  ImageCategoryPrediction,
  ImageDetectedObject,
  ScoredTimestampRange,
  TimestampRange,
  VideoAttributePrediction,
  VideoBboxObservation,
  VideoCategoryPrediction,
  VideoDetectedObject,
} from "./models.js";
import type { NormalizedBbox } from "./common.js";

// hyparquet routes each column chunk's codec to compressors[codec] when present.
// We pre-size the output buffer to the page's uncompressed length so decoding
// works even for Zstd frames written without a content-size header.
const compressors = {
  ZSTD: (input: Uint8Array, outputLength: number): Uint8Array =>
    zstdDecompress(input, new Uint8Array(outputLength)),
};

// hyparquet decodes parquet INT64 columns as bigint, so every id/microsecond
// field arrives as `number | bigint` and must be narrowed before leaving this
// module. Note: Number() on a BigInt beyond 2^53 loses precision — fine for
// these IDs / µs timestamps in practice.
function toNumber(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : (value as number);
}

// The parquet schema is already nested (one row per tracked object, with
// nested structs + repeated fields) and identical for images and video. Video
// is a straight structural map; image collapses the time dimension (one bbox,
// one score per attribute). Optional/repeated fields default to empty arrays
// via `?? []` so a missing list never throws. hyparquet returns `undefined`
// for null cells.

function parseTimestampRange(value: unknown): TimestampRange {
  const tr = (value ?? {}) as Record<string, unknown>;
  return {
    timestamp_start_us_inclusive: toNumber(tr["timestamp_start_us_inclusive"]),
    timestamp_end_us_inclusive: toNumber(tr["timestamp_end_us_inclusive"]),
  };
}

function parseScoredTimestampRange(value: unknown): ScoredTimestampRange {
  const tr = (value ?? {}) as Record<string, unknown>;
  return {
    timestamp_start_us_inclusive: toNumber(tr["timestamp_start_us_inclusive"]),
    timestamp_end_us_inclusive: toNumber(tr["timestamp_end_us_inclusive"]),
    score: tr["score"] as number,
  };
}

// Builds a real detection from a struct that is known to carry one — both the
// box and its score are present. The gap-frame branch lives at the caller, so
// this helper never sees nulls. Floats read straight from the parquet list — no
// per-element coercion.
function toBboxObservation(value: Record<string, unknown>): BboxObservation {
  return {
    normalized_bbox: value["normalized_bbox"] as NormalizedBbox,
    bbox_score: value["bbox_score"] as number,
  };
}

// ---- Video: straight structural map ----

function parseVideoBboxObservation(
  value: Record<string, unknown>
): VideoBboxObservation {
  // Gap frames (predicted-but-undetected frames inside a track's lifespan) emit
  // null for the bbox on the wire; hyparquet surfaces null cells as `undefined`.
  // The timestamp is always present; only the observation goes null.
  const normalizedBbox = value["normalized_bbox"];
  return {
    timestamp_microseconds: toNumber(value["timestamp_microseconds"]),
    observation: normalizedBbox == null ? null : toBboxObservation(value),
  };
}

function parseVideoAttributePrediction(
  value: Record<string, unknown>
): VideoAttributePrediction {
  const timestampRanges =
    (value["timestamp_ranges"] as unknown[] | null | undefined) ?? [];
  return {
    attribute_id: toNumber(value["attribute_id"]),
    attribute_name: value["attribute_name"] as string,
    option_id: toNumber(value["option_id"]),
    option_name: value["option_name"] as string,
    timestamp_ranges: timestampRanges.map(parseScoredTimestampRange),
  };
}

function parseVideoCategoryPrediction(
  value: Record<string, unknown>
): VideoCategoryPrediction {
  const attributes =
    (value["attributes"] as Record<string, unknown>[] | null | undefined) ?? [];
  return {
    category_id: toNumber(value["category_id"]),
    name: value["name"] as string,
    score: value["score"] as number,
    attributes: attributes.map(parseVideoAttributePrediction),
  };
}

function rowToVideoDetectedObject(
  row: Record<string, unknown>
): VideoDetectedObject {
  const bboxObservations =
    (row["bbox_observations"] as Record<string, unknown>[] | null | undefined) ??
    [];
  const categories =
    (row["categories"] as Record<string, unknown>[] | null | undefined) ?? [];
  const timestampRanges =
    (row["timestamp_ranges"] as unknown[] | null | undefined) ?? [];
  return {
    object_id: toNumber(row["object_id"]),
    timestamp_ranges: timestampRanges.map(parseTimestampRange),
    bbox_observations: bboxObservations.map(parseVideoBboxObservation),
    categories: categories.map(parseVideoCategoryPrediction),
  };
}

// ---- Image: collapse the time dimension ----

function parseImageAttributePrediction(
  value: Record<string, unknown>
): ImageAttributePrediction {
  const timestampRanges =
    (value["timestamp_ranges"] as unknown[] | null | undefined) ?? [];
  // Images have exactly one zero-width range; max is just defensive.
  const score = timestampRanges.reduce<number>((max, range) => {
    const s = parseScoredTimestampRange(range).score;
    return s > max ? s : max;
  }, 0.0);
  return {
    attribute_id: toNumber(value["attribute_id"]),
    attribute_name: value["attribute_name"] as string,
    option_id: toNumber(value["option_id"]),
    option_name: value["option_name"] as string,
    score,
  };
}

function parseImageCategoryPrediction(
  value: Record<string, unknown>
): ImageCategoryPrediction {
  const attributes =
    (value["attributes"] as Record<string, unknown>[] | null | undefined) ?? [];
  return {
    category_id: toNumber(value["category_id"]),
    name: value["name"] as string,
    score: value["score"] as number,
    attributes: attributes.map(parseImageAttributePrediction),
  };
}

function rowToImageDetectedObject(
  row: Record<string, unknown>
): ImageDetectedObject {
  const bboxObservations =
    (row["bbox_observations"] as Record<string, unknown>[] | null | undefined) ??
    [];
  const categories =
    (row["categories"] as Record<string, unknown>[] | null | undefined) ?? [];
  // Images always have exactly one bbox observation and are never gap frames;
  // take the first and build a real detection. A null bbox here would surface
  // as a malformed value rather than being silently masked — intentional.
  return {
    object_id: toNumber(row["object_id"]),
    bbox_observation: toBboxObservation(bboxObservations[0] ?? {}),
    categories: categories.map(parseImageCategoryPrediction),
  };
}

function toAsyncBuffer(buffer: ArrayBuffer) {
  return {
    byteLength: buffer.byteLength,
    slice(start: number, end?: number) {
      return buffer.slice(start, end);
    },
  };
}

async function readObjectForwardRows(
  parquetBytes: ArrayBuffer
): Promise<Record<string, unknown>[]> {
  const rows = await parquetReadObjects({
    file: toAsyncBuffer(parquetBytes),
    compressors,
  });
  return rows as Record<string, unknown>[];
}

// Reads the zstd-compressed, object-forward parquet body and maps each row to
// one VideoDetectedObject (a straight structural map preserving the time
// dimension).
export async function deserializeObjectForwardVideoPredictions(
  parquetBytes: ArrayBuffer
): Promise<VideoDetectedObject[]> {
  const rows = await readObjectForwardRows(parquetBytes);
  return rows.map(rowToVideoDetectedObject);
}

// Reads the same object-forward parquet body but collapses the time dimension
// per row, yielding timestamp-free ImageDetectedObjects: one bbox per object
// and one score per attribute.
export async function deserializeObjectForwardImagePredictions(
  parquetBytes: ArrayBuffer
): Promise<ImageDetectedObject[]> {
  const rows = await readObjectForwardRows(parquetBytes);
  return rows.map(rowToImageDetectedObject);
}
