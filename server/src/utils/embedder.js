import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.EMBEDDING_MODEL;
if (!MODEL) {
  throw new Error("EMBEDDING_MODEL environment variable is not configured");
}

export async function embedTexts(texts) {
  if (!Array.isArray(texts)) {
    throw new Error("texts must be an array");
  }

  if (texts.length === 0) {
    return [];
  }

  try {
    const response = await client.embeddings.create({
      model: MODEL,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    throw new Error(`OpenAI embedding request failed: ${error.message}`);
  }
}

export async function embedQuery(text) {
  if (!text?.trim()) {
    throw new Error("Query text cannot be empty");
  }

  const vectors = await embedTexts([text]);
  return vectors[0];
}