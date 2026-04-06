/**
 * Map MySQL errors to API responses (avoid crashing on missing tables).
 */
export function isMissingTableError(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' || err?.errno === 1146;
}

export const DB_SETUP_HINT =
  'Database tables are missing. From the project folder run: npm run db:setup';

export function sendDbError(res, err, fallbackMessage = 'Server error') {
  if (isMissingTableError(err)) {
    return res.status(503).json({ error: DB_SETUP_HINT });
  }
  console.error(err);
  return res.status(500).json({ error: fallbackMessage });
}
