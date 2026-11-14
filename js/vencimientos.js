// Vencimientos de servicios. Funciones puras: reciben los datos y la fecha de hoy, no leen el reloj ni la base.

export const UMBRAL_KM = 1000;  // "próximo" cuando faltan estos km o menos
export const UMBRAL_DIAS = 30;  // "próximo" cuando faltan estos días o menos

const GRAVEDAD = { vencido: 2, proximo: 1, 'al-dia': 0 };

/** Días enteros entre dos fechas 'AAAA-MM-DD' (positivo si `hasta` es posterior). */
export function diasEntre(desde, hasta) {
  const utc = (f) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(hasta) - utc(desde)) / 86400000);
}

/**
 * Estado del vencimiento de UN servicio.
 * Vence por lo que ocurra primero: los km o la fecha. Devuelve null si el servicio no tiene vencimiento.
 */
export function estadoVencimiento(servicio, odometroActual, hoy) {
  const kmRestantes = servicio.proxKm != null ? servicio.proxKm - odometroActual : null;
  const diasRestantes = servicio.proxFecha ? diasEntre(hoy, servicio.proxFecha) : null;
  if (kmRestantes === null && diasRestantes === null) return null;
  const porKm = kmRestantes === null ? 'al-dia' : kmRestantes <= 0 ? 'vencido' : kmRestantes <= UMBRAL_KM ? 'proximo' : 'al-dia';
  const porFecha = diasRestantes === null ? 'al-dia' : diasRestantes < 0 ? 'vencido' : diasRestantes <= UMBRAL_DIAS ? 'proximo' : 'al-dia';
  const estado = GRAVEDAD[porKm] >= GRAVEDAD[porFecha] ? porKm : porFecha;
  return { estado, kmRestantes, diasRestantes };
}

/**
 * Vencimientos vigentes de un vehículo.
 * De cada tipo de servicio solo cuenta el más reciente: un cambio de aceite nuevo reemplaza el aviso del anterior.
 * Ordenados de más a menos urgente.
 */
export function vencimientosDe(servicios, vehiculo, hoy) {
  const ultimoPorTipo = new Map();
  for (const s of servicios) {
    if (s.vehiculoId !== vehiculo.id) continue;
    const u = ultimoPorTipo.get(s.tipo);
    if (!u || s.fecha > u.fecha || (s.fecha === u.fecha && s.odometro > u.odometro)) ultimoPorTipo.set(s.tipo, s);
  }
  const out = [];
  for (const s of ultimoPorTipo.values()) {
    const e = estadoVencimiento(s, vehiculo.odometro || 0, hoy);
    if (e) out.push({ ...e, servicio: s, vehiculo });
  }
  const urgencia = (v) => Math.min(
    v.kmRestantes === null ? Infinity : v.kmRestantes / UMBRAL_KM,
    v.diasRestantes === null ? Infinity : v.diasRestantes / UMBRAL_DIAS,
  );
  return out.sort((a, b) => GRAVEDAD[b.estado] - GRAVEDAD[a.estado] || urgencia(a) - urgencia(b));
}

/** Avisos (vencidos y próximos) de todos los vehículos activos, de más a menos urgente. */
export function avisos(servicios, vehiculos, hoy) {
  return vehiculos
    .filter((v) => v.activo !== false)
    .flatMap((v) => vencimientosDe(servicios, v, hoy))
    .filter((v) => v.estado !== 'al-dia')
    .sort((a, b) => GRAVEDAD[b.estado] - GRAVEDAD[a.estado]);
}

/** Texto corto de un vencimiento: "Vencido hace 300 km", "Faltan 800 km · faltan 20 días", "Vence hoy". */
export function textoVencimiento({ kmRestantes, diasRestantes }) {
  const n = (x) => Math.abs(x).toLocaleString('es-AR');
  const partes = [];
  if (kmRestantes !== null) {
    partes.push(kmRestantes < 0 ? `vencido hace ${n(kmRestantes)} km` : kmRestantes === 0 ? 'vence en este kilometraje' : `faltan ${n(kmRestantes)} km`);
  }
  if (diasRestantes !== null) {
    const d = Math.abs(diasRestantes);
    partes.push(diasRestantes < 0 ? `vencido hace ${d} ${d === 1 ? 'día' : 'días'}`
      : diasRestantes === 0 ? 'vence hoy' : `${d === 1 ? 'falta' : 'faltan'} ${d} ${d === 1 ? 'día' : 'días'}`);
  }
  // Lo vencido va primero
  partes.sort((a, b) => b.startsWith('vencido') - a.startsWith('vencido'));
  const txt = partes.join(' · ');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
