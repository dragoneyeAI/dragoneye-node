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
  ClassificationAttributeOption,
  ClassificationAttributeResponse,
  ClassificationCategory,
  ClassificationCategoryPrediction,
  ClassificationObjectPrediction,
  ClassificationVideoObjectPrediction,
} from "./models.js";
import type { NormalizedBbox } from "./common.js";

// hyparquet routes each column chunk's codec to compressors[codec] when present.
// We pre-size the output buffer to the page's uncompressed length so decoding
// works even for Zstd frames written without a content-size header.
const compressors = {
  ZSTD: (input: Uint8Array, outputLength: number): Uint8Array =>
    zstdDecompress(input, new Uint8Array(outputLength)),
};

// Row shape after parquet decoding. Matches the server-side schema:
// image_id:           string
// normalized_bbox:    Float64[4]
// bbox_score:         number
// predictions:        RawPrediction[]
// timestamp_microseconds (video only): number | bigint
// hyparquet decodes parquet INT64 columns as bigint, so id fields arrive as
// number | bigint and must be narrowed before leaving this module.
interface RawOption {
  option_id: number | bigint;
  name: string;
  score: number;
}

interface RawAttribute {
  attribute_id: number | bigint;
  name: string;
  options: RawOption[];
}

interface RawPrediction {
  category_id: number | bigint;
  name: string;
  score: number;
  attributes: RawAttribute[];
}

// hyparquet returns `undefined` (not `null`) for null parquet cells, so every
// nullable column must include `undefined` in its type — casts on these fields
// would otherwise silently lie.
interface RawRow {
  image_id: string;
  normalized_bbox: [number, number, number, number] | null | undefined;
  bbox_score: number | null | undefined;
  predictions: RawPrediction[] | null | undefined;
  timestamp_microseconds?: number | bigint | null | undefined;
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function predictionsToModels(
  raw: RawPrediction[] | null | undefined
): ClassificationCategoryPrediction[] {
  if (!raw) return [];
  return raw.map((pred) => ({
    category: {
      id: toNumber(pred.category_id),
      name: pred.name,
      score: pred.score,
    } satisfies ClassificationCategory,
    attributes: (pred.attributes ?? []).map(
      (attr): ClassificationAttributeResponse => ({
        attribute_id: toNumber(attr.attribute_id),
        name: attr.name,
        options: (attr.options ?? []).map(
          (opt): ClassificationAttributeOption => ({
            option_id: toNumber(opt.option_id),
            name: opt.name,
            score: opt.score,
          })
        ),
      })
    ),
  }));
}

function toAsyncBuffer(buffer: ArrayBuffer) {
  return {
    byteLength: buffer.byteLength,
    slice(start: number, end?: number) {
      return buffer.slice(start, end);
    },
  };
}

async function readRows(parquetBytes: ArrayBuffer): Promise<RawRow[]> {
  const rows = await parquetReadObjects({
    file: toAsyncBuffer(parquetBytes),
    compressors,
  });
  return rows as unknown as RawRow[];
}

export async function deserializeImagePredictions(
  parquetBytes: ArrayBuffer
): Promise<ClassificationObjectPrediction[]> {
  const rows = await readRows(parquetBytes);
  return rows
    .filter((row) => row.normalized_bbox != null)
    .map((row) => ({
      normalizedBbox: row.normalized_bbox as NormalizedBbox,
      predictions: predictionsToModels(row.predictions),
    }));
}

export async function deserializeVideoPredictions(
  parquetBytes: ArrayBuffer
): Promise<Record<number, ClassificationVideoObjectPrediction[]>> {
  const rows = await readRows(parquetBytes);
  const result: Record<number, ClassificationVideoObjectPrediction[]> = {};

  for (const row of rows) {
    if (row.timestamp_microseconds == null) {
      continue;
    }
    const ts = toNumber(row.timestamp_microseconds);
    if (result[ts] === undefined) {
      result[ts] = [];
    }
    if (row.normalized_bbox != null) {
      result[ts].push({
        normalizedBbox: row.normalized_bbox as NormalizedBbox,
        predictions: predictionsToModels(row.predictions),
        frame_id: row.image_id,
        timestamp_microseconds: ts,
      });
    }
  }

  return result;
}
