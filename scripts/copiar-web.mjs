// Copia la app web a www/, que es lo que Capacitor mete dentro del APK.
// La app sigue sin paso de compilación: esto solo elige qué archivos van.
// No se copian sw.js (en Android los archivos ya vienen en el APK), los tests ni los scripts locales.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'www');
const ARCHIVOS = ['index.html', 'manifest.webmanifest', 'version.js'];
const CARPETAS = ['css', 'fonts', 'icons', 'js', 'vendor'];

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino);
for (const a of ARCHIVOS) cpSync(join(raiz, a), join(destino, a));
for (const c of CARPETAS) cpSync(join(raiz, c), join(destino, c), { recursive: true });
console.log(`App web copiada a www/ (${ARCHIVOS.length} archivos y ${CARPETAS.length} carpetas).`);
