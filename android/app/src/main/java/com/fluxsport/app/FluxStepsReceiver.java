package com.fluxsport.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receptor para mantener vivo el conteo pasivo de pasos sin necesidad de abrir la app:
 *  - Al encender/reiniciar el teléfono (BOOT_COMPLETED) o actualizar la app (MY_PACKAGE_REPLACED)
 *    reprograma el Worker y la alarma nocturna y toma una lectura inmediata.
 *  - Antes de apagarse el teléfono (ACTION_SHUTDOWN) o en la alarma de las 23:52
 *    (ACTION_NIGHT_SNAPSHOT) guarda los pasos acumulados del día antes de que cambie la fecha
 *    o se reinicie el contador de hardware.
 */
public class FluxStepsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        final Context appCtx = context.getApplicationContext();
        if (!FluxStepsHelper.isSupported(appCtx) || !FluxStepsHelper.hasPermission(appCtx)) return;
        if (FluxStepsHelper.isPaused(appCtx)) return;

        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                FluxStepsHelper.snapshot(appCtx);
                FluxStepsHelper.scheduleBackgroundTracking(appCtx);
            } catch (Exception ignored) {
            } finally {
                try {
                    pending.finish();
                } catch (Exception ignored) {}
            }
        }).start();
    }
}
