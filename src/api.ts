import type { VaultApi } from "./types";
import { platform } from "./utils/platform";
import { tauriApi } from "./backend/tauri";
import { webApi } from "./backend/web";

/**
 * Single API facade. Desktop (Tauri) uses the Rust backend over IPC; Android
 * (Capacitor) uses the in-process Web Crypto backend. Everything above this
 * line (hooks, views) is platform-agnostic.
 */
export const api: VaultApi = platform.isTauri ? tauriApi : webApi;
