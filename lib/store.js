export function validNumbers(value) {
  return Array.isArray(value) && value.length <= 100 && value.every(n => Number.isInteger(n) && n >= 1 && n <= 100) && new Set(value).size === value.length;
}

export function createStore(client) {
  let initialized;
  async function init() {
    if (!initialized) {
      initialized = client.batch([
        `CREATE TABLE IF NOT EXISTS raffle_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          numbers TEXT NOT NULL DEFAULT '[]',
          revision INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        'INSERT OR IGNORE INTO raffle_state (id) VALUES (1)'
      ], 'write').catch(error => { initialized = undefined; throw error; });
    }
    await initialized;
  }
  function decode(row) {
    return { numbers: JSON.parse(row.numbers), revision: Number(row.revision), updatedAt: row.updated_at };
  }
  return {
    async read() {
      await init();
      const result = await client.execute('SELECT numbers, revision, updated_at FROM raffle_state WHERE id = 1');
      return decode(result.rows[0]);
    },
    async replace(numbers, revision) {
      if (!validNumbers(numbers) || !Number.isSafeInteger(revision) || revision < 0) throw new TypeError('Invalid state');
      await init();
      // Compare-and-swap is atomic. A stale device cannot erase a newer edit.
      const result = await client.execute({
        sql: `UPDATE raffle_state SET numbers = ?, revision = revision + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = 1 AND revision = ? RETURNING numbers, revision, updated_at`,
        args: [JSON.stringify([...numbers].sort((a,b) => a-b)), revision]
      });
      return result.rows.length ? decode(result.rows[0]) : null;
    }
  };
}
