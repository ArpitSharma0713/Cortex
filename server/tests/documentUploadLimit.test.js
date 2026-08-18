import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  computeHashMock,
  enqueueDocumentProcessingMock,
  getUploadCountTodayMock,
  getWorkspaceByIdMock,
  withTenantContextMock,
} = vi.hoisted(() => ({
  computeHashMock: vi.fn(),
  enqueueDocumentProcessingMock: vi.fn(),
  getUploadCountTodayMock: vi.fn(),
  getWorkspaceByIdMock: vi.fn(),
  withTenantContextMock: vi.fn(),
}));

vi.mock("../src/queues/documentQueue.js", () => ({
  enqueueDocumentProcessing: enqueueDocumentProcessingMock,
  retryDocumentProcessing: vi.fn(),
}));

vi.mock("../src/services/documentService.js", () => ({
  getUploadCountToday: getUploadCountTodayMock,
}));

vi.mock("../src/services/storageService.js", () => ({
  buildStorageKey: vi.fn(),
  computeHash: computeHashMock,
  downloadFromR2: vi.fn(),
  uploadToR2: vi.fn(),
}));

vi.mock("../src/services/workspaceService.js", () => ({
  getWorkspaceById: getWorkspaceByIdMock,
}));

vi.mock("../src/middleware/withTenantContext.js", () => ({
  withTenantContext: withTenantContextMock,
}));

const { uploadDocument } = await import("../src/controllers/documentController.js");

describe("document upload limit", () => {
  beforeEach(() => {
    getWorkspaceByIdMock.mockReset().mockResolvedValue({ id: "workspace-1" });
    getUploadCountTodayMock.mockReset().mockResolvedValue(20);
    computeHashMock.mockReset();
    enqueueDocumentProcessingMock.mockReset();
    withTenantContextMock.mockReset().mockImplementation((userId, callback) =>
      callback({ query: vi.fn() }),
    );
  });

  it("returns 429 before storage or queue work when the daily cap is reached", async () => {
    const req = {
      file: {
        buffer: Buffer.from("pdf"),
        originalname: "test.pdf",
        mimetype: "application/pdf",
        size: 3,
      },
      params: { workspaceId: "workspace-1" },
      user: { id: "user-1" },
      body: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await uploadDocument(req, res, next);

    expect(withTenantContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(getUploadCountTodayMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.any(Function) }),
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Daily upload limit reached",
      limit: 20,
    });
    expect(computeHashMock).not.toHaveBeenCalled();
    expect(enqueueDocumentProcessingMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
