import * as db from './db.js';
import { S } from './store.js';
import { uid, hoy, mesActual, sumarMeses, fechaEnMes } from './util.js';

/** Ocurrencias de gastos recurrentes que ya vencieron y todavía no se cargaron. */
export function pendientes() {
  const ma = mesActual();
  const diaHoy = +hoy().slice(8);
  const out = [];
  for (const r of S.recurrentes) {
    if (!r.activo) continue;
    let m = r.ultimoMes ? sumarMeses(r.ultimoMes, 1) : r.desdeMes || ma;
    for (let i = 0; m <= ma && i < 36; i++, m = sumarMeses(m, 1)) {
      if (m === ma && r.dia > diaHoy) break;
      out.push({ r, mes: m, fecha: fechaEnMes(m, r.dia) });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function gastoDesde(r, fecha) {
  return {
    id: uid(), fecha, monto: r.monto, moneda: r.moneda,
    cotizacion: r.moneda === 'USD' ? S.cot : null,
    rubroId: r.rubroId, categoriaId: r.categoriaId, medioId: r.medioId,
    descripcion: r.descripcion, prescindible: !!r.prescindible,
    recurrenteId: r.id, creado: Date.now(),
  };
}

async function marcar(r, mes) {
  if (!r.ultimoMes || mes > r.ultimoMes) r.ultimoMes = mes;
  await db.put('recurrentes', r);
}

export async function cargarPendiente(p) {
  await db.put('gastos', gastoDesde(p.r, p.fecha));
  await marcar(p.r, p.mes);
}

export async function omitirPendiente(p) {
  await marcar(p.r, p.mes);
}

/** Costo mensual estimado en ARS de todos los recurrentes activos. */
export function costoMensual() {
  return S.recurrentes
    .filter((r) => r.activo)
    .reduce((a, r) => a + (r.moneda === 'USD' ? r.monto * (S.cot || 0) : r.monto), 0);
}
