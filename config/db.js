require('dotenv').config();
const mysql = require('mysql2');

const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const sslConfig = sslEnabled
  ? {
      rejectUnauthorized: false
    }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

function isTransientConnectionError(err) {
  return err && [
    'PROTOCOL_CONNECTION_LOST',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE'
  ].includes(err.code);
}

const originalQuery = pool.query.bind(pool);

pool.query = function queryWithRetry(sql, values, callback) {
  if (typeof values === 'function') {
    callback = values;
    values = undefined;
  }

  const run = (attempt) => {
    const done = (err, results, fields) => {
      if (isTransientConnectionError(err) && attempt < 2) {
        console.log(`Reintentando consulta MySQL por ${err.code} intento ${attempt + 1}`);
        return setTimeout(() => run(attempt + 1), 500);
      }

      if (callback) callback(err, results, fields);
    };

    if (values !== undefined) {
      return originalQuery(sql, values, done);
    }

    return originalQuery(sql, done);
  };

  run(0);
};

module.exports = pool;
