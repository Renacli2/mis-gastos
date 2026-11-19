// Recordatorios de pago de servicios (luz, internet, patente…). Funciones puras: reciben los datos
// y la fecha de hoy, no leen el reloj, la base ni la pantalla. Así se pueden testear y reutilizar
// (la tarjeta del inicio hoy; un widget o un aviso más adelante).
//
// Modelo
// - Servicio a pagar (tabla serviciosPago):
//   { id, nombre, categoriaId, frecuencia, primerVenc: 'AAAA-MM-DD', appPago, medioId, enlace,
//     diasAviso, montoRef, activo, desde, creado }   (desde: fecha de reactivación, opcional)
//   No tiene monto fijo. montoRef es opcional: una guía para el primer pago, antes de tener historial.
//   No guarda claves, números de tarjeta ni credenciales: solo el nombre de la app y el medio de pago.
// - Vencimiento (tabla vencimientosPago):
//   { id: '<servicioId>_<fecha>', servicioId, fecha, estado: 'pendiente' | 'pagado' | 'oculto', gastoId, appPago }
//   El monto y la fecha de pago se leen del gasto vinculado (gastoId): nunca se copian, así no se desfasan.
import { sumarMeses, fechaEnMes } from './util.js';
import { diasEntre } from './vencimientos.js';

export const FRECUENCIAS = { mensual: 1, bimestral: 2, trimestral: 3, anual: 12, unica: 0 };
export const NOMBRE_FRECUENCIA = { mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', anual: 'Anual', unica: 'Única vez' };
export const DIAS_AVISO = 5;
export const MAX_GENERADOS = 24;   // tope de seguridad por servicio en una sola pasada

export const idVencimiento = (servicioId, fecha) => `${servicioId}_${fecha}`;

const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || '') && !Number.isNaN(Date.parse(f));

/**
 * N-ésimo vencimiento del servicio (n = 0 es el primero). Mantiene el día del primer vencimiento:
 * si el mes no tiene ese día (31 en febrero), vence el último día del mes; al mes siguiente vuelve al 31.
 */
export function fechaVencimiento(servicio, n) {
  const paso = FRECUENCIAS[servicio.frecuencia];
  if (n < 0 || (paso === 0 && n > 0)) return null;
  const dia = +servicio.primerVenc.slice(8, 10);
  return fechaEnMes(sumarMeses(servicio.primerVenc.slice(0, 7), n * paso), dia);
}

/** Primer vencimiento estrictamente posterior a `fecha`, o null (servicio de única vez ya pasado). */
export function siguienteVencimiento(servicio, fecha) {
  for (let n = 0; ; n++) {
    const f = fechaVencimiento(servicio, n);
    if (f === null) return null;
    if (f > fecha) return f;
  }
}

/**
 * Fechas de vencimiento que faltan crear para un servicio.
 * - Nunca crea fechas anteriores o iguales a la última que ya existe (pagada, oculta o pendiente):
 *   así no hay duplicados y no reaparecen vencimientos viejos al editar el servicio.
 * - Crea las vencidas hasta hoy que falten (quedan como "vencido" hasta que las pagues u ocultes)
 *   y siempre deja una por delante: la primera posterior a hoy y a la última pagada.
 */
export function vencimientosFaltantes(servicio, existentes, hoy) {
  if (servicio.activo === false || !esFecha(servicio.primerVenc) || !(servicio.frecuencia in FRECUENCIAS)) return [];
  const propios = existentes.filter((v) => v.servicioId === servicio.id);
  const ultima = propios.reduce((m, v) => (v.fecha > m ? v.fecha : m), '');
  const resueltas = propios.filter((v) => v.estado !== 'pendiente').reduce((m, v) => (v.fecha > m ? v.fecha : m), '');
  const limite = resueltas > hoy ? resueltas : hoy;
  const out = [];
  for (let n = 0; out.length < MAX_GENERADOS; n++) {
    const f = fechaVencimiento(servicio, n);
    if (f === null) break;
    // `desde`: al reactivar un servicio pausado no se reclaman los vencimientos del tiempo en pausa.
    if (f > ultima && !(servicio.desde && f < servicio.desde)) out.push(f);
    if (f > limite) break;   // la primera por delante ya está incluida
  }
  return out;
}

