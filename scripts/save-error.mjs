// One way for every admin save endpoint to report a failure: storage not set
// up -> 503 with instructions; anything else -> 500 with the reason.
import { StorageNotConfigured } from './storage.mjs';

export function sendSaveError(res, where, e) {
  console.error('[' + where + '] save error:', e?.message || e);
  if (e instanceof StorageNotConfigured) {
    res.status(503).json({ error: 'storage_not_configured', detail: e.message });
    return;
  }
  res.status(500).json({ error: 'save failed', detail: 'The change was NOT saved: ' + String(e?.message || e).slice(0, 200) });
}
