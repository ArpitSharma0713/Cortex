import { qdrant } from "../config/qdrant.js";
import { embedQuery } from "../utils/embedder.js";

const TOP_K = 5;

function getCollectionName() {
  return process.env.QDRANT_COLLECTION;
}

export async function retrieveRelevantChunks(question, workspaceId, userId) {
  const queryVector = await embedQuery(question);

  const results = await qdrant.search(getCollectionName(), {
    vector: queryVector,
    limit: TOP_K,
    filter: {
      must: [
        { key: "workspace_id", match: { value: workspaceId } },
        { key: "user_id", match: { value: userId } },
      ],
    },
    with_payload: true,
  });

  return results.map((result) => ({
    chunkId: result.payload.chunk_id,
    documentId: result.payload.document_id,
    content: result.payload.content,
    chunkIndex: result.payload.chunk_index,
    pageNumber: result.payload.page_number,
    score: result.score,
  }));
}

