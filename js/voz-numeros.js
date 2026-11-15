// Números hablados en español rioplatense → valores. Funciones puras, sin acceso a la app.
// Entiende palabras ("quince mil", "mil quinientos", "dos y medio"), coloquiales ("veinte lucas",
// "un palo y medio") y dígitos que el navegador ya transcribe ("15.000", "15000", "15 mil").

const UNIDADES = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
// Números que no admiten una unidad detrás ("quince", "veintidós").
const CERRADOS = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
const MILES = ['mil', 'luca', 'lucas'];
const MILLONES = ['millon', 'millones', 'palo', 'palos'];
const MITAD = ['medio', 'media'];
const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** Minúsculas, sin tildes ni signos, partido en palabras. "$15.000" y "8,5" quedan como una sola palabra. */
export function palabras(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ$.,\s]/g, ' ')
    .split(/\s+/)
    .map((p) => p.replace(/^[.,]+|[.,]+$/g, ''))
    .flatMap((p) => { const m = p.match(/^(\$?\d[\d.,]*\d|\$?\d)([a-zñ]+)$/); return m ? [m[1], m[2]] : [p]; })
    .filter(Boolean);
}

const esDigitos = (p) => /^\$?\d[\d.,]*$/.test(p);

/** "15.000" → 15000 · "1.500,50" → 1500.5 · "8,5" → 8.5 · "2.5" → 2.5 · "15000" → 15000. Si no se entiende, null. */
export function numeroEnDigitos(p) {
  const s = String(p).replace(/^\$/, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d+,\d+$/.test(s)) return parseFloat(s.replace(',', '.'));
  if (/^\d+(\.\d{1,2})?$/.test(s)) return parseFloat(s);
  return null;
}

/** ¿Desde la palabra j viene un grupo menor a mil seguido de "mil" o "lucas"? */
function otroMilAdelante(t, j) {
  if (esDigitos(t[j])) return MILES.includes(t[j + 1]);
  let k = j;
  while (k < t.length && (tiene(CENTENAS, t[k]) || tiene(DECENAS, t[k]) || tiene(CERRADOS, t[k]) || tiene(UNIDADES, t[k])
    || (t[k] === 'y' && k > j && tiene(UNIDADES, t[k + 1])))) k++;
  return k > j && MILES.includes(t[k]);
}

/** Lee un número que empieza en la palabra i. Devuelve { valor, hasta } o null. */
function leer(t, i) {
  let millones = 0, miles = 0, act = 0;
  let nivel = 4;            // qué puede venir: 4 cualquier cosa, 3 decenas o unidades, 2 nada (salvo "y" + unidad), 0 nada
  let decenaAbierta = false, milUsado = false, millonUsado = false, ultimoMult = null;
  let j = i;
  for (; j < t.length; j++) {
    const w = t[j];
    let mult = null;
    // "dos mil tres mil": si lo que sigue a un "mil" vuelve a terminar en "mil", ahí empieza otro número.
    if (milUsado && nivel === 4 && act === 0 && otroMilAdelante(t, j)) break;
    if (esDigitos(w)) {
      const v = numeroEnDigitos(w);
      if (v === null || nivel !== 4 || ((milUsado || millonUsado) && v >= 1000)) break;
      act = v; nivel = 0;
    } else if (tiene(CENTENAS, w)) {
      if (nivel < 4) break;
      act += CENTENAS[w]; nivel = 3;
    } else if (tiene(DECENAS, w)) {
      if (nivel < 3) break;
      act += DECENAS[w]; nivel = 2; decenaAbierta = true;
    } else if (tiene(CERRADOS, w)) {
      if (nivel < 3) break;
      act += CERRADOS[w]; nivel = 0;
    } else if (tiene(UNIDADES, w)) {
      if (nivel < 3) break;
      act += UNIDADES[w]; nivel = 0;
    } else if (w === 'y' && j > i) {
      const sig = t[j + 1];
      if (decenaAbierta && nivel === 2 && tiene(UNIDADES, sig)) { act += UNIDADES[sig]; nivel = 0; decenaAbierta = false; j++; continue; }
      if (!MITAD.includes(sig)) break;
      // "y medio": la mitad de lo último que se nombró
      if (ultimoMult === 'mil') act += 500;
      else if (ultimoMult === 'millon') { miles += 500000; milUsado = true; }
      else act += 0.5;
      nivel = 0; j++;
    } else if (w === 'coma' && j > i && nivel < 4) {
      // "treinta y cinco coma cinco": un solo número detrás de la coma
      const sig = t[j + 1];
      const d = tiene(UNIDADES, sig) ? UNIDADES[sig] : tiene(CERRADOS, sig) ? CERRADOS[sig] : tiene(DECENAS, sig) ? DECENAS[sig] : (/^\d{1,2}$/.test(sig || '') ? +sig : null);
      if (d === null) break;
      act += d / (d < 10 ? 10 : 100); nivel = 0; j++;
    } else if (MILES.includes(w)) {
      if (milUsado) break;
      miles = (act || 1) * 1000; act = 0; nivel = 4; milUsado = true; mult = 'mil';
    } else if (MILLONES.includes(w)) {
      if (millonUsado) break;
      millones = ((miles + act) || 1) * 1e6; miles = 0; act = 0; nivel = 4; milUsado = false; millonUsado = true; mult = 'millon';
    } else if (MITAD.includes(w) && j === i) {
      act = 0.5; nivel = 0;   // "medio palo", "media luca"
    } else break;
    if (nivel !== 2) decenaAbierta = false;
    ultimoMult = mult;
  }
  if (j === i) return null;
  // "un café", "una carga", "medio kilo": una palabra suelta que casi nunca es un número.
  if (j - i === 1 && (MITAD.includes(t[i]) || ['un', 'uno', 'una'].includes(t[i]))) return null;
  return { valor: millones + miles + act, hasta: j };
}

/** Todos los números de una lista de palabras: [{ valor, desde, hasta }] (hasta no incluido). */
export function cantidades(t) {
  const lista = [];
  for (let i = 0; i < t.length;) {
    const r = leer(t, i);
    if (r) { lista.push({ valor: r.valor, desde: i, hasta: r.hasta }); i = r.hasta; } else i++;
  }
  return lista;
}

/** El número que dice un texto completo, o null si no es exactamente un número. */
export function aNumero(texto) {
  const t = palabras(texto);
  const c = cantidades(t);
  return c.length === 1 && c[0].desde === 0 && c[0].hasta === t.length ? c[0].valor : null;
}
