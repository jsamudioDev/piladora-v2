require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// ─── Datos de seed: Productos ────────────────────────────────────────────────
const productos = [
  { nombre: 'Maíz Grano 100lb',     unidad: 'saco', stockActual: 48, stockMinimo: 50,  categoria: 'grano',    ubicacion: 'piladora' },
  { nombre: 'Maíz Pilado 25lb',     unidad: 'saco', stockActual: 84, stockMinimo: 100, categoria: 'pilado',   ubicacion: 'piladora' },
  { nombre: 'Pulidura 50lb',        unidad: 'saco', stockActual: 18, stockMinimo: 30,  categoria: 'pilado',   ubicacion: 'piladora' },
  { nombre: 'Pollo Engorde H 40kg', unidad: 'saco', stockActual: 32, stockMinimo: 5,   categoria: 'alimento', ubicacion: 'piladora' },
  { nombre: 'PET MASTER 20kg',      unidad: 'saco', stockActual: 14, stockMinimo: 10,  categoria: 'alimento', ubicacion: 'piladora' },
];

const operarios = [
  { nombre: 'Eliecer', activo: true },
  { nombre: 'Chandy',  activo: true },
];

const parametros = [
  { clave: 'nombre_negocio',   valor: 'Piladora Samudio' },
  { clave: 'meta_margen',      valor: '25' },
  { clave: 'pago_por_tanda',   valor: '15' },
  { clave: 'precio_pilado',    valor: '3.50' },
  { clave: 'lb_por_hora',      valor: '200' },
  { clave: 'dias_op_periodo',  valor: '26' },
];

// ─── Datos de seed: Usuarios ─────────────────────────────────────────────────
const usuarios = [
  { nombre: 'Administrador',  email: 'admin@piladora.com',    password: 'Admin2026!',    rol: 'ADMIN' },
  { nombre: 'Vendedor Local', email: 'vendedor@piladora.com', password: 'Vendedor2026!', rol: 'VENDEDOR' },
  { nombre: 'Operario Planta', email: 'operario@piladora.com', password: 'Operario2026!', rol: 'OPERARIO' },
];

// ─── Función auxiliar para seed ──────────────────────────────────────────────
async function seedTable(label, items, finder, creator) {
  console.log(`\nSeeding ${label}...`);
  for (const item of items) {
    const exists = await finder(item);
    if (exists) {
      console.log(`  Ya existe: ${JSON.stringify(item).slice(0, 60)}`);
    } else {
      await creator(item);
      console.log(`  Creado: ${JSON.stringify(item).slice(0, 60)}`);
    }
  }
}

// ─── Ejecutar seed ──────────────────────────────────────────────────────────
async function main() {
  // Seed de usuarios con hash de contraseña
  console.log('\nSeeding usuarios...');
  for (const u of usuarios) {
    const existe = await prisma.usuario.findUnique({ where: { email: u.email } });
    if (existe) {
      console.log(`  Ya existe: ${u.email} (${u.rol})`);
    } else {
      const hash = await bcrypt.hash(u.password, 12);
      await prisma.usuario.create({
        data: { nombre: u.nombre, email: u.email, password: hash, rol: u.rol }
      });
      console.log(`  ✓ Creado: ${u.email} | contraseña: ${u.password} | rol: ${u.rol}`);
    }
  }

  await seedTable(
    'productos',
    productos,
    (p) => prisma.producto.findFirst({ where: { nombre: p.nombre } }),
    (p) => prisma.producto.create({ data: p })
  );

  await seedTable(
    'operarios',
    operarios,
    (o) => prisma.operario.findFirst({ where: { nombre: o.nombre } }),
    (o) => prisma.operario.create({ data: o })
  );

  await seedTable(
    'parámetros',
    parametros,
    (p) => prisma.parametro.findUnique({ where: { clave: p.clave } }),
    (p) => prisma.parametro.create({ data: p })
  );

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✓ Seed completado exitosamente');
  console.log('═══════════════════════════════════════════\n');

  // Resumen
  const users = await prisma.usuario.findMany({ select: { email: true, rol: true } });
  users.forEach(u => console.log(`  [usuario] ${u.email} → ${u.rol}`));
  const prods = await prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
  prods.forEach(p => console.log(`  [producto] ${p.nombre} stock:${p.stockActual} min:${p.stockMinimo}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
