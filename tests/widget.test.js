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
