module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ databaseEnabled: Boolean(process.env.NEO4J_URI && process.env.NEO4J_PASSWORD) });
};
