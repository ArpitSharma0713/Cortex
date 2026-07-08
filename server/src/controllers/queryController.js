import { retrieveRelevantChunks } from "../services/retrievalService.js";
import * as queryService from "../services/queryService.js";
import * as workspaceService from "../services/workspaceService.js";
import { streamCompletion } from "../utils/llm.js";
import { buildRagPrompt } from "../utils/promptBuilder.js";

const DAILY_QUERY_LIMIT = 20;

export async function askQuestion(req, res, next) {
  let queryRecord;
  let fullAnswer = "";

  try {
    const { workspaceId } = req.params;
    const { question } = req.body;

    const workspace = await workspaceService.getWorkspaceById(
      workspaceId,
      req.user.id,
    );

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const todayCount = await queryService.getQueryCountToday(req.user.id);

    if (todayCount >= DAILY_QUERY_LIMIT) {
      return res.status(429).json({
        error: "Daily query limit reached",
        limit: DAILY_QUERY_LIMIT,
      });
    }

    queryRecord = await queryService.createQuery(
      workspaceId,
      req.user.id,
      question,
    );

    const chunks = await retrieveRelevantChunks(
      question,
      workspaceId,
      req.user.id,
    );
    const prompt = buildRagPrompt(question, chunks);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (!prompt) {
      const answer =
        "I don't have any relevant documents to answer this question. Try uploading some content to this workspace first.";
      await queryService.completeQuery(queryRecord.id, answer, [], 0);

      res.write(
        `data: ${JSON.stringify({ type: "token", content: answer })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({
          type: "done",
          queryId: queryRecord.id,
          sources: [],
        })}\n\n`,
      );
      return res.end();
    }

    for await (const delta of streamCompletion(
      prompt.systemPrompt,
      prompt.userPrompt,
    )) {
      fullAnswer += delta;
      res.write(
        `data: ${JSON.stringify({ type: "token", content: delta })}\n\n`,
      );
    }

    const chunkIds = chunks.map((chunk) => chunk.chunkId);
    await queryService.completeQuery(queryRecord.id, fullAnswer, chunkIds, null);

    const sources = chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      excerpt: chunk.content.slice(0, 200),
      pageNumber: chunk.pageNumber,
      relevanceScore: chunk.score,
    }));

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        queryId: queryRecord.id,
        sources,
      })}\n\n`,
    );
    return res.end();
  } catch (error) {
    if (queryRecord) {
      await queryService.failQuery(queryRecord.id, error.message).catch(() => {});
    }

    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Something went wrong",
        })}\n\n`,
      );
      return res.end();
    }

    return next(error);
  }
}
