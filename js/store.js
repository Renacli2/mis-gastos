import * as db from './db.js';
import { mesActual } from './util.js';

export const S = {
  rubros: [], categorias: [], medios: [], presupuestos: {}, recurrentes: [], gastos: [],
  vehiculos: [], servicios: [], tiposServicio: [], vehFiltro: '',
  serviciosPago: [], vencimientosPago: [], appsPago: [],
  cot: 0, cotFecha: '', mes: mesActual(),
  rerender: () => {},
};

const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre);

export async function cargar() {
  const [r, c, m, p, rec, g] = await Promise.all(
    ['rubros', 'categorias', 'medios', 'presupuestos', 'recurrentes', 'gastos'].map((s) => db.all(s))
  );
  S.rubros = r.sort(porOrden);
  S.categorias = c.sort(porOrden);
  S.medios = m.sort(porOrden);
  S.presupuestos = Object.fromEntries(p.map((x) => [x.rubroId, x.monto]));
  S.recurrentes = rec.sort((a, b) => a.dia - b.dia);
  S.gastos = g.sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));
  S.vehiculos = (await db.all('vehiculos')).sort((a, b) => (b.activo !== false) - (a.activo !== false) || a.alias.localeCompare(b.alias));
  S.servicios = (await db.all('servicios')).sort((a, b) => b.fecha.localeCompare(a.fecha));
  S.tiposServicio = await db.getConfig('tiposServicio', []);
  S.serviciosPago = (await db.all('serviciosPago')).sort((a, b) => (b.activo !== false) - (a.activo !== false) || a.nombre.localeCompare(b.nombre));
  S.vencimientosPago = (await db.all('vencimientosPago')).sort((a, b) => a.fecha.localeCompare(b.fecha));
  S.appsPago = await db.getConfig('appsPago', []);
  S.cot = await db.getConfig('cotizacion', 0);
  S.cotFecha = await db.getConfig('cotizacionFecha', '');
}

const SIN = { nombre: '(sin asignar)', color: '#999999', icono: '❔' };
export const rubro = (id) => S.rubros.find((x) => x.id === id) || SIN;
export const cat = (id) => S.categorias.find((x) => x.id === id) || { nombre: '' };
export const medio = (id) => S.medios.find((x) => x.id === id) || { nombre: '(sin medio)', tipo: '' };
export const catsDe = (rubroId) => S.categorias.filter((c) => c.rubroId === rubroId);

/** Convierte un gasto a pesos usando su cotización guardada o, si no tiene, la actual. */
export const aARS = (g) => (g.moneda === 'USD' ? g.monto * (g.cotizacion || S.cot || 0) : g.monto);
export const delMes = (mes, lista = S.gastos) => lista.filter((g) => g.fecha.startsWith(mes));
export const vehiculo = (id) => S.vehiculos.find((x) => x.id === id) || null;
export const vehiculosActivos = () => S.vehiculos.filter((v) => v.activo !== false);
