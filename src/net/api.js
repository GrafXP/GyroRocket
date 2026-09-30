import { SIM_VERSION } from "../sim/world.js";

export const API_VERSION = 1;

export class ApiError extends Error {
  constructor(message, status = 0, retryAfter = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// Same-origin only, no cookies, no background startup dependency. The timeout
// covers reading the response too. Callers can cancel when leaving a page.
export function createApi({ fetchImpl = (...args) => fetch(...args), timeout = 6000 } = {}) {
  return async function request(path, { method = "GET", body, token, signal } = {}) {
    if (!/^\/api\/[\w/-]+$/.test(path)) throw new Error("Use a same-origin API path.");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    try {
      const headers = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetchImpl(path, {
        method, headers, credentials: "omit", cache: "no-store", redirect: "error",
        signal: controller.signal, ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        throw new ApiError("The community server is unavailable. Your levels and game still work.", response.status);
      }
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid response");
      if (!response.ok) throw new ApiError(
        typeof data.error === "string" ? data.error : "The request failed. Try again.",
        response.status, response.headers.get("retry-after"),
      );
      return data;
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
      if (timedOut) throw new ApiError("The community server took too long to reply. Try again.");
      if (error instanceof ApiError) throw error;
      throw new ApiError("Couldn't reach the community server. Your levels and game still work.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}

export function checkVersion(health) {
  if (health?.api !== API_VERSION || health.sim !== SIM_VERSION) {
    throw new ApiError("Update the game before using the community. Reload this page.", 409);
  }
  return health;
}
