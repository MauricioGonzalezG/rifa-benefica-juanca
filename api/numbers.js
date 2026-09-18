import { createClient } from '@libsql/client';
import { createStore } from '../lib/store.js';
import { createHandler } from '../lib/handler.js';

let store;
function getStore() {
  if (!store) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || (!url.startsWith('file:') && !authToken)) throw new Error('Missing Turso configuration');
    if (process.env.VERCEL && !/^libsql:\/\//.test(url || '')) throw new Error('A remote Turso database is required');
    store = createStore(createClient({ url, authToken }));
  }
  return store;
}
export default createHandler(getStore);
