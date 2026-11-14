import { suite, test, igual, cerca } from './lib.js';
import { tramos, promedio, resumenConsumo } from '../js/consumo.js';

const lleno = (fecha, odometro, litros) => ({ fecha, odometro, litros, tanqueLleno: true });
const parcial = (fecha, odometro, litros) => ({ fecha, odometro, litros, tanqueLleno: false });

suite('Tramos de consumo', () => {
  test('dos tanques llenos: 40 L en 500 km son 8 l/100 km y 12,5 km/l', () => {
    const [t] = tramos([lleno('2026-10-01', 1000, 35), lleno('2026-10-15', 1500, 40)]);
    igual([t.km, t.litros, t.parciales], [500, 40, 0]);
    cerca(t.l100, 8); cerca(t.kml, 12.5);
    igual([t.desde, t.hasta], ['2026-10-01', '2026-10-15']);
  });

  test('los litros del primer llenado no cuentan', () => {
    const [t] = tramos([lleno('2026-10-01', 1000, 999), lleno('2026-10-15', 1500, 40)]);
    igual(t.litros, 40);
  });

  test('las cargas parciales intermedias se suman al tramo', () => {
    const [t] = tramos([lleno('2026-10-01', 1000, 35), parcial('2026-10-08', 1200, 20), lleno('2026-10-15', 1500, 30)]);
    igual([t.km, t.litros, t.parciales], [500, 50, 1]);
    cerca(t.l100, 10);
  });

  test('una parcial antes del primer llenado se ignora', () => {
    const ts = tramos([parcial('2026-09-20', 800, 15), lleno('2026-10-01', 1000, 35), lleno('2026-10-15', 1500, 40)]);
    igual(ts.length, 1); igual(ts[0].litros, 40);
  });

  test('una parcial después del último llenado queda pendiente y no arma tramo', () => {
    const ts = tramos([lleno('2026-10-01', 1000, 35), lleno('2026-10-15', 1500, 40), parcial('2026-10-20', 1700, 10)]);
    igual(ts.length, 1);
  });

  test('tres llenados dan dos tramos encadenados', () => {
    const ts = tramos([lleno('2026-10-01', 1000, 35), lleno('2026-10-15', 1500, 40), lleno('2026-11-01', 2100, 54)]);
    igual(ts.map((t) => t.km), [500, 600]);
    cerca(ts[1].l100, 9);
    igual(ts[1].odoDesde, 1500);
  });

  test('ordena las cargas aunque lleguen desordenadas', () => {
    const ts = tramos([lleno('2026-11-01', 2100, 54), lleno('2026-10-01', 1000, 35), lleno('2026-10-15', 1500, 40)]);
    igual(ts.map((t) => t.hasta), ['2026-10-15', '2026-11-01']);
  });

  test('dos llenados con el mismo odómetro no dividen por cero: los litros pasan al tramo siguiente', () => {
    const ts = tramos([lleno('2026-10-01', 1000, 35), lleno('2026-10-01', 1000, 2), lleno('2026-10-15', 1500, 40)]);
    igual(ts.length, 1); igual([ts[0].km, ts[0].litros], [500, 42]);
  });

  test('sin datos suficientes devuelve lista vacía', () => {
    igual(tramos([]), []);
    igual(tramos([lleno('2026-10-01', 1000, 35)]), []);
    igual(tramos([parcial('2026-10-01', 1000, 10), parcial('2026-10-15', 1500, 10)]), []);
    igual(tramos([lleno('2026-10-01', 1000, 35), parcial('2026-10-15', 1500, 10)]), []);
  });

  test('no modifica la lista que recibe', () => {
    const cargas = [lleno('2026-11-01', 2100, 54), lleno('2026-10-01', 1000, 35)];
    tramos(cargas);
    igual(cargas[0].odometro, 2100);
  });
});

suite('Promedios y resumen', () => {
  const cargas = [
    lleno('2026-08-01', 1000, 30),
    lleno('2026-08-15', 1500, 40),   // 500 km, 40 L →  8,0
    lleno('2026-09-01', 2500, 100),  // 1000 km, 100 L → 10,0
    lleno('2026-10-01', 3000, 60),   // 500 km, 60 L → 12,0
  ];

  test('el promedio es ponderado por kilómetros, no un promedio de promedios', () => {
    const p = promedio(tramos(cargas));
    igual([p.km, p.litros, p.tramos], [2000, 200, 3]);
    cerca(p.l100, 10);   // (8 + 10 + 12) / 3 también da 10 acá…
    const q = promedio(tramos(cargas).slice(0, 2));
    cerca(q.l100, 9.333, 0.001); // …pero acá el simple daría 9,0: el tramo de 1000 km pesa el doble
    cerca(q.kml, 10.714, 0.001);
  });

  test('promedio de una lista vacía es null', () => { igual(promedio([]), null); });

  test('resumen: último tramo, últimos N e histórico', () => {
    const r = resumenConsumo(cargas, 2);
    igual(r.estado, 'ok'); igual(r.llenos, 4);
    cerca(r.ultimo.l100, 12);
    igual(r.ultimosN.tramos, 2); cerca(r.ultimosN.l100, (160 / 1500) * 100, 0.001);
    cerca(r.historico.l100, 10);
  });

  test('si hay menos tramos que N, usa los que hay', () => {
    const r = resumenConsumo(cargas, 5);
    igual(r.ultimosN.tramos, 3);
  });

  test('estados sin datos suficientes', () => {
    igual(resumenConsumo([]).estado, 'sin-cargas');
    const uno = resumenConsumo([lleno('2026-10-01', 1000, 35)]);
    igual([uno.estado, uno.llenos, uno.ultimo, uno.historico], ['faltan-llenos', 1, null, null]);
    igual(resumenConsumo([parcial('2026-10-01', 1000, 10), parcial('2026-10-15', 1500, 10)]).estado, 'faltan-llenos');
  });
});
