import { beforeEach, describe, expect, it, vi } from "vitest";

const { poolQueryMock } = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: { query: poolQueryMock },
}));

const {
  markEventProcessing,
  recoverProcessingEvents,
  writeOutboxEvent,
} = await import("../src/services/outboxService.js");

describe("outboxService", () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it("writes an event through the supplied transaction client", async () => {
    const client = { query: vi.fn().mockResolvedValue({}) };

    await writeOutboxEvent(client, {
      eventType: "chunks_embedded",
      documentId: "doc-1",
      workspaceId: "ws-1",
      payload: { points: [] },
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO outbox_events"),
      ["chunks_embedded", "doc-1", "ws-1", JSON.stringify({ points: [] })],
    );
  });

  it("claims only an event that is still pending", async () => {
    poolQueryMock.mockResolvedValueOnce({ rowCount: 1 });

    await expect(markEventProcessing("event-1")).resolves.toBe(true);
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("AND status = 'pending'"),
      ["event-1"],
    );
  });

  it("returns stale processing events to pending on startup", async () => {
    poolQueryMock.mockResolvedValueOnce({ rowCount: 2 });

    await expect(recoverProcessingEvents()).resolves.toBe(2);
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'processing'"),
    );
  });
});
