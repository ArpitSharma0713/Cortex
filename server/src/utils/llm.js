import OpenAI from "openai";

const MAX_RETRIES = 3;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callWithRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.status === 429;
      const isServerError = error.status >= 500;

      if ((isRateLimit || isServerError) && attempt < retries - 1) {
        const wait = 1000 * 2 ** attempt;
        console.warn(
          `OpenAI error ${error.status}, retrying in ${wait}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      throw error;
    }
  }
}

export async function generateCompletion(systemPrompt, userPrompt) {
  const response = await callWithRetry(() =>
    client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  );

  return {
    text: response.choices[0].message.content,
    usage: response.usage,
  };
}
