package com.fluxsport.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/**
 * Worker nativo de Android (WorkManager) estilo WhatsApp:
 * 1. Renueva el JWT de Supabase si expiró o está por expirar.
 * 2. PUSH BEFORE PULL: Envía primero cualquier registro hecho en modo offline
 *    (series de entrenamiento, métricas, ediciones) antes de descargar datos.
 * 3. PULL: Descarga silenciosamente las rutinas, dietas, ciclos, perfiles y clientes
 *    más recientes en un archivo JSON local que el WebView fusiona con IndexedDB al abrirse.
 */
public class FluxSyncWorker extends Worker {
    private static final String TAG = "FluxSyncWorker";
    public static final String PREFS_NAME = "flux_native_sync";
    public static final String CACHE_FILENAME = "flux_native_cache.json";

    public FluxSyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String supaUrl = prefs.getString("supa_url", "");
        String supaKey = prefs.getString("supa_key", "");
        String accessToken = prefs.getString("access_token", "");
        String refreshToken = prefs.getString("refresh_token", "");
        String role = prefs.getString("role", "");
        String clientId = prefs.getString("client_id", "");
        String profileId = prefs.getString("profile_id", "");
        String nutriId = prefs.getString("nutri_id", "");
        String email = prefs.getString("email", "");

        if (supaUrl.isEmpty() || supaKey.isEmpty() || (accessToken.isEmpty() && refreshToken.isEmpty())) {
            return Result.success();
        }

