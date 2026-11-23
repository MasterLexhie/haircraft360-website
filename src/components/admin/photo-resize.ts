import { MAX_PHOTO_BYTES, PHOTO_MAX_EDGE } from "@/domain/photo";

export class PhotoReadError extends Error {}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Shrinks a photo in the browser before upload: turned the right way up, at most PHOTO_MAX_EDGE
 * on its longest side, saved as WebP (JPEG where the browser can't write WebP), under MAX_PHOTO_BYTES.
 * Phone photos of several MB end up around 150 to 300 KB.
 */
export async function shrinkPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoReadError("This browser couldn't open that file. Try a JPEG or PNG photo.");
  }
  try {
    for (const edge of [PHOTO_MAX_EDGE, 1200, 900]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PhotoReadError("This browser couldn't prepare the photo.");
      // A white ground, so transparent PNGs don't turn black as JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const quality of [0.82, 0.7]) {
        let blob = await encode(canvas, "image/webp", quality);
        if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality + 0.03);
        if (blob && blob.size <= MAX_PHOTO_BYTES) return { blob, width, height };
      }
    }
  } finally {
    bitmap.close();
  }
  throw new PhotoReadError("That photo is too detailed to shrink enough. Try another one.");
}