/** Vencimientos nuevos (registros listos para guardar) de todos los servicios. */
export function generarVencimientos(servicios, existentes, hoy) {
  return servicios.flatMap((s) => vencimientosFaltantes(s, existentes, hoy).map((fecha) => ({
    id: idVencimiento(s.id, fecha), servicioId: s.id, fecha, estado: 'pendiente', gastoId: null, appPago: null,
  })));
}

/**
 * Al editar un servicio: ids de sus vencimientos pendientes, para borrarlos y volver a generarlos
 * con los datos nuevos. Los pagados y ocultos se conservan.
 */
export const pendientesDe = (servicioId, vencimientos) =>
  vencimientos.filter((v) => v.servicioId === servicioId && v.estado === 'pendiente').map((v) => v.id);

/**
 * Vencimientos marcados como pagados cuyo gasto ya no existe (lo borraste desde Gastos):
 * vuelven a pendiente. Devuelve los registros a guardar.
 */
export function reconciliar(vencimientos, gastos) {
  const ids = new Set(gastos.map((g) => g.id));
  return vencimientos
    .filter((v) => v.estado === 'pagado' && (!v.gastoId || !ids.has(v.gastoId)))
    .map((v) => ({ ...v, estado: 'pendiente', gastoId: null, appPago: null }));
}

/** Urgencia de un vencimiento pendiente: vencido, hoy, próximo (dentro de los días de aviso) o más adelante. */
export function urgencia(fecha, hoy, diasAviso = DIAS_AVISO) {
  const dias = diasEntre(hoy, fecha);
  const estado = dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : dias <= diasAviso ? 'proximo' : 'mas-adelante';
  return { estado, dias };
}

const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

