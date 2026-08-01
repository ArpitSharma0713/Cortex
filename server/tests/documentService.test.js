import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientQueryMock,
  connectMock,
  deleteFromR2Mock,
  poolQueryMock,
  releaseMock,
  writeOutboxEventMock,
} = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  connectMock: vi.fn(),
  deleteFromR2Mock: vi.fn(),
  poolQueryMock: vi.fn(),
  releaseMock: vi.fn(),
  writeOutboxEventMock: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: {
    connect: connectMock,
    query: poolQueryMock,
  },
}));

vi.mock("../src/services/outboxService.js", () => ({
  writeOutboxEvent: writeOutboxEventMock,
}));

vi.mock("../src/services/storageService.js", () => ({
  deleteFromR2: deleteFromR2Mock,
}));

const { clearDocumentChunks, deleteDocument } = await import(
  "../src/services/documentService.js"
);

describe("documentService outbox writes", () => {
  beforeEach(() => {
    clientQueryMock.mockReset().mockResolvedValue({ rowCount: 1, rows: [] });
    connectMock.mockReset().mockResolvedValue({
      query: clientQueryMock,
      release: releaseMock,
    });
    deleteFromR2Mock.mockReset().mockResolvedValue(undefined);
    poolQueryMock.mockReset();
    releaseMock.mockReset();
    writeOutboxEventMock.mockReset().mockResolvedValue(undefined);
  });

  it("queues vector cleanup in the same transaction as retry chunk cleanup", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("SELECT") && sql.includes("has_chunks")) {
        return {
          rowCount: 1,
          rows: [{ workspace_id: "ws-1", has_chunks: true }],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await clearDocumentChunks("doc-1");

    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: clientQueryMock }),
      {
        eventType: "document_deleted",
        documentId: "doc-1",
        workspaceId: "ws-1",
        payload: { documentId: "doc-1" },
      },
    );
    expect(clientQueryMock).toHaveBeenLastCalledWith("COMMIT");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("queues vector deletion with the document soft delete", async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "doc-2",
          workspace_id: "ws-2",
          user_id: "user-2",
          storage_key: "stored/doc-2.pdf",
        },
      ],
    });
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("UPDATE documents") && sql.includes("RETURNING id")) {
        return { rowCount: 1, rows: [{ id: "doc-2" }] };
      }

      return { rowCount: 1, rows: [] };
    });

    await expect(deleteDocument("doc-2", "ws-2", "user-2")).resolves.toBe(true);

    expect(writeOutboxEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: clientQueryMock }),
      {
        eventType: "document_deleted",
        documentId: "doc-2",
        workspaceId: "ws-2",
        payload: { documentId: "doc-2" },
      },
    );
    expect(deleteFromR2Mock).toHaveBeenCalledWith("stored/doc-2.pdf");
    expect(clientQueryMock).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rolls back a document delete when the outbox write fails", async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: "doc-3", workspace_id: "ws-3", user_id: "user-3" }],
    });
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("UPDATE documents") && sql.includes("RETURNING id")) {
        return { rowCount: 1, rows: [{ id: "doc-3" }] };
      }

      return { rowCount: 1, rows: [] };
    });
    writeOutboxEventMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(deleteDocument("doc-3", "ws-3", "user-3")).rejects.toThrow(
      "outbox unavailable",
    );

    expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });
});
