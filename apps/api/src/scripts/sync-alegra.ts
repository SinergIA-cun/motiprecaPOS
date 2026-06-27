// Runner manual de la sincronización Alegra (prueba local).
// Ejecutar con: pnpm --filter @motipreca/api run sync:alegra
import { syncFromAlegra } from '../lib/alegra/sync.js';

async function main(): Promise<void> {
  console.log('⏳ Sincronizando desde Alegra…\n');
  const r = await syncFromAlegra();
  for (const line of r.detalle) console.log(line);
  console.log('\n=== Resumen ===');
  console.log(
    `Clientes:  ${r.clientes.creados} creados · ${r.clientes.actualizados} actualizados · ${r.clientes.omitidos} omitidos (de ${r.clientes.total})`,
  );
  console.log(
    `Productos: ${r.productos.creados} creados · ${r.productos.actualizados} actualizados (de ${r.productos.total})`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌ Error en la sincronización:', error);
    process.exit(1);
  });
