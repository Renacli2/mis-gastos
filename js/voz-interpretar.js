// Interpretación de una frase dictada: de "gasté quince mil en supermercado" saca los datos del gasto.
// Funciones puras: reciben la frase y las listas de la app, y no guardan ni inventan nada.
// Lo que no se entiende queda en null; lo ambiguo queda en null con las opciones aparte.
import { palabras, cantidades } from './voz-numeros.js';

const IGNORAR = ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'mi', 'en', 'con', 'a', 'pago', 'tarjeta'];
const LITROS = ['litro', 'litros', 'l', 'lt', 'lts'];
const KM = ['km', 'kms', 'kilometro', 'kilometros'];
const DOLARES = ['dolar', 'dolares', 'usd'];
const PESOS = ['peso', 'pesos', 'mango', 'mangos'];

/** Dos palabras son la misma si solo cambia el plural ("peajes" = "peaje"). */
const igualPalabra = (a, b) => a === b || a + 's' === b || a === b + 's' || a + 'es' === b || a === b + 'es';

/** Partes de un nombre: "Taxi / Uber" → ["taxi / uber", "taxi", "uber"]. */
function frasesDeNombre(nombre) {
  const partes = String(nombre || '').split(/\s*\/\s*|\s+y\s+|,/);
  return [nombre, ...(partes.length > 1 ? partes : [])];
}

/** Arma entradas { frase: [palabras], ids } descartando las vacías. */
const entrada = (texto, ids) => ({ frase: palabras(texto), ids });
const utiles = (lista) => lista.filter((e) => e.frase.length && e.ids.length);

/**
 * Busca las frases en el texto y decide:
 * - una coincidencia dentro de otra más larga no cuenta ("tarjeta" dentro de "tarjeta de crédito");
 * - si todas las coincidencias comparten candidatos, quedan esos ("tarjeta" + "visa" → Crédito Visa);
 * - si no comparten ninguno, quedan todos como opciones.
 */
export function buscar(t, entradas) {
  const hallados = [];
  for (const e of entradas) {
    for (let i = 0; i + e.frase.length <= t.length; i++) {
      if (e.frase.every((p, k) => igualPalabra(t[i + k], p))) hallados.push({ desde: i, hasta: i + e.frase.length, ids: e.ids });
    }
  }
  const validos = hallados.filter((m) => !hallados.some((n) =>
    n !== m && n.desde <= m.desde && n.hasta >= m.hasta && (n.hasta - n.desde) > (m.hasta - m.desde)));
  if (!validos.length) return [];
  const comunes = validos.reduce((acc, m) => acc.filter((id) => m.ids.includes(id)), validos[0].ids);
  return comunes.length ? [...new Set(comunes)] : [...new Set(validos.flatMap((m) => m.ids))];
}

const norm = (s) => palabras(s).join(' ');

function entradasCategorias(categorias, rubros, sin) {
  const porNombre = {};
  Object.entries(sin || {}).forEach(([k, v]) => { porNombre[k.startsWith('tipo:') ? k : norm(k)] = v; });
  const lista = [];
  for (const c of categorias) {
    frasesDeNombre(c.nombre).forEach((f) => lista.push(entrada(f, [c.id])));
    [...(porNombre[norm(c.nombre)] || []), ...(c.tipo ? porNombre[`tipo:${c.tipo}`] || [] : [])].forEach((f) => lista.push(entrada(f, [c.id])));
  }
  // Nombrar un rubro apunta a todas sus categorías: queda como opciones dentro de ese rubro.
  for (const r of rubros || []) {
    const ids = categorias.filter((c) => c.rubroId === r.id).map((c) => c.id);
    frasesDeNombre(r.nombre).forEach((f) => lista.push(entrada(f, ids)));
  }
  return utiles(lista);
}

function entradasMedios(medios, sin) {
  const lista = [];
  for (const m of medios) {
    lista.push(entrada(m.nombre, [m.id]));
    palabras(m.nombre).filter((p) => !IGNORAR.includes(p)).forEach((p) =>
      lista.push({ frase: [p], ids: medios.filter((x) => palabras(x.nombre).includes(p)).map((x) => x.id) }));
  }
  for (const s of sin || []) {
    const ids = medios.filter((m) => (s.tipos || []).includes(m.tipo) || (s.nombre && norm(m.nombre) === norm(s.nombre))).map((m) => m.id);
    (s.palabras || []).forEach((f) => lista.push(entrada(f, ids)));
  }
  return utiles(lista);
}

function entradasVehiculos(vehiculos) {
  const lista = [];
  for (const v of vehiculos) {
    const textos = [v.alias, v.marca, v.modelo].filter(Boolean);
    textos.forEach((x) => lista.push(entrada(x, [v.id])));
    palabras(v.alias).filter((p) => !IGNORAR.includes(p) && p !== 'auto').forEach((p) =>
      lista.push({ frase: [p], ids: vehiculos.filter((x) => palabras(x.alias).includes(p)).map((x) => x.id) }));
  }
  return utiles(lista);
}

