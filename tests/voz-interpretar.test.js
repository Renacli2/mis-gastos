import { suite, test, igual } from './lib.js';
import { interpretar, textoEntendido, fechaRelativa } from '../js/voz-interpretar.js';
import { palabras } from '../js/voz-numeros.js';
import { SINONIMOS } from '../js/voz-sinonimos.js';

const rubros = [
  { id: 'rA', nombre: 'Alimentación' }, { id: 'rT', nombre: 'Transporte' }, { id: 'rS', nombre: 'Salud' },
  { id: 'rV', nombre: 'Vivienda' }, { id: 'rSe', nombre: 'Servicios' }, { id: 'rO', nombre: 'Otros' },
];
const categorias = [
  { id: 'super', rubroId: 'rA', nombre: 'Supermercado' },
  { id: 'deli', rubroId: 'rA', nombre: 'Delivery' },
  { id: 'cafe', rubroId: 'rA', nombre: 'Café y snacks' },
  { id: 'comb', rubroId: 'rT', nombre: 'Nafta del auto', tipo: 'combustible' },   // renombrada: se reconoce por tipo
  { id: 'taxi', rubroId: 'rT', nombre: 'Taxi / Uber' },
  { id: 'peaje', rubroId: 'rT', nombre: 'Peajes y estacionamiento' },
  { id: 'mant', rubroId: 'rT', nombre: 'Mantenimiento auto', tipo: 'mantenimiento' },
  { id: 'farm', rubroId: 'rS', nombre: 'Farmacia' },
  { id: 'mantCasa', rubroId: 'rV', nombre: 'Mantenimiento' },
  { id: 'luz', rubroId: 'rSe', nombre: 'Luz' },
  { id: 'varios', rubroId: 'rO', nombre: 'Varios' },
];
const medios = [
  { id: 'efe', nombre: 'Efectivo', tipo: 'efectivo' }, { id: 'deb', nombre: 'Débito', tipo: 'debito' },
  { id: 'visa', nombre: 'Crédito Visa', tipo: 'credito' }, { id: 'master', nombre: 'Crédito Mastercard', tipo: 'credito' },
  { id: 'transf', nombre: 'Transferencia', tipo: 'transferencia' }, { id: 'mp', nombre: 'Mercado Pago', tipo: 'billetera' },
];
const vehiculos = [{ id: 'gol', alias: 'El Gol', marca: 'Volkswagen', modelo: 'Gol' }, { id: 'moto', alias: 'La moto', marca: 'Honda' }];
const ctx = { rubros, categorias, medios, vehiculos, hoy: '2026-11-15', sinonimos: SINONIMOS };
const i = (frase, c = ctx) => interpretar(frase, c);

suite('Voz · frases completas', () => {
  test('"gasté quince mil en supermercado"', () => {
    const r = i('gasté quince mil en supermercado');
    igual([r.monto, r.categoriaId, r.rubroId, r.medioId, r.fecha, r.litros], [15000, 'super', 'rA', null, null, null]);
  });
  test('"combustible cuarenta litros cincuenta y dos mil"', () => {
    const r = i('combustible cuarenta litros cincuenta y dos mil');
    igual([r.monto, r.litros, r.categoriaId, r.montosPosibles], [52000, 40, 'comb', []]);
  });
  test('"pagué ocho mil quinientos de farmacia con tarjeta": tarjeta a secas no elige', () => {
    const r = i('pagué ocho mil quinientos de farmacia con tarjeta');
    igual([r.monto, r.categoriaId, r.medioId, r.mediosPosibles], [8500, 'farm', null, ['deb', 'visa', 'master']]);
  });
  test('lo que transcribe Chrome con dígitos', () => {
    const r = i('Gasté $15.000 en el súper con débito ayer');
    igual([r.monto, r.moneda, r.categoriaId, r.medioId, r.fecha], [15000, 'ARS', 'super', 'deb', '2026-11-14']);
  });
  test('carga completa con vehículo, litros y odómetro', () => {
    const r = i('cargué nafta al gol 38 litros 49.500 pesos 120.300 km con visa');
    igual([r.monto, r.litros, r.odometro, r.categoriaId, r.vehiculoId, r.medioId], [49500, 38, 120300, 'comb', 'gol', 'visa']);
  });
  test('"veinte lucas de uber en efectivo anteayer"', () => {
    const r = i('veinte lucas de uber en efectivo anteayer');
    igual([r.monto, r.categoriaId, r.medioId, r.fecha], [20000, 'taxi', 'efe', '2026-11-13']);
  });
  test('"cien dólares de delivery" cambia la moneda', () => {
    const r = i('cien dólares de delivery');
    igual([r.monto, r.moneda, r.categoriaId], [100, 'USD', 'deli']);
  });
  test('una frase que no dice nada del gasto no inventa datos', () => {
    const r = i('hola qué tal');
    igual([r.monto, r.categoriaId, r.medioId, r.vehiculoId, r.fecha, r.litros, r.odometro], [null, null, null, null, null, null, null]);
    igual([r.montosPosibles, r.categoriasPosibles, r.mediosPosibles], [[], [], []]);
    igual(i('').monto, null);
  });
});

