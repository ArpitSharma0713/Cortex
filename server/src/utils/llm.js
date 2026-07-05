const MAX_RETRIES = 3;

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

