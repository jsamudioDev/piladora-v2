require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const productos = [
  { nombre: 'Maíz Grano 100lb',    unidad: 'saco', stockActual: 48, stockMinimo: 50, categoria: 'grano',    ubicacion: 'piladora' },
  { nombre: 'Maíz Pilado 25lb',    unidad: 'saco', stockActual: 84, stockMinimo: 100, categoria: 'pilado',  ubicacion: 'piladora' },
  { nombre: 'Pulidura 50lb',       unidad: 'saco', stockActual: 18, stockMinimo: 30, categoria: 'pilado',   ubicacion: 'piladora' },
  { nombre: 'Pollo Engorde H 40kg',unidad: 'saco', stockActual: 32, stockMinimo: 5,  categoria: 'alimento', ubicacion: 'piladora' },
  { nombre: 'PET MASTER 20kg',     unidad: 'saco', stockActual: 14, stockMinimo: 10, categoria: 'alimento', ubicacion: 'piladora' },
];

async function main() {
  console.log('Seeding productos...');
  for (const p of productos) {
    await prisma.producto.upsert({
      where:  { id: -1 },
      update: {},
      create: p,
    }).catch(async () => {
      // upsert by nombre si ya existe
      const existing = await prisma.producto.findFirst({ where: { nombre: p.nombre } });
      if (!existing) await prisma.producto.create({ data: p });
      else console.log(`  Ya existe: ${p.nombre}`);
    });
  }

  // Insertar directo si no hay duplicados
  const count = await prisma.producto.count();
  if (count === 0) {
    await prisma.producto.createMany({ data: productos });
  }

  console.log('Seed completado.');
  const all = await prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
  all.forEach(p => console.log(`  [${p.id}] ${p.nombre} — stock: ${p.stockActual} / min: ${p.stockMinimo}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
