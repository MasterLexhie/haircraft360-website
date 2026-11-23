import { describe, expect, it } from "vitest";
import { readPhoto, servicePhotoUrl } from "@/domain/photo";
import { webpBytes } from "../factories";

/** A JPEG start: SOI, an APP0 segment, then a baseline frame header with the given size. */
function jpegBytes(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
}

describe("readPhoto", () => {
  it("reads the type and size of a WebP", () => {
    expect(readPhoto(webpBytes(1600, 1067))).toEqual({ contentType: "image/webp", width: 1600, height: 1067 });
  });

  it("reads the type and size of a JPEG, skipping the segments before the frame", () => {
    expect(readPhoto(jpegBytes(1200, 900))).toEqual({ contentType: "image/jpeg", width: 1200, height: 900 });
  });

  it.each([
    ["an empty file", new Uint8Array()],
    ["a PNG", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)])],
    ["HTML pretending to be a photo", new TextEncoder().encode("<html><script>alert(1)</script></html>".padEnd(60, " "))],
    ["a photo far larger than an upload should be", webpBytes(9000, 9000)],
  ])("refuses %s", (_, bytes) => {
    expect(readPhoto(bytes)).toBeNull();
  });
});

describe("servicePhotoUrl", () => {
  it("builds the photo's own address", () => {
    expect(servicePhotoUrl("svc_1", "abc123")).toBe("/media/services/svc_1/abc123");
  });
});
