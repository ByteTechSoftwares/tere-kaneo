// read-image-file.ts
//
// 06-03 (L74, panel client half): converts a picked File into the raw
// base64 payload the Worker's /panel/message endpoint expects. Stripping
// the "data:image/png;base64," prefix here is required -- the Worker
// expects raw base64 with no data-URL prefix and rejects anything else as
// a bad encoding (06-02-SUMMARY.md's shipped request contract). Kept free
// of React imports so it stays trivially testable in isolation.

export interface PanelImagePayload {
  readonly data: string;
  readonly contentType: string;
}

export function readImageFile(file: File): Promise<PanelImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result type"));
        return;
      }
      // Data URLs look like "data:image/png;base64,iVBOR..." -- the
      // Worker wants only the part after the first comma, raw and
      // unprefixed.
      const commaIndex = result.indexOf(",");
      const data = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
      resolve({ data, contentType: file.type });
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}
