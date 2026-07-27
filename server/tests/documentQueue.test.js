import { describe, expect, it, vi } from "vitest";

const { addMock, getJobMock, retryMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({ id: "job-123" }),
  getJobMock: vi.fn(),
  retryMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/config/redis.js", () => ({
  redisConnection: {},
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(function QueueMock() {
    return {
      add: addMock,
      getJob: getJobMock,
    };
  }),
}));

const { enqueueDocumentProcessing, retryDocumentProcessing } = await import(
  "../src/queues/documentQueue.js"
);

describe("documentQueue", () => {
  it("enqueues with documentId as jobId for idempotency", async () => {
    await enqueueDocumentProcessing("doc-1", "key", "ws-1", "user-1");

    expect(addMock).toHaveBeenCalledWith(
      "process-document",
      {
        documentId: "doc-1",
        storageKey: "key",
        workspaceId: "ws-1",
        userId: "user-1",
      },
      { jobId: "doc-1" },
    );
  });

  it("retries an existing failed job with attempts reset", async () => {
    getJobMock.mockResolvedValueOnce({
      isFailed: vi.fn().mockResolvedValue(true),
      retry: retryMock,
    });

    await retryDocumentProcessing("doc-2", "key", "ws-1", "user-1");

    expect(retryMock).toHaveBeenCalledWith("failed", {
      resetAttemptsMade: true,
      resetAttemptsStarted: true,
    });
  });
});