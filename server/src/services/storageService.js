import { createHash } from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { BUCKET, r2Client } from "../config/storage.js";

export function computeHash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function buildStorageKey(workspaceId, documentId, filename) {
  const rawExtension = filename.includes(".")
    ? filename.split(".").pop()
    : filename;
  const extension = rawExtension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "pdf";

  return `workspaces/${workspaceId}/documents/${documentId}.${extension}`;
}

export async function uploadToR2(storageKey, buffer, mimeType) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return storageKey;
}

export async function downloadFromR2(storageKey) {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    }),
  );
  const chunks = [];

  for await (const chunk of response.Body) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function deleteFromR2(storageKey) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
    }),
  );
}
