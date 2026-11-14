let activos = [];

export function chart(canvas, config) {
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue('--tinta2').trim();
  Chart.defaults.borderColor = css.getPropertyValue('--linea').trim();
  Chart.defaults.font.family = css.getPropertyValue('--texto-f').trim();
  const c = new Chart(canvas, config);
  activos.push(c);
  return c;
}

export function destruirCharts() {
  activos.forEach((c) => c.destroy());
  activos = [];
}

export const PALETA = ['#0f4c47', '#f2b705', '#2f6f8f', '#d1495b', '#5a9a3c', '#8b5fbf', '#d98324', '#2ba39b', '#8a6b4f', '#9aa8a3'];
