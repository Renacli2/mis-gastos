// Recordatorios de pago: lectura y escritura en la base. Las reglas están en js/pagos.js (funciones puras).
import * as db from './db.js';
import { S, cargar, medio } from './store.js';
import { hoy } from './util.js';
import { generarVencimientos, reconciliar, proximosVencimientos } from './pagos.js';

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

/** Datos de los próximos vencimientos, listos para mostrar (tarjeta del inicio, y a futuro widget o avisos). */
export const vencimientosActuales = (fecha = hoy()) =>
  proximosVencimientos(S.serviciosPago, S.vencimientosPago, fecha, { medio: (id) => (id ? medio(id).nombre : '') });
