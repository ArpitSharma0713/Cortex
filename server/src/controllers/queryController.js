import { retrieveRelevantChunks } from "../services/retrievalService.js";
import * as queryService from "../services/queryService.js";
import * as workspaceService from "../services/workspaceService.js";
import { generateCompletion } from "../utils/llm.js";
import { buildRagPrompt } from "../utils/promptBuilder.js";

const DAILY_QUERY_LIMIT = 20;

export async function askQuestion(req, res, next) {
  let queryRecord;

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

    if (!prompt) {
      const answer =
        "I don't have any relevant documents to answer this question. Try uploading some content to this workspace first.";
      await queryService.completeQuery(queryRecord.id, answer, [], 0);

      return res.status(200).json({
        queryId: queryRecord.id,
        answer,
        sources: [],
      });
    }

    const { text, usage } = await generateCompletion(
      prompt.systemPrompt,
      prompt.userPrompt,
    );
    const chunkIds = chunks.map((chunk) => chunk.chunkId);
    await queryService.completeQuery(
      queryRecord.id,
      text,
      chunkIds,
      usage?.total_tokens || null,
    );

    return res.status(200).json({
      queryId: queryRecord.id,
      answer: text,
      sources: chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        excerpt: chunk.content.slice(0, 200),
        pageNumber: chunk.pageNumber,
        relevanceScore: chunk.score,
      })),
    });
  } catch (error) {
    if (queryRecord) {
      await queryService.failQuery(queryRecord.id, error.message).catch(() => {});
    }

    return next(error);
  }
}

