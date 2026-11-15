import { suite, test, igual } from './lib.js';
import { palabras, numeroEnDigitos, cantidades, aNumero } from '../js/voz-numeros.js';

const todos = (pares) => pares.forEach(([frase, n]) => igual(aNumero(frase), n, frase));
const valores = (frase) => cantidades(palabras(frase)).map((c) => c.valor);

suite('Voz · números en palabras', () => {
  test('unidades, decenas y centenas', () => todos([
    ['siete', 7], ['quince', 15], ['dieciséis', 16], ['veintidós', 22], ['treinta', 30], ['cuarenta y cinco', 45],
    ['noventa y nueve', 99], ['cien', 100], ['ciento veinte', 120], ['ciento cinco', 105], ['quinientos', 500],
    ['setecientos ochenta y tres', 783],
  ]));
  test('miles', () => todos([
    ['mil', 1000], ['mil quinientos', 1500], ['dos mil', 2000], ['quince mil', 15000], ['ocho mil quinientos', 8500],
    ['cincuenta y dos mil', 52000], ['veintiún mil', 21000], ['treinta y un mil', 31000],
    ['ciento veinte mil', 120000], ['ciento veinte mil quinientos', 120500],
    ['trescientos cuarenta y cinco mil seiscientos setenta y ocho', 345678],
  ]));
  test('millones', () => todos([
    ['un millón', 1000000], ['dos millones', 2000000], ['un millón doscientos mil', 1200000],
    ['dos millones quinientos mil', 2500000], ['un millón y medio', 1500000],
  ]));
  test('y medio', () => todos([
    ['dos y medio', 2.5], ['ocho coma cinco', 8.5], ['doce coma veinticinco', 12.25], ['cuarenta y media', 40.5], ['mil y medio', 1500], ['tres mil y medio', 3500],
  ]));
});

suite('Voz · montos coloquiales', () => {
  test('lucas', () => todos([
    ['una luca', 1000], ['veinte lucas', 20000], ['cuarenta y cinco lucas', 45000], ['dos lucas y media', 2500],
    ['media luca', 500], ['ciento cincuenta lucas', 150000], ['dos y media lucas', 2500],
  ]));
  test('palos', () => todos([
    ['un palo', 1000000], ['dos palos', 2000000], ['un palo y medio', 1500000], ['medio palo', 500000],
    ['un palo doscientas lucas', 1200000],
  ]));
});

suite('Voz · números en dígitos', () => {
  test('formatos que transcribe el navegador', () => {
    igual(numeroEnDigitos('15.000'), 15000);
    igual(numeroEnDigitos('15000'), 15000);
    igual(numeroEnDigitos('$15.000'), 15000);
    igual(numeroEnDigitos('1.500,50'), 1500.5);
    igual(numeroEnDigitos('8,5'), 8.5);
    igual(numeroEnDigitos('2.5'), 2.5);
    igual(numeroEnDigitos('1.250.000'), 1250000);
    igual(numeroEnDigitos('1.2.3'), null);
  });
  test('dígitos combinados con palabras', () => todos([
    ['15 mil', 15000], ['20 lucas', 20000], ['2 millones', 2000000], ['15 mil 500', 15500],
    ['15 mil quinientos', 15500], ['2,5 lucas', 2500], ['$8.500', 8500],
  ]));
  test('un número pegado a su unidad se separa', () => {
    igual(palabras('40l'), ['40', 'l']);
    igual(palabras('120.000km'), ['120.000', 'km']);
  });
});

suite('Voz · números dentro de una frase', () => {
  test('encuentra cada número por separado', () => {
    igual(valores('combustible cuarenta litros cincuenta y dos mil'), [40, 52000]);
    igual(valores('gasté quince mil en supermercado'), [15000]);
    igual(valores('cuarenta cincuenta'), [40, 50]);
    igual(valores('quinientos seiscientos'), [500, 600]);
    igual(valores('Pagué $8.500, de farmacia.'), [8500]);
  });
  test('la "y" que no une un número lo corta', () => {
    igual(valores('quince mil y farmacia'), [15000]);
    igual(valores('veinte y treinta'), [20, 30]);
  });
  test('"un", "una" y "medio" sueltos no son números', () => {
    igual(valores('compré un café'), []);
    igual(valores('una carga de nafta'), []);
    igual(valores('medio kilo de pan'), []);
    igual(valores('pagué un café cinco mil'), [5000]);
  });
  test('una frase sin números da lista vacía', () => {
    igual(valores('supermercado con tarjeta'), []);
    igual(valores(''), []);
    igual(aNumero('hola'), null);
    igual(aNumero('quince mil pesos'), null);
  });
  test('ignora mayúsculas y tildes', () => todos([['Veintitrés MIL', 23000], ['Dieciséis', 16], ['UN MILLÓN', 1000000]]));
});
