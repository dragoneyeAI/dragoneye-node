// media.ts
import { IncorrectMediaTypeError } from "./exception";

type ImageMime = `image/${string}`;
type VideoMime = `video/${string}`;
type ImageOrVideoMime = ImageMime | VideoMime;

function isImageOrVideo(
  mime: string | undefined | null
): mime is ImageOrVideoMime {
  return (
    typeof mime === "string" &&
    (mime.startsWith("image/") || mime.startsWith("video/"))
  );
}
function isImageMime(mime: string): mime is ImageMime {
  return mime.startsWith("image/");
}
function isVideoMime(mime: string): mime is VideoMime {
  return mime.startsWith("video/");
}

/** Derive an instance type from a constructor's prototype without requiring a public constructor. */
type ThisInstance<T> = T extends { prototype: infer P } ? P : never;

/**
 * Cross-runtime media holder for image/video uploads (Node 18+ and browsers).
 * No fallbacks to application/octet-stream. Constructors will throw unless the
 * MIME type is image/* or video/*.
 */
export abstract class Media {
  abstract readonly kind: "image" | "video";
  readonly mimeType: ImageOrVideoMime;
  private _blob: Blob;

  // Make Media non-instantiable from the outside and only by subclasses.
  protected constructor(blob: Blob, mimeType: ImageOrVideoMime) {
    this._blob = blob;
    this.mimeType = mimeType;
  }

  /** Blob used for multipart upload. */
  toBlob(): Blob {
    return this._blob;
  }

  // ---------- Polymorphic factories (browser + Node) ----------
  // These use a polymorphic `this` so that Image.* returns Image and Video.* returns Video.

  /**
   * Create from a Blob/File. If Blob has no type or it's not image/video,
   * you must supply a valid `mimeTypeOverride`.
   */
  static fromBlob<T extends typeof Media>(
    this: T,
    blob: Blob,
    mimeTypeOverride?: string
  ): ThisInstance<T> {
    const candidate = (mimeTypeOverride ?? blob.type ?? "").trim();
    if (!isImageOrVideo(candidate)) {
      throw new IncorrectMediaTypeError(
        `Invalid MIME type for ${this.name}.fromBlob: "${
          candidate || "(missing)"
        }". Expected ${expectedFamilyText(this)}`
      );
    }
    enforceFamilyOrThrow(this, candidate, "fromBlob");
    return constructForThis(this, blob, candidate);
  }

  static fromFile<T extends typeof Media>(
    this: T,
    file: File
  ): ThisInstance<T> {
    return this.fromBlob(file);
  }

  static fromArrayBuffer<T extends typeof Media>(
    this: T,
    buf: ArrayBuffer,
    mimeType: string
  ): ThisInstance<T> {
    if (!isImageOrVideo(mimeType)) {
      throw new IncorrectMediaTypeError(
        `Invalid MIME type for ${
          this.name
        }.fromArrayBuffer: "${mimeType}". Expected ${expectedFamilyText(this)}`
      );
    }
    enforceFamilyOrThrow(this, mimeType, "fromArrayBuffer");
    return constructForThis(
      this,
      new Blob([buf], { type: mimeType }),
      mimeType
    );
  }

  static fromUint8Array<T extends typeof Media>(
    this: T,
    u8: Uint8Array,
    mimeType: string
  ): ThisInstance<T> {
    if (!isImageOrVideo(mimeType)) {
      throw new IncorrectMediaTypeError(
        `Invalid MIME type for ${
          this.name
        }.fromUint8Array: "${mimeType}". Expected ${expectedFamilyText(this)}`
      );
    }
    enforceFamilyOrThrow(this, mimeType, "fromUint8Array");
    return constructForThis(this, new Blob([u8], { type: mimeType }), mimeType);
  }

  static fromBase64<T extends typeof Media>(
    this: T,
    base64: string,
    mimeType: string
  ): ThisInstance<T> {
    if (!isImageOrVideo(mimeType)) {
      throw new IncorrectMediaTypeError(
        `Invalid MIME type for ${
          this.name
        }.fromBase64: "${mimeType}". Expected ${expectedFamilyText(this)}`
      );
    }
    enforceFamilyOrThrow(this, mimeType, "fromBase64");

    const hasAtob = typeof (globalThis as any).atob === "function";
    let u8: Uint8Array;
    if (hasAtob) {
      const bin = (globalThis as any).atob(base64);
      u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    } else {
      // Node
      u8 = Uint8Array.from(Buffer.from(base64, "base64"));
    }
    return this.fromUint8Array(u8, mimeType);
  }

