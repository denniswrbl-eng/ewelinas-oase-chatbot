/**
 * HTTP-Helper fuer Provider-Aufrufe.
 *
 * GROSSES BILD:
 * - Fetch mit Timeout via AbortController.
 * - Cloudflare Workers-Runtime unterstuetzt AbortController nativ.
 * - Ohne Timeout wuerde ein haengender Upstream-Provider die gesamte
 *   Fallback-Kette blockieren, bis der Worker-Request-Limit (30s) greift.
 *   Das ist zu spaet — wir wollen nach 8s auf den naechsten Provider wechseln.
 *
 * WARUM 8s:
 * - p99 fuer Groq/Anthropic liegt unter 3s bei normalem Traffic.
 * - 8s gibt Puffer fuer kurze Spikes, ohne die UX (Chat-Tipp-Indikator) zu
 *   sprengen.
 * - Konfigurierbar per Env: LLM_PROVIDER_TIMEOUT_MS
 */

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Fetch mit hartem Timeout. Wirft einen Error mit Message "timeout after Xms"
 * wenn der Upstream nicht innerhalb der Zeit antwortet.
 *
 * @param {string} url
 * @param {Object} options       - Standard-Fetch-Options (method, headers, body)
 * @param {Object} env           - Cloudflare Env (fuer Timeout-Override)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options, env) {
  const timeoutMs = Number(env?.LLM_PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
