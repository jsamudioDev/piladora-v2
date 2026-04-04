// ─── Servicio de envío de correo electrónico ─────────────────────────────────
// Usa nodemailer con configuración SMTP almacenada en la tabla Parametro.
// Si el SMTP no está configurado, lanza un error descriptivo.

const nodemailer = require('nodemailer');
const prisma = require('../prisma');

/**
 * Obtiene la configuración SMTP desde la base de datos.
 * @returns {Object} cfg con las claves smtp_host, smtp_puerto, smtp_usuario, smtp_pass
 */
async function obtenerConfigSMTP() {
  const claves = ['smtp_host', 'smtp_puerto', 'smtp_usuario', 'smtp_pass', 'nombre_empresa', 'email_empresa'];
  const params = await prisma.parametro.findMany({ where: { clave: { in: claves } } });
  return Object.fromEntries(params.map(p => [p.clave, p.valor]));
}

/**
 * Envía un correo con la factura en HTML.
 * @param {Object} opciones
 * @param {string} opciones.destinatario - Correo del receptor
 * @param {string} opciones.asunto - Asunto del correo
 * @param {string} opciones.html - Contenido HTML del correo
 */
async function enviarFactura({ destinatario, asunto, html }) {
  const cfg = await obtenerConfigSMTP();

  // Verificar que el SMTP esté configurado
  if (!cfg.smtp_host || !cfg.smtp_usuario || !cfg.smtp_pass) {
    throw new Error(
      'SMTP no configurado. Ve a Configuración → Parámetros y completa: smtp_host, smtp_usuario y smtp_pass.'
    );
  }

  // Crear transporter con la configuración de la BD
  const transporter = nodemailer.createTransport({
    host:   cfg.smtp_host,
    port:   Number(cfg.smtp_puerto) || 587,
    secure: Number(cfg.smtp_puerto) === 465, // SSL solo en puerto 465
    auth: {
      user: cfg.smtp_usuario,
      pass: cfg.smtp_pass,
    },
  });

  // Determinar el remitente
  const nombreEmpresa = cfg.nombre_empresa || 'Piladora';
  const emailFrom     = cfg.email_empresa  || cfg.smtp_usuario;

  await transporter.sendMail({
    from:    `"${nombreEmpresa}" <${emailFrom}>`,
    to:      destinatario,
    subject: asunto,
    html,
  });
}

/**
 * Genera el HTML completo de una factura (cumple Ley 256 de Panamá).
 * @param {Object} venta - Objeto venta con detalles e usuario
 * @param {Object} empresa - Parámetros de la empresa (cfg de Parametros)
 * @returns {string} HTML de la factura
 */
function generarHTMLFactura(venta, empresa) {
  const pad = n => String(n).padStart(4, '0');
  const fmtFecha = iso => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };
  const fmtMoney = n => `$${Number(n || 0).toFixed(2)}`;

  const itbmsPct = Number(empresa.itbms_porcentaje || 7) / 100;
  const baseImp  = venta.aplicaITBMS ? venta.total / (1 + itbmsPct) : venta.total;
  const montoITBMS = venta.aplicaITBMS ? venta.total - baseImp : 0;

  const rucCompleto = [empresa.ruc_empresa, empresa.dv_empresa].filter(Boolean).join('-');

  const filas = (venta.detalles || []).map(d => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${d.producto?.nombre || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${d.cantidad}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(d.precioUnit)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(d.subtotal)}</td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><title>Factura F-${pad(venta.facturaNum)}</title></head>
  <body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#222;">
    <!-- Encabezado -->
    <table width="100%" style="margin-bottom:20px;">
      <tr>
        <td>
          <h2 style="margin:0;font-size:20px;">${empresa.nombre_empresa || 'Piladora'}</h2>
          ${rucCompleto ? `<p style="margin:2px 0;font-size:13px;">RUC: ${rucCompleto}</p>` : ''}
          ${empresa.direccion_empresa ? `<p style="margin:2px 0;font-size:13px;">${empresa.direccion_empresa}</p>` : ''}
          ${empresa.telefono_empresa  ? `<p style="margin:2px 0;font-size:13px;">Tel: ${empresa.telefono_empresa}</p>` : ''}
        </td>
        <td style="text-align:right;">
          <h1 style="margin:0;font-size:28px;color:#7c6af7;">FACTURA</h1>
          <p style="margin:4px 0;font-size:18px;font-weight:bold;">F-${pad(venta.facturaNum)}</p>
          <p style="margin:2px 0;font-size:13px;">Fecha: ${fmtFecha(venta.createdAt)}</p>
        </td>
      </tr>
    </table>
    <hr style="border:1px solid #7c6af7;margin-bottom:16px;">
    <!-- Datos del receptor -->
    <table width="100%" style="margin-bottom:20px;background:#f9f9f9;padding:12px;border-radius:6px;">
      <tr>
        <td style="font-size:13px;">
          <strong>FACTURADO A:</strong><br>
          ${venta.cliente || 'Consumidor Final'}<br>
          ${venta.clienteRuc ? `RUC/Cédula: ${venta.clienteRuc}<br>` : ''}
          ${venta.clienteDireccion ? `Dir: ${venta.clienteDireccion}<br>` : ''}
        </td>
        <td style="font-size:13px;text-align:right;">
          <strong>CONDICIÓN DE PAGO:</strong><br>
          ${venta.metodoPago === 'CREDITO' ? 'A CRÉDITO' : 'CONTADO'}<br>
          <strong>MÉTODO:</strong><br>
          ${venta.metodoPago === 'CREDITO' ? 'Crédito' : venta.metodoPago}
        </td>
      </tr>
    </table>
    <!-- Detalle de productos -->
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#7c6af7;color:#fff;">
          <th style="padding:8px;text-align:left;">Descripción</th>
          <th style="padding:8px;text-align:center;">Cantidad</th>
          <th style="padding:8px;text-align:right;">Precio Unit.</th>
          <th style="padding:8px;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <!-- Totales -->
    <table style="margin-left:auto;min-width:260px;font-size:14px;">
      ${venta.aplicaITBMS ? `
      <tr><td style="padding:4px 8px;">Base Imponible:</td><td style="padding:4px 8px;text-align:right;">${fmtMoney(baseImp)}</td></tr>
      <tr><td style="padding:4px 8px;">ITBMS (${empresa.itbms_porcentaje || 7}%):</td><td style="padding:4px 8px;text-align:right;">${fmtMoney(montoITBMS)}</td></tr>
      ` : ''}
      <tr style="font-size:18px;font-weight:bold;background:#7c6af7;color:#fff;">
        <td style="padding:8px 12px;">TOTAL:</td>
        <td style="padding:8px 12px;text-align:right;">${fmtMoney(venta.total)}</td>
      </tr>
    </table>
    <!-- Pie legal -->
    <p style="font-size:11px;color:#888;margin-top:24px;text-align:center;">
      Documento generado por el sistema de facturación de ${empresa.nombre_empresa || 'Piladora San José'}.
      Conserve este documento como comprobante de su compra.
    </p>
  </body>
  </html>
  `;
}

module.exports = { enviarFactura, generarHTMLFactura };
