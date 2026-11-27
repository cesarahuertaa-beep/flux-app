package com.fluxsport.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Contador de pasos nativo de FLUX (NEAT).
 *
 * Usa el sensor de hardware TYPE_STEP_COUNTER (coprocesador de movimiento, consumo mínimo de batería).
 * El sensor entrega un acumulado desde el último reinicio del teléfono; aquí se calcula el delta
 * entre lecturas y se atribuye a cada día. El conteo es pasivo: el coprocesador sigue contando aunque
 * la app esté cerrada, y las instantáneas se toman desde varias fuentes independientes:
 *  - FluxStepsWorker (WorkManager, ≈15 min),
 *  - una alarma nocturna antes de medianoche (para cerrar el día con el valor real),
 *  - FluxStepsReceiver al reiniciar/apagar el teléfono o actualizar la app,
 *  - la propia app al abrirse o volver a primer plano.
 *
 * Si el sistema restringió la app en segundo plano y entre dos lecturas pasó la medianoche, el delta se
 * reparte entre los días involucrados según las horas transcurridas (ponderando menos la madrugada) y esos
 * días se marcan como "estimados" en lugar de sumar todo al día actual.
 */
public class FluxStepsHelper {
    private static final String TAG = "FluxSteps";
    static final String PREFS = "flux_steps_prefs";
    private static final String KEY_LAST_TOTAL = "last_total";
    private static final String KEY_LAST_MS = "last_snapshot_ms";
    private static final String KEY_LAST_BOOT = "last_boot_count";
    private static final String KEY_DAYS = "days_json";
    private static final String KEY_EST_DAYS = "estimated_days_json";
    private static final String KEY_OWNER_CLIENT = "owner_client_id";
    private static final String KEY_CLOUD_SYNCED = "cloud_synced_json";
    private static final String KEY_PERM_BLOCKED = "perm_permanently_denied";
    private static final String KEY_PAUSED = "paused_no_session";
    private static final String KEY_REBASELINE = "rebaseline_pending";

    private static final int MAX_DAYS = 120;
    /** Lecturas más cercanas que esto se ignoran (evita lecturas duplicadas en cola). */
    private static final long MIN_SNAPSHOT_GAP_MS = 5000L;
    /** Huecos mayores a esto que cruzan medianoche se marcan como estimados. */
    private static final long ESTIMATE_GAP_MS = 3L * 3600L * 1000L;
    /** Límite de seguridad ante lecturas corruptas del sensor (pasos por día transcurrido). */
    private static final long MAX_STEPS_PER_DAY = 80000L;
    private static final long SENSOR_TIMEOUT_MS = 5000L;

    static final String ACTION_NIGHT_SNAPSHOT = "com.fluxsport.app.STEPS_NIGHT_SNAPSHOT";
    static final String WORKER_UNIQUE_NAME = "flux_steps_snapshot";
    private static final int RC_NIGHT_SNAPSHOT = 7701;

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isSupported(Context ctx) {
        try {
            SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
            return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean hasPermission(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACTIVITY_RECOGNITION)
                == PackageManager.PERMISSION_GRANTED;
    }

    /** true si la app está exenta de optimización de batería (no la congela el modo Doze / App Standby). */
    public static boolean isIgnoringBatteryOptimizations(Context ctx) {
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            return pm == null || pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        } catch (Exception e) {
            return true;
        }
    }

    public static synchronized boolean isPaused(Context ctx) {
        return prefs(ctx).getBoolean(KEY_PAUSED, false);
    }

