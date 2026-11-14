import { suite, test, igual } from './lib.js';
import { validarServicio, gastoDeServicio, historial } from '../js/servicios.js';

const ok = { id: 's1', gastoId: 'g1', vehiculoId: 'v1', tipo: 'Cambio de aceite', fecha: '2026-11-10', odometro: 100000, costo: 85000, medioId: 'm1', proxKm: 110000, proxFecha: '2027-11-10', creado: 5 };
const cat = { id: 'cM', rubroId: 'rT' };

suite('Validación de un servicio', () => {
  test('un servicio completo es válido', () => { igual(validarServicio(ok), null); });
  test('sin costo no hace falta medio de pago ni vencimientos', () => {
    igual(validarServicio({ ...ok, costo: 0, medioId: null, proxKm: null, proxFecha: '' }), null);
  });
  test('pide vehículo, tipo, fecha y odómetro', () => {
    igual(validarServicio({ ...ok, vehiculoId: '' }), 'Elegí un vehículo');
    igual(validarServicio({ ...ok, tipo: '' }), 'Elegí el tipo de servicio');
    igual(validarServicio({ ...ok, fecha: '' }), 'Ingresá la fecha del servicio');
    igual(validarServicio({ ...ok, odometro: NaN }), 'Ingresá el odómetro en km');
  });
  test('con costo pide el medio de pago', () => {
    igual(validarServicio({ ...ok, medioId: null }), 'Elegí con qué lo pagaste');
  });
  test('rechaza un costo negativo', () => {
    igual(validarServicio({ ...ok, costo: -1 }), 'El costo no puede ser negativo');
  });
  test('el próximo vencimiento tiene que quedar más adelante', () => {
    igual(validarServicio({ ...ok, proxKm: 100000 }), 'El próximo vencimiento en km tiene que ser mayor al odómetro del servicio');
    igual(validarServicio({ ...ok, proxFecha: '2026-11-10' }), 'La fecha del próximo vencimiento tiene que ser posterior al servicio');
  });
});

suite('Gasto vinculado a un servicio', () => {
  test('con costo genera un gasto en la categoría de mantenimiento', () => {
    const g = gastoDeServicio(ok, cat, 'El Gol');
    igual([g.id, g.monto, g.fecha, g.categoriaId, g.rubroId, g.medioId], ['g1', 85000, '2026-11-10', 'cM', 'rT', 'm1']);
    igual([g.vehiculoId, g.servicioId, g.descripcion, g.moneda], ['v1', 's1', 'Cambio de aceite · El Gol', 'ARS']);
  });
  test('sin costo no genera gasto', () => {
    igual(gastoDeServicio({ ...ok, costo: 0 }, cat, 'El Gol'), null);
  });
  test('al editar conserva el id y los datos propios del gasto, y actualiza monto y fecha', () => {
    const previo = { id: 'gViejo', prescindible: true, creado: 1, monto: 1, fecha: '2026-01-01', servicioId: 's1' };
    const g = gastoDeServicio({ ...ok, costo: 90000, fecha: '2026-11-11' }, cat, 'El Gol', previo);
    igual([g.id, g.prescindible, g.creado, g.monto, g.fecha], ['gViejo', true, 1, 90000, '2026-11-11']);
  });
});

suite('Historial de servicios', () => {
  test('filtra por vehículo y ordena del más nuevo al más viejo', () => {
    const lista = [
      { id: 'a', vehiculoId: 'v1', fecha: '2026-03-01', odometro: 90000 },
      { id: 'b', vehiculoId: 'v2', fecha: '2026-09-01', odometro: 5000 },
      { id: 'c', vehiculoId: 'v1', fecha: '2026-11-10', odometro: 100000 },
      { id: 'd', vehiculoId: 'v1', fecha: '2026-11-10', odometro: 100200 },
    ];
    igual(historial(lista, 'v1').map((s) => s.id), ['d', 'c', 'a']);
  });
});
