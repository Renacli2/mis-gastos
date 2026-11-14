import * as db from './db.js';
import { uid } from './util.js';

const RUBROS = [
  ['Vivienda', '🏠', '#2f6f8f', ['Alquiler', 'Expensas', 'Mantenimiento', 'Muebles y hogar']],
  ['Servicios', '💡', '#d98324', ['Luz', 'Gas', 'Agua', 'Internet', 'Celular', 'Streaming y suscripciones']],
  ['Alimentación', '🛒', '#5a9a3c', ['Supermercado', 'Almacén y verdulería', 'Carnicería', 'Delivery', 'Restaurante', 'Café y snacks']],
  ['Transporte', '🚗', '#d1495b', ['Combustible', 'Transporte público', 'Taxi / Uber', 'Peajes y estacionamiento', 'Mantenimiento auto', 'Seguro auto']],
  ['Salud', '💊', '#2ba39b', ['Prepaga / obra social', 'Farmacia', 'Consultas', 'Gimnasio y deporte']],
  ['Educación', '📚', '#6c7bd1', ['Cursos', 'Libros', 'Cuota escolar']],
  ['Ocio', '🎉', '#8b5fbf', ['Salidas', 'Viajes', 'Hobbies', 'Juegos y apps']],
  ['Ropa y cuidado', '👕', '#d96ba0', ['Ropa', 'Calzado', 'Peluquería y cuidado personal']],
  ['Impuestos y finanzas', '🧾', '#8a6b4f', ['Impuestos', 'Comisiones bancarias', 'Intereses tarjeta', 'Seguros']],
  ['Regalos', '🎁', '#b0613f', ['Regalos', 'Donaciones']],
  ['Mascotas', '🐾', '#7fb069', ['Alimento', 'Veterinario']],
  ['Otros', '📦', '#9aa8a3', ['Varios']],
];

const MEDIOS = [
  ['Efectivo', 'efectivo'],
  ['Débito', 'debito'],
  ['Crédito Visa', 'credito'],
  ['Crédito Mastercard', 'credito'],
  ['Transferencia', 'transferencia'],
  ['Mercado Pago', 'billetera'],
];

// Colores de la paleta anterior (por nombre de rubro) → paleta nueva.
// Solo se cambian los rubros que todavía tienen el color original; los que personalizaste no se tocan.
const PALETA_VIEJA = {
  'Vivienda': ['#4e79a7', '#2f6f8f'], 'Servicios': ['#f28e2b', '#d98324'], 'Alimentación': ['#59a14f', '#5a9a3c'],
  'Transporte': ['#e15759', '#d1495b'], 'Salud': ['#76b7b2', '#2ba39b'], 'Educación': ['#edc948', '#6c7bd1'],
  'Ocio': ['#b07aa1', '#8b5fbf'], 'Ropa y cuidado': ['#ff9da7', '#d96ba0'], 'Impuestos y finanzas': ['#9c755f', '#8a6b4f'],
  'Regalos': ['#d37295', '#b0613f'], 'Mascotas': ['#8cd17d', '#7fb069'], 'Otros': ['#bab0ac', '#9aa8a3'],
};

export async function migrarPaleta() {
  if (await db.getConfig('paleta', 1) >= 2) return;
  const cambios = (await db.all('rubros'))
    .filter((r) => PALETA_VIEJA[r.nombre]?.[0] === r.color)
    .map((r) => ({ ...r, color: PALETA_VIEJA[r.nombre][1] }));
  if (cambios.length) await db.putMany('rubros', cambios);
  await db.setConfig('paleta', 2);
}

export async function seedSiHaceFalta() {
  if (await db.getConfig('seeded', false)) return;
  const rubros = [];
  const cats = [];
  RUBROS.forEach(([nombre, icono, color, cs], i) => {
    const id = uid();
    rubros.push({ id, nombre, icono, color, orden: i });
    cs.forEach((c, j) => cats.push({ id: uid(), rubroId: id, nombre: c, orden: j }));
  });
  await db.putMany('rubros', rubros);
  await db.putMany('categorias', cats);
  await db.putMany('medios', MEDIOS.map(([nombre, tipo], i) => ({ id: uid(), nombre, tipo, orden: i })));
  await db.setConfig('seeded', true);
  await db.setConfig('paleta', 2);
}
