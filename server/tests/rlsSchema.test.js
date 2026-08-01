import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../migrations/20260801_add_document_rls.sql",
  import.meta.url,
);

describe("document RLS migration", () => {
  it("forces default-deny tenant policies on documents and chunks", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain("current_setting('app.current_user_id', true)");

    for (const table of ["documents", "chunks"]) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY tenant_isolation_${table} ON ${table}\\s+FOR ALL\\s+USING \\(user_id = public\\.current_user_id\\(\\)\\)\\s+WITH CHECK \\(user_id = public\\.current_user_id\\(\\)\\)`,
        ),
      );
    }
  });
});
