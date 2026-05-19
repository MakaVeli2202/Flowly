const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (err) => {
  const status = err?.response?.status;
  if (!status) return true; // network errors / timeouts
  return status >= 500;
};

const MAX_RETRY_DELAY_MS = 2000;

export const withRetry = async (requestFn, maxAttempts = 2) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestFn();
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err) || attempt >= maxAttempts) {
        throw err;
      }

      const backoff = Math.min(300 * attempt, MAX_RETRY_DELAY_MS);
      await delay(backoff);
    }
  }

  throw lastError;
};