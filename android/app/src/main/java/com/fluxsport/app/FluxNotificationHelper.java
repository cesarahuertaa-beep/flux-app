package com.fluxsport.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;

/**
 * Helper centralizado para mostrar notificaciones nativas en la barra de estado
 * de Android (tanto en primer plano desde el WebView como en segundo plano desde WorkManager).
 */
public class FluxNotificationHelper {
    public static final String CHANNEL_ALERTS = "flux_alerts_channel";
    private static final String SHOWN_IDS_KEY = "shown_notification_ids";

    public static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm == null) return;

            NotificationChannel alertsChannel = new NotificationChannel(
                CHANNEL_ALERTS,
                "Notificaciones de FLUX",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertsChannel.setDescription("Avisos de citas, planes de nutrición, rutinas, progreso y membresías");
            alertsChannel.enableLights(true);
            alertsChannel.setLightColor(Color.parseColor("#00B4D8"));
            alertsChannel.enableVibration(true);
            alertsChannel.setShowBadge(true);
            nm.createNotificationChannel(alertsChannel);
        }
    }

    public static boolean hasPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    public static boolean isAlreadyShown(Context ctx, String notifId) {
        if (notifId == null || notifId.isEmpty()) return false;
        SharedPreferences prefs = ctx.getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(SHOWN_IDS_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                if (notifId.equals(arr.optString(i))) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    public static void markAsShown(Context ctx, String notifId) {
        if (notifId == null || notifId.isEmpty()) return;
        SharedPreferences prefs = ctx.getSharedPreferences(FluxSyncWorker.PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(SHOWN_IDS_KEY, "[]");
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                if (notifId.equals(arr.optString(i))) return;
            }
            arr.put(notifId);
            // Mantener máximo los últimos 120 IDs para evitar crecimiento infinito
            if (arr.length() > 120) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 120; i < arr.length(); i++) {
                    trimmed.put(arr.get(i));
                }
                arr = trimmed;
            }
            prefs.edit().putString(SHOWN_IDS_KEY, arr.toString()).apply();
        } catch (Exception ignored) {}
    }

    public static void showStatusBarNotification(Context ctx, String notifId, String title, String message, String linkUrl) {
        if (ctx == null || title == null || title.trim().isEmpty()) return;
        if (!hasPermission(ctx)) return;

        if (notifId != null && !notifId.isEmpty()) {
            if (isAlreadyShown(ctx, notifId)) return;
            markAsShown(ctx, notifId);
        }

        ensureChannels(ctx);

        try {
            Intent openIntent = new Intent(ctx, MainActivity.class);
            openIntent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
            );
            if (linkUrl != null && !linkUrl.isEmpty()) {
                openIntent.putExtra("flux_notif_link", linkUrl);
            }

            int reqCode = (notifId != null && !notifId.isEmpty())
                ? (Math.abs(notifId.hashCode()) % 90000) + 5000
                : (int) (System.currentTimeMillis() % 90000) + 5000;

            int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
            PendingIntent pi = PendingIntent.getActivity(ctx, reqCode, openIntent, piFlags);

            String safeMessage = (message != null && !message.trim().isEmpty())
                ? message
                : "Tienes una nueva actualización en FLUX.";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ALERTS)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(safeMessage)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeMessage))
                .setColor(Color.parseColor("#00B4D8"))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pi);

            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(reqCode, builder.build());
            }
        } catch (Exception ignored) {}
    }
}
