declare module "bidi-js" {
  type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  };
  type ReorderSegment = [number, number];

  interface BidiAPI {
    getEmbeddingLevels(text: string, baseDirection?: "ltr" | "rtl" | "auto"): EmbeddingLevels;
    getReorderSegments(text: string, levels: EmbeddingLevels): ReorderSegment[];
    getReorderedString(text: string, levels: EmbeddingLevels): string;
  }

  export default function bidiFactory(): BidiAPI;
}
