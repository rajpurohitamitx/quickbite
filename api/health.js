const { getPool, ensureSchema } = require('../lib/postgres');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const pool = getPool();
  if (!pool) return res.status(503).json({ ok: false, error: 'PostgreSQL is not configured. Add POSTGRES_URL or DATABASE_URL in Vercel.' });
  let client;
  try {
    client = await pool.connect();
    await ensureSchema(client);
    await client.query('SELECT 1');
    return res.status(200).json({ ok: true, database: 'PostgreSQL', tablesReady: true });
  } catch (error) {
    console.error('QuickBite PostgreSQL health check failed:', error.message);
    return res.status(503).json({ ok: false, error: 'Database connection failed. Check the Vercel PostgreSQL connection string.' });
  } finally {
    if (client) client.release();
  }
};
