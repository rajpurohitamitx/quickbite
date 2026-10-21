const { getDriver } = require('../lib/neo4j');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const driver = getDriver();
  if (!driver) return res.status(503).json({ ok: false, error: 'Database is not configured' });
  try {
    await driver.verifyConnectivity();
    const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
    try {
      await session.run('CREATE CONSTRAINT quickbite_state_key IF NOT EXISTS FOR (s:QuickBiteState) REQUIRE s.key IS UNIQUE');
    } finally {
      await session.close();
    }
    return res.status(200).json({ ok: true, database: 'Neo4j' });
  } catch (error) {
    console.error('QuickBite health check failed:', error.message);
    return res.status(503).json({ ok: false, error: 'Database connection failed. Check the Vercel environment variables.' });
  }
};