    /** Lectura bloqueante del acumulado del sensor. Debe llamarse fuera del hilo principal. */
    private static float readCounter(Context ctx) {
        try {
            SensorManager sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
            if (sm == null) return -1f;
            Sensor sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (sensor == null) return -1f;

            final CountDownLatch latch = new CountDownLatch(1);
            final float[] out = new float[]{-1f};
            SensorEventListener listener = new SensorEventListener() {
                @Override
                public void onSensorChanged(SensorEvent event) {
                    if (event != null && event.values != null && event.values.length > 0) {
                        out[0] = event.values[0];
                        latch.countDown();
                    }
                }

                @Override
                public void onAccuracyChanged(Sensor s, int accuracy) {}
            };
            sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, 0);
            // Forzar al coprocesador a entregar el valor en lote; sin esto, con el teléfono quieto o en
            // Doze, el sensor (de tipo on-change) puede no emitir nada y la lectura se perdía.
            try {
                sm.flush(listener);
            } catch (Exception ignored) {}
            try {
                latch.await(SENSOR_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            sm.unregisterListener(listener);
            return out[0];
        } catch (Exception e) {
            return -1f;
        }
    }

    private static int currentBootCount(Context ctx) {
        try {
            return Settings.Global.getInt(ctx.getContentResolver(), Settings.Global.BOOT_COUNT, -1);
        } catch (Exception e) {
            return -1;
        }
    }

    private static String dayKey(long ms) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(ms));
    }

    private static long startOfToday() {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static JSONObject loadJson(SharedPreferences p, String key) {
        try {
            return new JSONObject(p.getString(key, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /**
     * Reparte un delta de pasos entre los días que abarca [fromMs, toMs]. Si todo ocurre el mismo día
     * se suma tal cual; si cruza medianoche se pondera hora por hora (la madrugada pesa 10%).
     */
    private static void distribute(JSONObject days, JSONObject est, long fromMs, long toMs, long delta) throws Exception {
        if (delta <= 0L) return;
        String toKey = dayKey(toMs);
        if (fromMs <= 0L || fromMs >= toMs || dayKey(fromMs).equals(toKey)) {
            days.put(toKey, days.optLong(toKey, 0L) + delta);
            return;
        }
        long earliest = toMs - (long) MAX_DAYS * 24L * 3600L * 1000L;
        long cursor = Math.max(fromMs, earliest);

        LinkedHashMap<String, Double> weights = new LinkedHashMap<>();
        double total = 0d;
        Calendar cal = Calendar.getInstance();
        while (cursor < toMs) {
            cal.setTimeInMillis(cursor);
            int hour = cal.get(Calendar.HOUR_OF_DAY);
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            cal.add(Calendar.HOUR_OF_DAY, 1);
            long segEnd = Math.min(cal.getTimeInMillis(), toMs);
            if (segEnd <= cursor) segEnd = Math.min(cursor + 3600L * 1000L, toMs);
            double w = (segEnd - cursor) * (hour < 6 ? 0.1d : 1d);
            String k = dayKey(cursor);
            Double prev = weights.get(k);
            weights.put(k, (prev == null ? 0d : prev) + w);
            total += w;
            cursor = segEnd;
        }
        if (total <= 0d) {
            days.put(toKey, days.optLong(toKey, 0L) + delta);
            return;
        }

        boolean estimated = (toMs - fromMs) > ESTIMATE_GAP_MS;
        long assigned = 0L;
        for (Map.Entry<String, Double> e : weights.entrySet()) {
            long part = (long) Math.floor(delta * (e.getValue() / total));
            if (part <= 0L) continue;
            days.put(e.getKey(), days.optLong(e.getKey(), 0L) + part);
            assigned += part;
            if (estimated && !e.getKey().equals(toKey)) est.put(e.getKey(), true);
        }
        long rem = delta - assigned;
        if (rem > 0L) days.put(toKey, days.optLong(toKey, 0L) + rem);
    }

    private static void prune(JSONObject obj) {
        if (obj.length() <= MAX_DAYS) return;
        List<String> keys = new ArrayList<>();
        Iterator<String> it = obj.keys();
        while (it.hasNext()) keys.add(it.next());
        Collections.sort(keys);
        for (int i = 0; i < keys.size() - MAX_DAYS; i++) obj.remove(keys.get(i));
    }

    /** Toma una instantánea del sensor y atribuye el delta de pasos a los días correspondientes. */
    public static synchronized void snapshot(Context ctx) {
        if (!isSupported(ctx) || !hasPermission(ctx)) return;
        SharedPreferences p = prefs(ctx);
        // Sin sesión activa no se acumulan pasos (no sabemos a quién pertenecen).
        if (p.getBoolean(KEY_PAUSED, false)) return;

        long now = System.currentTimeMillis();
        long lastMs = p.getLong(KEY_LAST_MS, 0L);
        if (lastMs > 0L && now >= lastMs && now - lastMs < MIN_SNAPSHOT_GAP_MS) return;

        float total = readCounter(ctx);
        if (total < 0f) return;

        long cur = (long) total;
        long last = p.getLong(KEY_LAST_TOTAL, -1L);
        int boot = currentBootCount(ctx);
        int lastBoot = p.getInt(KEY_LAST_BOOT, -1);
        long bootMs = now - SystemClock.elapsedRealtime();

        SharedPreferences.Editor ed = p.edit()
            .putLong(KEY_LAST_TOTAL, cur)
            .putLong(KEY_LAST_MS, now)
            .putInt(KEY_LAST_BOOT, boot);

        // Cambio de usuario en el teléfono: fijar nueva base sin heredar pasos del anterior.
        if (p.getBoolean(KEY_REBASELINE, false)) {
            ed.putBoolean(KEY_REBASELINE, false).apply();
            return;
        }

        long delta;
        long fromMs;
        boolean rebooted = boot >= 0 && lastBoot >= 0 && boot != lastBoot;
        if (last < 0L) {
            // Primera lectura: si el teléfono arrancó hoy, todo el acumulado pertenece a hoy.
            delta = bootMs >= startOfToday() ? cur : 0L;
            fromMs = now;
        } else if (rebooted || cur < last) {
            // El contador se reinició (reboot): lo acumulado desde el arranque es nuevo.
            delta = cur;
            fromMs = Math.max(bootMs, lastMs);
        } else {
            delta = cur - last;
            fromMs = lastMs;
        }

        long spanDays = fromMs > 0L && now > fromMs ? ((now - fromMs) / (24L * 3600L * 1000L)) + 1L : 1L;
        if (delta > MAX_STEPS_PER_DAY * spanDays) {
            Log.w(TAG, "Delta de pasos descartado por inconsistente: " + delta);
            ed.apply();
            return;
        }

        try {
            JSONObject days = loadJson(p, KEY_DAYS);
            JSONObject est = loadJson(p, KEY_EST_DAYS);
            distribute(days, est, fromMs, now, delta);
            prune(days);
            prune(est);
            ed.putString(KEY_DAYS, days.toString()).putString(KEY_EST_DAYS, est.toString());
        } catch (Exception e) {
            Log.w(TAG, "Error guardando pasos: " + e.getMessage());
        }
        ed.apply();
    }

    public static long getToday(Context ctx) {
        return loadJson(prefs(ctx), KEY_DAYS).optLong(dayKey(System.currentTimeMillis()), 0L);
    }

    public static String getHistoryJson(Context ctx) {
        return loadJson(prefs(ctx), KEY_DAYS).toString();
    }

    public static String getEstimatedDaysJson(Context ctx) {
        return loadJson(prefs(ctx), KEY_EST_DAYS).toString();
    }

    public static synchronized boolean isPermissionBlocked(Context ctx) {
        if (hasPermission(ctx)) return false;
        return prefs(ctx).getBoolean(KEY_PERM_BLOCKED, false);
    }

    public static synchronized void setPermissionBlocked(Context ctx, boolean blocked) {
        prefs(ctx).edit().putBoolean(KEY_PERM_BLOCKED, blocked).apply();
    }

    public static synchronized String getOwnerClient(Context ctx) {
        return prefs(ctx).getString(KEY_OWNER_CLIENT, "");
    }

    /**
     * Declara a quién pertenecen los pasos de este teléfono (paciente, civil o perfil personal del
     * profesional). Si cambia de persona se limpia el historial local y se fija una nueva base del
     * sensor para no heredar pasos ajenos. Reanuda el conteo si estaba pausado por cierre de sesión.
     */
    public static synchronized void setOwner(Context ctx, String clientId) {
        if (clientId == null || clientId.isEmpty()) return;
        SharedPreferences p = prefs(ctx);
        String prev = p.getString(KEY_OWNER_CLIENT, "");
        SharedPreferences.Editor ed = p.edit()
            .putBoolean(KEY_PAUSED, false)
            .putString(KEY_OWNER_CLIENT, clientId);
        if (!prev.isEmpty() && !prev.equals(clientId)) {
            ed.remove(KEY_DAYS)
              .remove(KEY_EST_DAYS)
              .remove(KEY_CLOUD_SYNCED)
              .putBoolean(KEY_REBASELINE, true);
        }
        ed.apply();
    }

    /** Compatibilidad: usado al guardar credenciales de pacientes/civiles. */
    public static void ensureOwnerClient(Context ctx, String clientId) {
        setOwner(ctx, clientId);
    }

    /** Al cerrar sesión: dejar de acumular pasos hasta que alguien vuelva a iniciar sesión. */
    public static synchronized void pauseForLogout(Context ctx) {
        prefs(ctx).edit().putBoolean(KEY_PAUSED, true).apply();
        cancelBackgroundTracking(ctx);
    }

    // ── Programación del conteo pasivo ──

    public static void schedulePeriodicWorker(Context ctx) {
        try {
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(
                FluxStepsWorker.class, 15, TimeUnit.MINUTES
            ).build();
            WorkManager.getInstance(ctx.getApplicationContext()).enqueueUniquePeriodicWork(
                WORKER_UNIQUE_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                req
            );
        } catch (Exception e) {
            Log.w(TAG, "Error programando worker de pasos: " + e.getMessage());
        }
    }

    private static PendingIntent nightSnapshotIntent(Context ctx) {
        Intent i = new Intent(ctx, FluxStepsReceiver.class).setAction(ACTION_NIGHT_SNAPSHOT);
        return PendingIntent.getBroadcast(
            ctx, RC_NIGHT_SNAPSHOT, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    /** Alarma diaria a las 23:52 (aun en Doze) para cerrar el día con su conteo real. */
    public static void scheduleNightSnapshot(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, 23);
            c.set(Calendar.MINUTE, 52);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() <= System.currentTimeMillis() + 60000L) {
                c.add(Calendar.DAY_OF_YEAR, 1);
            }
            PendingIntent pi = nightSnapshotIntent(ctx);
            long at = c.getTimeInMillis();
            boolean canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
            if (canExact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error programando alarma nocturna de pasos: " + e.getMessage());
        }
    }

    public static void scheduleBackgroundTracking(Context ctx) {
        if (!isSupported(ctx) || !hasPermission(ctx) || isPaused(ctx)) return;
        schedulePeriodicWorker(ctx);
        scheduleNightSnapshot(ctx);
    }

    public static void cancelBackgroundTracking(Context ctx) {
        try {
            WorkManager.getInstance(ctx.getApplicationContext()).cancelUniqueWork(WORKER_UNIQUE_NAME);
        } catch (Exception ignored) {}
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.cancel(nightSnapshotIntent(ctx));
        } catch (Exception ignored) {}
    }

    // ── Sincronización con Supabase (pasos_diarios) ──

    /**
     * Incorpora el historial de la nube como piso mínimo local: si en Supabase ya existe un conteo
     * mayor para una fecha (p. ej. tras reinstalar o cambiar de teléfono), nunca se sobrescribe con
     * un número local menor.
     */
    public static synchronized void mergeCloudHistory(Context ctx, String clientId, JSONObject cloudDays) {
        if (clientId == null || clientId.isEmpty() || cloudDays == null || cloudDays.length() == 0) return;
        SharedPreferences p = prefs(ctx);
        String owner = p.getString(KEY_OWNER_CLIENT, "");
        if (!owner.isEmpty() && !owner.equals(clientId)) return;

        JSONObject days = loadJson(p, KEY_DAYS);
        JSONObject synced = loadJson(p, KEY_CLOUD_SYNCED);
        boolean changed = false;

        Iterator<String> it = cloudDays.keys();
        while (it.hasNext()) {
            String fecha = it.next();
            long cloudPasos = cloudDays.optLong(fecha, 0L);
            if (cloudPasos <= 0L) continue;
            long localPasos = days.optLong(fecha, 0L);
            if (cloudPasos > localPasos) {
                try {
                    days.put(fecha, cloudPasos);
                    changed = true;
                } catch (Exception ignored) {}
            }
            String syncKey = clientId + ":" + fecha;
            if (cloudPasos >= days.optLong(fecha, 0L) && synced.optLong(syncKey, -1L) != cloudPasos) {
                try {
                    synced.put(syncKey, cloudPasos);
                    changed = true;
                } catch (Exception ignored) {}
            }
        }

        if (changed) {
            prune(days);
            p.edit()
                .putString(KEY_DAYS, days.toString())
                .putString(KEY_CLOUD_SYNCED, synced.toString())
                .apply();
        }
    }

    /** Prepara filas pendientes de subir a Supabase (pasos_diarios) solo si hubo cambios reales. */
    public static synchronized JSONArray buildUnsyncedCloudRows(Context ctx, String clientId) {
        JSONArray rows = new JSONArray();
        if (clientId == null || clientId.isEmpty()) return rows;
        SharedPreferences p = prefs(ctx);
        // Solo subir pasos si este teléfono pertenece a ese cliente.
        String owner = p.getString(KEY_OWNER_CLIENT, "");
        if (!owner.isEmpty() && !owner.equals(clientId)) return rows;
        if (p.getBoolean(KEY_PAUSED, false)) return rows;

        JSONObject days = loadJson(p, KEY_DAYS);
        JSONObject synced = loadJson(p, KEY_CLOUD_SYNCED);

        SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        isoFmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        String nowIso = isoFmt.format(new Date());

        Iterator<String> it = days.keys();
        while (it.hasNext()) {
            String fecha = it.next();
            long pasos = days.optLong(fecha, 0L);
            if (pasos <= 0L) continue;
            String syncKey = clientId + ":" + fecha;
            if (synced.optLong(syncKey, -1L) == pasos) continue;
            try {
                JSONObject row = new JSONObject();
                row.put("cliente_id", clientId);
                row.put("fecha", fecha);
                row.put("pasos", pasos);
                row.put("updated_at", nowIso);
                rows.put(row);
            } catch (Exception ignored) {}
        }
        return rows;
    }

    /** Marca filas subidas (o ya cubiertas por la nube) para no repetir peticiones desde el Worker. */
    public static synchronized void markCloudSynced(Context ctx, String clientId, JSONArray rows) {
        if (clientId == null || clientId.isEmpty() || rows == null || rows.length() == 0) return;
        SharedPreferences p = prefs(ctx);
        JSONObject synced = loadJson(p, KEY_CLOUD_SYNCED);
        for (int i = 0; i < rows.length(); i++) {
            JSONObject r = rows.optJSONObject(i);
            if (r == null) continue;
            String fecha = r.optString("fecha", "");
            long pasos = r.optLong("pasos", 0L);
            if (!fecha.isEmpty() && pasos > 0L) {
                try {
                    synced.put(clientId + ":" + fecha, pasos);
                } catch (Exception ignored) {}
            }
        }
        p.edit().putString(KEY_CLOUD_SYNCED, synced.toString()).apply();
    }
}
