import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/20260818_add_chunk_content_flags.sql",
  import.meta.url,
);

describe("chunk content flags migration", () => {
  it("adds a nullable text array for suspicious pattern matches", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toMatch(
      /ALTER TABLE chunks\s+ADD COLUMN IF NOT EXISTS flagged_patterns TEXT\[\]/,
    );
  });
});
