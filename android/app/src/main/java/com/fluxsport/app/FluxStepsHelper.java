package com.fluxsport.app;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Contador de pasos nativo de FLUX (NEAT).
 *
 * Usa el sensor de hardware TYPE_STEP_COUNTER (coprocesador de movimiento, consumo mínimo de batería).
 * El sensor entrega un acumulado desde el último reinicio del teléfono; aquí se calcula el delta
 * entre lecturas y se atribuye a cada día. Un Worker periódico (FluxStepsWorker) toma instantáneas
 * incluso con la app cerrada, de modo que el historial no depende de que la app esté abierta.
 */
public class FluxStepsHelper {
    static final String PREFS = "flux_steps_prefs";
    private static final String KEY_LAST_TOTAL = "last_total";
    private static final String KEY_DAYS = "days_json";
    private static final int MAX_DAYS = 120;

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

    /** Lectura bloqueante (máx. 4 s) del acumulado del sensor. Debe llamarse fuera del hilo principal. */
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
            sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL);
            try {
                latch.await(4, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            sm.unregisterListener(listener);
            return out[0];
        } catch (Exception e) {
            return -1f;
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

    private static JSONObject loadDays(SharedPreferences p) {
        try {
            return new JSONObject(p.getString(KEY_DAYS, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Toma una instantánea del sensor y suma el delta de pasos al día actual. */
    public static synchronized void snapshot(Context ctx) {
        if (!isSupported(ctx) || !hasPermission(ctx)) return;
        float total = readCounter(ctx);
        if (total < 0f) return;

        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long cur = (long) total;
        long last = p.getLong(KEY_LAST_TOTAL, -1L);
        long delta = 0L;
        long now = System.currentTimeMillis();

        if (last < 0L) {
            // Primera lectura: si el teléfono se reinició hoy, todo el acumulado pertenece a hoy.
            long bootMs = now - SystemClock.elapsedRealtime();
            if (bootMs >= startOfToday()) delta = cur;
        } else if (cur >= last) {
            delta = cur - last;
        } else {
            // El contador se reinició (reboot del teléfono): lo acumulado desde el arranque es nuevo.
            delta = cur;
        }

        try {
            JSONObject days = loadDays(p);
            String today = dayKey(now);
            days.put(today, days.optLong(today, 0L) + delta);

            // Poda de historial antiguo
            if (days.length() > MAX_DAYS) {
                List<String> keys = new ArrayList<>();
                Iterator<String> it = days.keys();
                while (it.hasNext()) keys.add(it.next());
                Collections.sort(keys);
                for (int i = 0; i < keys.size() - MAX_DAYS; i++) days.remove(keys.get(i));
            }
            p.edit().putString(KEY_DAYS, days.toString()).putLong(KEY_LAST_TOTAL, cur).apply();
        } catch (Exception ignored) {}
    }

    public static long getToday(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return loadDays(p).optLong(dayKey(System.currentTimeMillis()), 0L);
    }

    public static String getHistoryJson(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return loadDays(p).toString();
    }
}
