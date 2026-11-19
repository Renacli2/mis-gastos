# Mis Gastos

App web instalable (PWA) para registrar y analizar gastos personales desde Android. Funciona sin conexión y guarda los datos solo en el celular (IndexedDB).

## Funciones
- Rubros y categorías editables (vienen precargados) y medios de pago editables.
- Gastos en ARS y USD (cada gasto en USD guarda la cotización del día).
- Compras en cuotas con tarjeta de crédito (se reparten en los meses siguientes).
- Gastos fijos que se repiten todos los meses (alquiler, suscripciones…).
- Presupuesto mensual por rubro con barras de avance.
- Análisis: comparación con el mes anterior y con el promedio, rubros en alza, gráficos por rubro, categoría y medio de pago, evolución de 12 meses, gastos prescindibles, cuotas pendientes.
- Backup JSON (descargar y restaurar) y exportación CSV para Excel.
- Vehículos:
  - Cargas de combustible con litros, odómetro y tanque lleno. Son el mismo gasto, no un registro aparte.
  - Consumo en l/100 km y km/l, calculado entre tanques llenos.
  - Servicios y mantenimiento, con avisos de vencimiento por km o por fecha. Un servicio con costo genera su gasto.
  - Costo total y costo por km de cada vehículo, y filtro por vehículo en Gastos y Análisis.
- Carga por voz (opcional): en "Cargar gasto", el botón de micrófono transcribe una frase como "gasté quince mil en supermercado" y completa el formulario. Nunca guarda solo.

- Recordatorios de pago de servicios (luz, internet, patente): vencimientos mensuales, bimestrales, trimestrales, anuales o de única vez, en una tarjeta del inicio. Al tildar uno se ingresa el monto y se carga el gasto.

## Recordatorios de pago
- **Servicio a pagar** (tabla `serviciosPago`): nombre, categoría, frecuencia, fecha del próximo vencimiento, dónde se paga, medio de pago, enlace, días de aviso y monto de referencia opcional. No tiene monto fijo. Nunca guarda usuarios, claves ni números de tarjeta. La baja es lógica: el historial se conserva.
- **Vencimiento** (tabla `vencimientosPago`): uno por servicio y fecha (`<servicioId>_<fecha>`), con estado pendiente, pagado u oculto. El monto y la fecha de pago se leen del gasto vinculado, así que editar ese gasto en Gastos también actualiza el historial; borrarlo devuelve el vencimiento a pendiente.
- Los vencimientos se crean solos al abrir la app y al volver a ella: los que vencieron y falten, y siempre uno por delante. Un día 31 cae el último día de los meses más cortos. Nunca se duplican.
- Las reglas están en `js/pagos.js` (funciones puras, con tests). `js/pagos-datos.js` lee y guarda en la base. `js/tarjeta-vencimientos.js` es la tarjeta, separada de los datos. `js/dialogo-pago.js` es el diálogo de pago. `js/views/pagos.js` tiene la lista, la ficha con el historial, el formulario y los ocultos.

### Para más adelante: widget y avisos
- `vencimientosActuales()` en `js/pagos-datos.js` devuelve una lista simple (servicio, fecha, estado, texto, enlace). Es lo que leerían un widget o un aviso, sin rehacer la lógica.
- **Widget del sistema:** una PWA no puede crear widgets en la pantalla de Android. Hace falta empaquetarla como app Android (Bubblewrap / TWA) y escribir el widget nativo. Ese widget no puede leer el IndexedDB del navegador, así que habría que pasarle los datos de otra forma. Alternativa liviana: accesos directos del manifiesto al mantener apretado el ícono.
- **Avisos:** con la app abierta se pueden mostrar notificaciones. Para avisar con la app cerrada hace falta un servidor de notificaciones push.

