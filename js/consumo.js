// Cálculo de consumo de combustible. Funciones puras: reciben cargas y devuelven números.
// El consumo nunca se guarda: se calcula cada vez a partir de las cargas.

/**
 * Tramos entre dos cargas consecutivas de "tanque lleno" de un mismo vehículo.
 * Método de tanque lleno: los litros que entran para volver a llenar el tanque son los que se
 * gastaron desde el llenado anterior. Por eso un tramo suma los litros de todas las cargas
 * posteriores al primer llenado (parciales incluidas) hasta el segundo llenado inclusive, y
 * NO cuenta los litros del primer llenado.
 *
 * @param cargas cargas de UN vehículo: { fecha, odometro, litros, tanqueLleno }
 * @returns tramos ordenados del más viejo al más nuevo
 */
export function tramos(cargas) {
  const orden = [...cargas].sort((a, b) => a.odometro - b.odometro || a.fecha.localeCompare(b.fecha));
  const out = [];
  let inicio = null;
  let litros = 0;
  let parciales = 0;
  for (const c of orden) {
    if (!inicio) { if (c.tanqueLleno) inicio = c; continue; } // lo anterior al primer llenado no sirve
    litros += c.litros;
    if (!c.tanqueLleno) { parciales++; continue; }
    const km = c.odometro - inicio.odometro;
    if (km <= 0) continue; // dos llenados con el mismo odómetro: se acumulan los litros y se sigue
    out.push({
      desde: inicio.fecha, hasta: c.fecha, odoDesde: inicio.odometro, odoHasta: c.odometro,
      km, litros, parciales, l100: (litros / km) * 100, kml: km / litros,
    });
    inicio = c; litros = 0; parciales = 0;
  }
  return out;
}

/** Promedio ponderado de un grupo de tramos: litros totales sobre km totales (no el promedio de promedios). */
export function promedio(lista) {
  const km = lista.reduce((s, t) => s + t.km, 0);
  const litros = lista.reduce((s, t) => s + t.litros, 0);
  if (!(km > 0) || !(litros > 0)) return null;
  return { l100: (litros / km) * 100, kml: km / litros, km, litros, tramos: lista.length };
}

/**
 * Resumen de consumo de un vehículo.
 * estado: 'sin-cargas' | 'faltan-llenos' (menos de dos cargas de tanque lleno) | 'ok'
 */
export function resumenConsumo(cargas, n = 5) {
  const ts = tramos(cargas);
  const llenos = cargas.filter((c) => c.tanqueLleno).length;
  const estado = !cargas.length ? 'sin-cargas' : ts.length ? 'ok' : 'faltan-llenos';
  return {
    estado, llenos, tramos: ts, n,
    ultimo: ts.length ? ts[ts.length - 1] : null,
    ultimosN: promedio(ts.slice(-n)),
    historico: promedio(ts),
  };
}
