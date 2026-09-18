import { createHash, timingSafeEqual } from 'node:crypto';
import { validNumbers } from './store.js';

function authorized(req, password) {
  const value = req.headers.authorization;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return false;
  const digest = input => createHash('sha256').update(input).digest();
  return timingSafeEqual(digest(value.slice(7)), digest(encodeURIComponent(password)));
}

export function createHandler(getStore, getPassword = () => process.env.ADMIN_PASSWORD) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    if (!['GET', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, PUT');
      return res.status(405).json({ error: 'Método no permitido.' });
    }
    const password = getPassword();
    if (!password || password.length < 16) return res.status(503).json({ error: 'Configura ADMIN_PASSWORD con al menos 16 caracteres en Vercel.' });
    const canEdit = authorized(req, password);
    if ((req.method === 'PUT' || req.headers.authorization) && !canEdit) return res.status(401).json({ error: 'La clave de edición no es correcta.' });
    try {
      if (req.method === 'GET') return res.status(200).json({ ...await getStore().read(), canEdit });
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'Se requiere JSON.' });
      let data = req.body;
      if (typeof data === 'string') {
        if (Buffer.byteLength(data) > 4096) return res.status(413).json({ error: 'Solicitud demasiado grande.' });
        try { data = JSON.parse(data); } catch { return res.status(400).json({ error: 'JSON inválido.' }); }
      }
      if (!data || !validNumbers(data.numbers) || !Number.isSafeInteger(data.revision) || data.revision < 0) return res.status(400).json({ error: 'Selección o versión inválida.' });
      const result = await getStore().replace(data.numbers, data.revision);
      if (!result) return res.status(409).json({ error: 'Otro dispositivo cambió la selección. Se cargó la versión más reciente; intenta de nuevo.', ...await getStore().read(), canEdit });
      return res.status(200).json({ ...result, canEdit });
    } catch {
      return res.status(503).json({ error: 'No se pudo conectar con Turso. Revisa la conexión y las variables TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.' });
    }
  };
}
