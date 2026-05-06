const express = require("express");

const cors = require("cors");

const app = express();
const db = require('./config/db');

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
    return res.status(401).json({ success: false, message: "Contrasena incorrecta. Debes usar la contrasena 123 para modificar o eliminar." });
  }
  next();
}


function getUserEmail(req) {
  return (req.headers["x-user-email"] || req.body.usuario_correo || "").toString();
}

function initHistorialCambios() {
  const sql = `
    CREATE TABLE IF NOT EXISTS historial_cambios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      equipo_id INT NULL,
      accion VARCHAR(30) NOT NULL,
      equipo_nombre VARCHAR(150) NULL,
      serial VARCHAR(150) NULL,
      usuario_correo VARCHAR(255) NULL,
      usuario_rol VARCHAR(50) NULL,
      detalles JSON NULL,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(sql, (err) => {
    if (err) {
      console.log("Error creando historial_cambios:", err);
    } else {
      console.log("Tabla historial_cambios lista");
    }
  });
}

function registrarHistorial(req, accion, equipoId, equipo, detalles, callback) {
  const sql = `
    INSERT INTO historial_cambios
    (equipo_id, accion, equipo_nombre, serial, usuario_correo, usuario_rol, detalles)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    equipoId || null,
    accion,
    equipo && equipo.nombre_equipo ? equipo.nombre_equipo : null,
    equipo && equipo.serial ? equipo.serial : null,
    getUserEmail(req) || null,
    getUserRole(req) || null,
    JSON.stringify(detalles || {})
  ], (err) => {
    if (err) {
      console.log("Error registrando historial:", err);
    }
    if (callback) callback();
  });
}

// CONEXIÃ“N A MARIADB (XAMPP)
require('dotenv').config();

console.log("PASSWORD:", process.env.DB_PASSWORD);
initHistorialCambios();



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

// RUTA PARA LISTAR HISTORIAL DE CAMBIOS
app.get("/historial", (req, res) => {
  const sql = `
    SELECT id, equipo_id, accion, equipo_nombre, serial, usuario_correo, usuario_rol, detalles, creado_en
    FROM historial_cambios
    ORDER BY creado_en DESC, id DESC
    LIMIT 100
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error al cargar historial" });
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
  const findSql = "SELECT * FROM equipos WHERE id = ? LIMIT 1";

  db.query(findSql, [id], (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error al buscar equipo" });
    }
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Equipo no encontrado" });
    }

    const equipoEliminado = rows[0];
    const sql = "DELETE FROM equipos WHERE id = ?";

    db.query(sql, [id], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Error al eliminar" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Equipo no encontrado" });
      }

      registrarHistorial(req, "ELIMINACION", id, equipoEliminado, { equipo: equipoEliminado }, () => {
        res.json({ success: true, message: "Equipo eliminado correctamente" });
      });
    });
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
      registrarHistorial(req, "MODIFICACION", id, { nombre_equipo, serial }, {
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
      }, () => {
        res.json({ success: true, message: "Equipo actualizado correctamente" });
      });
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
  const findSql = "SELECT id, correo, rol FROM usuarios WHERE id = ? LIMIT 1";

  db.query(findSql, [id], (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: "Error al buscar usuario" });
    }
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const usuarioEliminado = rows[0];
    const sql = "DELETE FROM usuarios WHERE id = ?";

    db.query(sql, [id], (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Error al eliminar" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      registrarHistorial(req, "ELIMINACION_USUARIO", null, {
        nombre_equipo: usuarioEliminado.correo,
        serial: usuarioEliminado.rol
      }, {
        usuario_eliminado: usuarioEliminado
      }, () => {
        res.json({ success: true, message: "Usuario eliminado correctamente" });
      });
    });
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
        return res.status(500).json({ success: false, message: "Error al guardar" });
      }
      registrarHistorial(req, "CREACION", result.insertId, { nombre_equipo, serial }, {
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
      }, () => {
        res.json({ success: true, message: "Equipo guardado correctamente" });
      });
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
        message: "El correo ya estÃ¡ registrado"
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
