let activos = [];

export function chart(canvas, config) {
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue('--texto2').trim();
  Chart.defaults.borderColor = css.getPropertyValue('--linea').trim();
  Chart.defaults.font.family = 'system-ui, -apple-system, Roboto, sans-serif';
  const c = new Chart(canvas, config);
  activos.push(c);
  return c;
}

export function destruirCharts() {
  activos.forEach((c) => c.destroy());
  activos = [];
}

export const PALETA = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];
