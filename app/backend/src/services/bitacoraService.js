// ─── Servicio centralizado para registrar entradas en la bitácora ─────────────
// Importa la instancia compartida de Prisma para no crear múltiples conexiones
const prisma = require('../prisma');

/**
 * Registra una acción en la bitácora.
 * Este método nunca lanza error — si falla, solo lo imprime en consola
 * para no interrumpir el flujo principal de la aplicación.
 *
 * @param {object}        opciones
 * @param {number|null}   opciones.usuarioId  - ID del usuario que realizó la acción
 * @param {string|null}   opciones.nombre     - Nombre del usuario al momento del log
 * @param {string}        opciones.modulo     - Módulo donde ocurrió la acción
 * @param {string}        opciones.accion     - Tipo de acción (login, crear, editar…)
 * @param {object|string} opciones.detalle    - Datos adicionales; se serializa a JSON si es objeto
 * @param {string|null}   opciones.ip         - Dirección IP del cliente
 */
async function registrar({ usuarioId = null, nombre = null, modulo, accion, detalle = {}, ip = null }) {
  try {
    await prisma.bitacora.create({
      data: {
        usuarioId,
        nombre,
        modulo,
        accion,
        detalle: typeof detalle === 'string' ? detalle : JSON.stringify(detalle),
        ip,
      },
    });
  } catch (err) {
    // No interrumpir el flujo principal si falla el log
    console.error('[Bitácora] Error al registrar:', err.message);
  }
}

module.exports = { registrar };
