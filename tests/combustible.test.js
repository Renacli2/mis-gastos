import { suite, test, igual, cerca } from './lib.js';
import { esCarga, cargasDe, precioPorLitro, validarCarga, odometroVehiculo } from '../js/combustible.js';

const c = (fecha, odometro, litros = 40, extra = {}) => ({ id: fecha + odometro, vehiculoId: 'v1', fecha, odometro, litros, monto: 50000, ...extra });

suite('Cargas de combustible', () => {
  test('un gasto histórico sin litros ni vehículo no es una carga', () => {
    igual(esCarga({ monto: 40000, fecha: '2026-10-05' }), false);
    igual(esCarga({ vehiculoId: 'v1', litros: 40 }), false, 'sin odómetro');
    igual(esCarga(c('2026-10-05', 1000)), true);
  });

  test('cargasDe filtra por vehículo y ordena por odómetro', () => {
    const lista = [c('2026-11-01', 3000), c('2026-10-01', 1000), { ...c('2026-10-15', 2000), vehiculoId: 'v2' }, { monto: 1, fecha: '2026-10-02' }];
    igual(cargasDe(lista, 'v1').map((x) => x.odometro), [1000, 3000]);
  });

  test('precio por litro sale del monto y los litros', () => {
    cerca(precioPorLitro(45000, 35.5), 1267.61);
    igual(precioPorLitro(45000, 0), null);
  });
});

suite('Validación de una carga', () => {
  const otras = [c('2026-10-01', 1000), c('2026-10-20', 1600)];

  test('acepta una carga posterior con más kilómetros', () => {
    igual(validarCarga({ monto: 1, litros: 1, odometro: 2100, fecha: '2026-11-03' }, otras), null);
  });
  test('acepta el mismo odómetro que la carga anterior', () => {
    igual(validarCarga({ monto: 1, litros: 1, odometro: 1600, fecha: '2026-11-03' }, otras), null);
  });
  test('rechaza un odómetro menor al de la carga anterior', () => {
    igual(validarCarga({ monto: 1, litros: 1, odometro: 1500, fecha: '2026-11-03' }, otras),
      'El odómetro no puede ser menor al de la carga anterior (1.600 km)');
  });
  test('una carga cargada con fecha vieja tiene que caer entre sus vecinas', () => {
    igual(validarCarga({ monto: 1, litros: 1, odometro: 1300, fecha: '2026-10-10' }, otras), null);
    igual(validarCarga({ monto: 1, litros: 1, odometro: 1700, fecha: '2026-10-10' }, otras),
      'El odómetro no puede ser mayor al de una carga posterior (1.600 km)');
  });
  test('no compara contra cargas del mismo día', () => {
    igual(validarCarga({ monto: 1, litros: 1, odometro: 1550, fecha: '2026-10-20' }, otras), null);
  });
  test('litros y monto tienen que ser positivos', () => {
    igual(validarCarga({ monto: 0, litros: 10, odometro: 2000, fecha: '2026-11-03' }, otras), 'El monto tiene que ser mayor a cero');
    igual(validarCarga({ monto: 100, litros: 0, odometro: 2000, fecha: '2026-11-03' }, otras), 'Ingresá los litros cargados');
    igual(validarCarga({ monto: 100, litros: -5, odometro: 2000, fecha: '2026-11-03' }, otras), 'Ingresá los litros cargados');
  });
  test('el odómetro es obligatorio', () => {
    igual(validarCarga({ monto: 100, litros: 10, odometro: NaN, fecha: '2026-11-03' }, otras), 'Ingresá el odómetro en km');
  });
  test('la primera carga de un vehículo no tiene con qué compararse', () => {
    igual(validarCarga({ monto: 100, litros: 10, odometro: 5, fecha: '2026-11-03' }, []), null);
  });
});

suite('Odómetro del vehículo', () => {
  test('una carga nueva con más km actualiza el odómetro', () => {
    igual(odometroVehiculo(98500, [c('2026-11-03', 99100)]), 99100);
  });
  test('una carga vieja con menos km no lo baja', () => {
    igual(odometroVehiculo(98500, [c('2026-09-01', 90000)]), 98500);
  });
  test('corregir hacia abajo la última carga baja el odómetro', () => {
    igual(odometroVehiculo(99900, [c('2026-10-20', 98000), c('2026-11-03', 99100)], 99900), 99100);
  });
  test('borrar la última carga vuelve al odómetro de la anterior', () => {
    igual(odometroVehiculo(99100, [c('2026-10-20', 98000)], 99100), 98000);
  });
  test('borrar la única carga deja el odómetro como estaba', () => {
    igual(odometroVehiculo(99100, [], 99100), 99100);
  });
  test('si el odómetro se editó a mano por encima de las cargas, se respeta', () => {
    igual(odometroVehiculo(105000, [c('2026-10-20', 98000)], 99100), 105000);
  });
});
