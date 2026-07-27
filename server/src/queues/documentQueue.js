import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const documentQueue = new Queue("document-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  },
});

export async function enqueueDocumentProcessing(
  documentId,
  storageKey,
  workspaceId,
  userId,
) {
  return documentQueue.add(
    "process-document",
    { documentId, storageKey, workspaceId, userId },
    { jobId: documentId },
  );
}
export async function retryDocumentProcessing(
  documentId,
  storageKey,
  workspaceId,
  userId,
) {
  const existingJob = await documentQueue.getJob(documentId);

  if (existingJob) {
    const isFailed = await existingJob.isFailed();

    if (isFailed) {
      await existingJob.retry("failed", {
        resetAttemptsMade: true,
        resetAttemptsStarted: true,
      });
      return existingJob;
    }

    return existingJob;
  }

  return enqueueDocumentProcessing(documentId, storageKey, workspaceId, userId);
}