suite('Voz · monto', () => {
  test('con dos números sin unidad no elige: quedan como opciones', () => {
    const r = i('compré dos remeras por treinta mil');
    igual([r.monto, r.montosPosibles], [null, [2, 30000]]);
  });
  test('si uno dice "pesos", ese es el monto', () => {
    igual(i('dos cafés cinco mil pesos').monto, 5000);
    igual(i('dos cafés $5.000').monto, 5000);
  });
  test('los litros y los km nunca son el monto', () => {
    const r = i('cuarenta litros');
    igual([r.monto, r.litros], [null, 40]);
    igual(i('ciento veinte mil kilómetros').odometro, 120000);
    igual(i('treinta y cinco coma cinco litros').litros, 35.5);
    igual(i('35,5 litros 48 mil').litros, 35.5);
  });
  test('sin moneda dicha, la moneda queda sin tocar', () => { igual(i('quince mil').moneda, null); });
});

suite('Voz · categorías', () => {
  test('sinónimos del archivo de configuración', () => {
    igual(i('ypf cincuenta mil').categoriaId, 'comb');
    igual(i('una carga de nafta').categoriaId, 'comb');
    igual(i('coto doce mil').categoriaId, 'super');
    igual(i('carrefour').categoriaId, 'super');
    igual(i('el mecánico').categoriaId, 'mant');
  });
  test('el nombre propio de la categoría y sus partes', () => {
    igual(i('taxi').categoriaId, 'taxi');
    igual(i('estacionamiento dos mil').categoriaId, 'peaje');
    igual(i('un peaje').categoriaId, 'peaje');   // plural/singular
    igual(i('la luz').categoriaId, 'luz');
  });
  test('el nombre más largo gana al más corto', () => {
    igual(i('mantenimiento auto').categoriaId, 'mant');
    igual(i('mantenimiento').categoriaId, 'mantCasa');
  });
  test('dos categorías distintas: no elige, deja las opciones', () => {
    const r = i('súper y farmacia veinte mil');
    igual([r.categoriaId, r.categoriasPosibles, r.rubroId], [null, ['super', 'farm'], null]);
  });
  test('nombrar solo el rubro deja el rubro y sus categorías como opciones', () => {
    const r = i('transporte tres mil');
    igual([r.categoriaId, r.rubroId, r.categoriasPosibles], [null, 'rT', ['comb', 'taxi', 'peaje', 'mant']]);
  });
  test('"otro" no cuenta como el rubro Otros', () => {
    const r = i('otro café cinco mil');
    igual([r.categoriaId, r.categoriasPosibles], ['cafe', []]);
  });
  test('una categoría que no existe en la app no se inventa', () => {
    igual(i('netflix ocho mil').categoriaId, null);   // en este contexto no hay categoría de streaming
  });
  test('sin sinónimos sigue reconociendo los nombres', () => {
    igual(interpretar('farmacia', { ...ctx, sinonimos: {} }).categoriaId, 'farm');
    igual(interpretar('ypf', { ...ctx, sinonimos: {} }).categoriaId, null);
  });
});

suite('Voz · medio de pago y vehículo', () => {
  test('medios por nombre, por palabra y por tipo', () => {
    igual(i('con visa').medioId, 'visa');
    igual(i('con mastercard').medioId, 'master');
    igual(i('tarjeta visa').medioId, 'visa');
    igual(i('con débito').medioId, 'deb');
    igual(i('tarjeta de débito').medioId, 'deb');
    igual(i('en efectivo').medioId, 'efe');
    igual(i('por transferencia').medioId, 'transf');
    igual(i('con mercado pago').medioId, 'mp');
  });
  test('"crédito" con dos tarjetas de crédito deja las dos como opciones', () => {
    const r = i('con tarjeta de crédito');
    igual([r.medioId, r.mediosPosibles], [null, ['visa', 'master']]);
  });
  test('"pago" o "pagué" no eligen Mercado Pago', () => {
    igual(i('pago de luz diez mil').medioId, null);
    igual(i('pagué diez mil').medioId, null);
  });
  test('con una sola tarjeta, "tarjeta" alcanza', () => {
    const uno = { ...ctx, medios: [medios[0], medios[2]] };
    igual(i('con tarjeta', uno).medioId, 'visa');
  });
  test('vehículo por alias o marca', () => {
    igual(i('nafta para la moto').vehiculoId, 'moto');
    igual(i('nafta del gol').vehiculoId, 'gol');
    igual(i('nafta de la honda').vehiculoId, 'moto');
    igual(i('nafta').vehiculoId, null);
  });
});

suite('Voz · fechas', () => {
  const f = (frase) => fechaRelativa(palabras(frase), '2026-03-01')?.fecha ?? null;
  test('hoy, ayer y anteayer, cruzando el mes', () => {
    igual(f('lo gasté hoy'), '2026-03-01');
    igual(f('ayer'), '2026-02-28');
    igual(f('anteayer'), '2026-02-27');
    igual(f('antes de ayer'), '2026-02-27');
  });
  test('sin fecha dicha queda null', () => { igual(f('quince mil en farmacia'), null); });
  test('año bisiesto', () => { igual(fechaRelativa(['ayer'], '2028-03-01').fecha, '2028-02-29'); });
});

suite('Voz · resumen de lo entendido', () => {
  test('arma el texto "Entendí: …"', () => {
    igual(textoEntendido(i('gasté quince mil en supermercado hoy'), ctx), 'Entendí: $15.000 · Supermercado · hoy');
    igual(textoEntendido(i('nafta cuarenta litros cincuenta y dos mil al gol con visa'), ctx),
      'Entendí: $52.000 · Nafta del auto · 40 L · El Gol · Crédito Visa');
    igual(textoEntendido(i('cien dólares de delivery'), ctx), 'Entendí: US$ 100 · Delivery');
    igual(textoEntendido(i('transporte'), ctx), 'Entendí: Transporte');
  });
  test('si no entendió nada, lo dice', () => { igual(textoEntendido(i('hola'), ctx), 'No entendí ningún dato del gasto'); });
});
