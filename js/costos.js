// Costos por vehículo. Funciones puras: reciben los gastos y cómo convertirlos a pesos.

/**
 * Costo total de un vehículo y costo por km.
 *
 * - combustible: gastos del vehículo en la categoría de combustible (tengan o no litros cargados)
 * - servicios:   gastos generados por un servicio
 * - otros:       cualquier otro gasto asociado al vehículo (seguro, patente, peajes…)
 * - km:          distancia entre el menor y el mayor odómetro registrado (cargas y servicios)
 * - porKm:       total ÷ km. null si todavía no hay dos registros de odómetro distintos.
 *
 * @param gastos     todos los gastos
 * @param servicios  todos los servicios
 * @param vehiculoId vehículo a calcular
 * @param enPesos    función gasto → monto en pesos
 * @param tipoDeCategoria función categoriaId → 'combustible' | 'mantenimiento' | undefined
 * @param desde, hasta  opcionales: limitan los gastos a un rango de fechas 'AAAA-MM-DD' (inclusive)
 */
export function costosVehiculo(gastos, servicios, vehiculoId, enPesos, tipoDeCategoria, { desde = '', hasta = '9999-12-31' } = {}) {
  const r = { combustible: 0, servicios: 0, otros: 0, total: 0, km: 0, porKm: null, cantidad: 0 };
  const odos = [];
  for (const g of gastos) {
    if (g.vehiculoId !== vehiculoId || g.fecha < desde || g.fecha > hasta) continue;
    const monto = enPesos(g) || 0;
    if (g.servicioId) r.servicios += monto;
    else if (tipoDeCategoria(g.categoriaId) === 'combustible' || g.litros > 0) r.combustible += monto;
    else r.otros += monto;
    r.cantidad++;
    if (Number.isFinite(g.odometro) && g.odometro !== null) odos.push(g.odometro);
  }
  for (const s of servicios) {
    if (s.vehiculoId !== vehiculoId || s.fecha < desde || s.fecha > hasta) continue;
    if (Number.isFinite(s.odometro)) odos.push(s.odometro);
  }
  r.total = r.combustible + r.servicios + r.otros;
  if (odos.length > 1) r.km = Math.max(...odos) - Math.min(...odos);
  if (r.km > 0 && r.total > 0) r.porKm = r.total / r.km;
  return r;
}
