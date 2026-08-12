import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientQueryMock,
  embedTextsMock,
  qdrantUpsertMock,
  withTenantContextMock,
  writeOutboxEventMock,
} = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  embedTextsMock: vi.fn(),
  qdrantUpsertMock: vi.fn(),
  withTenantContextMock: vi.fn(),
  writeOutboxEventMock: vi.fn(),
}));

vi.mock("../src/middleware/withTenantContext.js", () => ({
  withTenantContext: withTenantContextMock,
}));

vi.mock("../src/config/qdrant.js", () => ({
  qdrant: {
    delete: vi.fn(),
    upsert: qdrantUpsertMock,
  },
}));

vi.mock("../src/utils/embedder.js", () => ({
  embedTexts: embedTextsMock,
}));

vi.mock("../src/services/outboxService.js", () => ({
  writeOutboxEvent: writeOutboxEventMock,
}));

const { embedDocument } = await import("../src/services/embeddingService.js");

const chunk = {
  id: "11111111-1111-4111-8111-111111111111",
  document_id: "22222222-2222-4222-8222-222222222222",
  workspace_id: "33333333-3333-4333-8333-333333333333",
  user_id: "44444444-4444-4444-8444-444444444444",
  chunk_index: 0,
  token_count: 3,
  page_number: 1,
  content: "hello world",
};

describe("embedDocument", () => {
  beforeEach(() => {
    clientQueryMock.mockReset().mockResolvedValue({ rowCount: 1 });
    embedTextsMock.mockReset().mockResolvedValue([[0.1, 0.2]]);
    qdrantUpsertMock.mockReset();
    withTenantContextMock
      .mockReset()
      .mockImplementation(async (_userId, callback) =>
        callback({ query: clientQueryMock }),
      );
    writeOutboxEventMock.mockReset().mockResolvedValue(undefined);
  });

  it("commits chunk state and vector payload through the same transaction", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("SELECT *") && sql.includes("FROM chunks")) {
        return { rows: [chunk] };
      }

      if (sql.includes("SELECT embedded_chunk_count")) {
        return { rows: [{ embedded_chunk_count: 1 }] };
      }

      return { rowCount: 1, rows: [] };
    });

    await expect(
      embedDocument(chunk.document_id, chunk.user_id),
    ).resolves.toEqual({ embedded: 1 });

    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET is_embedded = TRUE"),
      [[chunk.id], chunk.user_id],
    );
    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: clientQueryMock }),
      expect.objectContaining({
        eventType: "chunks_embedded",
        documentId: chunk.document_id,
        workspaceId: chunk.workspace_id,
        payload: {
          points: [
            expect.objectContaining({
              id: chunk.id,
              vector: [0.1, 0.2],
            }),
          ],
        },
      }),
    );
    expect(clientQueryMock).toHaveBeenCalledWith("COMMIT");
    expect(qdrantUpsertMock).not.toHaveBeenCalled();
    expect(withTenantContextMock).toHaveBeenCalledWith(
      chunk.user_id,
      expect.any(Function),
    );
  });

  it("rolls back chunk state when the outbox write fails", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("SELECT *") && sql.includes("FROM chunks")) {
        return { rows: [chunk] };
      }

      return { rowCount: 1, rows: [] };
    });
    writeOutboxEventMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(
      embedDocument(chunk.document_id, chunk.user_id),
    ).rejects.toThrow("outbox unavailable");

    expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
  });
});