## Carga por voz
- Usa la Web Speech API del navegador, en es-AR (o es-ES si no está). No hay backend ni claves. La transcripción la hace el navegador: en Chrome el audio va a los servidores de Google y necesita internet.
- Solo escucha al tocar el micrófono. Se detiene al dejar de hablar, al tocar de nuevo, con Cancelar, a los 8 segundos de silencio o al salir de la pantalla.
- Si el navegador no tiene reconocimiento de voz, el botón no aparece. Si el micrófono está bloqueado, queda deshabilitado con una explicación. La carga manual no depende de nada de esto.
- La interpretación es por reglas, sin IA: `js/voz-numeros.js` (números hablados, "lucas", "palos") y `js/voz-interpretar.js` (monto, categoría, medio, vehículo, litros, odómetro, fecha). Lo ambiguo se ofrece como opciones; lo que no se entiende queda vacío.
- **Para agregar palabras** ("Coto" → Supermercado), editar `js/voz-sinonimos.js`. Es solo una lista; las instrucciones están al principio del archivo.

## Cómo está organizado el código
- `js/views/`: una pantalla por archivo.
- `js/combustible.js`, `js/consumo.js`, `js/servicios.js`, `js/vencimientos.js`, `js/costos.js`: reglas y cálculos del módulo de vehículos, como funciones puras (no leen la base ni la pantalla).
- `js/voz-numeros.js`, `js/voz-interpretar.js`: interpretación de lo dictado, también como funciones puras. `js/voz-sinonimos.js`: su configuración. `js/voz.js` y `js/voz-ui.js`: captura de voz y botón de micrófono.
- `js/pagos.js`: reglas de los recordatorios de pago, como funciones puras.
- `js/db.js`: base de datos local. `js/seed.js`: datos iniciales y migraciones.
- `tests/`: tests de las funciones puras.

## Datos y migraciones
La base es IndexedDB y su esquema está en la versión 3 (la 3 sumó los recordatorios de pago). No hay nada que aplicar a mano: al abrir una versión nueva de la app, `js/db.js` crea las tablas que falten y `migrarDatos()` en `js/seed.js` completa los datos. Los gastos existentes no se modifican.

Para un cambio de esquema futuro: subir `VERSION` en `js/db.js`, agregar la tabla en `STORES` y sumar un paso en `migrarDatos()`.

## Probar en la PC
```
powershell -ExecutionPolicy Bypass -File servidor.ps1
```
y abrir http://localhost:8765

Los tests se corren en el navegador, con el servidor andando: http://localhost:8765/tests/index.html

## Instalar en Android
1. Publicar la carpeta en un hosting HTTPS (por ejemplo GitHub Pages).
2. Abrir la URL en Chrome para Android → menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").

## Publicar una actualización
1. Subí el número en `version.js` (por ejemplo `1.1.0` → `1.2.0`) y escribí en `APP_NOTAS` qué cambió.
2. Hacé commit y push a `main`; GitHub Pages la publica en 1–2 minutos.

En el celular, la app busca versiones nuevas sola al abrirse y al volver a ella. Si encuentra una, muestra un cartel con el botón **Actualizar**. También se puede buscar a mano en **Ajustes → Actualizaciones**. Actualizar no borra los gastos.

Los datos **no** viajan al servidor: hacé backups periódicos desde Ajustes → Backup.

