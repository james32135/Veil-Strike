// Shared fetch with AbortController timeout — prevents indefinite TCP hangs.
// All network calls in the backend should use this instead of raw fetch().

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Fetch with a timeout. If the request doesn't complete within `timeoutMs`,
 * the AbortController fires and the promise rejects with an AbortError.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
