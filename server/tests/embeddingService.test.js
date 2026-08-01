import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientQueryMock,
  connectMock,
  embedTextsMock,
  poolQueryMock,
  qdrantUpsertMock,
  releaseMock,
  writeOutboxEventMock,
} = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  connectMock: vi.fn(),
  embedTextsMock: vi.fn(),
  poolQueryMock: vi.fn(),
  qdrantUpsertMock: vi.fn(),
  releaseMock: vi.fn(),
  writeOutboxEventMock: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: {
    connect: connectMock,
    query: poolQueryMock,
  },
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
    connectMock.mockReset().mockResolvedValue({
      query: clientQueryMock,
      release: releaseMock,
    });
    embedTextsMock.mockReset().mockResolvedValue([[0.1, 0.2]]);
    poolQueryMock.mockReset();
    qdrantUpsertMock.mockReset();
    releaseMock.mockReset();
    writeOutboxEventMock.mockReset().mockResolvedValue(undefined);
  });

  it("commits chunk state and vector payload through the same transaction", async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [chunk] })
      .mockResolvedValueOnce({ rows: [{ embedded_chunk_count: 1 }] });

    await expect(embedDocument(chunk.document_id)).resolves.toEqual({ embedded: 1 });

    expect(clientQueryMock).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("SET is_embedded = TRUE"),
      [[chunk.id]],
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
    expect(clientQueryMock).toHaveBeenLastCalledWith("COMMIT");
    expect(qdrantUpsertMock).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("rolls back chunk state when the outbox write fails", async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [chunk] });
    writeOutboxEventMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(embedDocument(chunk.document_id)).rejects.toThrow(
      "outbox unavailable",
    );

    expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });
});
