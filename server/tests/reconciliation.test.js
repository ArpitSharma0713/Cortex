import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.QDRANT_COLLECTION = "test-chunks";

const { poolQueryMock, qdrantRetrieveMock } = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
  qdrantRetrieveMock: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: { query: poolQueryMock },
}));

vi.mock("../src/config/qdrant.js", () => ({
  qdrant: { retrieve: qdrantRetrieveMock },
}));

const { runReconciliation } = await import(
  "../src/jobs/reconciliation.js"
);

describe("runReconciliation", () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    qdrantRetrieveMock.mockReset();
  });

  it("reports zero drift when every embedded chunk exists in Qdrant", async () => {
    poolQueryMock.mockResolvedValueOnce({
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
    expect(qdrantRetrieveMock).toHaveBeenCalledWith("test-chunks", {
      ids: ["chunk-1", "chunk-2"],
    });
  });

  it("reports an embedded chunk that is missing from Qdrant", async () => {
    poolQueryMock.mockResolvedValueOnce({
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
});
