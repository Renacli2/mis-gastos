// Utilidades de test mínimas para el navegador (la app no usa Node).
export const suites = [];
let actual;

export function suite(nombre, fn) { actual = { nombre, casos: [] }; suites.push(actual); fn(); }
export function test(nombre, fn) { actual.casos.push({ nombre, fn }); }
export function igual(real, esperado, msg = '') {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg ? msg + ': ' : ''}esperaba ${b} y obtuve ${a}`);
}
export function cerca(real, esperado, tolerancia = 0.005) {
  if (!(Math.abs(real - esperado) <= tolerancia)) throw new Error(`esperaba ≈${esperado} y obtuve ${real}`);
}
