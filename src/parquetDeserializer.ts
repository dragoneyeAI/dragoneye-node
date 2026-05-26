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
  AttributePrediction,
  BboxObservation,
  CategoryPrediction,
  DetectedObject,
  ScoredTimestampRange,
  TimestampRange,
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
// nested structs + repeated fields), so the deserializer is a straight
// structural map from parquet row → typed object: no flattening or grouping.
// Optional/repeated fields default to empty arrays via `?? []` so a missing
// list never throws. hyparquet returns `undefined` for null cells.

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

function parseBboxObservation(value: Record<string, unknown>): BboxObservation {
  return {
    timestamp_microseconds: toNumber(value["timestamp_microseconds"]),
    // Floats read straight from the parquet list — no per-element coercion.
    normalized_bbox: value["normalized_bbox"] as NormalizedBbox,
    bbox_score: value["bbox_score"] as number,
  };
}

function parseAttributePrediction(
  value: Record<string, unknown>
): AttributePrediction {
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

function parseCategoryPrediction(
  value: Record<string, unknown>
): CategoryPrediction {
  const attributes =
    (value["attributes"] as Record<string, unknown>[] | null | undefined) ?? [];
  return {
    category_id: toNumber(value["category_id"]),
    name: value["name"] as string,
    score: value["score"] as number,
    attributes: attributes.map(parseAttributePrediction),
  };
}

function rowToDetectedObject(row: Record<string, unknown>): DetectedObject {
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
    bbox_observations: bboxObservations.map(parseBboxObservation),
    categories: categories.map(parseCategoryPrediction),
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

// Reads the zstd-compressed, object-forward parquet body and maps each row to
// one DetectedObject. The same format is used for both images and video; the
// image vs. video distinction and scalar metadata (frames_per_second, etc.)
// live in response headers, which the caller reads.
export async function deserializeDetectedObjects(
  parquetBytes: ArrayBuffer
): Promise<DetectedObject[]> {
  const rows = await parquetReadObjects({
    file: toAsyncBuffer(parquetBytes),
    compressors,
  });
  return (rows as Record<string, unknown>[]).map(rowToDetectedObject);
}
