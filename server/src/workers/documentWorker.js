import { randomUUID } from "crypto";
import { Worker } from "bullmq";
import { redisConnection } from "../config/redis.js";
import { withTenantContext } from "../middleware/withTenantContext.js";
import * as documentService from "../services/documentService.js";
import { embedDocument } from "../services/embeddingService.js";
import { downloadFromR2 } from "../services/storageService.js";
import { chunkText } from "../utils/chunker.js";
import { flagSuspiciousContent } from "../utils/contentSanitizer.js";
import { extractTextFromBuffer } from "../utils/pdfParser.js";
import { sanitizeText } from "../utils/sanitize.js";

const CONCURRENCY = Number.parseInt(process.env.DOCUMENT_WORKER_CONCURRENCY || "3", 10);

export async function processDocumentJob(job) {
  const { documentId, storageKey, workspaceId, userId } = job.data;

  await withTenantContext(userId, (client) =>
    documentService.updateDocumentStatus(
      client,
      documentId,
      userId,
      "processing",
      { errorMessage: null },
    ),
  );

  const buffer = await downloadFromR2(storageKey);
  const { text, pageCount } = await extractTextFromBuffer(buffer);
  const sanitized = sanitizeText(text);
  const chunks = chunkText(sanitized);

  const chunkRecords = chunks.map((chunk) => {
    const flaggedPatterns = flagSuspiciousContent(chunk.content);

    if (flaggedPatterns.length > 0) {
      console.warn(
        `Suspicious content pattern in document ${documentId}, chunk ${chunk.chunkIndex}:`,
        flaggedPatterns,
      );
    }

    return {
      id: randomUUID(),
      documentId,
      workspaceId,
      userId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      pageNumber: null,
      flaggedPatterns: flaggedPatterns.length > 0 ? flaggedPatterns : null,
    };
  });

  await withTenantContext(userId, async (client) => {
    await documentService.clearDocumentChunks(client, documentId, userId);
    await documentService.insertChunks(client, chunkRecords);
  });
  const { embedded } = await embedDocument(documentId, userId);

  await withTenantContext(userId, (client) =>
    documentService.updateDocumentStatus(client, documentId, userId, "ready", {
      pageCount,
      chunkCount: chunks.length,
      embeddedChunkCount: embedded,
      errorMessage: null,
    }),
  );

  return { chunkCount: chunks.length, embedded };
}

export const documentWorker = new Worker("document-processing", processDocumentJob, {
  connection: redisConnection,
  concurrency: CONCURRENCY,
});

documentWorker.on("failed", async (job, error) => {
  console.error(
    `Job ${job?.id || "unknown"} failed (attempt ${job?.attemptsMade || 0}):`,
    error.message,
  );

  if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
    await withTenantContext(job.data.userId, (client) =>
      documentService.updateDocumentStatus(
        client,
        job.data.documentId,
        job.data.userId,
        "failed",
        { errorMessage: error.message },
      ),
    );
  }
});

documentWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed:`, job.returnvalue);
});

