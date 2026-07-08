export function buildRagPrompt(question, chunks) {
  if (chunks.length === 0) {
    return null;
  }

  const context = chunks
    .map((chunk, index) => `[Source ${index + 1}]\n${chunk.content}`)
    .join("\n\n");

  const systemPrompt = `You are Cortex, a research assistant. Answer the user's question using ONLY the provided sources below.

Rules:
- If the sources don't contain enough information to answer, say so explicitly. Do not make up information.
- If the user asks what the document or source is about, summarize the provided sources.
- Cite which source number(s) support each claim using [Source N] notation.
- Be concise and direct.

Sources:
${context}`;

  return {
    systemPrompt,
    userPrompt: question,
  };
}
