/**
 * Global flag telling the auto-lock machinery NOT to lock while the native file
 * picker is open. Opening the Android picker backgrounds the app, which would
 * otherwise trigger an immediate lock and lose the in-progress import.
 */
let _importInProgress = false;

export const importLock = {
  acquire: () => {
    _importInProgress = true;
  },
  release: () => {
    _importInProgress = false;
  },
  isActive: () => _importInProgress,
};
