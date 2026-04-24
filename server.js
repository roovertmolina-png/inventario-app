const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

function getUserRole(req) {
  return (req.headers["x-user-role"] || "").toLowerCase();
}

const ADMIN_PASSWORD = "123";

function verifyAdminPassword(req, res, next) {
  const password = (req.headers["x-admin-password"] || req.body.adminPassword || req.query.adminPassword || "").toString();
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Contraseña incorrecta. Debes usar la contraseña 123 para modificar o eliminar." });
  }
  next();
}

// CONEXIÓN A MARIADB (XAMPP)
const db = mysql.createConnection({
  host: "localhost",
  user: "app",
  password: "123456",
  database: "miproyecto"
});

db.connect(err => {
  if (err) {
    console.log("Error de conexión:", err);
  } else {
    console.log("Conectado a la base de datos");
  }
});

db.connect(err => {
  if (err) {
    console.log("Error de conexión:", err);
  } else {
    console.log("Conectado a la base de datos");

    // 👇 PRUEBA REAL
    db.query("SELECT * FROM usuarios", (err, results) => {
      if (err) {
        console.log("Error en la consulta:", err);
      } else {
        console.log("Datos:", results);
      }
    });

  }
});

function ensureCiudad(ciudadNombre, callback) {
  if (!ciudadNombre) {
    return callback(null, null);
  }
  const nombreCiud = ciudadNombre.trim();
  const findSql = "SELECT id FROM ciudades WHERE nombres = ? LIMIT 1";
  db.query(findSql, [nombreCiud], (err, result) => {
    if (err) {
      console.log(err);
      return callback(err);
    }
    if (result.length > 0) {
      return callback(null, result[0].id);
    }
    const insertSql = "INSERT INTO ciudades (nombres) VALUES (?)";
    db.query(insertSql, [nombreCiud], (err, result) => {
      if (err) {
        console.log(err);
        return callback(err);
      }
      callback(null, result.insertId);
    });
  });
}

function ensureEdificio(edificioNombre, callback) {
  if (!edificioNombre) {
    return callback(null, null);
  }
  const nombreEd = edificioNombre.trim();
  const findSql = "SELECT id FROM edificios WHERE nombre = ? LIMIT 1";
  db.query(findSql, [nombreEd], (err, result) => {
    if (err) {
      console.log(err);
      return callback(err);
    }
    if (result.length > 0) {
      return callback(null, result[0].id);
    }
    const insertSql = "INSERT INTO edificios (nombre) VALUES (?)";
    db.query(insertSql, [nombreEd], (err, result) => {
      if (err) {
        console.log(err);
        return callback(err);
      }
      callback(null, result.insertId);
    });
  });
}

