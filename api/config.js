module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).json({ databaseEnabled: Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL), database: 'PostgreSQL' });
};
