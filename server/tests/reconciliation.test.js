import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.QDRANT_COLLECTION = "test-chunks";

const {
  poolQueryMock,
  qdrantRetrieveMock,
  tenantClientQueryMock,
  withTenantContextMock,
} = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
  qdrantRetrieveMock: vi.fn(),
  tenantClientQueryMock: vi.fn(),
  withTenantContextMock: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: { query: poolQueryMock },
}));

vi.mock("../src/config/qdrant.js", () => ({
  qdrant: { retrieve: qdrantRetrieveMock },
}));

vi.mock("../src/middleware/withTenantContext.js", () => ({
  withTenantContext: withTenantContextMock,
}));

const { runReconciliation } = await import(
  "../src/jobs/reconciliation.js"
);

describe("runReconciliation", () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    qdrantRetrieveMock.mockReset();
    tenantClientQueryMock.mockReset();
    withTenantContextMock
      .mockReset()
      .mockImplementation(async (_userId, callback) =>
        callback({ query: tenantClientQueryMock }),
      );
  });

  it("reports zero drift when every embedded chunk exists in Qdrant", async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: "user-1" }],
    });
    tenantClientQueryMock.mockResolvedValueOnce({
      rows: [
        { id: "chunk-1", document_id: "doc-1" },
        { id: "chunk-2", document_id: "doc-1" },
      ],
    });
    qdrantRetrieveMock.mockResolvedValueOnce([
      { id: "chunk-1" },
      { id: "chunk-2" },
    ]);

    await expect(runReconciliation()).resolves.toEqual({
      checked: 2,
      missing: 0,
    });
    expect(tenantClientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("documents.deleted_at IS NULL"),
      ["user-1"],
    );
    expect(withTenantContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(qdrantRetrieveMock).toHaveBeenCalledWith("test-chunks", {
      ids: ["chunk-1", "chunk-2"],
    });
  });

  it("reports an embedded chunk that is missing from Qdrant", async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: "user-1" }],
    });
    tenantClientQueryMock.mockResolvedValueOnce({
      rows: [
        { id: "chunk-1", document_id: "doc-1" },
        { id: "chunk-2", document_id: "doc-1" },
      ],
    });
    qdrantRetrieveMock.mockResolvedValueOnce([{ id: "chunk-1" }]);

    await expect(runReconciliation()).resolves.toEqual({
      checked: 2,
      missing: 1,
    });
  });

  it("scans every user separately so forced RLS cannot hide drift", async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: "user-1" }, { id: "user-2" }],
    });
    tenantClientQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "chunk-1", document_id: "doc-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "chunk-2", document_id: "doc-2" }] });
    qdrantRetrieveMock.mockResolvedValueOnce([
      { id: "chunk-1" },
      { id: "chunk-2" },
    ]);

    await expect(runReconciliation()).resolves.toEqual({
      checked: 2,
      missing: 0,
    });
    expect(withTenantContextMock).toHaveBeenNthCalledWith(
      1,
      "user-1",
      expect.any(Function),
    );
    expect(withTenantContextMock).toHaveBeenNthCalledWith(
      2,
      "user-2",
      expect.any(Function),
    );
  });
});
