import { suite, test, igual, cerca } from './lib.js';
import { costosVehiculo } from '../js/costos.js';

const enPesos = (g) => (g.moneda === 'USD' ? g.monto * 1000 : g.monto);
const tipo = (id) => ({ cC: 'combustible', cM: 'mantenimiento' }[id]);
const gastos = [
  { vehiculoId: 'v1', fecha: '2026-10-01', monto: 40000, categoriaId: 'cC', litros: 35, odometro: 98000 },
  { vehiculoId: 'v1', fecha: '2026-10-20', monto: 50000, categoriaId: 'cC', litros: 41, odometro: 98500 },
  { vehiculoId: 'v1', fecha: '2026-09-05', monto: 30000, categoriaId: 'cC' },                         // carga vieja asociada, sin litros
  { vehiculoId: 'v1', fecha: '2026-11-10', monto: 85000, categoriaId: 'cM', servicioId: 's1' },       // gasto de un servicio
  { vehiculoId: 'v1', fecha: '2026-11-02', monto: 60000, categoriaId: 'cSeguro' },                    // seguro
  { vehiculoId: 'v1', fecha: '2026-11-03', monto: 10, moneda: 'USD', categoriaId: 'cPeaje' },         // en dólares
  { vehiculoId: 'v2', fecha: '2026-10-10', monto: 999999, categoriaId: 'cC', litros: 9, odometro: 5000 },
  { fecha: '2026-10-10', monto: 71000, categoriaId: 'cSuper' },                                        // sin vehículo
];
const servicios = [
  { id: 's1', vehiculoId: 'v1', fecha: '2026-11-10', odometro: 99000 },
  { id: 's2', vehiculoId: 'v2', fecha: '2026-11-10', odometro: 7000 },
];

suite('Costos por vehículo', () => {
  test('separa combustible, servicios y otros, y suma el total', () => {
    const r = costosVehiculo(gastos, servicios, 'v1', enPesos, tipo);
    igual([r.combustible, r.servicios, r.otros, r.total, r.cantidad], [120000, 85000, 70000, 275000, 6]);
  });

  test('los km salen del menor y el mayor odómetro, contando cargas y servicios', () => {
    const r = costosVehiculo(gastos, servicios, 'v1', enPesos, tipo);
    igual(r.km, 1000);          // de 98.000 (primera carga) a 99.000 (servicio)
    cerca(r.porKm, 275);
  });

  test('no mezcla vehículos ni cuenta gastos sin vehículo', () => {
    const r = costosVehiculo(gastos, servicios, 'v2', enPesos, tipo);
    igual([r.total, r.km], [999999, 2000]);
  });

  test('con un solo registro de odómetro no hay costo por km', () => {
    const r = costosVehiculo([gastos[0]], [], 'v1', enPesos, tipo);
    igual([r.total, r.km, r.porKm], [40000, 0, null]);
  });

  test('un vehículo sin gastos da todo en cero', () => {
    igual(costosVehiculo(gastos, servicios, 'v9', enPesos, tipo), { combustible: 0, servicios: 0, otros: 0, total: 0, km: 0, porKm: null, cantidad: 0 });
  });

  test('se puede limitar a un rango de fechas', () => {
    const r = costosVehiculo(gastos, servicios, 'v1', enPesos, tipo, { desde: '2026-11-01', hasta: '2026-11-30' });
    igual([r.combustible, r.servicios, r.otros, r.total], [0, 85000, 70000, 155000]);
  });
});
