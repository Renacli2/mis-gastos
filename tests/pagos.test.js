import { suite, test, igual } from './lib.js';
import {
  fechaVencimiento, siguienteVencimiento, vencimientosFaltantes, generarVencimientos, pendientesDe, reconciliar,
  urgencia, textoUrgencia, proximosVencimientos, paraTarjeta, historialPagos, montoReferencia,
  enlaceSeguro, validarServicioPago, validarPago, gastoDePago, idVencimiento, datosWidget,
} from '../js/pagos.js';

const serv = (extra) => ({ id: 's', nombre: 'Luz', categoriaId: 'cLuz', frecuencia: 'mensual', primerVenc: '2026-11-10', diasAviso: 5, activo: true, ...extra });
const fechas = (s, n) => Array.from({ length: n }, (_, i) => fechaVencimiento(s, i));
const venc = (fecha, estado = 'pendiente', extra) => ({ id: idVencimiento('s', fecha), servicioId: 's', fecha, estado, gastoId: null, ...extra });

suite('Pagos · fechas de vencimiento', () => {
  test('mensual, bimestral, trimestral y anual', () => {
    igual(fechas(serv(), 3), ['2026-11-10', '2026-12-10', '2027-01-10']);
    igual(fechas(serv({ frecuencia: 'bimestral' }), 3), ['2026-11-10', '2027-01-10', '2027-03-10']);
    igual(fechas(serv({ frecuencia: 'trimestral' }), 3), ['2026-11-10', '2027-02-10', '2027-05-10']);
    igual(fechas(serv({ frecuencia: 'anual', primerVenc: '2026-03-15' }), 3), ['2026-03-15', '2027-03-15', '2028-03-15']);
  });
  test('única vez: solo la primera', () => {
    const s = serv({ frecuencia: 'unica' });
    igual([fechaVencimiento(s, 0), fechaVencimiento(s, 1)], ['2026-11-10', null]);
  });
  test('día 31: último día de los meses cortos, y vuelve al 31', () => {
    igual(fechas(serv({ primerVenc: '2026-12-31' }), 5), ['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });
  test('año bisiesto: 29 de febrero', () => {
    igual(fechas(serv({ primerVenc: '2028-01-31' }), 2), ['2028-01-31', '2028-02-29']);
    igual(fechas(serv({ frecuencia: 'anual', primerVenc: '2028-02-29' }), 3), ['2028-02-29', '2029-02-28', '2030-02-28']);
  });
  test('día 30 con febrero de por medio no se corre a 28 para siempre', () => {
    igual(fechas(serv({ primerVenc: '2027-01-30' }), 3), ['2027-01-30', '2027-02-28', '2027-03-30']);
  });
  test('siguiente vencimiento después de una fecha', () => {
    igual(siguienteVencimiento(serv(), '2026-11-18'), '2026-12-10');
    igual(siguienteVencimiento(serv(), '2026-11-09'), '2026-11-10');
    igual(siguienteVencimiento(serv(), '2026-11-10'), '2026-12-10');
    igual(siguienteVencimiento(serv({ frecuencia: 'unica' }), '2026-12-01'), null);
  });
});

suite('Pagos · generar vencimientos', () => {
  const HOY = '2026-11-18';
  test('servicio nuevo: el vencido de este período y el próximo', () => {
    igual(vencimientosFaltantes(serv(), [], HOY), ['2026-11-10', '2026-12-10']);
  });
  test('si el primero es futuro, solo ese', () => {
    igual(vencimientosFaltantes(serv({ primerVenc: '2026-11-25' }), [], HOY), ['2026-11-25']);
  });
  test('no duplica: con los dos ya creados no agrega nada', () => {
    igual(vencimientosFaltantes(serv(), [venc('2026-11-10'), venc('2026-12-10')], HOY), []);
  });
  test('al pagar el próximo por adelantado aparece el siguiente', () => {
    igual(vencimientosFaltantes(serv(), [venc('2026-11-10', 'pagado'), venc('2026-12-10', 'pagado')], HOY), ['2027-01-10']);
  });
  test('ocultar también cuenta como resuelto', () => {
    igual(vencimientosFaltantes(serv(), [venc('2026-11-10'), venc('2026-12-10', 'oculto')], HOY), ['2027-01-10']);
  });
  test('cambio de año: pasa de diciembre a enero', () => {
    igual(vencimientosFaltantes(serv({ primerVenc: '2026-12-20' }), [venc('2026-12-20', 'pagado')], '2026-12-28'), ['2027-01-20']);
  });
  test('si la app no se abrió en meses, crea los vencidos que faltan', () => {
    igual(vencimientosFaltantes(serv(), [venc('2026-11-10', 'pagado')], '2027-02-15'), ['2026-12-10', '2027-01-10', '2027-02-10', '2027-03-10']);
  });
  test('no reaparecen vencimientos anteriores al último existente', () => {
    // El servicio se editó y ahora arranca antes: lo ya resuelto no se vuelve a pedir.
    igual(vencimientosFaltantes(serv({ primerVenc: '2026-09-10' }), [venc('2026-11-10', 'pagado')], HOY), ['2026-12-10']);
  });
  test('al reactivar no reclama los vencimientos de la pausa', () => {
    igual(vencimientosFaltantes(serv({ desde: '2027-03-01' }), [venc('2026-11-10', 'pagado')], '2027-03-05'), ['2027-03-10']);
  });
  test('inactivos, única vez resuelta y datos incompletos no generan', () => {
    igual(vencimientosFaltantes(serv({ activo: false }), [], HOY), []);
    igual(vencimientosFaltantes(serv({ frecuencia: 'unica' }), [venc('2026-11-10', 'pagado')], HOY), []);
    igual(vencimientosFaltantes(serv({ primerVenc: '' }), [], HOY), []);
    igual(vencimientosFaltantes(serv({ frecuencia: 'semanal' }), [], HOY), []);
  });
  test('única vez futura: se crea una sola vez', () => {
    igual(vencimientosFaltantes(serv({ frecuencia: 'unica', primerVenc: '2027-01-05' }), [], HOY), ['2027-01-05']);
  });
  test('ignora vencimientos de otros servicios', () => {
    igual(vencimientosFaltantes(serv(), [{ servicioId: 'otro', fecha: '2027-05-01', estado: 'pagado' }], HOY), ['2026-11-10', '2026-12-10']);
  });
  test('tiene un tope por servicio', () => {
    igual(vencimientosFaltantes(serv({ primerVenc: '2020-01-10' }), [], HOY).length, 24);
  });
  test('arma los registros con id fijo por servicio y fecha', () => {
    igual(generarVencimientos([serv({ primerVenc: '2026-11-25' })], [], HOY),
      [{ id: 's_2026-11-25', servicioId: 's', fecha: '2026-11-25', estado: 'pendiente', gastoId: null, appPago: null }]);
  });
  test('al editar un servicio se rehacen solo sus pendientes', () => {
    const lista = [venc('2026-11-10', 'pagado'), venc('2026-12-10'), venc('2027-01-10', 'oculto'), { id: 'x', servicioId: 'otro', estado: 'pendiente' }];
    igual(pendientesDe('s', lista), ['s_2026-12-10']);
  });
});

suite('Pagos · gasto borrado', () => {
  test('si el gasto de un pago ya no existe, el vencimiento vuelve a pendiente', () => {
    const lista = [venc('2026-10-10', 'pagado', { gastoId: 'g1' }), venc('2026-11-10', 'pagado', { gastoId: 'g2', appPago: 'MP' }), venc('2026-12-10')];
    igual(reconciliar(lista, [{ id: 'g1' }]), [{ ...venc('2026-11-10'), appPago: null }]);
  });
  test('con todos los gastos presentes no cambia nada', () => {
    igual(reconciliar([venc('2026-10-10', 'pagado', { gastoId: 'g1' })], [{ id: 'g1' }]), []);
  });
});

suite('Pagos · urgencia', () => {
  const HOY = '2026-11-18';
  test('vencido, hoy, próximo y más adelante', () => {
    igual(urgencia('2026-11-17', HOY, 5), { estado: 'vencido', dias: -1 });
    igual(urgencia('2026-11-18', HOY, 5), { estado: 'hoy', dias: 0 });
    igual(urgencia('2026-11-23', HOY, 5).estado, 'proximo');       // justo 5 días
    igual(urgencia('2026-11-24', HOY, 5).estado, 'mas-adelante');
    igual(urgencia('2026-11-19', HOY, 0).estado, 'mas-adelante');  // sin aviso previo
  });
  test('cruza fin de año', () => { igual(urgencia('2027-01-02', '2026-12-30', 5), { estado: 'proximo', dias: 3 }); });
  test('textos', () => {
    igual(textoUrgencia(urgencia('2026-11-17', HOY), '2026-11-17'), 'Venció ayer');
    igual(textoUrgencia(urgencia('2026-11-08', HOY), '2026-11-08'), 'Venció hace 10 días');
    igual(textoUrgencia(urgencia('2026-11-18', HOY), '2026-11-18'), 'Vence hoy');
    igual(textoUrgencia(urgencia('2026-11-19', HOY), '2026-11-19'), 'Vence mañana');
    igual(textoUrgencia(urgencia('2026-11-22', HOY), '2026-11-22'), 'Vence en 4 días');
    igual(textoUrgencia(urgencia('2026-12-10', HOY), '2026-12-10'), 'Vence el 10/12');
  });
});

suite('Pagos · lista para la tarjeta', () => {
  const HOY = '2026-11-18';
  const servicios = [
    serv({ id: 'luz', nombre: 'Luz', appPago: 'Homebanking', medioId: 'deb', enlace: 'https://banco.com.ar' }),
    serv({ id: 'net', nombre: 'Internet', diasAviso: 10 }),
    serv({ id: 'pat', nombre: 'Patente' }),
    serv({ id: 'viejo', nombre: 'Gimnasio', activo: false }),
  ];
  const vencs = [
    { id: 'a', servicioId: 'luz', fecha: '2026-12-10', estado: 'pendiente' },
    { id: 'b', servicioId: 'net', fecha: '2026-11-25', estado: 'pendiente' },
    { id: 'c', servicioId: 'pat', fecha: '2026-11-15', estado: 'pendiente' },
    { id: 'd', servicioId: 'luz', fecha: '2026-11-10', estado: 'pagado' },
    { id: 'e', servicioId: 'pat', fecha: '2026-11-18', estado: 'oculto' },
    { id: 'f', servicioId: 'viejo', fecha: '2026-11-01', estado: 'pendiente' },
  ];
  const lista = proximosVencimientos(servicios, vencs, HOY, { medio: (id) => ({ deb: 'Débito' }[id]) });
  test('solo pendientes de servicios activos, del más urgente al menos', () => {
    igual(lista.map((x) => [x.nombre, x.estado]), [['Patente', 'vencido'], ['Internet', 'proximo'], ['Luz', 'mas-adelante']]);
  });
  test('cada ítem trae lo necesario para mostrarlo, sin HTML', () => {
    igual(lista[2], { id: 'a', servicioId: 'luz', nombre: 'Luz', fecha: '2026-12-10', diasAviso: 5, estado: 'mas-adelante', dias: 22, texto: 'Vence el 10/12', appPago: 'Homebanking', medio: 'Débito', enlace: 'https://banco.com.ar/' });
  });
  test('la tarjeta muestra los urgentes, con tope', () => {
    const t = paraTarjeta(lista, 1);
    igual([t.items.map((x) => x.id), t.resto, t.siguiente, t.total], [['c'], 1, null, 3]);
  });
  test('sin urgentes muestra el siguiente; sin nada, vacía', () => {
    const t = paraTarjeta(lista.filter((x) => x.estado === 'mas-adelante'));
    igual([t.items, t.siguiente.id], [[], 'a']);
    igual(paraTarjeta([]), { items: [], resto: 0, siguiente: null, total: 0 });
  });
});

suite('Pagos · datos para el widget', () => {
  const HOY = '2026-11-18';
  const servicios = [
    serv({ id: 'luz', nombre: 'Luz', appPago: 'Homebanking', medioId: 'deb', enlace: 'https://banco.com.ar', montoRef: 33000 }),
    serv({ id: 'net', nombre: 'Internet', diasAviso: 10 }),
    serv({ id: 'pat', nombre: 'Patente' }),
    serv({ id: 'viejo', nombre: 'Gimnasio', activo: false }),
  ];
  const vencs = [
    { id: 'a', servicioId: 'luz', fecha: '2026-12-10', estado: 'pendiente' },
    { id: 'b', servicioId: 'net', fecha: '2026-11-25', estado: 'pendiente' },
    { id: 'c', servicioId: 'pat', fecha: '2026-11-15', estado: 'pendiente' },
    { id: 'd', servicioId: 'luz', fecha: '2026-11-10', estado: 'pagado', gastoId: 'g1' },
    { id: 'e', servicioId: 'pat', fecha: '2026-11-18', estado: 'oculto' },
    { id: 'f', servicioId: 'viejo', fecha: '2026-11-01', estado: 'pendiente' },
  ];
  const lista = proximosVencimientos(servicios, vencs, HOY, { medio: (id) => ({ deb: 'Débito' }[id]) });
  const d = datosWidget(lista, HOY, true);
  test('mismo orden que la tarjeta, sin pagados, ocultos ni servicios dados de baja', () => {
    igual(d.items.map((x) => x.id), ['c', 'b', 'a']);
    igual([d.v, d.generado, d.hayServicios, d.total], [1, HOY, true, 3]);
  });
  test('cada ítem lleva solo lo que muestra el widget: sin montos ni estado precalculado', () => {
    igual(d.items[2], { id: 'a', servicioId: 'luz', nombre: 'Luz', fecha: '2026-12-10', diasAviso: 5, appPago: 'Homebanking', medio: 'Débito', enlace: 'https://banco.com.ar/' });
    igual(/monto|gasto|estado|texto/.test(JSON.stringify(d)), false);
  });
  test('respeta el tope pero informa el total', () => {
    const t = datosWidget(lista, HOY, true, 2);
    igual([t.items.length, t.total], [2, 3]);
  });
  test('sin servicios o sin pendientes, lista vacía', () => {
    igual(datosWidget([], HOY, false), { v: 1, generado: HOY, hayServicios: false, total: 0, items: [] });
  });
});

suite('Pagos · historial y referencia', () => {
  const vencs = [
    venc('2026-09-10', 'pagado', { gastoId: 'g9' }),
    venc('2026-10-10', 'pagado', { gastoId: 'g10', appPago: 'Mercado Pago' }),
    venc('2026-11-10', 'pagado', { gastoId: 'borrado' }),
    venc('2026-12-10'),
  ];
  const gastos = [{ id: 'g9', fecha: '2026-09-08', monto: 30000 }, { id: 'g10', fecha: '2026-10-12', monto: 34500, moneda: 'ARS' }];
  test('pagos con monto y fecha del gasto, del más nuevo al más viejo', () => {
    igual(historialPagos('s', vencs, gastos).map((h) => [h.vencimiento, h.fechaPago, h.monto, h.appPago]),
      [['2026-10-10', '2026-10-12', 34500, 'Mercado Pago'], ['2026-09-10', '2026-09-08', 30000, '']]);
  });
  test('la referencia es el último pago; sin pagos, la manual', () => {
    igual(montoReferencia(serv(), historialPagos('s', vencs, gastos)), { monto: 34500, moneda: 'ARS', origen: 'ultimo-pago' });
    igual(montoReferencia(serv({ montoRef: 28000 }), []), { monto: 28000, moneda: 'ARS', origen: 'manual' });
    igual(montoReferencia(serv(), []), null);
  });
});

suite('Pagos · validaciones y enlace', () => {
  test('enlace: solo web, sin usuario ni clave', () => {
    igual(enlaceSeguro('https://www.mercadopago.com.ar'), 'https://www.mercadopago.com.ar/');
    igual(enlaceSeguro('homebanking.bna.com.ar'), 'https://homebanking.bna.com.ar/');
    igual(enlaceSeguro('javascript:alert(1)'), '');
    igual(enlaceSeguro('https://usuario:clave@banco.com'), '');
    igual(enlaceSeguro('intent://x'), '');
    igual(enlaceSeguro(''), '');
  });
  test('servicio válido y sus errores', () => {
    igual(validarServicioPago(serv()), null);
    igual(validarServicioPago(serv({ nombre: ' ' })), 'Ingresá el nombre del servicio');
    igual(validarServicioPago(serv({ categoriaId: null })), 'Elegí la categoría del gasto');
    igual(validarServicioPago(serv({ frecuencia: 'x' })), 'Elegí cada cuánto vence');
    igual(validarServicioPago(serv({ primerVenc: '2026-13-01' })), 'Ingresá la fecha del próximo vencimiento');
    igual(validarServicioPago(serv({ diasAviso: 90 })), 'Los días de aviso van de 0 a 60');
    igual(validarServicioPago(serv({ enlace: 'javascript:x' })), 'El enlace tiene que ser una dirección web (https://…) sin usuario ni clave');
  });
  test('pago: monto obligatorio, fecha, medio y cotización en dólares', () => {
    const ok = { monto: 34500, fechaPago: '2026-11-18', medioId: 'deb', moneda: 'ARS' };
    igual(validarPago(ok), null);
    igual(validarPago({ ...ok, monto: 0 }), 'Ingresá el monto que pagaste');
    igual(validarPago({ ...ok, fechaPago: '' }), 'Ingresá la fecha de pago');
    igual(validarPago({ ...ok, medioId: null }), 'Elegí con qué lo pagaste');
    igual(validarPago({ ...ok, moneda: 'USD' }), 'Ingresá la cotización del dólar');
  });
});

suite('Pagos · gasto generado', () => {
  const s = serv();
  const v = venc('2026-11-10');
  const pago = { id: 'g1', creado: 7, monto: 34500, fechaPago: '2026-11-18', medioId: 'deb', moneda: 'ARS' };
  test('usa la categoría del servicio y queda vinculado al vencimiento', () => {
    igual(gastoDePago(s, v, pago, { id: 'cLuz', rubroId: 'rServ' }), {
      id: 'g1', fecha: '2026-11-18', monto: 34500, moneda: 'ARS', cotizacion: null,
      rubroId: 'rServ', categoriaId: 'cLuz', medioId: 'deb', descripcion: 'Luz · vto. 10/11', prescindible: false,
      servicioPagoId: 's', vencimientoPagoId: 's_2026-11-10', creado: 7,
    });
  });
  test('al corregir conserva el id y lo que marcaste en el gasto', () => {
    const g = gastoDePago(s, v, { ...pago, id: 'nuevo', monto: 36000 }, { id: 'cLuz', rubroId: 'rServ' }, { id: 'g1', creado: 1, prescindible: true });
    igual([g.id, g.creado, g.prescindible, g.monto], ['g1', 1, true, 36000]);
  });
});
