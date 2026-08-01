import { qdrant } from "../config/qdrant.js";
import {
  getPendingEvents,
  markEventCompleted,
  markEventFailed,
  markEventProcessing,
  recoverProcessingEvents,
} from "../services/outboxService.js";

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.OUTBOX_POLL_INTERVAL_MS || "3000",
  10,
);
const EVENT_BATCH_SIZE = Number.parseInt(
  process.env.OUTBOX_EVENT_BATCH_SIZE || "20",
  10,
);

let isPolling = false;

function collectionName() {
  return process.env.QDRANT_COLLECTION;
}

function parsePayload(payload) {
  return typeof payload === "string" ? JSON.parse(payload) : payload;
}

export async function processOutboxEvent(event) {
  const claimed = await markEventProcessing(event.id);

  if (!claimed) {
    return false;
  }

  const payload = parsePayload(event.payload);

  if (event.event_type === "chunks_embedded") {
    await qdrant.upsert(collectionName(), {
      wait: true,
      points: payload.points,
    });
  } else if (event.event_type === "document_deleted") {
    await qdrant.delete(collectionName(), {
      wait: true,
      filter: {
        must: [
          { key: "document_id", match: { value: event.document_id } },
        ],
      },
    });
  } else {
    throw new Error(`Unsupported outbox event type: ${event.event_type}`);
  }

  await markEventCompleted(event.id);
  return true;
}

export async function processPendingEvents() {
  if (isPolling) {
    return { processed: 0, skipped: true };
  }

  isPolling = true;
  let processed = 0;

  try {
    const events = await getPendingEvents(EVENT_BATCH_SIZE);

    for (const event of events) {
      try {
        const wasProcessed = await processOutboxEvent(event);
        processed += wasProcessed ? 1 : 0;
      } catch (error) {
        console.error(`Outbox event ${event.id} failed:`, error.message);
        await markEventFailed(event.id, error.message);
      }
    }

    return { processed, skipped: false };
  } finally {
    isPolling = false;
  }
}

export async function startOutboxWorker() {
  const recovered = await recoverProcessingEvents();

  if (recovered > 0) {
    console.log(`Recovered ${recovered} interrupted outbox events`);
  }

  console.log(`Outbox worker started, polling every ${POLL_INTERVAL_MS} ms`);
  await processPendingEvents();

  return setInterval(() => {
    processPendingEvents().catch((error) => {
      console.error("Outbox polling failed:", error.message);
    });
  }, POLL_INTERVAL_MS);
}
