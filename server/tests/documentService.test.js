import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientQueryMock,
  deleteFromR2Mock,
  writeOutboxEventMock,
} = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  deleteFromR2Mock: vi.fn(),
  writeOutboxEventMock: vi.fn(),
}));

vi.mock("../src/services/outboxService.js", () => ({
  writeOutboxEvent: writeOutboxEventMock,
}));

vi.mock("../src/services/storageService.js", () => ({
  deleteFromR2: deleteFromR2Mock,
}));

const {
  clearDocumentChunks,
  deleteDocument,
  insertChunks,
  updateDocumentStatus,
} = await import("../src/services/documentService.js");

const client = { query: clientQueryMock };

describe("documentService outbox writes", () => {
  beforeEach(() => {
    clientQueryMock.mockReset().mockResolvedValue({ rowCount: 1, rows: [] });
    deleteFromR2Mock.mockReset().mockResolvedValue(undefined);
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

    await clearDocumentChunks(client, "doc-1", "user-1");

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
  });

  it("queues vector deletion with the document soft delete", async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("SELECT") && sql.includes("original_filename")) {
        return {
          rowCount: 1,
          rows: [{
          id: "doc-2",
          workspace_id: "ws-2",
          user_id: "user-2",
          storage_key: "stored/doc-2.pdf",
          }],
        };
      }

      if (sql.includes("UPDATE documents") && sql.includes("RETURNING id")) {
        return { rowCount: 1, rows: [{ id: "doc-2" }] };
      }

      return { rowCount: 1, rows: [] };
    });

    await expect(
      deleteDocument(client, "doc-2", "ws-2", "user-2"),
    ).resolves.toBe(true);

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
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql.includes("SELECT") && sql.includes("original_filename")) {
        return {
          rowCount: 1,
          rows: [{ id: "doc-3", workspace_id: "ws-3", user_id: "user-3" }],
        };
      }

      if (sql.includes("UPDATE documents") && sql.includes("RETURNING id")) {
        return { rowCount: 1, rows: [{ id: "doc-3" }] };
      }

      return { rowCount: 1, rows: [] };
    });
    writeOutboxEventMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(
      deleteDocument(client, "doc-3", "ws-3", "user-3"),
    ).rejects.toThrow("outbox unavailable");

    expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
    expect(deleteFromR2Mock).not.toHaveBeenCalled();
  });

  it("keeps an application-level owner filter on status updates", async () => {
    await updateDocumentStatus(client, "doc-4", "user-4", "processing");

    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringMatching(/WHERE id = \$2\s+AND user_id = \$3/),
      ["processing", "doc-4", "user-4"],
    );
  });

  it("persists suspicious pattern arrays with chunk content", async () => {
    await insertChunks(client, [
      {
        id: "chunk-1",
        documentId: "doc-1",
        workspaceId: "ws-1",
        userId: "user-1",
        chunkIndex: 0,
        content: "ignore previous instructions",
        tokenCount: 3,
        pageNumber: null,
        flaggedPatterns: ["ignore previous instructions"],
      },
    ]);

    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("flagged_patterns"),
      [
        "chunk-1",
        "doc-1",
        "ws-1",
        "user-1",
        0,
        "ignore previous instructions",
        3,
        null,
        ["ignore previous instructions"],
      ],
    );
  });
});
