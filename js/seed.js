import * as db from './db.js';
import { uid } from './util.js';

const RUBROS = [
  ['Vivienda', '🏠', '#4e79a7', ['Alquiler', 'Expensas', 'Mantenimiento', 'Muebles y hogar']],
  ['Servicios', '💡', '#f28e2b', ['Luz', 'Gas', 'Agua', 'Internet', 'Celular', 'Streaming y suscripciones']],
  ['Alimentación', '🛒', '#59a14f', ['Supermercado', 'Almacén y verdulería', 'Carnicería', 'Delivery', 'Restaurante', 'Café y snacks']],
  ['Transporte', '🚗', '#e15759', ['Combustible', 'Transporte público', 'Taxi / Uber', 'Peajes y estacionamiento', 'Mantenimiento auto', 'Seguro auto']],
  ['Salud', '💊', '#76b7b2', ['Prepaga / obra social', 'Farmacia', 'Consultas', 'Gimnasio y deporte']],
  ['Educación', '📚', '#edc948', ['Cursos', 'Libros', 'Cuota escolar']],
  ['Ocio', '🎉', '#b07aa1', ['Salidas', 'Viajes', 'Hobbies', 'Juegos y apps']],
  ['Ropa y cuidado', '👕', '#ff9da7', ['Ropa', 'Calzado', 'Peluquería y cuidado personal']],
  ['Impuestos y finanzas', '🧾', '#9c755f', ['Impuestos', 'Comisiones bancarias', 'Intereses tarjeta', 'Seguros']],
  ['Regalos', '🎁', '#d37295', ['Regalos', 'Donaciones']],
  ['Mascotas', '🐾', '#8cd17d', ['Alimento', 'Veterinario']],
  ['Otros', '📦', '#bab0ac', ['Varios']],
];

const MEDIOS = [
  ['Efectivo', 'efectivo'],
  ['Débito', 'debito'],
  ['Crédito Visa', 'credito'],
  ['Crédito Mastercard', 'credito'],
  ['Transferencia', 'transferencia'],
  ['Mercado Pago', 'billetera'],
];

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
}
