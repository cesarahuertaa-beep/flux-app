# Directrices del Proyecto FLUX (Reglas para Agentes de IA)

Este archivo define los estándares de sincronización, arquitectura y despliegue del proyecto FLUX para mantener todas las plataformas (PWA/Web, Android Nativo y Electron) perfectamente alineadas.

---

## 1. Arquitectura Multiplataforma

- **Núcleo de Código Compartido**: Todo el código de la interfaz y lógica de negocio vive en `src/`.
- **Web / PWA**: Se despliega automáticamente a Vercel con cada push a la rama `main`.
- **Android (Capacitor)**: Proyecto nativo en `android/`. Depende de los archivos compilados en `dist/` copiados a `android/app/src/main/assets/public`.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).

---

## 2. Regla Obligatoria de Sincronización Automática

> [!IMPORTANT]
> **SIEMPRE que se realicen cambios en el código (`src/`) y se vaya a hacer commit o push:**
> 1. Ejecutar `npm run build` para garantizar que la compilación de Vite sea limpia (0 errores).
> 2. Ejecutar `npx cap sync android` para inyectar automáticamente la versión más reciente en el proyecto nativo de Android (`android/app/src/main/assets/public`).
> 3. De esta manera, el proyecto interno de Android y cualquier APK o AAB que se genere estará 100% al día con la PWA.

---

## 3. Comandos de Compilación Android

- **Sincronizar cambios web con Android**:
  `npx cap sync android` (o `npm run android:sync`)
- **Compilar APK Release (Instalador directo)**:
  `cd android && gradlew.bat assembleRelease` (o `npm run android:apk`)
  *Salida: `android/app/build/outputs/apk/release/app-release.apk`*
- **Compilar AAB Release (Google Play Bundle)**:
  `cd android && gradlew.bat bundleRelease` (o `npm run android:bundle`)
  *Salida: `android/app/build/outputs/bundle/release/app-release.aab`*

---

## 4. Entorno de Ejecución (Windows)
En Windows PowerShell, las políticas de ejecución pueden restringir scripts directos `.ps1`. Ejecutar los comandos a través de `cmd.exe /c "..."` para garantizar compatibilidad total.

> [!IMPORTANT]
> **`public/version.json` NO se sube con la versión nueva.** Ese archivo se despliega a la web al instante y `AppUpdater.jsx` lo compara contra la versión instalada. Si se sube antes de que Google Play **apruebe y publique** el build, los usuarios ven un aviso de actualización que todavía no existe en la tienda. Solo se actualiza el número **después** de confirmar que la versión ya está disponible en Play Store. Los scripts de release no deben tocarlo.


---

## 5. Procedimiento de Limpieza y Organización (Aprendido)

**Estructura**: `flux-app/` = código fuente (va a GitHub). `Desktop\FLUX-Release\` = instaladores compilados (NO va a GitHub; salida definida en `package.json > build.directories.output`).

### Reglas de limpieza del repo (`flux-app/`)
1. **Verificar antes de borrar**: buscar referencias del archivo en código, `package.json`, `vercel.json`, `capacitor.config.json` y configs de Android. Solo borrar si no hay ninguna (ojo: `main.js` ≠ `main.jsx`).
2. **Se puede borrar**: scripts temporales sueltos en la raíz (`fix_*`, `check*`, `test*`, `patch.py`, `script.js`, etc.), logs (`*.log`, `db_out.txt`), APKs de prueba, `release/` y `assets/` huérfanos en la raíz, assets de plantilla Vite (`react.svg`, `vite.svg`), duplicados (`electron/main.js`; el activo es `main.cjs`).
3. **Mover, no borrar**: los `.sql` sueltos van a `supabase/scripts/`.
4. **NO tocar**: `src/`, `android/`, `public/` (incluye `FLUX.apk`, usado por `Landing.jsx` y `AppUpdater.jsx`), `supabase/functions`, `.env*`, llaves de firma.
5. **Después de limpiar**: `npm run build` (0 errores) → `npx cap sync android` → commit → push. Usar `cmd.exe /c` para npm y mensajes de commit entre comillas simples en PowerShell.
6. **Versiones**: guardar versiones con tags de git (`vX.Y.Z-playstore`), no con copias de archivos. Nunca subir archivos de >100 MB a GitHub.

### Reglas de limpieza de `FLUX-Release/`
- **Conservar**: la versión actual y la anterior (`.aab`, `.apk`, `FLUX Setup X.Y.Z.exe` + `.blockmap`), `latest.yml` (lo usa el auto-updater de Electron), `flux-upload-key.jks`, iconos/gráficos de Play Store y carpeta de capturas.
- **Borrar**: instaladores `.exe`/`.apk`/`.aab` de versiones anteriores a la previa, `win-unpacked/`, `builder-debug.yml`.
- Al publicar la v(N+1), borrar la v(N-1).

### Llaves de firma (CRÍTICO)
- `flux-upload-key.jks` y `android/keystore.properties` (alias `flux-upload`) **no están en git**. Mantener respaldo fuera de la PC (Drive/USB). Nunca subirlos a GitHub ni mostrarlos en chats públicos.
