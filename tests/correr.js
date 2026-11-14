// Corre todos los tests y muestra el resultado. Abrir: http://localhost:8765/tests/index.html
import { suites } from './lib.js';
import './combustible.test.js';
import './consumo.test.js';
import './servicios.test.js';
import './vencimientos.test.js';

const salida = document.getElementById('salida');
let ok = 0, mal = 0;
for (const s of suites) {
  const h = document.createElement('h2'); h.textContent = s.nombre; salida.appendChild(h);
  for (const c of s.casos) {
    const d = document.createElement('div');
    try { c.fn(); ok++; d.className = 'ok'; d.textContent = `✓ ${c.nombre}`; }
    catch (e) { mal++; d.className = 'mal'; d.textContent = `✗ ${c.nombre}`; const p = document.createElement('pre'); p.textContent = e.message; d.appendChild(p); }
    salida.appendChild(d);
  }
}
const r = document.getElementById('resumen');
r.textContent = mal ? `${mal} fallaron, ${ok} pasaron` : `Pasaron los ${ok} tests`;
r.className = mal ? 'mal' : 'ok';
window.RESULTADO = { ok, mal };
