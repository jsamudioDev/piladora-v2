require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

async function main() {
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

  console.log('\n✓ Seed completado.\n');
  const prods = await prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
  prods.forEach(p => console.log(`  [producto] ${p.nombre} stock:${p.stockActual} min:${p.stockMinimo}`));
  const ops = await prisma.operario.findMany({ orderBy: { nombre: 'asc' } });
  ops.forEach(o => console.log(`  [operario] ${o.nombre} activo:${o.activo}`));
  const params = await prisma.parametro.findMany({ orderBy: { clave: 'asc' } });
  params.forEach(p => console.log(`  [param] ${p.clave} = ${p.valor}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
