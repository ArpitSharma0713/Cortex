import { createServer } from "node:http";
import { once } from "node:events";
import { expect, it, vi } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";

vi.mock("../src/utils/embedder.js", () => ({ embedQuery: async () => [0.1, 0.2] }));

it("queries scoped points through the installed Qdrant client and maps citations", async () => {
  let request;
  const server = createServer(async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    request = { path: req.url, body: JSON.parse(Buffer.concat(parts)) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", time: 0, result: { points: [{
      id: 1, score: 0.9, payload: { chunk_id: "c", document_id: "d",
        content: "example", chunk_index: 0, page_number: 3 },
    }] } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const client = new QdrantClient({
      url: `http://127.0.0.1:${server.address().port}`, checkCompatibility: false,
    });
    vi.doMock("../src/config/qdrant.js", () => ({ qdrant: client }));
    vi.stubEnv("QDRANT_COLLECTION", "chunks");
    const { retrieveRelevantChunks } = await import("../src/services/retrievalService.js");
    expect(await retrieveRelevantChunks("question", "w", "u")).toEqual([{
      chunkId: "c", documentId: "d", content: "example", chunkIndex: 0,
      pageNumber: 3, score: 0.9,
    }]);
    expect(request.path).toBe("/collections/chunks/points/query");
    expect(request.body).toMatchObject({ query: [0.1, 0.2], limit: 5, with_payload: true,
      filter: { must: [{ key: "workspace_id", match: { value: "w" } },
        { key: "user_id", match: { value: "u" } }] },
    });
  } finally {
    vi.unstubAllEnvs();
    vi.doUnmock("../src/config/qdrant.js");
    await new Promise(resolve => server.close(resolve));
  }
});
