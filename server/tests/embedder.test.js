import { describe, expect, it, vi } from "vitest";

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function createOpenAIMock() {
    return {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [
            { embedding: new Array(1536).fill(0.1) },
            { embedding: new Array(1536).fill(0.2) },
          ],
        }),
      },
    };
  }),
}));

vi.mock("../src/utils/llm.js", () => ({
  callWithRetry: vi.fn().mockImplementation((fn) => fn()),
}));

const { embedQuery, embedTexts } = await import("../src/utils/embedder.js");

describe("embedder", () => {
  it("returns one vector per input text", async () => {
    const result = await embedTexts(["hello", "world"]);
    expect(result).toHaveLength(2);
  });

  it("each vector has correct dimension", async () => {
    const result = await embedTexts(["hello", "world"]);
    expect(result[0]).toHaveLength(1536);
  });

  it("embedQuery returns a single vector", async () => {
    const result = await embedQuery("what is cortex?");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1536);
  });

  it("all values in vector are numbers", async () => {
    const result = await embedTexts(["test"]);
    result[0].forEach((value) => expect(typeof value).toBe("number"));
  });
});
