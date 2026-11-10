export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const fUSD = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
export const money = (n, mon = 'ARS') => (mon === 'USD' ? fUSD : fARS).format(n || 0);
export const pct = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}%`;
export const round2 = (n) => Math.round(n * 100) / 100;
export const sum = (arr) => arr.reduce((a, b) => a + (b || 0), 0);

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const hoy = () => ymd(new Date());
export const mesActual = () => hoy().slice(0, 7);
export const mesDe = (f) => f.slice(0, 7);

export function sumarMeses(mes, n) {
  let [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  y = Math.floor(t / 12);
  m = (t % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function fechaEnMes(mes, dia) {
  const [y, m] = mes.split('-').map(Number);
  const ult = new Date(y, m, 0).getDate();
  return `${mes}-${String(Math.min(dia, ult)).padStart(2, '0')}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (mes) => {
  const [y, m] = mes.split('-');
  return `${MESES[m - 1]} ${y}`;
};
export const mesCorto = (mes) => {
  const [y, m] = mes.split('-');
  return `${MESES[m - 1].slice(0, 3)} ${y.slice(2)}`;
};
export const diasDelMes = (mes) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export function fechaLarga(f) {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

let toastTimer;
export function toast(msg) {
  let t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2600);
}

export function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
