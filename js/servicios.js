// Reglas de los servicios de mantenimiento. Funciones puras: no leen la base ni la pantalla.
// Un servicio con costo tiene UN gasto vinculado (servicio.gastoId ↔ gasto.servicioId): se carga una sola vez.

/** Devuelve el mensaje de error, o null si el servicio está bien. */
export function validarServicio(s) {
  if (!s.vehiculoId) return 'Elegí un vehículo';
  if (!s.tipo) return 'Elegí el tipo de servicio';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.fecha || '')) return 'Ingresá la fecha del servicio';
  if (!Number.isFinite(s.odometro) || s.odometro < 0) return 'Ingresá el odómetro en km';
  if (!(s.costo >= 0)) return 'El costo no puede ser negativo';
  if (s.costo > 0 && !s.medioId) return 'Elegí con qué lo pagaste';
  if (s.proxKm != null && !(s.proxKm > s.odometro)) return 'El próximo vencimiento en km tiene que ser mayor al odómetro del servicio';
  if (s.proxFecha && !(s.proxFecha > s.fecha)) return 'La fecha del próximo vencimiento tiene que ser posterior al servicio';
  return null;
}

/**
 * Gasto que le corresponde a un servicio, o null si no tiene costo.
 * @param s         servicio ya validado
 * @param categoria categoría de mantenimiento ({ id, rubroId })
 * @param alias     nombre del vehículo, para la descripción
 * @param previo    gasto vinculado que ya existía (al editar), para conservar su id y sus demás campos
 */
export function gastoDeServicio(s, categoria, alias, previo = null) {
  if (!(s.costo > 0)) return null;
  return {
    prescindible: false, creado: s.creado,
    ...(previo || {}),
    id: previo?.id || s.gastoId,
    fecha: s.fecha, monto: s.costo, moneda: 'ARS', cotizacion: null,
    rubroId: categoria.rubroId, categoriaId: categoria.id, medioId: s.medioId,
    descripcion: [s.tipo, alias].filter(Boolean).join(' · '),
    vehiculoId: s.vehiculoId, servicioId: s.id,
  };
}

/** Historial de servicios de un vehículo, del más nuevo al más viejo. */
export function historial(servicios, vehiculoId) {
  return servicios
    .filter((s) => s.vehiculoId === vehiculoId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.odometro - a.odometro);
}
