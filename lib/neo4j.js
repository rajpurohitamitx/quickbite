const neo4j = require('neo4j-driver');

let driver;
function getDriver() {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !password) return null;
  if (!driver) {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 5,
      connectionAcquisitionTimeout: 10000
    });
  }
  return driver;
}

module.exports = { getDriver };
