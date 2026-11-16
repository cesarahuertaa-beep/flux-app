package com.fluxsport.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Instantánea periódica (≈15 min) del contador de pasos, incluso con la app cerrada. */
public class FluxStepsWorker extends Worker {
    public static final String UNIQUE_NAME = "flux_steps_snapshot";

    public FluxStepsWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            FluxStepsHelper.snapshot(getApplicationContext());
        } catch (Exception ignored) {}
        return Result.success();
    }
}