export function textoUrgencia({ estado, dias }, fecha) {
  if (estado === 'vencido') return dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`;
  if (estado === 'hoy') return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return dias <= 14 ? `Vence en ${dias} días` : `Vence el ${ddmm(fecha)}`;
}

const ORDEN = { vencido: 0, hoy: 1, proximo: 2, 'mas-adelante': 3 };

/**
 * Vencimientos pendientes de servicios activos, del más urgente al menos, con todo lo que hace falta
 * para mostrarlos. Es el "contrato" de datos: objetos simples, sin ids de la pantalla ni HTML,
 * que puede leer la tarjeta del inicio o, en el futuro, un widget o un aviso.
 * nombres = { medio: (id) => nombre }
 */
export function proximosVencimientos(servicios, vencimientos, hoy, nombres = {}) {
  const porId = new Map(servicios.map((s) => [s.id, s]));
  return vencimientos
    .filter((v) => v.estado === 'pendiente' && porId.get(v.servicioId) && porId.get(v.servicioId).activo !== false)
    .map((v) => {
      const s = porId.get(v.servicioId);
      const diasAviso = s.diasAviso ?? DIAS_AVISO;
      const u = urgencia(v.fecha, hoy, diasAviso);
      return {
        id: v.id, servicioId: s.id, nombre: s.nombre, fecha: v.fecha, diasAviso,
        estado: u.estado, dias: u.dias, texto: textoUrgencia(u, v.fecha),
        appPago: s.appPago || '', medio: nombres.medio ? nombres.medio(s.medioId) || '' : '', enlace: enlaceSeguro(s.enlace),
      };
    })
    .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre));
}

/**
 * Qué muestra la tarjeta del inicio: los urgentes (vencidos, hoy y dentro del aviso), hasta `max`.
 * Si no hay urgentes, el próximo como referencia, para que la tarjeta no quede vacía.
 */
export function paraTarjeta(lista, max = 5) {
  const urgentes = lista.filter((x) => x.estado !== 'mas-adelante');
  return {
    items: urgentes.slice(0, max),
    resto: Math.max(0, urgentes.length - max),
    siguiente: urgentes.length ? null : lista[0] || null,
    total: lista.length,
  };
}

/**
 * Copia chica para el widget de Android (versión 1 del contrato). Sale de proximosVencimientos() y lleva
 * solo lo que el widget muestra, elegido campo por campo: nada de montos, gastos ni datos de pago.
 * No guarda el estado de urgencia: el widget lo calcula con fecha y diasAviso, así acierta aunque cambie el día.
 */
export function datosWidget(lista, fecha, hayServicios, max = 12) {
  return {
    v: 1,
    generado: fecha,
    hayServicios: !!hayServicios,
    total: lista.length,
    items: lista.slice(0, max).map((x) => ({
      id: x.id, servicioId: x.servicioId, nombre: x.nombre, fecha: x.fecha, diasAviso: x.diasAviso,
      appPago: x.appPago || '', medio: x.medio || '', enlace: x.enlace || '',
    })),
  };
}

/** Pagos de un servicio, del más nuevo al más viejo, leyendo monto y fecha del gasto vinculado. */
export function historialPagos(servicioId, vencimientos, gastos) {
  const porId = new Map(gastos.map((g) => [g.id, g]));
  return vencimientos
    .filter((v) => v.servicioId === servicioId && v.estado === 'pagado' && porId.has(v.gastoId))
    .map((v) => {
      const g = porId.get(v.gastoId);
      return { vencimientoId: v.id, vencimiento: v.fecha, fechaPago: g.fecha, monto: g.monto, moneda: g.moneda || 'ARS', gastoId: g.id, appPago: v.appPago || '' };
    })
    .sort((a, b) => b.vencimiento.localeCompare(a.vencimiento) || b.fechaPago.localeCompare(a.fechaPago));
}

/** Monto de referencia: el del último pago o, si todavía no hay pagos, el cargado a mano en el servicio. */
export function montoReferencia(servicio, historial) {
  if (historial.length) return { monto: historial[0].monto, moneda: historial[0].moneda, origen: 'ultimo-pago' };
  return servicio.montoRef > 0 ? { monto: servicio.montoRef, moneda: 'ARS', origen: 'manual' } : null;
}

/** Enlace de pago solo si es http(s) y no trae usuario o clave adentro; si no, vacío. */
export function enlaceSeguro(enlace) {
  const t = String(enlace || '').trim();
  if (!t) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return '';
    return u.href;
  } catch { return ''; }
}

/** Devuelve el primer error o null. */
export function validarServicioPago(s) {
  if (!String(s.nombre || '').trim()) return 'Ingresá el nombre del servicio';
  if (!s.categoriaId) return 'Elegí la categoría del gasto';
  if (!(s.frecuencia in FRECUENCIAS)) return 'Elegí cada cuánto vence';
  if (!esFecha(s.primerVenc)) return 'Ingresá la fecha del próximo vencimiento';
  if (!Number.isInteger(s.diasAviso) || s.diasAviso < 0 || s.diasAviso > 60) return 'Los días de aviso van de 0 a 60';
  if (String(s.enlace || '').trim() && !enlaceSeguro(s.enlace)) return 'El enlace tiene que ser una dirección web (https://…) sin usuario ni clave';
  if (s.montoRef != null && s.montoRef !== '' && !(s.montoRef >= 0)) return 'El monto de referencia no puede ser negativo';
  return null;
}

export function validarPago(p) {
  if (!(p.monto > 0)) return 'Ingresá el monto que pagaste';
  if (!esFecha(p.fechaPago)) return 'Ingresá la fecha de pago';
  if (!p.medioId) return 'Elegí con qué lo pagaste';
  if (p.moneda === 'USD' && !(p.cotizacion > 0)) return 'Ingresá la cotización del dólar';
  return null;
}

/**
 * Gasto que genera un pago. `categoria` es la del servicio ({ id, rubroId }).
 * `previo` es el gasto anterior del mismo vencimiento, si se está corrigiendo: conserva su id y sus datos propios.
 */
export function gastoDePago(servicio, vencimiento, pago, categoria, previo = null) {
  return {
    ...(previo || {}),
    id: previo?.id || pago.id,
    fecha: pago.fechaPago, monto: pago.monto, moneda: pago.moneda || 'ARS',
    cotizacion: pago.moneda === 'USD' ? pago.cotizacion : null,
    rubroId: categoria.rubroId, categoriaId: categoria.id, medioId: pago.medioId,
    descripcion: `${servicio.nombre} · vto. ${ddmm(vencimiento.fecha)}`,
    prescindible: previo?.prescindible ?? false,
    servicioPagoId: servicio.id, vencimientoPagoId: vencimiento.id,
    creado: previo?.creado || pago.creado,
  };
}
