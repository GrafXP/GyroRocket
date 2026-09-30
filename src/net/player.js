import { ApiError, createApi, checkVersion } from "./api.js";

export const PLAYER_KEY = "gyrorocket:player";
const TOKEN = /^[a-f0-9]{64}$/;

export function tokenFromCode(code) {
  const token = String(code).replace(/[\s-]/g, "").toLowerCase();
  if (!TOKEN.test(token)) throw new ApiError("Enter the whole player code: eight groups of eight letters and digits.");
  return token;
}

export const transferCode = (token) => tokenFromCode(token).match(/.{8}/g).join("-");

export function createPlayerClient({ request = createApi(), storage = () => localStorage } = {}) {
  let creating = null;
  function token() {
    try {
      const value = storage().getItem(PLAYER_KEY);
      return TOKEN.test(value ?? "") ? value : null;
    } catch {
      return null;
    }
  }
  function writable() {
    try {
      const store = storage();
      store.setItem(`${PLAYER_KEY}:check`, "0".repeat(64));
      store.removeItem(`${PLAYER_KEY}:check`);
    } catch {
      throw new ApiError("Allow storage for this site to keep your player code on this phone.");
    }
  }
  function remember(value) {
    try {
      storage().setItem(PLAYER_KEY, value);
    } catch {
      throw new ApiError(`Couldn't keep the profile on this phone. Save this code and try it again: ${transferCode(value)}`);
    }
  }
  const health = async (signal) => checkVersion(await request("/api/health", { signal }));
  function clear(value) {
    if (token() === value) {
      try { storage().removeItem(PLAYER_KEY); } catch {}
    }
  }
  async function me(signal) {
    const saved = token();
    if (!saved) return null;
    try {
      return (await request("/api/players/me", { token: saved, signal })).player;
    } catch (error) {
      // Forget me on another phone invalidates this code too. Clear only an
      // explicitly unrecognised code; outages and bans keep the identity.
      if (error.status !== 401) throw error;
      clear(saved);
      return null;
    }
  }
  async function ensure(signal) {
    if (token()) {
      const existing = await me(signal);
      if (existing) return existing;
    }
    if (creating) return creating;
    writable();
    creating = (async () => {
      const result = await request("/api/players", { method: "POST", body: {}, signal });
      const value = tokenFromCode(result.token);
      // Keep a created token even if the page was closed during the response.
      remember(value);
      return result.player;
    })();
    try {
      return await creating;
    } finally {
      creating = null;
    }
  }
  return {
    token, health, me,
    async rename(name, signal) {
      const clean = name.trim();
      if (!/^[A-Za-z0-9 _-]{3,16}$/.test(clean) || !/[A-Za-z0-9]/.test(clean)) {
        throw new ApiError("Use 3–16 letters, digits, spaces, - or _ for your name.");
      }
      await health(signal);
      await ensure(signal);
      return (await request("/api/players/me", { method: "PATCH", body: { name: clean }, token: token(), signal })).player;
    },
    async useCode(code, signal) {
      const value = tokenFromCode(code);
      writable();
      await health(signal);
      const result = await request("/api/players/me", { token: value, signal });
      remember(value); // a bad code or failed request never replaces the old one
      return result.player;
    },
    async data(signal) {
      if (!token()) throw new ApiError("Pick a name or enter your player code first.");
      return request("/api/players/me/data", { token: token(), signal });
    },
    async forget(signal) {
      const saved = token();
      if (!saved) return;
      try {
        await request("/api/players/me", { method: "DELETE", body: {}, token: saved, signal });
      } catch (error) {
        if (error.status !== 401) throw error; // already forgotten elsewhere
      }
      // A different tab might have switched profiles while the request ran.
      clear(saved);
    },
  };
}

export const player = createPlayerClient();
