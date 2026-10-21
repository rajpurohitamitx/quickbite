const { getPool, ensureSchema } = require('../lib/postgres');

const TABLES = ['customer','restaurant','food','discount','orders','cart','payment','delivery','review'];
const NUMERIC_FIELDS = {
  customer: ['id'], restaurant: ['id','rating'], food: ['id','price','rid'],
  discount: ['id','pct'], orders: ['id','cid','did','total'], cart: ['id','oid','fid','qty'],
  payment: ['id','oid','amount'], delivery: ['id','oid'], review: ['id','cid','rid','rating']
};
const SELECTS = {
  customer: 'SELECT id, name, email, phone, address FROM qb_customers ORDER BY id',
  restaurant: 'SELECT id, name, cuisine, rating, city FROM qb_restaurants ORDER BY id',
  food: 'SELECT id, name, price, category, available, restaurant_id AS rid FROM qb_food_items ORDER BY id',
  discount: 'SELECT id, code, pct, to_char(expiry, \'YYYY-MM-DD\') AS expiry FROM qb_discounts ORDER BY id',
  orders: 'SELECT id, customer_id AS cid, discount_id AS did, total, status, to_char(order_date, \'YYYY-MM-DD\') AS date FROM qb_orders ORDER BY id',
  cart: 'SELECT id, order_id AS oid, food_id AS fid, quantity AS qty FROM qb_order_items ORDER BY id',
  payment: 'SELECT id, order_id AS oid, method, status, amount FROM qb_payments ORDER BY id',
  delivery: 'SELECT id, order_id AS oid, partner, status, address FROM qb_deliveries ORDER BY id',
  review: 'SELECT id, customer_id AS cid, restaurant_id AS rid, rating, comment FROM qb_reviews ORDER BY id'
};
const INSERTS = {
  customer: ['INSERT INTO qb_customers(id,name,email,phone,address) VALUES($1,$2,$3,$4,$5)', r => [r.id,r.name,r.email,r.phone ?? null,r.address]],
  restaurant: ['INSERT INTO qb_restaurants(id,name,cuisine,rating,city) VALUES($1,$2,$3,$4,$5)', r => [r.id,r.name,r.cuisine,r.rating,r.city]],
  food: ['INSERT INTO qb_food_items(id,name,price,category,available,restaurant_id) VALUES($1,$2,$3,$4,$5,$6)', r => [r.id,r.name,r.price,r.category,r.available,r.rid]],
  discount: ['INSERT INTO qb_discounts(id,code,pct,expiry) VALUES($1,$2,$3,$4)', r => [r.id,r.code,r.pct,r.expiry]],
  orders: ['INSERT INTO qb_orders(id,customer_id,discount_id,total,status,order_date) VALUES($1,$2,$3,$4,$5,$6)', r => [r.id,r.cid,r.did ?? null,r.total,r.status,r.date]],
  cart: ['INSERT INTO qb_order_items(id,order_id,food_id,quantity) VALUES($1,$2,$3,$4)', r => [r.id,r.oid,r.fid,r.qty]],
  payment: ['INSERT INTO qb_payments(id,order_id,method,status,amount) VALUES($1,$2,$3,$4,$5)', r => [r.id,r.oid,r.method,r.status,r.amount]],
  delivery: ['INSERT INTO qb_deliveries(id,order_id,partner,status,address) VALUES($1,$2,$3,$4,$5)', r => [r.id,r.oid,r.partner,r.status,r.address]],
  review: ['INSERT INTO qb_reviews(id,customer_id,restaurant_id,rating,comment) VALUES($1,$2,$3,$4,$5)', r => [r.id,r.cid,r.rid,r.rating,r.comment ?? null]]
};
const DELETE_ORDER = ['qb_reviews','qb_deliveries','qb_payments','qb_order_items','qb_orders','qb_discounts','qb_food_items','qb_customers','qb_restaurants'];

function shapeRow(table, row) {
  const result = { ...row };
  for (const key of NUMERIC_FIELDS[table] || []) {
    if (result[key] !== null && result[key] !== undefined) result[key] = Number(result[key]);
  }
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'PostgreSQL is not configured. Add POSTGRES_URL or DATABASE_URL in Vercel.' });
  let client;
  try {
    client = await pool.connect();
    await ensureSchema(client);
    if (req.method === 'GET') {
      const counts = await Promise.all(TABLES.map(async t => {
        const r = await client.query(`SELECT COUNT(*)::int AS count FROM ${({customer:'qb_customers',restaurant:'qb_restaurants',food:'qb_food_items',discount:'qb_discounts',orders:'qb_orders',cart:'qb_order_items',payment:'qb_payments',delivery:'qb_deliveries',review:'qb_reviews'})[t]}`);
        return r.rows[0].count;
      }));
      if (counts.every(n => n === 0)) return res.status(404).json({ error: 'Database is empty; initial data has not been saved yet.' });
      const entries = await Promise.all(TABLES.map(async t => {
        const result = await client.query(SELECTS[t]);
        return [t, result.rows.map(row => shapeRow(t, row))];
      }));
      const data = Object.fromEntries(entries);
      return res.status(200).json(data);
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ error: 'Request body must be valid JSON.' }); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Request body must be a JSON object.' });
    if (TABLES.some(t => !Array.isArray(body[t]))) return res.status(400).json({ error: 'Request must contain all QuickBite data arrays.' });
    const bytes = Buffer.byteLength(JSON.stringify(body), 'utf8');
    if (bytes > 2_000_000) return res.status(413).json({ error: 'Payload too large.' });

    await client.query('BEGIN');
    // Serialize full-state writes so overlapping serverless requests do not
    // interleave table replacement operations.
    await client.query("SELECT pg_advisory_xact_lock(741852963)");
    for (const name of DELETE_ORDER) await client.query(`DELETE FROM ${name}`);
    for (const table of ['customer','restaurant','food','discount','orders','cart','payment','delivery','review']) {
      const [sql, values] = INSERTS[table];
      for (const row of body[table]) await client.query(sql, values(row));
    }
    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Saved to PostgreSQL', tables: TABLES.length });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('QuickBite PostgreSQL API failed:', error.message);
    return res.status(500).json({ error: 'Database operation failed. Check that the data satisfies the database constraints.' });
  } finally {
    if (client) client.release();
  }
};
