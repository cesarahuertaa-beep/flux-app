package com.fluxsport.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Instantánea periódica (≈15 min) del contador de pasos, incluso con la app cerrada. */
public class FluxStepsWorker extends Worker {
    public static final String UNIQUE_NAME = FluxStepsHelper.WORKER_UNIQUE_NAME;

    public FluxStepsWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context appCtx = getApplicationContext();
        try {
            FluxStepsHelper.snapshot(appCtx);
            FluxStepsHelper.scheduleNightSnapshot(appCtx);
        } catch (Exception ignored) {}
        return Result.success();
    }
}