/** Suma días a una fecha 'AAAA-MM-DD'. */
function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** hoy, ayer, anteayer (también "antes de ayer" y "antier"). Devuelve { fecha, texto } o null. */
export function fechaRelativa(t, hoy) {
  const s = ` ${t.join(' ')} `;
  if (/ (anteayer|antier|antes de ayer|antes de ayer) /.test(s)) return { fecha: sumarDias(hoy, -2), texto: 'anteayer' };
  if (s.includes(' ayer ')) return { fecha: sumarDias(hoy, -1), texto: 'ayer' };
  if (s.includes(' hoy ')) return { fecha: hoy, texto: 'hoy' };
  return null;
}

/**
 * Interpreta una frase.
 * ctx = { categorias, rubros, medios, vehiculos, hoy: 'AAAA-MM-DD', sinonimos }
 * Devuelve los datos entendidos; los que no, en null. Si hay varias opciones posibles para un dato,
 * el dato queda en null y las opciones van en montosPosibles / categoriasPosibles / mediosPosibles / vehiculosPosibles.
 */
export function interpretar(texto, ctx) {
  const t = palabras(texto);
  const r = {
    texto: String(texto || '').trim(),
    monto: null, moneda: null, montosPosibles: [],
    litros: null, odometro: null,
    rubroId: null, categoriaId: null, categoriasPosibles: [],
    medioId: null, mediosPosibles: [],
    vehiculoId: null, vehiculosPosibles: [],
    fecha: null, fechaTexto: null,
  };

  // Números: el que va con "litros" son litros, el que va con "km" es el odómetro; el resto puede ser el monto.
  const seguros = [], sueltos = [];
  for (const c of cantidades(t)) {
    const sig = t[c.hasta];
    if (LITROS.includes(sig)) { if (r.litros === null) r.litros = c.valor; continue; }
    if (KM.includes(sig)) { if (r.odometro === null) r.odometro = Math.round(c.valor); continue; }
    if (DOLARES.includes(sig)) { seguros.push({ valor: c.valor, moneda: 'USD' }); continue; }
    if (PESOS.includes(sig) || t[c.desde].startsWith('$')) { seguros.push({ valor: c.valor, moneda: 'ARS' }); continue; }
    sueltos.push({ valor: c.valor, moneda: null });
  }
  const candidatos = (seguros.length ? seguros : sueltos).filter((c) => c.valor > 0);
  if (candidatos.length === 1) {
    r.monto = Math.round(candidatos[0].valor * 100) / 100;
    r.moneda = candidatos[0].moneda;
  } else if (candidatos.length > 1) {
    r.montosPosibles = [...new Set(candidatos.map((c) => Math.round(c.valor * 100) / 100))];
    if (r.montosPosibles.length === 1) { r.monto = r.montosPosibles[0]; r.moneda = candidatos[0].moneda; r.montosPosibles = []; }
  }

  const sin = ctx.sinonimos || {};
  const ignorar = (sin.ignorar || []).map(norm);
  const cats = buscar(t, entradasCategorias(ctx.categorias || [], ctx.rubros || [], sin.categorias)
    .filter((e) => !(e.frase.length === 1 && ignorar.some((p) => igualPalabra(e.frase[0], p)))));
  if (cats.length === 1) r.categoriaId = cats[0]; else r.categoriasPosibles = cats;
  const rubrosDe = [...new Set(cats.map((id) => ctx.categorias.find((c) => c.id === id)?.rubroId))];
  if (rubrosDe.length === 1) r.rubroId = rubrosDe[0];

  const medios = buscar(t, entradasMedios(ctx.medios || [], sin.medios));
  if (medios.length === 1) r.medioId = medios[0]; else r.mediosPosibles = medios;

  const vehs = buscar(t, entradasVehiculos(ctx.vehiculos || []));
  if (vehs.length === 1) r.vehiculoId = vehs[0]; else r.vehiculosPosibles = vehs;

  const f = fechaRelativa(t, ctx.hoy);
  if (f) { r.fecha = f.fecha; r.fechaTexto = f.texto; }
  return r;
}

const miles = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

/** Resumen de lo entendido: "Entendí: $15.000 · Supermercado · hoy". */
export function textoEntendido(r, ctx) {
  const nombre = (lista, id, campo = 'nombre') => (lista || []).find((x) => x.id === id)?.[campo];
  const partes = [
    r.monto !== null ? `${r.moneda === 'USD' ? 'US$ ' : '$'}${miles(r.monto)}` : null,
    r.categoriaId ? nombre(ctx.categorias, r.categoriaId) : (r.rubroId ? nombre(ctx.rubros, r.rubroId) : null),
    r.litros !== null ? `${miles(r.litros)} L` : null,
    r.odometro !== null ? `${miles(r.odometro)} km` : null,
    r.vehiculoId ? nombre(ctx.vehiculos, r.vehiculoId, 'alias') : null,
    r.medioId ? nombre(ctx.medios, r.medioId) : null,
    r.fechaTexto,
  ].filter(Boolean);
  return partes.length ? `Entendí: ${partes.join(' · ')}` : 'No entendí ningún dato del gasto';
}
