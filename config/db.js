require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.log("Error de conexion:", err.message);
    return;
  }

  console.log("Conectado a MySQL");
  connection.release();
});

module.exports = db;