  /**
   * Fetches the resource and uses its Content-Type unless you pass an override.
   * If neither resolve to image/* or video/*, throws.
   */
  static async fromUrl<T extends typeof Media>(
    this: T,
    url: string,
    mimeTypeOverride?: string
  ): Promise<ThisInstance<T>> {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch media from URL: ${resp.status} ${resp.statusText}`
      );
    }
    // Prefer explicit override, else header, else blob.type
    const headerType = resp.headers.get("content-type")?.split(";")[0]?.trim();
    const blob = await resp.blob();
    const resolved = (mimeTypeOverride ?? headerType ?? blob.type)?.trim();

    if (!isImageOrVideo(resolved)) {
      throw new IncorrectMediaTypeError(
        `Remote resource is not ${expectedFamilyText(this)} (Content-Type "${
          headerType || blob.type || "unknown"
        }"). Provide a valid ${expectedFamilyText(this)} mimeTypeOverride.`
      );
    }
    enforceFamilyOrThrow(this, resolved, "fromUrl");
    return constructForThis(this, blob, resolved);
  }

  /**
   * Node-only helper: read a local file path into a Media.
   * Attempts to guess MIME by extension if none is provided; throws if not image/video.
   */
  static async fromFilePath<T extends typeof Media>(
    this: T,
    filePath: string,
    mimeType?: string
  ): Promise<ThisInstance<T>> {
    const [{ readFile }, { extname }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const buf = await readFile(filePath);
    const guessed = (
      mimeType ?? guessMimeByExt(extname(filePath).toLowerCase())
    )?.trim();

    if (!isImageOrVideo(guessed)) {
      throw new IncorrectMediaTypeError(
        `Cannot infer a valid ${expectedFamilyText(
          this
        )} MIME type for "${filePath}". ` +
          `Pass an explicit ${expectedFamilyText(this)} mimeType.`
      );
    }
    enforceFamilyOrThrow(this, guessed, "fromFilePath");
    return this.fromUint8Array(buf, guessed);
  }
}

// ---------- Subclasses (guarantee MIME family) ----------

export class Image extends Media {
  readonly kind = "image";

  /* @internal */ constructor(blob: Blob, mimeType: ImageMime) {
    if (!isImageMime(mimeType)) {
      throw new IncorrectMediaTypeError(
        `Image requires image/* MIME; got "${mimeType}"`
      );
    }
    super(blob, mimeType);
  }
}

export class Video extends Media {
  readonly kind = "video";

  /* @internal */ constructor(blob: Blob, mimeType: VideoMime) {
    if (!isVideoMime(mimeType)) {
      throw new IncorrectMediaTypeError(
        `Video requires video/* MIME; got "${mimeType}"`
      );
    }
    super(blob, mimeType);
  }
}

// ---------- Small internal helpers ----------

function constructForThis<T extends typeof Media>(
  ctor: T,
  blob: Blob,
  mime: ImageOrVideoMime
): ThisInstance<T> {
  // We rely on the subclass constructor to re-validate the family.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (ctor as any)(blob, mime);
}

function enforceFamilyOrThrow<T extends typeof Media>(
  ctor: T,
  mime: ImageOrVideoMime,
  ctx: string
): void {
  const ctorName = (ctor as Function).name;
  const isImageCall = ctorName === "Image";
  const isVideoCall = ctorName === "Video";

  if (isImageCall && !isImageMime(mime)) {
    throw new IncorrectMediaTypeError(
      `Invalid MIME type for Image.${ctx}: "${mime}". Expected image/*`
    );
  }
  if (isVideoCall && !isVideoMime(mime)) {
    throw new IncorrectMediaTypeError(
      `Invalid MIME type for Video.${ctx}: "${mime}". Expected video/*`
    );
  }
}

function expectedFamilyText<T extends typeof Media>(ctor: T): string {
  const ctorName = (ctor as Function).name;
  if (ctorName === "Image") return "image/*";
  if (ctorName === "Video") return "video/*";
  // Fallback if ever referenced on base (shouldn't be in normal use).
  return "image/* or video/*";
}

function guessMimeByExt(ext: string): string | undefined {
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    default:
      return undefined;
  }
}