## App Android (Capacitor)
La misma app web se empaqueta como app Android con [Capacitor](https://capacitorjs.com) 8, para poder sumarle un widget y avisos nativos. La versión web y la PWA siguen funcionando igual.

**Cómo está armado**
- `capacitor.config.json` y `package.json`: configuración de Capacitor y los comandos.
- `scripts/copiar-web.mjs` copia la app web a `www/` (no va al repo). No se copian `sw.js` ni los tests: dentro del APK los archivos ya están en el teléfono.
- `android/`: el proyecto Android que genera Capacitor (íconos y pantalla de carga incluidos).
- `js/plataforma.js` dice si la app corre dentro de Android (`esApp`). Dentro de la app:
  - no se registra el service worker ni se buscan actualizaciones en GitHub Pages;
  - el backup y el CSV se entregan con el menú **Compartir** de Android (Drive, Archivos, mail…), porque el visor web no descarga archivos.
- La carga por voz no está disponible dentro de la app: el visor web de Android no trae reconocimiento de voz, y la app esconde el botón del micrófono sola.

**Herramientas**: Node 22 o más nuevo, JDK 21 y el SDK de Android con la plataforma 36. Android Studio 2025.2.1 o más nuevo solo hace falta para abrir el proyecto en el editor.

**Compilar el APK de prueba**
```
npm install
npm run apk
```
(con `JAVA_HOME` apuntando al JDK 21 y `ANDROID_HOME` al SDK). El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

**Instalarlo en el celular**: con la depuración USB activada, `adb install -r app-debug.apk`; o copiar el APK al teléfono y abrirlo (pide permitir "instalar apps desconocidas").

**Datos**: la app Android tiene su propia base, separada de la de Chrome. Para pasar los gastos: en la PWA, Ajustes → Backup → Descargar backup; en la app, Ajustes → Backup → Restaurar backup. Desinstalar la app borra sus datos: antes, guardá un backup.

**Datos para el widget**: el widget es nativo y no puede leer la base de la app web (IndexedDB). Por eso:
- Cada vez que cambian los datos (todo termina en `cargar()`, que avisa con `alCargar`), `js/widget-datos.js` arma con `datosWidget()` de `js/pagos.js` una copia chica de los próximos vencimientos y la guarda con el plugin nativo `WidgetDatos` (`android/app/src/main/java/app/misgastos/WidgetDatosPlugin.java`) en SharedPreferences privadas (`mis_gastos_widget`). Solo reescribe si algo cambió.
- La copia (versión 1) tiene hasta 12 pendientes, del más urgente al menos: id, servicio, nombre, fecha, días de aviso, app, medio y enlace. **No lleva montos, gastos, claves ni datos de tarjetas.** No guarda el estado de urgencia: el widget lo calcula con la fecha, así acierta aunque cambie el día sin abrir la app. `generado` permite avisar si la copia es vieja.
- Lo que se pida desde el widget (por ejemplo, ocultar un vencimiento) queda en una cola en el mismo lugar. La app la aplica y la vacía al abrirse o al volver a ella; las acciones sobre vencimientos que ya no existen se ignoran.
- En el navegador y en la PWA nada de esto hace nada.

**Widget "Próximos vencimientos"** (`VencimientosWidget.java`, diseño en `res/layout/widget_vencimientos.xml`):
- 4x2 celdas, redimensionable; muestra hasta 3 vencimientos urgentes (vencidos, de hoy y dentro de los días de aviso), con colores de urgencia, la fecha, la app y el medio de pago. Si hay más, "y N más". Modo claro y oscuro.
- Se agrega desde **Ajustes → Servicios a pagar → Agregar el widget a la pantalla de inicio**, o a mano (mantener apretada la pantalla de inicio → Widgets → Mis Gastos).
- Tocar el **cuadrado** abre la app en el diálogo de pago de ese vencimiento: dentro de un widget no se puede escribir, y el monto cambia cada mes. Tocar el **nombre** abre la ficha del servicio; el título, la lista de servicios. Lo hace con direcciones `misgastos://…` que el plugin `WidgetDatos` guarda y la app lee con `tomarApertura()` (`aperturaWidget()` en `js/widget-datos.js`).
- La **✕** de cada fila oculta ese vencimiento sin abrir la app: el widget deja de mostrarlo enseguida y lo anota en la cola de acciones; la app lo oculta en la base al abrirse, y desde ahí se puede restaurar (ficha del servicio o "Vencimientos ocultos").
- Se redibuja: cuando la app cambia los datos, poco después de medianoche (alarma inexacta, sin despertar al teléfono), cada 30 minutos (el mínimo de Android) y al cambiar la hora o la zona horaria. Calcula la urgencia con la fecha del día, igual que `urgencia()` de `js/pagos.js`.
- Sin datos todavía, pide abrir la app; sin servicios, invita a cargarlos; si la copia tiene más de 7 días, avisa "Abrí la app para actualizar".
- El botón "atrás" de Android usa `@capacitor/app`: cierra el diálogo abierto, vuelve a la pantalla anterior o, en el inicio, pasa la app a segundo plano.

**Actualizar**: cada versión nueva es un APK nuevo, que se instala encima del anterior sin borrar los datos. Tiene que estar firmado con la misma clave que el anterior.
