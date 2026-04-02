// ─── Validaciones de entrada con express-validator ───────────────────────────
// Cada validador: limpia strings con trim() y escape() contra XSS,
// y verifica que los datos tengan el formato correcto antes de llegar
// al controlador. Si hay errores, handleValidation responde 400.
const { body, validationResult } = require('express-validator');

// Verifica los errores acumulados y responde 400 si hay alguno.
// Se usa al final de cada array de validaciones en las rutas.
const handleValidation = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }
  next();
};

// ─── Login ────────────────────────────────────────────────────────────────────
const validateLogin = [
  body('email')
    .trim().escape()
    .isEmail().withMessage('El email no es válido'),
  body('password')
    .trim()
    .isLength({ min: 6 }).withMessage('La contraseña debe tener mínimo 6 caracteres'),
  handleValidation,
];

// ─── Registro de usuario ─────────────────────────────────────────────────────
const validateRegistro = [
  body('nombre')
    .trim().escape()
    .notEmpty().withMessage('El nombre es obligatorio'),
  body('email')
    .trim().escape()
    .isEmail().withMessage('El email no es válido'),
  body('password')
    .trim()
    .isLength({ min: 8 }).withMessage('La contraseña debe tener mínimo 8 caracteres'),
  body('rol')
    .trim().escape()
    .isIn(['ADMIN', 'VENDEDOR', 'OPERARIO']).withMessage('El rol debe ser ADMIN, VENDEDOR u OPERARIO'),
  handleValidation,
];

// ─── Producto (stock) ─────────────────────────────────────────────────────────
const validateProducto = [
  body('nombre')
    .trim().escape()
    .notEmpty().withMessage('El nombre del producto es obligatorio'),
  body('unidad')
    .trim().escape()
    .notEmpty().withMessage('La unidad es obligatoria'),
  body('stockMinimo')
    .optional()
    .isFloat({ min: 0 }).withMessage('El stock mínimo debe ser mayor o igual a 0'),
  handleValidation,
];

// ─── Venta ────────────────────────────────────────────────────────────────────
const validateVenta = [
  body('total')
    .isFloat({ gt: 0 }).withMessage('El total debe ser mayor a 0'),
  body('metodoPago')
    .trim().escape()
    .notEmpty().withMessage('El método de pago es obligatorio'),
  body('detalles')
    .isArray({ min: 1 }).withMessage('La venta debe tener al menos un producto'),
  handleValidation,
];

// ─── Movimiento de stock ──────────────────────────────────────────────────────
const validateMovimiento = [
  body('productoId')
    .isInt({ gt: 0 }).withMessage('El productoId debe ser un entero válido'),
  body('tipo')
    .trim().escape()
    .isIn(['ENTRADA', 'SALIDA']).withMessage('El tipo debe ser ENTRADA o SALIDA'),
  body('cantidad')
    .isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
  handleValidation,
];

// ─── Egreso ───────────────────────────────────────────────────────────────────
const validateEgreso = [
  body('monto')
    .isFloat({ gt: 0 }).withMessage('El monto debe ser mayor a 0'),
  body('descripcion')
    .trim().escape()
    .notEmpty().withMessage('La descripción es obligatoria'),
  body('categoria')
    .trim().escape()
    .notEmpty().withMessage('La categoría es obligatoria'),
  handleValidation,
];

// ─── Pilado ───────────────────────────────────────────────────────────────────
const validatePilado = [
  body('operarioId')
    .isInt({ gt: 0 }).withMessage('El operarioId debe ser un entero válido'),
  body('qqEntrada')
    .isFloat({ gt: 0 }).withMessage('Los quintales de entrada deben ser mayor a 0'),
  handleValidation,
];

module.exports = {
  handleValidation,
  validateLogin,
  validateRegistro,
  validateProducto,
  validateVenta,
  validateMovimiento,
  validateEgreso,
  validatePilado,
};
