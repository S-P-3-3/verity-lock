import { useCallback, useState } from "react";
import { api } from "../api";
import type { Entry, NewEntry, VaultMeta } from "../types";

/**
 * Vault session state: holds the unlock metadata (incl. session token) and the
 * decrypted entries. All mutations persist via the Rust backend and refresh.
 */
export function useVault() {
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const token = meta?.session_token ?? "";

  const refresh = useCallback(async () => {
    if (!token) return;
    setEntries(await api.getEntries(token));
  }, [token]);

  const open = useCallback(async (path: string, pw: string) => {
    const m = await api.openVault(path, pw);
    setMeta(m);
    setEntries(await api.getEntries(m.session_token));
  }, []);

  const create = useCallback(async (path: string, pw: string) => {
    const m = await api.createVault(path, pw);
    setMeta(m);
    setEntries([]);
  }, []);

  const lock = useCallback(async () => {
    try {
      await api.lockVault();
    } catch {
      /* ignore */
    }
    setMeta(null);
    setEntries([]);
  }, []);

  const createEntry = useCallback(
    async (e: NewEntry) => {
      await api.createEntry(token, e);
      await refresh();
    },
    [token, refresh],
  );

  const updateEntry = useCallback(
    async (e: Entry) => {
      await api.updateEntry(token, e);
      await refresh();
    },
    [token, refresh],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await api.deleteEntry(token, id);
      await refresh();
    },
    [token, refresh],
  );

  const importFile = useCallback(
    async (format: string, path: string) => {
      const res = await api.importFromFile(token, format, path);
      await refresh();
      return res.imported;
    },
    [token, refresh],
  );

  return {
    meta,
    entries,
    token,
    open,
    create,
    lock,
    refresh,
    createEntry,
    updateEntry,
    deleteEntry,
    importFile,
  };
}
