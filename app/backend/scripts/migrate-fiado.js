// ─── Script de migración: Fiado → Crédito ────────────────────────────────────
// Corre UNA SOLA VEZ en producción para corregir ventas antiguas que usaban
// metodoPago = 'Fiado' (antes de que se renombrara a 'CREDITO').
//
// Qué hace:
//   1. Busca todas las ventas con metodoPago = 'Fiado'
//   2. Actualiza cada una a metodoPago = 'CREDITO'
//   3. Si la venta NO tiene creditoId, crea el registro Credito asociado
//   4. Informa el resultado al finalizar
//
// Uso desde /app/backend:
//   node scripts/migrate-fiado.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('─── Migración Fiado → Crédito ───────────────────────────────────');

  // 1. Buscar ventas con metodoPago = 'Fiado' (o 'fiado' en cualquier capitalización)
  const ventasFiado = await prisma.venta.findMany({
    where: {
      metodoPago: { in: ['Fiado', 'fiado', 'FIADO'] },
    },
    include: {
      detalles: { include: { producto: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (ventasFiado.length === 0) {
    console.log('✅ No hay ventas con metodoPago "Fiado". Nada que migrar.');
    return;
  }

  console.log(`📋 Encontradas ${ventasFiado.length} venta(s) con metodoPago "Fiado".`);
  console.log();

  let actualizadas = 0;
  let creditosCreados = 0;
  let errores = 0;

  for (const venta of ventasFiado) {
    console.log(`  ► Venta #${venta.id} | Cliente: ${venta.cliente || 'Sin nombre'} | Total: $${venta.total.toFixed(2)}`);

    try {
      await prisma.$transaction(async (tx) => {
        // 2. Actualizar metodoPago
        const ventaActualizada = await tx.venta.update({
          where: { id: venta.id },
          data:  { metodoPago: 'CREDITO' },
        });

        // 3. Si no tiene creditoId, crear el crédito correspondiente
        if (!ventaActualizada.creditoId) {
          const credito = await tx.credito.create({
            data: {
              clienteNombre: venta.cliente || 'Cliente',
              montoTotal:    venta.total,
              saldo:         venta.total,
              ventaId:       venta.id,
            },
          });

          // Enlazar el creditoId en la venta
          await tx.venta.update({
            where: { id: venta.id },
            data:  { creditoId: credito.id },
          });

          console.log(`     → Crédito creado #${credito.id} (saldo: $${credito.saldo.toFixed(2)})`);
          creditosCreados++;
        } else {
          console.log(`     → Ya tiene creditoId #${ventaActualizada.creditoId}, solo se actualizó metodoPago.`);
        }
      });

      actualizadas++;
    } catch (e) {
      console.error(`     ✗ Error en venta #${venta.id}: ${e.message}`);
      errores++;
    }
  }

  console.log();
  console.log('─── Resultado ───────────────────────────────────────────────────');
  console.log(`  Ventas actualizadas : ${actualizadas}`);
  console.log(`  Créditos creados    : ${creditosCreados}`);
  console.log(`  Errores             : ${errores}`);

  if (errores === 0) {
    console.log('\n✅ Migración completada sin errores.');
  } else {
    console.log('\n⚠️  Migración completada con errores. Revisa los logs arriba.');
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
