import OpenAI from "openai";
import { callWithRetry } from "./llm.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BATCH_SIZE = 100;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function getEmbeddingModel() {
  return process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export async function embedTexts(texts) {
  const results = [];

  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE);

    const response = await callWithRetry(() =>
      client.embeddings.create({
        model: getEmbeddingModel(),
        input: batch,
      }),
    );

    results.push(...response.data.map((item) => item.embedding));
  }

  return results;
}

export async function embedQuery(text) {
  const response = await callWithRetry(() =>
    client.embeddings.create({
      model: getEmbeddingModel(),
      input: [text],
    }),
  );

  return response.data[0].embedding;
}
