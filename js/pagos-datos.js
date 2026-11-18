// Recordatorios de pago: lectura y escritura en la base. Las reglas están en js/pagos.js (funciones puras).
import * as db from './db.js';
import { S, cargar, medio } from './store.js';
import { hoy, uid } from './util.js';
import { generarVencimientos, reconciliar, proximosVencimientos, validarPago, gastoDePago } from './pagos.js';

/**
 * Deja los vencimientos al día: crea los que faltan según la frecuencia de cada servicio
 * y devuelve a pendiente los pagos cuyo gasto se borró. Es idempotente: correrla dos veces no duplica nada.
 * Devuelve true si cambió algo (y en ese caso ya recargó el estado).
 */
export async function sincronizarVencimientos(fecha = hoy()) {
  const cambios = [
    ...generarVencimientos(S.serviciosPago, S.vencimientosPago, fecha),
    ...reconciliar(S.vencimientosPago, S.gastos),
  ];
  if (!cambios.length) return false;
  await db.putMany('vencimientosPago', cambios);
  await cargar();
  return true;
}

/** Cambia el estado de un vencimiento pendiente u oculto (los pagados se deshacen desde el pago). */
async function cambiarEstado(id, estado) {
  const v = S.vencimientosPago.find((x) => x.id === id);
  if (!v || v.estado === 'pagado') return null;
  await db.put('vencimientosPago', { ...v, estado });
  await cargar();
  await sincronizarVencimientos();   // al ocultar el último, aparece el siguiente
  return v;
}
/** Oculta un vencimiento: deja de mostrarse, pero se puede restaurar desde la gestión de servicios. */
export const ocultarVencimiento = (id) => cambiarEstado(id, 'oculto');
export const restaurarVencimiento = (id) => cambiarEstado(id, 'pendiente');

/**
 * Registra el pago de un vencimiento: crea el gasto (con el monto que ingresaste, la categoría del servicio
 * y el medio elegido) y lo vincula. Si el vencimiento ya está pagado no hace nada: no hay carga duplicada.
 * pago = { monto, moneda, cotizacion, fechaPago, medioId, appPago }
 * Devuelve { gasto } o { error }.
 */
export async function registrarPago(vencimientoId, pago) {
  const v = (await db.all('vencimientosPago')).find((x) => x.id === vencimientoId);
  if (!v) return { error: 'Ese vencimiento ya no existe' };
  if (v.estado === 'pagado') return { error: 'Ese vencimiento ya figura como pagado' };
  const s = S.serviciosPago.find((x) => x.id === v.servicioId);
  if (!s) return { error: 'El servicio ya no existe' };
  const error = validarPago(pago);
  if (error) return { error };
  const c = S.categorias.find((x) => x.id === s.categoriaId);
  if (!c) return { error: 'La categoría del servicio ya no existe. Editá el servicio y elegí otra.' };
  const gasto = gastoDePago(s, v, { ...pago, id: uid(), creado: Date.now() }, c);
  await db.put('gastos', gasto);
  await db.put('vencimientosPago', { ...v, estado: 'pagado', gastoId: gasto.id, appPago: pago.appPago || '' });
  if (pago.moneda === 'USD' && !S.cot) await db.setConfig('cotizacion', pago.cotizacion);
  await cargar();
  await sincronizarVencimientos();   // asegura que exista el vencimiento siguiente
  return { gasto };
}

/** Deshace un pago: borra el gasto vinculado y el vencimiento vuelve a pendiente. */
export async function deshacerPago(vencimientoId) {
  const v = S.vencimientosPago.find((x) => x.id === vencimientoId);
  if (!v || v.estado !== 'pagado') return false;
  if (v.gastoId) await db.del('gastos', v.gastoId);
  await db.put('vencimientosPago', { ...v, estado: 'pendiente', gastoId: null, appPago: null });
  await cargar();
  return true;
}

/** Datos de los próximos vencimientos, listos para mostrar (tarjeta del inicio, y a futuro widget o avisos). */
export const vencimientosActuales = (fecha = hoy()) =>
  proximosVencimientos(S.serviciosPago, S.vencimientosPago, fecha, { medio: (id) => (id ? medio(id).nombre : '') });
