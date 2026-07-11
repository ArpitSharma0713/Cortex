import { describe, expect, it } from "vitest";
import { buildRagPrompt } from "../src/utils/promptBuilder.js";

describe("buildRagPrompt", () => {
  it("returns null when no chunks provided", () => {
    expect(buildRagPrompt("question", [])).toBeNull();
  });

  it("includes the question as userPrompt", () => {
    const result = buildRagPrompt("what is X?", [{ content: "X is a thing" }]);
    expect(result.userPrompt).toBe("what is X?");
  });

  it("includes chunk content in systemPrompt", () => {
    const result = buildRagPrompt("q", [{ content: "unique marker text" }]);
    expect(result.systemPrompt).toContain("unique marker text");
  });

  it("numbers multiple sources sequentially", () => {
    const chunks = [{ content: "first" }, { content: "second" }];
    const result = buildRagPrompt("q", chunks);
    expect(result.systemPrompt).toContain("[Source 1]");
    expect(result.systemPrompt).toContain("[Source 2]");
  });

  it("instructs the model to admit missing information", () => {
    const result = buildRagPrompt("q", [{ content: "x" }]);
    expect(result.systemPrompt.toLowerCase()).toContain("don't");
  });
});
