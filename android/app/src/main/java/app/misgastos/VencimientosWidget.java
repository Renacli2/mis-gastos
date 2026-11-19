package app.misgastos;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Widget "Próximos vencimientos" de la pantalla de inicio.
 *
 * Solo lee: muestra la copia que deja la app web con el plugin WidgetDatos (ver datosWidget() en js/pagos.js).
 * Calcula la urgencia con la fecha del día, igual que urgencia() y textoUrgencia() de js/pagos.js,
 * así acierta aunque la app no se abra. Tocar un ítem abre la app:
 *   - el cuadrado, en el diálogo de pago de ese vencimiento (misgastos://pagar/ID), porque el monto hay que escribirlo;
 *   - el nombre, en la ficha del servicio (misgastos://servicio/ID).
 */
public class VencimientosWidget extends AppWidgetProvider {

    static final String ACCION_NUEVO_DIA = "app.misgastos.widget.NUEVO_DIA";
    static final String ACCION_OCULTAR = "app.misgastos.widget.OCULTAR";
    private static final int FILAS = 3;
    private static final int DIAS_COPIA_VIEJA = 7;

    private static final int[] FILA = { R.id.w_fila1, R.id.w_fila2, R.id.w_fila3 };
    private static final int[] TILDE = { R.id.w_tilde1, R.id.w_tilde2, R.id.w_tilde3 };
    private static final int[] TXT = { R.id.w_txt1, R.id.w_txt2, R.id.w_txt3 };
    private static final int[] NOMBRE = { R.id.w_nombre1, R.id.w_nombre2, R.id.w_nombre3 };
    private static final int[] ESTADO = { R.id.w_estado1, R.id.w_estado2, R.id.w_estado3 };
    private static final int[] SUB = { R.id.w_sub1, R.id.w_sub2, R.id.w_sub3 };
    private static final int[] OCULTAR = { R.id.w_ocultar1, R.id.w_ocultar2, R.id.w_ocultar3 };

    // ---------- Ciclo de vida ----------

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) dibujar(context, mgr, id);
        programarMedianoche(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle opciones) {
        dibujar(context, mgr, id); // cambió el tamaño: pueden entrar más o menos filas
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String a = intent.getAction();
        if (ACCION_OCULTAR.equals(a)) {
            ocultar(context, intent.getStringExtra("id"), intent.getStringExtra("nombre"));
            return;
        }
        if (ACCION_NUEVO_DIA.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {
            actualizarTodos(context);
            programarMedianoche(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(intentoNuevoDia(context));
    }

    /**
     * ✕ en el widget: el vencimiento deja de mostrarse enseguida y queda anotado en la cola de acciones.
     * La app lo oculta de verdad al abrirse (y desde ahí se puede restaurar), así la base sigue siendo una sola.
     */
    static void ocultar(Context context, String id, String nombre) {
        if (id == null || id.isEmpty()) return;
        try {
            JSONObject accion = new JSONObject();
            accion.put("tipo", "ocultar");
            accion.put("id", id);
            WidgetDatosPlugin.encolarAccion(context, accion);
        } catch (JSONException e) {
            return;
        }
        actualizarTodos(context);
        android.widget.Toast.makeText(context,
                "Ocultaste " + (nombre != null ? nombre : "el vencimiento") + ". Lo podés restaurar desde la app.",
                android.widget.Toast.LENGTH_SHORT).show();
    }

    /** Ids que el widget pidió ocultar y la app todavía no aplicó: no se muestran. */
    static java.util.Set<String> ocultosPendientes(Context context) {
        java.util.Set<String> ids = new java.util.HashSet<>();
        try {
            JSONArray cola = new JSONArray(WidgetDatosPlugin.prefs(context).getString(WidgetDatosPlugin.CLAVE_ACCIONES, "[]"));
            for (int i = 0; i < cola.length(); i++) {
                JSONObject a = cola.optJSONObject(i);
                if (a != null && "ocultar".equals(a.optString("tipo"))) ids.add(a.optString("id"));
            }
        } catch (JSONException e) {
            // cola dañada: no se excluye nada
        }
        return ids;
    }

    /** Redibuja todos los widgets puestos. Lo llama el plugin cuando la app cambia los datos. */
    static void actualizarTodos(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, VencimientosWidget.class));
        for (int id : ids) dibujar(context, mgr, id);
    }

    /**
     * Pide un redibujo poco después de medianoche, para que "vence mañana" pase a "vence hoy".
     * Alarma inexacta y sin despertar al teléfono: si está dormido, se redibuja al despertarlo. No gasta batería.
     */
    static void programarMedianoche(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 1);
        c.set(Calendar.SECOND, 0);
        am.set(AlarmManager.RTC, c.getTimeInMillis(), intentoNuevoDia(context));
    }

    private static PendingIntent intentoNuevoDia(Context context) {
        Intent i = new Intent(context, VencimientosWidget.class).setAction(ACCION_NUEVO_DIA);
        return PendingIntent.getBroadcast(context, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------- Datos ----------

    /** Un vencimiento de la copia, con la urgencia calculada para hoy. */
    static class Item {
        String id, servicioId, nombre, fecha, appPago, medio;
        int dias, orden;
        String estado;
    }

    /** Lo que se dibuja. */
    static class Vista {
        boolean hayCopia, hayServicios, copiaVieja;
        List<Item> urgentes = new ArrayList<>();
        Item siguiente;
    }

    static Vista calcular(String json, long hoy, java.util.Set<String> excluir) {
        Vista v = new Vista();
        if (json == null) return v;
        try {
            JSONObject d = new JSONObject(json);
            v.hayCopia = true;
            v.hayServicios = d.optBoolean("hayServicios", false);
            String generado = d.optString("generado", "");
            if (generado.length() == 10) v.copiaVieja = hoy - diaDe(generado) > DIAS_COPIA_VIEJA;
            JSONArray items = d.optJSONArray("items");
            List<Item> todos = new ArrayList<>();
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject o = items.getJSONObject(i);
                Item it = new Item();
                it.id = o.optString("id");
                it.servicioId = o.optString("servicioId");
                it.nombre = o.optString("nombre");
                it.fecha = o.optString("fecha");
                it.appPago = o.optString("appPago", "");
                it.medio = o.optString("medio", "");
                if (it.fecha.length() != 10 || excluir.contains(it.id)) continue;
                it.dias = (int) (diaDe(it.fecha) - hoy);
                int aviso = o.optInt("diasAviso", 5);
                // Igual que urgencia() en js/pagos.js
                it.estado = it.dias < 0 ? "vencido" : it.dias == 0 ? "hoy" : it.dias <= aviso ? "proximo" : "mas-adelante";
                it.orden = it.dias < 0 ? 0 : it.dias == 0 ? 1 : it.dias <= aviso ? 2 : 3;
                todos.add(it);
            }
            Collections.sort(todos, (a, b) -> a.orden != b.orden ? a.orden - b.orden
                    : !a.fecha.equals(b.fecha) ? a.fecha.compareTo(b.fecha) : a.nombre.compareTo(b.nombre));
            for (Item it : todos) if (!"mas-adelante".equals(it.estado)) v.urgentes.add(it);
            if (v.urgentes.isEmpty() && !todos.isEmpty()) v.siguiente = todos.get(0);
        } catch (JSONException e) {
            v.hayCopia = false; // copia dañada: se pide abrir la app, que la vuelve a escribir
        }
        return v;
    }

    /** Igual que textoUrgencia() en js/pagos.js. */
    static String textoUrgencia(Item it) {
        if ("vencido".equals(it.estado)) return it.dias == -1 ? "Venció ayer" : "Venció hace " + (-it.dias) + " días";
        if ("hoy".equals(it.estado)) return "Vence hoy";
        if (it.dias == 1) return "Vence mañana";
        return it.dias <= 14 ? "Vence en " + it.dias + " días" : "Vence el " + ddmm(it.fecha);
    }

    static String ddmm(String f) {
        return f.substring(8, 10) + "/" + f.substring(5, 7);
    }

    /** Número de día (días desde 1970-01-01) de una fecha "AAAA-MM-DD", sin zonas horarias de por medio. */
    static long diaDe(String f) {
        return diaCivil(Integer.parseInt(f.substring(0, 4)), Integer.parseInt(f.substring(5, 7)), Integer.parseInt(f.substring(8, 10)));
    }

    static long hoy() {
        Calendar c = Calendar.getInstance();
        return diaCivil(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    // Algoritmo "days from civil" (H. Hinnant): fecha del calendario a número de día.
    private static long diaCivil(int y, int m, int d) {
        y -= m <= 2 ? 1 : 0;
        long era = (y >= 0 ? y : y - 399) / 400;
        long yoe = y - era * 400;
        long doy = (153L * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
        long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    // ---------- Dibujo ----------

    static void dibujar(Context context, AppWidgetManager mgr, int widgetId) {
        String json = WidgetDatosPlugin.prefs(context).getString(WidgetDatosPlugin.CLAVE_DATOS, null);
        Vista vista = calcular(json, hoy(), ocultosPendientes(context));
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_vencimientos);

        // Cuántas filas entran según el alto actual del widget (en dp)
        Bundle op = mgr.getAppWidgetOptions(widgetId);
        int alto = op != null ? op.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
        int filas = alto > 0 ? Math.max(1, Math.min(FILAS, (alto - 44) / 44)) : FILAS;

        int base = widgetId * 20;   // códigos distintos por widget y por botón, para que Android no mezcle los toques
        rv.setOnClickPendingIntent(R.id.w_cabecera, abrir(context, "misgastos://pagos", base));

        String vacio = null;
        String pie = null;
        int mostrados = 0;
        if (!vista.hayCopia) {
            vacio = "Abrí Mis Gastos para ver tus vencimientos.";
        } else if (!vista.hayServicios) {
            vacio = "Cargá tus servicios (luz, internet, patente…) y la app te recuerda cuándo vencen.";
            rv.setOnClickPendingIntent(R.id.w_vacio, abrir(context, "misgastos://nuevo-servicio", base + 1));
        } else if (vista.urgentes.isEmpty()) {
            vacio = vista.siguiente == null ? "Estás al día. No hay vencimientos pendientes."
                    : "Estás al día. El próximo es " + vista.siguiente.nombre + ": "
                      + textoUrgencia(vista.siguiente).toLowerCase(Locale.forLanguageTag("es-AR")) + ".";
        } else {
            mostrados = Math.min(filas, vista.urgentes.size());
            int resto = vista.urgentes.size() - mostrados;
            if (resto > 0) pie = "y " + resto + " más";
        }
        if (vista.hayCopia && vista.copiaVieja) pie = (pie == null ? "" : pie + " · ") + "Abrí la app para actualizar";

        for (int i = 0; i < FILAS; i++) {
            if (i >= mostrados) {
                rv.setViewVisibility(FILA[i], View.GONE);
                continue;
            }
            Item it = vista.urgentes.get(i);
            boolean urgente = "vencido".equals(it.estado) || "hoy".equals(it.estado);
            rv.setViewVisibility(FILA[i], View.VISIBLE);
            rv.setTextViewText(NOMBRE[i], it.nombre);
            rv.setTextViewText(ESTADO[i], textoUrgencia(it));
            rv.setInt(ESTADO[i], "setBackgroundResource", urgente ? R.drawable.widget_badge_rojo : R.drawable.widget_badge_ambar);
            rv.setTextColor(ESTADO[i], context.getColor(urgente ? R.color.w_coral : R.color.w_tinta));
            rv.setInt(TILDE[i], "setBackgroundResource", urgente ? R.drawable.widget_tilde_urgente : R.drawable.widget_tilde);
            rv.setContentDescription(TILDE[i], "Pagar " + it.nombre + " del " + ddmm(it.fecha));
            rv.setTextViewText(SUB[i], subtitulo(it));
            rv.setOnClickPendingIntent(TILDE[i], abrir(context, "misgastos://pagar/" + Uri.encode(it.id), base + 2 + i));
            rv.setOnClickPendingIntent(TXT[i], abrir(context, "misgastos://servicio/" + Uri.encode(it.servicioId), base + 5 + i));
            rv.setContentDescription(OCULTAR[i], "Ocultar " + it.nombre + " del " + ddmm(it.fecha));
            rv.setOnClickPendingIntent(OCULTAR[i], pedirOcultar(context, it, base + 10 + i));
        }

        rv.setViewVisibility(R.id.w_vacio, vacio == null ? View.GONE : View.VISIBLE);
        if (vacio != null) {
            rv.setTextViewText(R.id.w_vacio, vacio);
            if (vista.hayServicios || !vista.hayCopia) rv.setOnClickPendingIntent(R.id.w_vacio, abrir(context, "misgastos://inicio", base + 1));
        }
        rv.setViewVisibility(R.id.w_pie, pie == null ? View.GONE : View.VISIBLE);
        if (pie != null) {
            rv.setTextViewText(R.id.w_pie, pie);
            rv.setOnClickPendingIntent(R.id.w_pie, abrir(context, "misgastos://pagos", base + 8));
        }
        mgr.updateAppWidget(widgetId, rv);
    }

    /** "18/11 · Mercado Pago · Débito", sin repetir si la app y el medio se llaman igual. */
    static String subtitulo(Item it) {
        LinkedHashSet<String> partes = new LinkedHashSet<>();
        partes.add(ddmm(it.fecha));
        if (!it.appPago.isEmpty()) partes.add(it.appPago);
        if (!it.medio.isEmpty()) partes.add(it.medio);
        return android.text.TextUtils.join(" · ", partes);
    }

    /** Toque en la ✕: le llega al propio widget (sin abrir la app). */
    static PendingIntent pedirOcultar(Context context, Item it, int codigo) {
        Intent i = new Intent(context, VencimientosWidget.class)
                .setAction(ACCION_OCULTAR)
                .putExtra("id", it.id)
                .putExtra("nombre", it.nombre);
        return PendingIntent.getBroadcast(context, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Abre la app en una pantalla concreta. La app web lee la dirección con WidgetDatos.tomarApertura(). */
    static PendingIntent abrir(Context context, String uri, int codigo) {
        Intent i = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(uri))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
