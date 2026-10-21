const { Pool } = require('pg');

let pool;
function getPool() {
  // POSTGRES_URL is commonly added by Vercel database integrations.
  // DATABASE_URL is supported for manually configured PostgreSQL providers too.
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      // Hosted PostgreSQL providers normally require TLS. Keep certificate
      // verification compatible with provider-managed serverless endpoints.
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS qb_customers (
      id BIGINT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      phone TEXT, address TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qb_restaurants (
      id BIGINT PRIMARY KEY, name TEXT NOT NULL, cuisine TEXT NOT NULL,
      rating NUMERIC(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5), city TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qb_food_items (
      id BIGINT PRIMARY KEY, name TEXT NOT NULL, price NUMERIC(12,2) NOT NULL CHECK (price > 0),
      category TEXT NOT NULL CHECK (category IN ('Veg','Non-Veg')),
      available TEXT NOT NULL CHECK (available IN ('Y','N')),
      restaurant_id BIGINT NOT NULL REFERENCES qb_restaurants(id)
    );
    CREATE TABLE IF NOT EXISTS qb_discounts (
      id BIGINT PRIMARY KEY, code TEXT NOT NULL UNIQUE, pct NUMERIC(5,2) NOT NULL CHECK (pct >= 1 AND pct <= 100),
      expiry DATE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qb_orders (
      id BIGINT PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES qb_customers(id),
      discount_id BIGINT REFERENCES qb_discounts(id) ON DELETE SET NULL,
      total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
      status TEXT NOT NULL CHECK (status IN ('Pending','Delivered','Cancelled')), order_date DATE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qb_order_items (
      id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES qb_orders(id) ON DELETE CASCADE,
      food_id BIGINT NOT NULL REFERENCES qb_food_items(id), quantity INTEGER NOT NULL CHECK (quantity > 0)
    );
    CREATE TABLE IF NOT EXISTS qb_payments (
      id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL UNIQUE REFERENCES qb_orders(id) ON DELETE CASCADE,
      method TEXT NOT NULL CHECK (method IN ('UPI','Card','COD')),
      status TEXT NOT NULL CHECK (status IN ('Pending','Success','Failed')),
      amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0)
    );
    CREATE TABLE IF NOT EXISTS qb_deliveries (
      id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL UNIQUE REFERENCES qb_orders(id) ON DELETE CASCADE,
      partner TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('Preparing','Out for Delivery','Delivered','Cancelled')),
      address TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qb_reviews (
      id BIGINT PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES qb_customers(id),
      restaurant_id BIGINT NOT NULL REFERENCES qb_restaurants(id),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), comment TEXT
    );
    CREATE INDEX IF NOT EXISTS qb_orders_customer_idx ON qb_orders(customer_id);
    CREATE INDEX IF NOT EXISTS qb_order_items_order_idx ON qb_order_items(order_id);
    CREATE INDEX IF NOT EXISTS qb_food_restaurant_idx ON qb_food_items(restaurant_id);
    CREATE INDEX IF NOT EXISTS qb_reviews_restaurant_idx ON qb_reviews(restaurant_id);
  `);
}

module.exports = { getPool, ensureSchema };
