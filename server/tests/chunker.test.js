import { describe, expect, it } from "vitest";
import { chunkText } from "../src/utils/chunker.js";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const result = chunkText("Hello world.");

    expect(result).toHaveLength(1);
    expect(result[0].chunkIndex).toBe(0);
  });

  it("each chunk has content, tokenCount, chunkIndex", () => {
    const result = chunkText("Hello world.");

    expect(result[0]).toHaveProperty("content");
    expect(result[0]).toHaveProperty("tokenCount");
    expect(result[0]).toHaveProperty("chunkIndex");
  });

  it("tokenCount is positive for non-empty chunk", () => {
    const result = chunkText("Hello world.");

    expect(result[0].tokenCount).toBeGreaterThan(0);
  });

  it("produces multiple chunks for long text", () => {
    const longText = "This is a sentence. ".repeat(200);
    const result = chunkText(longText);

    expect(result.length).toBeGreaterThan(1);
  });

  it("no chunk exceeds max token count", () => {
    const longText = "This is a sentence. ".repeat(200);
    const result = chunkText(longText);

    result.forEach((chunk) => {
      expect(chunk.tokenCount).toBeLessThanOrEqual(600);
    });
  });

  it("splits text with no sentence boundaries at the character limit", () => {
    const result = chunkText("a".repeat(5000));

    expect(result.length).toBeGreaterThan(1);
    expect(result[0].content).toHaveLength(2048);
  });

  it("returns one chunk for exactly 512 approximate tokens", () => {
    const result = chunkText("a".repeat(512 * 4));

    expect(result).toHaveLength(1);
    expect(result[0].tokenCount).toBe(512);
  });
});