// RUTA PARA LISTAR EQUIPOS
app.get("/equipos", (req, res) => {
  const sql = `
    SELECT e.*, c.nombres AS ciudad, ed.nombre AS edificio
    FROM equipos e
    LEFT JOIN ciudades c ON e.ciudad_id = c.id
    LEFT JOIN edificios ed ON e.edificio_id = ed.id
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error servidor" });
    }
    res.json(result);
  });
});

// RUTA PARA LISTAR CIUDADES
app.get("/ciudades", (req, res) => {
  const sql = "SELECT id, nombres FROM ciudades";
  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error servidor" });
    }
    res.json(result);
  });
});

// RUTA PARA ELIMINAR EQUIPO
app.delete("/equipos/:id", verifyAdminPassword, (req, res) => {
  if (getUserRole(req) === "servicio") {
    return res.status(403).json({ success: false, message: "No autorizado: usuario servicio no puede eliminar equipos" });
  }
  const { id } = req.params;
  const sql = "DELETE FROM equipos WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error al eliminar" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Equipo no encontrado" });
    }
    res.json({ success: true, message: "Equipo eliminado correctamente" });
  });
});

// RUTA PARA MODIFICAR EQUIPO
app.put("/equipos/:id", verifyAdminPassword, (req, res) => {
  if (getUserRole(req) === "servicio") {
    return res.status(403).json({ success: false, message: "No autorizado: usuario servicio no puede modificar equipos" });
  }

  const { id } = req.params;
  const {
    nombre_equipo,
    serial,
    placa,
    modelo,
    marca_id,
    tipo_equipo_id,
    estado_id,
    piso_id,
    ciudad,
    edificio,
    usuario_modifica
  } = req.body;

  function updateEquipo(ciudadId, edificioId) {
    const sql = `
      UPDATE equipos SET
      nombre_equipo = ?,
      serial = ?,
      placa = ?,
      modelo = ?,
      marca_id = ?,
      tipo_equipo_id = ?,
      estado_id = ?,
      piso_id = ?,
      ciudad_id = ?,
      edificio_id = ?,
      usuario_modifica = ?
      WHERE id = ?
    `;

    db.query(sql, [
      nombre_equipo,
      serial,
      placa,
      modelo,
      marca_id,
      tipo_equipo_id,
      estado_id,
      piso_id,
      ciudadId,
      edificioId,
      usuario_modifica,
      id
    ], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Error al actualizar" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Equipo no encontrado" });
      }
      res.json({ success: true, message: "Equipo actualizado correctamente" });
    });
  }

  ensureCiudad(ciudad, (err, ciudadId) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Error al procesar ciudad" });
    }
    ensureEdificio(edificio, (err, edificioId) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Error al procesar edificio" });
      }
      updateEquipo(ciudadId, edificioId);
    });
  });
});

// RUTA PARA LISTAR USUARIOS
app.get("/usuarios", (req, res) => {
  const sql = "SELECT id, correo, rol FROM usuarios";
  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error servidor" });
    }
    res.json(result);
  });
});

// RUTA PARA ELIMINAR USUARIO
app.delete("/usuarios/:id", verifyAdminPassword, (req, res) => {
  if (getUserRole(req) === "servicio") {
    return res.status(403).json({ success: false, message: "No autorizado: usuario servicio no puede eliminar usuarios" });
  }
  const { id } = req.params;
  const sql = "DELETE FROM usuarios WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error al eliminar" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
    res.json({ success: true, message: "Usuario eliminado correctamente" });
  });
});

// RUTA PARA GUARDAR EQUIPOS
app.post("/equipos", (req, res) => {
  if (getUserRole(req) === "servicio") {
    return res.status(403).json({ success: false, message: "No autorizado: usuario servicio no puede crear equipos" });
  }

  const {
    nombre_equipo,
    serial,
    placa,
    modelo,
    marca_id,
    tipo_equipo_id,
    estado_id,
    piso_id,
    ciudad,
    edificio,
    usuario_modifica
  } = req.body;

  function insertEquipo(ciudadId, edificioId) {
    const sql = `
      INSERT INTO equipos 
      (nombre_equipo, serial, placa, modelo, marca_id, tipo_equipo_id, estado_id, piso_id, ciudad_id, edificio_id, usuario_modifica)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
      nombre_equipo,
      serial,
      placa,
      modelo,
      marca_id,
      tipo_equipo_id,
      estado_id,
      piso_id,
      ciudadId,
      edificioId,
      usuario_modifica
    ], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al guardar");
      }
      res.send("Equipo guardado correctamente");
    });
  }

  ensureCiudad(ciudad, (err, ciudadId) => {
    if (err) {
      return res.status(500).send("Error al procesar ciudad");
    }
    ensureEdificio(edificio, (err, edificioId) => {
      if (err) {
        return res.status(500).send("Error al procesar edificio");
      }
      insertEquipo(ciudadId, edificioId);
    });
  });
});

app.post("/login", (req, res) => {
  const { correo, password } = req.body;

  const sql = "SELECT * FROM usuarios WHERE correo = ? AND password = ?";

  db.query(sql, [correo, password], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send("Error servidor");
    }

    if (result.length > 0) {
      res.json({
        success: true,
        usuario: result[0]
      });
    } else {
      res.json({
        success: false,
        message: "Datos incorrectos"
      });
    }
  });
});

app.post("/register", (req, res) => {
  const { correo, password, rol } = req.body;

  // Verificar si el correo ya existe
  const checkSql = "SELECT * FROM usuarios WHERE correo = ?";
  db.query(checkSql, [correo], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error servidor" });
    }

    if (result.length > 0) {
      return res.json({
        success: false,
        message: "El correo ya está registrado"
      });
    }

    // Insertar nuevo usuario
    const insertSql = "INSERT INTO usuarios (correo, password, rol) VALUES (?, ?, ?)";
    db.query(insertSql, [correo, password, rol], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Error al registrar" });
      }
      res.json({
        success: true,
        message: "Usuario registrado correctamente"
      });
    });
  });
});

// INICIAR SERVIDOR
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});

