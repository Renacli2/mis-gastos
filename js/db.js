const DB_NAME = 'mis-gastos';
const VERSION = 1;
export const STORES = {
  gastos: 'id',
  rubros: 'id',
  categorias: 'id',
  medios: 'id',
  presupuestos: 'rubroId',
  recurrentes: 'id',
  config: 'clave',
};

let dbp;
function open() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [n, k] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(n)) {
          const s = db.createObjectStore(n, { keyPath: k });
          if (n === 'gastos') s.createIndex('fecha', 'fecha');
        }
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txP = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

export async function all(store) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).getAll());
}
export async function get(store, key) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).get(key));
}
export async function put(store, obj) { return putMany(store, [obj]); }
export async function putMany(store, arr) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  arr.forEach((o) => s.put(o));
  return txP(t);
}
export async function del(store, key) { return delMany(store, [key]); }
export async function delMany(store, keys) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  keys.forEach((k) => s.delete(k));
  return txP(t);
}
export async function clear(store) {
  const db = await open();
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).clear();
  return txP(t);
}

export async function getConfig(clave, def) {
  const r = await get('config', clave);
  return r ? r.valor : def;
}
export const setConfig = (clave, valor) => put('config', { clave, valor });

export async function exportAll() {
  const data = {};
  for (const s of Object.keys(STORES)) data[s] = await all(s);
  return { app: 'mis-gastos', version: VERSION, exportado: new Date().toISOString(), data };
}

export async function importAll(obj) {
  if (!obj || obj.app !== 'mis-gastos' || !obj.data || !Array.isArray(obj.data.gastos)) {
    throw new Error('El archivo no es un backup válido de Mis Gastos');
  }
  for (const s of Object.keys(STORES)) {
    await clear(s);
    if (Array.isArray(obj.data[s])) await putMany(s, obj.data[s]);
  }
}

export async function borrarTodo() {
  for (const s of Object.keys(STORES)) await clear(s);
}
