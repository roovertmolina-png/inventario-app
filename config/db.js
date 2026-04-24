require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  connectTimeout: 20000
});

db.connect((err) => {
  if (err) {
    console.log("Error de conexión:", err);
  } else {
    console.log("Conectado a MySQL ✔");
  }
});

module.exports = db;