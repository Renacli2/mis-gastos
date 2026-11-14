import { suite, test, igual } from './lib.js';
import { diasEntre, estadoVencimiento, vencimientosDe, avisos, textoVencimiento } from '../js/vencimientos.js';

const HOY = '2026-11-14';
const s = (extra) => ({ id: 'x', vehiculoId: 'v1', tipo: 'Cambio de aceite', fecha: '2026-05-01', odometro: 90000, proxKm: null, proxFecha: '', ...extra });
const estado = (extra, odo = 95000) => estadoVencimiento(s(extra), odo, HOY);

suite('Días entre fechas', () => {
  test('cuenta días enteros y cruza meses y años', () => {
    igual(diasEntre('2026-11-14', '2026-11-14'), 0);
    igual(diasEntre('2026-11-14', '2026-12-14'), 30);
    igual(diasEntre('2026-12-31', '2027-01-01'), 1);
    igual(diasEntre('2026-11-14', '2026-11-01'), -13);
  });
  test('febrero de un año bisiesto', () => { igual(diasEntre('2028-02-28', '2028-03-01'), 2); });
});

suite('Estado de un vencimiento', () => {
  test('sin km ni fecha no hay vencimiento', () => { igual(estado({}), null); });

  test('por km: al día, próximo y vencido', () => {
    igual(estado({ proxKm: 100000 }), { estado: 'al-dia', kmRestantes: 5000, diasRestantes: null });
    igual(estado({ proxKm: 96000 }).estado, 'proximo');   // faltan justo 1.000 km
    igual(estado({ proxKm: 96001 }).estado, 'al-dia');
    igual(estado({ proxKm: 95000 }).estado, 'vencido');   // llegó al kilometraje
    igual(estado({ proxKm: 94700 }), { estado: 'vencido', kmRestantes: -300, diasRestantes: null });
  });

  test('por fecha: al día, próximo y vencido', () => {
    igual(estado({ proxFecha: '2027-05-01' }).estado, 'al-dia');
    igual(estado({ proxFecha: '2026-12-14' }).estado, 'proximo');  // faltan justo 30 días
    igual(estado({ proxFecha: '2026-12-15' }).estado, 'al-dia');
    igual(estado({ proxFecha: '2026-11-14' }), { estado: 'proximo', kmRestantes: null, diasRestantes: 0 }); // vence hoy
    igual(estado({ proxFecha: '2026-11-13' }).estado, 'vencido');
  });

  test('con km y fecha manda lo que ocurra primero', () => {
    igual(estado({ proxKm: 100000, proxFecha: '2026-11-01' }).estado, 'vencido');  // por fecha
    igual(estado({ proxKm: 94000, proxFecha: '2027-05-01' }).estado, 'vencido');   // por km
    igual(estado({ proxKm: 95500, proxFecha: '2027-05-01' }).estado, 'proximo');
    igual(estado({ proxKm: 100000, proxFecha: '2027-05-01' }).estado, 'al-dia');
  });
});

suite('Vencimientos de un vehículo', () => {
  const v1 = { id: 'v1', alias: 'El Gol', odometro: 100000 };

  test('de cada tipo solo cuenta el servicio más reciente', () => {
    const lista = [
      s({ id: 'viejo', fecha: '2025-11-01', odometro: 80000, proxKm: 90000 }),   // estaría vencido…
      s({ id: 'nuevo', fecha: '2026-10-01', odometro: 99000, proxKm: 109000 }),  // …pero ya se hizo de nuevo
    ];
    const r = vencimientosDe(lista, v1, HOY);
    igual(r.map((x) => [x.servicio.id, x.estado]), [['nuevo', 'al-dia']]);
  });

  test('si el servicio más reciente no tiene vencimiento, el tipo no avisa', () => {
    const lista = [s({ id: 'viejo', fecha: '2025-11-01', proxKm: 90000 }), s({ id: 'nuevo', fecha: '2026-10-01' })];
    igual(vencimientosDe(lista, v1, HOY), []);
  });

  test('ignora servicios de otros vehículos y ordena por urgencia', () => {
    const lista = [
      s({ id: 'a', tipo: 'Frenos', proxKm: 105000 }),                 // al día
      s({ id: 'b', tipo: 'Batería', proxFecha: '2026-12-01' }),        // próximo
      s({ id: 'c', tipo: 'Filtros', proxKm: 99000 }),                  // vencido
      s({ id: 'd', tipo: 'Neumáticos', proxKm: 100400 }),              // próximo, más urgente que la batería
      s({ id: 'e', vehiculoId: 'v2', tipo: 'Correa', proxKm: 1 }),
    ];
    igual(vencimientosDe(lista, v1, HOY).map((x) => x.servicio.id), ['c', 'd', 'b', 'a']);
  });
});

suite('Avisos', () => {
  test('junta vencidos y próximos de los vehículos activos, vencidos primero', () => {
    const vehiculos = [
      { id: 'v1', alias: 'El Gol', odometro: 100000 },
      { id: 'v2', alias: 'La moto', odometro: 12000 },
      { id: 'v3', alias: 'Vendido', odometro: 200000, activo: false },
    ];
    const lista = [
      s({ id: 'a', tipo: 'Frenos', proxKm: 100500 }),                               // v1 próximo
      s({ id: 'b', tipo: 'Batería', proxKm: 150000 }),                               // v1 al día: no avisa
      s({ id: 'c', vehiculoId: 'v2', tipo: 'Cambio de aceite', proxKm: 11000 }),     // v2 vencido
      s({ id: 'd', vehiculoId: 'v3', tipo: 'Cambio de aceite', proxKm: 1 }),         // inactivo: no avisa
    ];
    igual(avisos(lista, vehiculos, HOY).map((x) => [x.servicio.id, x.vehiculo.alias, x.estado]),
      [['c', 'La moto', 'vencido'], ['a', 'El Gol', 'proximo']]);
  });
  test('sin servicios no hay avisos', () => { igual(avisos([], [{ id: 'v1', odometro: 1 }], HOY), []); });
});

suite('Texto de un vencimiento', () => {
  test('por km', () => {
    igual(textoVencimiento({ kmRestantes: 800, diasRestantes: null }), 'Faltan 800 km');
    igual(textoVencimiento({ kmRestantes: -1300, diasRestantes: null }), 'Vencido hace 1.300 km');
    igual(textoVencimiento({ kmRestantes: 0, diasRestantes: null }), 'Vence en este kilometraje');
  });
  test('por fecha, con singular y plural', () => {
    igual(textoVencimiento({ kmRestantes: null, diasRestantes: 20 }), 'Faltan 20 días');
    igual(textoVencimiento({ kmRestantes: null, diasRestantes: 1 }), 'Falta 1 día');
    igual(textoVencimiento({ kmRestantes: null, diasRestantes: 0 }), 'Vence hoy');
    igual(textoVencimiento({ kmRestantes: null, diasRestantes: -1 }), 'Vencido hace 1 día');
  });
  test('con los dos datos, lo vencido va primero', () => {
    igual(textoVencimiento({ kmRestantes: 4000, diasRestantes: -12 }), 'Vencido hace 12 días · faltan 4.000 km');
    igual(textoVencimiento({ kmRestantes: 800, diasRestantes: 45 }), 'Faltan 800 km · faltan 45 días');
  });
});
