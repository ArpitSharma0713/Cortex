import { describe, expect, it, vi } from "vitest";

const {
  clearDocumentChunksMock,
  downloadFromR2Mock,
  embedDocumentMock,
  extractTextFromBufferMock,
  insertChunksMock,
  tenantClient,
  updateDocumentStatusMock,
  withTenantContextMock,
  workerOnMock,
} = vi.hoisted(() => ({
  clearDocumentChunksMock: vi.fn().mockResolvedValue(undefined),
  downloadFromR2Mock: vi.fn().mockResolvedValue(Buffer.from("pdf")),
  embedDocumentMock: vi.fn().mockResolvedValue({ embedded: 1 }),
  extractTextFromBufferMock: vi.fn().mockResolvedValue({
    text: "hello world",
    pageCount: 2,
  }),
  insertChunksMock: vi.fn().mockResolvedValue([{ id: "chunk-1" }]),
  tenantClient: { query: vi.fn() },
  updateDocumentStatusMock: vi.fn().mockResolvedValue(undefined),
  withTenantContextMock: vi.fn(),
  workerOnMock: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(function WorkerMock() {
    return { on: workerOnMock };
  }),
}));

vi.mock("../src/config/redis.js", () => ({
  redisConnection: {},
}));

vi.mock("../src/middleware/withTenantContext.js", () => ({
  withTenantContext: withTenantContextMock,
}));

vi.mock("../src/services/documentService.js", () => ({
  clearDocumentChunks: clearDocumentChunksMock,
  insertChunks: insertChunksMock,
  updateDocumentStatus: updateDocumentStatusMock,
}));

vi.mock("../src/services/embeddingService.js", () => ({
  embedDocument: embedDocumentMock,
}));

vi.mock("../src/services/storageService.js", () => ({
  downloadFromR2: downloadFromR2Mock,
}));

vi.mock("../src/utils/pdfParser.js", () => ({
  extractTextFromBuffer: extractTextFromBufferMock,
}));

vi.mock("../src/utils/chunker.js", () => ({
  chunkText: vi.fn().mockReturnValue([
    { chunkIndex: 0, content: "hello world", tokenCount: 3 },
  ]),
}));

const { processDocumentJob } = await import("../src/workers/documentWorker.js");

describe("processDocumentJob", () => {
  it("downloads the stored PDF and marks the document ready", async () => {
    withTenantContextMock.mockImplementation(async (_userId, callback) =>
      callback(tenantClient),
    );

    const result = await processDocumentJob({
      data: {
        documentId: "doc-1",
        storageKey: "storage/key.pdf",
        workspaceId: "ws-1",
        userId: "user-1",
      },
    });

    expect(downloadFromR2Mock).toHaveBeenCalledWith("storage/key.pdf");
    expect(clearDocumentChunksMock).toHaveBeenCalledWith(
      tenantClient,
      "doc-1",
      "user-1",
    );
    expect(insertChunksMock).toHaveBeenCalledWith(
      tenantClient,
      [
        expect.objectContaining({
          documentId: "doc-1",
          workspaceId: "ws-1",
          userId: "user-1",
          chunkIndex: 0,
          content: "hello world",
          tokenCount: 3,
        }),
      ],
    );
    expect(embedDocumentMock).toHaveBeenCalledWith("doc-1", "user-1");
    expect(updateDocumentStatusMock).toHaveBeenLastCalledWith(
      tenantClient,
      "doc-1",
      "user-1",
      "ready",
      {
        pageCount: 2,
        chunkCount: 1,
        embeddedChunkCount: 1,
        errorMessage: null,
      },
    );
    expect(withTenantContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(result).toEqual({ chunkCount: 1, embedded: 1 });
  });
});
