import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.QDRANT_COLLECTION = "test-chunks";

const {
  getPendingEventsMock,
  markEventCompletedMock,
  markEventFailedMock,
  markEventProcessingMock,
  qdrantDeleteMock,
  qdrantUpsertMock,
  recoverProcessingEventsMock,
} = vi.hoisted(() => ({
  getPendingEventsMock: vi.fn(),
  markEventCompletedMock: vi.fn(),
  markEventFailedMock: vi.fn(),
  markEventProcessingMock: vi.fn(),
  qdrantDeleteMock: vi.fn(),
  qdrantUpsertMock: vi.fn(),
  recoverProcessingEventsMock: vi.fn(),
}));

vi.mock("../src/config/qdrant.js", () => ({
  qdrant: {
    delete: qdrantDeleteMock,
    upsert: qdrantUpsertMock,
  },
}));

vi.mock("../src/services/outboxService.js", () => ({
  getPendingEvents: getPendingEventsMock,
  markEventCompleted: markEventCompletedMock,
  markEventFailed: markEventFailedMock,
  markEventProcessing: markEventProcessingMock,
  recoverProcessingEvents: recoverProcessingEventsMock,
}));

const { processOutboxEvent, processPendingEvents } = await import(
  "../src/workers/outboxWorker.js"
);

describe("outboxWorker", () => {
  beforeEach(() => {
    getPendingEventsMock.mockReset().mockResolvedValue([]);
    markEventCompletedMock.mockReset().mockResolvedValue(undefined);
    markEventFailedMock.mockReset().mockResolvedValue(undefined);
    markEventProcessingMock.mockReset().mockResolvedValue(true);
    qdrantDeleteMock.mockReset().mockResolvedValue(undefined);
    qdrantUpsertMock.mockReset().mockResolvedValue(undefined);
    recoverProcessingEventsMock.mockReset().mockResolvedValue(0);
  });

  it("upserts embedded chunk points before completing the event", async () => {
    const points = [{ id: "chunk-1", vector: [0.1], payload: {} }];

    await expect(
      processOutboxEvent({
        id: "event-1",
        event_type: "chunks_embedded",
        payload: JSON.stringify({ points }),
      }),
    ).resolves.toBe(true);

    expect(qdrantUpsertMock).toHaveBeenCalledWith("test-chunks", {
      wait: true,
      points,
    });
    expect(markEventCompletedMock).toHaveBeenCalledWith("event-1");
    expect(
      qdrantUpsertMock.mock.invocationCallOrder[0],
    ).toBeLessThan(markEventCompletedMock.mock.invocationCallOrder[0]);
  });

  it("deletes document vectors before completing the event", async () => {
    await processOutboxEvent({
      id: "event-2",
      event_type: "document_deleted",
      document_id: "doc-2",
      payload: { documentId: "doc-2" },
    });

    expect(qdrantDeleteMock).toHaveBeenCalledWith("test-chunks", {
      wait: true,
      filter: {
        must: [{ key: "document_id", match: { value: "doc-2" } }],
      },
    });
    expect(markEventCompletedMock).toHaveBeenCalledWith("event-2");
  });

  it("does not process an event already claimed elsewhere", async () => {
    markEventProcessingMock.mockResolvedValueOnce(false);

    await expect(
      processOutboxEvent({
        id: "event-3",
        event_type: "chunks_embedded",
        payload: { points: [] },
      }),
    ).resolves.toBe(false);

    expect(qdrantUpsertMock).not.toHaveBeenCalled();
    expect(markEventCompletedMock).not.toHaveBeenCalled();
  });

  it("marks a claimed event failed when Qdrant rejects it", async () => {
    qdrantUpsertMock.mockRejectedValueOnce(new Error("Qdrant unavailable"));
    getPendingEventsMock.mockResolvedValueOnce([
      {
        id: "event-4",
        event_type: "chunks_embedded",
        payload: { points: [] },
      },
    ]);

    await expect(processPendingEvents()).resolves.toEqual({
      processed: 0,
      skipped: false,
    });

    expect(markEventFailedMock).toHaveBeenCalledWith(
      "event-4",
      "Qdrant unavailable",
    );
  });
});
