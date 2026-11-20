import { suite, test, igual } from './lib.js';
import { destinoWidget } from '../js/widget-datos.js';

suite('Widget · adónde lleva cada toque', () => {
  test('el cuadrado abre el pago de ese vencimiento en el inicio', () => {
    igual(destinoWidget('misgastos://pagar/luz_2026-12-10'), { ruta: '#/', pagar: 'luz_2026-12-10' });
  });
  test('el nombre abre la ficha del servicio', () => {
    igual(destinoWidget('misgastos://servicio/0b50b8fb-2682'), { ruta: '#/pagos/0b50b8fb-2682', pagar: null });
  });
  test('cabecera, alta de servicio e inicio', () => {
    igual(destinoWidget('misgastos://pagos'), { ruta: '#/pagos', pagar: null });
    igual(destinoWidget('misgastos://nuevo-servicio'), { ruta: '#/pagos/nuevo', pagar: null });
    igual(destinoWidget('misgastos://inicio'), { ruta: '#/', pagar: null });
  });
  test('direcciones ajenas o rotas no hacen nada', () => {
    igual(destinoWidget('https://otro.com/pagar/x'), null);
    igual(destinoWidget(''), null);
    igual(destinoWidget('misgastos://algo-raro'), { ruta: '#/', pagar: null });
  });
});

import { resumenBackup } from '../js/traspaso.js';

suite('Traspaso · resumen del backup para confirmar', () => {
  test('cuenta gastos, servicios y vehículos', () => {
    const b = (g, s, v) => ({ data: { gastos: Array(g).fill({}), serviciosPago: Array(s).fill({}), vehiculos: Array(v).fill({}) } });
    igual(resumenBackup(b(120, 9, 1)), '120 gastos, 9 servicios a pagar y 1 vehículo');
    igual(resumenBackup(b(1, 1, 2)), '1 gasto, 1 servicio a pagar y 2 vehículos');
    igual(resumenBackup(b(5, 0, 0)), '5 gastos');
    igual(resumenBackup(b(5, 2, 0)), '5 gastos y 2 servicios a pagar');
  });
});