        try {
            // 1. Verificar si el access_token expiró o expira en los próximos 5 minutos
            if (isJwtExpiredOrExpiringSoon(accessToken) && !refreshToken.isEmpty()) {
                String refreshed = refreshSupabaseToken(prefs, supaUrl, supaKey, refreshToken);
                if (refreshed != null && !refreshed.isEmpty()) {
                    accessToken = refreshed;
                }
            }

            // 2. PUSH BEFORE PULL: Vaciar cola de mutaciones offline antes de descargar
            boolean pushOk = flushPendingMutations(prefs, supaUrl, supaKey, accessToken, refreshToken);
            if (!pushOk) {
                // Si falló la red a mitad del envío, reintentar más tarde SIN sobrescribir caché local
                return Result.retry();
            }
            // Recargar token por si flushPendingMutations lo renovó tras un 401
            accessToken = prefs.getString("access_token", accessToken);

            // 3. PULL: Descargar consultas clave según el rol del usuario
            JSONObject cacheMap = readExistingCacheFile(ctx);

            // Marca global
            fetchAndStore(cacheMap, supaUrl, supaKey, accessToken,
                "profiles?role=eq.superadmin&select=nombre_marca,color_primario,logo_url&limit=1");

            // Si tiene expediente de cliente o civil
            if (!clientId.isEmpty()) {
                pullClientData(cacheMap, supaUrl, supaKey, accessToken, clientId, nutriId, email);
            }

            // Si es nutriólogo, superadmin o staff
            if ("superadmin".equals(role) || "nutriologo".equals(role) ||
                "nutriologo_estudiante".equals(role) || "staff".equals(role) || "administrativo".equals(role)) {
                if (!profileId.isEmpty()) {
                    pullAdminData(cacheMap, supaUrl, supaKey, accessToken, profileId, role);
                }
            }

            // 4. NOTIFICACIONES NATIVAS EN BARRA DE ESTADO:
            // Consultar buzón de notificaciones no leídas para mostrarlas en la barra de tareas
            if (!profileId.isEmpty()) {
                pullAndShowUnreadNotifications(ctx, cacheMap, supaUrl, supaKey, accessToken, profileId);
            }

            writeCacheFile(ctx, cacheMap);
            prefs.edit().putLong("last_native_sync", System.currentTimeMillis()).apply();

            // Notificar al WebView si la app está abierta en primer plano
            MainActivity.notifyWebViewSyncComplete();

            return Result.success();
        } catch (Exception e) {
            Log.w(TAG, "Background sync postponed: " + e.getMessage());
            return Result.retry();
        }
    }

    private void pullClientData(JSONObject cacheMap, String supaUrl, String supaKey, String token,
                                String clientId, String nutriId, String email) throws Exception {
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "clientes?id=eq." + clientId);
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "clientes?id=eq." + clientId + "&activo=eq.true");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "clientes?id=eq." + clientId + "&select=premium_origen");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "recibos_pago_civil?cliente_id=eq." + clientId + "&order=created_at.desc");

        if (email != null && !email.isEmpty()) {
            String encEmail = URLEncoder.encode(email, "UTF-8");
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "clientes?email=ilike." + encEmail);
        }

        if (nutriId != null && !nutriId.isEmpty()) {
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?id=eq." + nutriId + "&select=bloqueado");
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?id=eq." + nutriId + "&select=nombre_marca,color_primario,logo_url");
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?id=eq." + nutriId);
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "citas?cliente_id=eq." + clientId + "&order=fecha_hora.desc&select=id,fecha_hora,modalidad,estado,motivo_rechazo");
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "disponibilidad?nutriologo_id=eq." + nutriId + "&order=dia_semana.asc");
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "citas_ratings?cliente_id=eq." + clientId + "&select=cita_id,puntuacion");
        }

        fetchAndStore(cacheMap, supaUrl, supaKey, token, "metricas_progreso?cliente_id=eq." + clientId + "&order=fecha.desc&limit=1");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "metricas_progreso?cliente_id=eq." + clientId + "&order=fecha.desc");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "rutinas?cliente_id=eq." + clientId + "&select=id,ciclo_id,ejercicios(id,grupo_muscular)");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "progreso?cliente_id=eq." + clientId + "&limit=3000");

        pullClientPlan(cacheMap, supaUrl, supaKey, token, clientId, true);
    }

    private void pullClientPlan(JSONObject cacheMap, String supaUrl, String supaKey, String token,
                                String clientId, boolean includeProgressByIds) throws Exception {
        fetchAndStore(cacheMap, supaUrl, supaKey, token,
            "nutricion_progreso?cliente_id=eq." + clientId + "&limit=1000");
        JSONArray csActive = fetchAndStore(cacheMap, supaUrl, supaKey, token,
            "ciclos?cliente_id=eq." + clientId + "&activo=eq.true&limit=1");
        JSONArray csAll = fetchAndStore(cacheMap, supaUrl, supaKey, token,
            "ciclos?cliente_id=eq." + clientId + "&order=created_at.desc");

        String activeCycleId = null;
        if (csActive != null && csActive.length() > 0) {
            activeCycleId = csActive.optJSONObject(0).optString("id", null);
        } else if (csAll != null) {
            for (int i = 0; i < csAll.length(); i++) {
                JSONObject c = csAll.optJSONObject(i);
                if (c != null && c.optBoolean("activo", false)) {
                    activeCycleId = c.optString("id", null);
                    break;
                }
            }
        }

        String[] filters = activeCycleId != null
            ? new String[]{"ciclo_id=eq." + activeCycleId, "ciclo_id=is.null"}
            : new String[]{"ciclo_id=is.null"};

        for (String filter : filters) {
            JSONArray ns = fetchAndStore(cacheMap, supaUrl, supaKey, token,
                "nutricion?cliente_id=eq." + clientId + "&" + filter);
            if (ns != null && ns.length() > 0) {
                String nutriId = ns.optJSONObject(0).optString("id", "");
                if (!nutriId.isEmpty()) {
                    fetchAndStore(cacheMap, supaUrl, supaKey, token,
                        "nutricion_dias?nutricion_id=eq." + nutriId + "&select=*,comidas(*)&order=orden.asc");
                }
            }

            JSONArray rs = fetchAndStore(cacheMap, supaUrl, supaKey, token,
                "rutinas?cliente_id=eq." + clientId + "&" + filter + "&select=*,ejercicios(*)&order=orden.asc");
            if (includeProgressByIds && rs != null && rs.length() > 0) {
                StringBuilder idsBuilder = new StringBuilder();
                for (int r = 0; r < rs.length(); r++) {
                    JSONObject rut = rs.optJSONObject(r);
                    if (rut == null) continue;
                    JSONArray ejs = rut.optJSONArray("ejercicios");
                    if (ejs == null) continue;
                    for (int e = 0; e < ejs.length(); e++) {
                        JSONObject ej = ejs.optJSONObject(e);
                        if (ej != null && ej.has("id")) {
                            if (idsBuilder.length() > 0) idsBuilder.append(",");
                            idsBuilder.append(ej.optString("id"));
                        }
                    }
                }
                if (idsBuilder.length() > 0) {
                    fetchAndStore(cacheMap, supaUrl, supaKey, token,
                        "progreso?cliente_id=eq." + clientId + "&ejercicio_id=in.(" + idsBuilder + ")&limit=3000");
                }
            }
        }
    }

    private void pullAdminData(JSONObject cacheMap, String supaUrl, String supaKey, String token,
                               String profileId, String role) throws Exception {
        boolean isSuperOrStaff = "superadmin".equals(role) || "staff".equals(role) || "administrativo".equals(role);
        String clientFilter = isSuperOrStaff
            ? "clientes?order=created_at.asc"
            : "clientes?nutriologo_id=eq." + profileId + "&order=created_at.asc";

        fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?id=eq." + profileId);
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?id=eq." + profileId + "&select=nombre_marca,color_primario,logo_url");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?id=eq." + profileId + "&select=id,nombre,email,nombre_marca,telefono,ubicacion_texto,mapa_url");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?role=in.(nutriologo,nutriologo_estudiante,superadmin)&select=email");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "clientes?nutriologo_id=eq." + profileId + "&objetivo=neq.Mi%20entrenamiento%20personal&order=created_at.asc&limit=1");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "recibos_pago?nutriologo_id=eq." + profileId + "&order=created_at.desc");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "ciclos?activo=eq.true&select=id,cliente_id,nombre,fecha_inicio,activo");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "progreso?select=cliente_id,updated_at&order=updated_at.desc&limit=3000");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "metricas_progreso?select=cliente_id,fecha,created_at&order=created_at.desc&limit=1000");
        fetchAndStore(cacheMap, supaUrl, supaKey, token, "biblioteca_ejercicios?order=nombre.asc");

        if (isSuperOrStaff) {
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?role=in.(nutriologo,nutriologo_estudiante)&order=created_at.desc");
            fetchAndStore(cacheMap, supaUrl, supaKey, token, "profiles?role=in.(nutriologo,nutriologo_estudiante)&select=id,nombre");
        }

        JSONArray clientes = fetchAndStore(cacheMap, supaUrl, supaKey, token, clientFilter);
        if (clientes != null) {
            int maxToSync = isSuperOrStaff ? Math.min(clientes.length(), 25) : Math.min(clientes.length(), 30);
            for (int i = 0; i < maxToSync; i++) {
                JSONObject c = clientes.optJSONObject(i);
                if (c != null) {
                    String cId = c.optString("id", "");
                    if (!cId.isEmpty()) {
                        pullClientPlan(cacheMap, supaUrl, supaKey, token, cId, false);
                    }
                }
            }
        }
    }

    private void pullAndShowUnreadNotifications(Context ctx, JSONObject cacheMap, String supaUrl,
                                                String supaKey, String token, String profileId) {
        try {
            JSONArray notifs = fetchAndStore(
                cacheMap,
                supaUrl,
                supaKey,
                token,
                "notificaciones?profile_id=eq." + profileId + "&leida=eq.false&order=created_at.asc&limit=15"
            );
            if (notifs == null || notifs.length() == 0) return;

            for (int i = 0; i < notifs.length(); i++) {
                JSONObject n = notifs.optJSONObject(i);
                if (n == null) continue;
                String id = n.optString("id", "");
                String titulo = n.optString("titulo", "Notificación FLUX");
                String mensaje = n.optString("mensaje", "");
                String linkUrl = n.optString("link_url", "");

                if (!id.isEmpty() && !FluxNotificationHelper.isAlreadyShown(ctx, id)) {
                    FluxNotificationHelper.showStatusBarNotification(ctx, id, titulo, mensaje, linkUrl);
                    // Marcar como leída en Supabase para no volver a dispararla
                    sendMutationRequest(supaUrl, supaKey, token, "PATCH", "notificaciones?id=eq." + id, "{\"leida\":true}");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error checking unread notifications: " + e.getMessage());
        }
    }

    private boolean flushPendingMutations(SharedPreferences prefs, String supaUrl, String supaKey,
                                          String accessToken, String refreshToken) {
        String pendingRaw = prefs.getString("pending_mutations_json", "[]");
        if (pendingRaw == null || pendingRaw.isEmpty() || "[]".equals(pendingRaw)) {
            return true;
        }

        try {
            JSONArray pending = new JSONArray(pendingRaw);
            if (pending.length() == 0) return true;

            String flushedRaw = prefs.getString("flushed_mutation_ids", "[]");
            JSONArray flushedIds = new JSONArray(flushedRaw);
            JSONArray remaining = new JSONArray();
            String currentToken = accessToken;
            boolean networkFailed = false;

            for (int i = 0; i < pending.length(); i++) {
                JSONObject m = pending.optJSONObject(i);
                if (m == null) continue;
                if (networkFailed) {
                    remaining.put(m);
                    continue;
                }

                int id = m.optInt("id", -1);
                String method = m.optString("method", "POST");
                String path = m.optString("path", "");
                Object bodyObj = m.opt("body");
                String bodyStr = bodyObj != null && bodyObj != JSONObject.NULL ? bodyObj.toString() : null;

                int status = sendMutationRequest(supaUrl, supaKey, currentToken, method, path, bodyStr);
                if (status == 401 && !refreshToken.isEmpty()) {
                    String newTok = refreshSupabaseToken(prefs, supaUrl, supaKey, refreshToken);
                    if (newTok != null) {
                        currentToken = newTok;
                        status = sendMutationRequest(supaUrl, supaKey, currentToken, method, path, bodyStr);
                    }
                }

                if (status >= 200 && status < 300) {
                    if (id != -1) flushedIds.put(id);
                } else if (status >= 400 && status < 500 && status != 401 && status != 408 && status != 429) {
                    // Error 4xx permanente: descartar para no bloquear la cola
                    if (id != -1) flushedIds.put(id);
                } else {
                    // Error de red o 5xx: detener envío y conservar el resto en orden
                    networkFailed = true;
                    remaining.put(m);
                }
            }

            prefs.edit()
                .putString("pending_mutations_json", remaining.toString())
                .putString("flushed_mutation_ids", flushedIds.toString())
                .apply();

            return !networkFailed;
        } catch (Exception e) {
            Log.w(TAG, "Error flushing mutations: " + e.getMessage());
            return false;
        }
    }

    private int sendMutationRequest(String supaUrl, String supaKey, String token,
                                    String method, String path, String bodyStr) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(supaUrl + "/rest/v1/" + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(12000);
            conn.setRequestMethod(method);
            conn.setRequestProperty("apikey", supaKey);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            if (path.contains("on_conflict=")) {
                conn.setRequestProperty("Prefer", "resolution=merge-duplicates,return=representation");
            } else {
                conn.setRequestProperty("Prefer", "return=representation");
            }

            if (bodyStr != null && !("GET".equals(method) || "DELETE".equals(method))) {
                conn.setDoOutput(true);
                byte[] bytes = bodyStr.getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
            }
            return conn.getResponseCode();
        } catch (Exception e) {
            return -1;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private JSONArray fetchAndStore(JSONObject cacheMap, String supaUrl, String supaKey,
                                    String token, String path) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(supaUrl + "/rest/v1/" + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(12000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", supaKey);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                String body = readStream(conn.getInputStream());
                String trimmed = body.trim();
                if (trimmed.startsWith("[")) {
                    JSONArray arr = new JSONArray(trimmed);
                    JSONObject entry = new JSONObject();
                    entry.put("data", arr);
                    entry.put("timestamp", System.currentTimeMillis());
                    cacheMap.put(path, entry);
                    return arr;
                } else if (trimmed.startsWith("{")) {
                    JSONObject obj = new JSONObject(trimmed);
                    JSONObject entry = new JSONObject();
                    entry.put("data", obj);
                    entry.put("timestamp", System.currentTimeMillis());
                    cacheMap.put(path, entry);
                }
            }
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String refreshSupabaseToken(SharedPreferences prefs, String supaUrl,
                                        String supaKey, String refreshToken) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(supaUrl + "/auth/v1/token?grant_type=refresh_token");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", supaKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JSONObject payload = new JSONObject();
            payload.put("refresh_token", refreshToken);
            byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                String resp = readStream(conn.getInputStream());
                JSONObject data = new JSONObject(resp);
                String newAccess = data.optString("access_token", "");
                String newRefresh = data.optString("refresh_token", refreshToken);
                if (!newAccess.isEmpty()) {
                    prefs.edit()
                        .putString("access_token", newAccess)
                        .putString("refresh_token", newRefresh)
                        .putBoolean("tokens_refreshed_by_worker", true)
                        .apply();
                    return newAccess;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Token refresh in worker failed: " + e.getMessage());
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private boolean isJwtExpiredOrExpiringSoon(String jwt) {
        if (jwt == null || jwt.isEmpty() || "offline".equals(jwt)) return true;
        try {
            String[] parts = jwt.split("\\.");
            if (parts.length < 2) return true;
            byte[] decoded = Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            JSONObject payload = new JSONObject(new String(decoded, StandardCharsets.UTF_8));
            long expSec = payload.optLong("exp", 0);
            long nowSec = System.currentTimeMillis() / 1000L;
            return (expSec - nowSec) < 300L; // Menos de 5 minutos de vida
        } catch (Exception e) {
            return true;
        }
    }

    private String readStream(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
        }
        return sb.toString();
    }

    private JSONObject readExistingCacheFile(Context ctx) {
        File file = new File(ctx.getFilesDir(), CACHE_FILENAME);
        if (!file.exists()) return new JSONObject();
        try (FileInputStream fis = new FileInputStream(file)) {
            String content = readStream(fis);
            return new JSONObject(content);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    private void writeCacheFile(Context ctx, JSONObject cacheMap) {
        try {
            // Limitar tamaño máximo a 600 rutas en el archivo nativo de puente
            if (cacheMap.length() > 600) {
                Iterator<String> keys = cacheMap.keys();
                int toRemove = cacheMap.length() - 600;
                while (keys.hasNext() && toRemove > 0) {
                    String k = keys.next();
                    if (!k.startsWith("profiles") && !k.startsWith("clientes") && !k.startsWith("ciclos")) {
                        keys.remove();
                        toRemove--;
                    }
                }
            }
            File file = new File(ctx.getFilesDir(), CACHE_FILENAME);
            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(cacheMap.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            Log.w(TAG, "Error writing native cache file: " + e.getMessage());
        }
    }
}
