import { createContext, useContext, useEffect, useState } from "react";
import { dbGet, getProfileId } from "../lib/supabase";
import { cacheMediaUrl } from "../lib/mediaCache";

const BrandContext = createContext(null);

export const useBrand = () => useContext(BrandContext);

// Default FLUX brand - used as absolute fallback if database is offline/unreachable
export const FLUX_DEFAULT = { 
  nombre_marca: "FLUX Sport Supplements", 
  color_primario: "#1A6FD4", 
  logo_url: "/flux_logo.jpeg" 
};

export const getFluxOfficialColor = () => {
  try {
    return localStorage.getItem("flux_official_brand_color") || FLUX_DEFAULT.color_primario;
  } catch {
    return FLUX_DEFAULT.color_primario;
  }
};

export function BrandProvider({ children, session }) {
  const [fluxBrandColor, setFluxBrandColor] = useState(() => getFluxOfficialColor());

  const [brand, setBrand] = useState(() => {
    try {
      const cachedColor = localStorage.getItem("flux_cached_brand_color");
      const cachedName = localStorage.getItem("flux_cached_brand_name");
      const cachedLogo = localStorage.getItem("flux_cached_brand_logo");
      if (cachedColor) {
        return {
          nombre_marca: cachedName || FLUX_DEFAULT.nombre_marca,
          color_primario: cachedColor,
          logo_url: cachedLogo || FLUX_DEFAULT.logo_url
        };
      }
    } catch (e) {}
    return FLUX_DEFAULT;
  });

  // Inyectar variables en el elemento raíz del DOM para que apliquen a modales, loaders y todo el documento
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--brand-primary", brand.color_primario);
      document.documentElement.style.setProperty("--brand-secondary", `color-mix(in srgb, ${brand.color_primario} 12%, white)`);
      document.documentElement.style.setProperty("--brand-primary-hover", `color-mix(in srgb, ${brand.color_primario} 85%, black)`);
      document.documentElement.style.setProperty("--brand-primary-light", `color-mix(in srgb, ${brand.color_primario} 20%, white)`);
    }
    try {
      localStorage.setItem("flux_cached_brand_color", brand.color_primario);
      localStorage.setItem("flux_cached_brand_name", brand.nombre_marca);
      localStorage.setItem("flux_cached_brand_logo", brand.logo_url);
      if (brand.logo_url && brand.logo_url.startsWith("http")) {
        cacheMediaUrl(brand.logo_url).catch(() => {});
      }
    } catch (e) {}
  }, [brand]);

  useEffect(() => {
    let active = true;

    const fetchBrand = async () => {
      try {
        // 1. Obtener la marca oficial configurada por el Superadmin en la BD (FLUX), base y fallback de todo el sistema
        let superadminBrand = { ...FLUX_DEFAULT };
        try {
          const superadminRows = await dbGet("profiles?role=eq.superadmin&select=nombre_marca,color_primario,logo_url&limit=1");
          if (superadminRows && superadminRows.length > 0) {
            const sa = superadminRows[0];
            if (sa.nombre_marca?.trim()) superadminBrand.nombre_marca = sa.nombre_marca.trim();
            if (sa.color_primario?.trim()) superadminBrand.color_primario = sa.color_primario.trim();
            if (sa.logo_url?.trim()) superadminBrand.logo_url = sa.logo_url.trim();
          }
        } catch (saErr) {
          console.warn("No se pudo cargar marca superadmin:", saErr);
        }

        const officialColor = superadminBrand.color_primario || FLUX_DEFAULT.color_primario;
        if (active) {
          setFluxBrandColor(officialColor);
        }
        try {
          localStorage.setItem("flux_official_brand_color", officialColor);
        } catch (e) {}

        // 2. Determinar si hay un perfil específico según la sesión
        let profileIdToFetch = null;

        if (session?.role === "cliente" && session.data?.nutriologo_id) {
          // Cliente ve la marca de su nutriólogo
          profileIdToFetch = session.data.nutriologo_id;
        } else if (
          session?.role === "nutriologo" ||
          session?.role === "nutriologo_estudiante" ||
          session?.role === "superadmin" ||
          session?.role === "admin"
        ) {
          // Nutriólogo (titulado o estudiante) o Superadmin
          profileIdToFetch = session.profileId || getProfileId() || session.data?.id;
        }

        // 3. Si hay perfil asignado a consultar
        if (profileIdToFetch) {
          const res = await dbGet(`profiles?id=eq.${profileIdToFetch}&select=nombre_marca,color_primario,logo_url`);
          if (active && res && res.length > 0) {
            const p = res[0];
            // Si el nutriólogo tiene definido su propio logo o color, se respeta.
            // Si NO tiene logo o color definido, se utiliza exactamente el color y logo fijados por el Superadmin para FLUX.
            const resolved = {
              nombre_marca: p.nombre_marca?.trim() || superadminBrand.nombre_marca,
              color_primario: p.color_primario?.trim() || superadminBrand.color_primario,
              logo_url: p.logo_url?.trim() || superadminBrand.logo_url,
            };
            setBrand((prev) =>
              prev &&
              prev.nombre_marca === resolved.nombre_marca &&
              prev.color_primario === resolved.color_primario &&
              prev.logo_url === resolved.logo_url
                ? prev
                : resolved
            );
            return;
          }
        }

        // 4. Si es atleta independiente (civil), staff, o paciente directo de FLUX:
        if (active) {
          setBrand((prev) =>
            prev &&
            prev.nombre_marca === superadminBrand.nombre_marca &&
            prev.color_primario === superadminBrand.color_primario &&
            prev.logo_url === superadminBrand.logo_url
              ? prev
              : superadminBrand
          );
        }
      } catch (e) {
        if (active) {
          setBrand((prev) => prev || FLUX_DEFAULT);
        }
      }
    };

    fetchBrand();

    const onBrandUpdated = () => { fetchBrand(); };
    const onCacheUpdated = (ev) => {
      const table = ev?.detail?.table;
      if (!table || table === "*" || table === "profiles") {
        fetchBrand();
      }
    };
    window.addEventListener("flux:brand-updated", onBrandUpdated);
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onBrandUpdated);

    return () => {
      active = false;
      window.removeEventListener("flux:brand-updated", onBrandUpdated);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onBrandUpdated);
    };
  }, [session?.role, session?.profileId, session?.data?.id, session?.data?.nutriologo_id]);

  // Generamos variables CSS dinámicas basadas en el color primario de la marca.
  const cssVars = {
    "--brand-primary": brand.color_primario,
    "--brand-secondary": `color-mix(in srgb, ${brand.color_primario} 12%, white)`,
    "--brand-primary-hover": `color-mix(in srgb, ${brand.color_primario} 85%, black)`,
    "--brand-primary-light": `color-mix(in srgb, ${brand.color_primario} 20%, white)`,
  };

  const contextValue = {
    ...brand,
    fluxBrandColor,
    setBrand,
    setBrandColor: (c) => setBrand((prev) => ({ ...prev, color_primario: c }))
  };

  return (
    <BrandContext.Provider value={contextValue}>
      <div style={{ ...cssVars, minHeight: "100vh" }}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
