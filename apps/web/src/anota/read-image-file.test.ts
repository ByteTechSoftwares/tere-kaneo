import { describe, expect, it } from "vitest";
import { readImageFile } from "./read-image-file";

describe("readImageFile", () => {
  it("round-trips a small blob to the base64 of its bytes with no data-URL prefix remaining", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 250]);
    const file = new File([bytes], "photo.png", { type: "image/png" });

    const payload = await readImageFile(file);

    const expectedBase64 = Buffer.from(bytes).toString("base64");
    expect(payload.data).toBe(expectedBase64);
    expect(payload.data.startsWith("data:")).toBe(false);
    expect(payload.data.includes("base64,")).toBe(false);
  });

  it("returns the file's own type as contentType", async () => {
    const file = new File([new Uint8Array([1])], "photo.jpg", {
      type: "image/jpeg",
    });

    const payload = await readImageFile(file);

    expect(payload.contentType).toBe("image/jpeg");
  });

  it("rejects when the underlying read fails", async () => {
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (this: FileReader) {
      queueMicrotask(() => {
        this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      });
    };

    const file = new File([new Uint8Array([1])], "photo.png", {
      type: "image/png",
    });

    await expect(readImageFile(file)).rejects.toBeTruthy();

    FileReader.prototype.readAsDataURL = originalReadAsDataURL;
  });
});
