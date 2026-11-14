// Reglas de las cargas de combustible. Funciones puras: no leen la base ni la pantalla.
// Una "carga" es un gasto común con campos extra: vehiculoId, litros, odometro y tanqueLleno.

export const esCarga = (g) => !!g.vehiculoId && g.litros > 0 && g.odometro >= 0;

/** Cargas de un vehículo, de la más vieja a la más nueva (por odómetro y, a igual odómetro, por fecha). */
export function cargasDe(gastos, vehiculoId) {
  return gastos
    .filter((g) => g.vehiculoId === vehiculoId && esCarga(g))
    .sort((a, b) => a.odometro - b.odometro || a.fecha.localeCompare(b.fecha));
}

export const precioPorLitro = (monto, litros) => (litros > 0 && monto > 0 ? monto / litros : null);

/**
 * Valida una carga contra las demás cargas del mismo vehículo (sin incluirla a ella misma).
 * Devuelve el mensaje de error, o null si está bien.
 */
export function validarCarga({ monto, litros, odometro, fecha }, otras) {
  if (!(monto > 0)) return 'El monto tiene que ser mayor a cero';
  if (!(litros > 0)) return 'Ingresá los litros cargados';
  if (!Number.isFinite(odometro) || odometro < 0) return 'Ingresá el odómetro en km';
  const km = (n) => n.toLocaleString('es-AR');
  const anterior = otras.filter((c) => c.fecha < fecha).reduce((m, c) => (m && m.odometro >= c.odometro ? m : c), null);
  if (anterior && odometro < anterior.odometro) {
    return `El odómetro no puede ser menor al de la carga anterior (${km(anterior.odometro)} km)`;
  }
  const siguiente = otras.filter((c) => c.fecha > fecha).reduce((m, c) => (m && m.odometro <= c.odometro ? m : c), null);
  if (siguiente && odometro > siguiente.odometro) {
    return `El odómetro no puede ser mayor al de una carga posterior (${km(siguiente.odometro)} km)`;
  }
  return null;
}

/**
 * Odómetro que le corresponde al vehículo después de guardar o borrar una carga.
 * @param actual     odómetro que tiene hoy el vehículo
 * @param cargas     cargas del vehículo tal como quedan después del cambio
 * @param odoPrevio  odómetro que tenía la carga antes de editarla o borrarla (null si es nueva)
 */
export function odometroVehiculo(actual, cargas, odoPrevio = null) {
  const maxCargas = cargas.reduce((m, c) => Math.max(m, c.odometro), 0);
  // Si el vehículo estaba "apoyado" en la carga que se corrigió o borró, se recalcula desde las cargas que quedan.
  if (odoPrevio !== null && actual === odoPrevio) return cargas.length ? maxCargas : actual;
  return Math.max(actual || 0, maxCargas);
}
