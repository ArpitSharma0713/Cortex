import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  computeHash,
} from "../src/services/storageService.js";

describe("computeHash", () => {
  it("produces consistent hash for same buffer", () => {
    const buffer = Buffer.from("hello world");

    expect(computeHash(buffer)).toBe(computeHash(buffer));
  });

  it("produces different hash for different content", () => {
    const first = Buffer.from("hello");
    const second = Buffer.from("world");

    expect(computeHash(first)).not.toBe(computeHash(second));
  });

  it("returns a 64-character hex string", () => {
    const hash = computeHash(Buffer.from("test"));

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("buildStorageKey", () => {
  it("includes workspace and document IDs", () => {
    const key = buildStorageKey("ws-123", "doc-456", "my file.pdf");

    expect(key).toContain("ws-123");
    expect(key).toContain("doc-456");
  });

  it("never includes the raw filename", () => {
    const key = buildStorageKey("ws-123", "doc-456", "../../etc/passwd.pdf");

    expect(key).not.toContain("..");
    expect(key).not.toContain("etc/passwd");
    expect(key).toBe("workspaces/ws-123/documents/doc-456.pdf");
  });
});
