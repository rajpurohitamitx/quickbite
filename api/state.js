const { getDriver } = require('../lib/neo4j');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const driver = getDriver();
  if (!driver) return res.status(503).json({ error: 'Database is not configured' });
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
  try {
    if (req.method === 'GET') {
      const result = await session.run(
        'MATCH (s:QuickBiteState {key: $key}) RETURN s.payload AS payload LIMIT 1',
        { key: 'main' }
      );
      if (!result.records.length) return res.status(404).json({ error: 'No saved state yet' });
      const payload = result.records[0].get('payload');
      if (typeof payload !== 'string') return res.status(500).json({ error: 'Saved data is invalid' });
      try { return res.status(200).json(JSON.parse(payload)); }
      catch { return res.status(500).json({ error: 'Saved data could not be parsed' }); }
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ error: 'Request body must be valid JSON' }); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }
    const payload = JSON.stringify(body);
    if (payload.length > 2_000_000) return res.status(413).json({ error: 'Payload too large' });
    await session.run(
      'MERGE (s:QuickBiteState {key: $key}) SET s.payload = $payload, s.updatedAt = datetime()',
      { key: 'main', payload }
    );
    return res.status(200).json({ ok: true, message: 'Saved to Neo4j' });
  } catch (error) {
    console.error('QuickBite state API failed:', error.message);
    return res.status(500).json({ error: 'Database operation failed' });
  } finally {
    await session.close();
  }
};
