import { createContext, useContext, useEffect, useState } from "react";
import { dbGet, getProfileId } from "../lib/supabase";
import { cacheMediaUrl } from "../lib/mediaCache";

const BrandContext = createContext(null);

export const useBrand = () => useContext(BrandContext);

// Default FLUX brand - used for superadmin or unauthenticated state
const FLUX_DEFAULT = { 
  nombre_marca: "FLUX Sport Supplements", 
  color_primario: "#56CCF2", 
  logo_url: "/flux_logo.jpeg" 
};

export function BrandProvider({ children, session }) {
  const [brand, setBrand] = useState(() => {
    try {
      const cachedColor = localStorage.getItem("flux_cached_brand_color");
      const cachedName = localStorage.getItem("flux_cached_brand_name");
      const cachedLogo = localStorage.getItem("flux_cached_brand_logo");
      if (cachedColor && cachedColor !== "#1A6FD4") {
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
        let profileIdToFetch = null;

        if (session?.role === "cliente" && session.data?.nutriologo_id) {
          // Cliente ve la marca de su nutriólogo
          profileIdToFetch = session.data.nutriologo_id;
        } else if (session?.role === "nutriologo" || session?.role === "nutriologo_estudiante" || session?.role === "superadmin" || session?.role === "admin") {
          // Nutriólogo o Superadmin ve su propia marca configurada en su perfil
          profileIdToFetch = session.profileId || getProfileId() || session.data?.id;
        }

        if (profileIdToFetch) {
          const res = await dbGet(`profiles?id=eq.${profileIdToFetch}&select=nombre_marca,color_primario,logo_url`);
          if (active && res && res.length > 0) {
            const p = res[0];
            setBrand({
              nombre_marca: p.nombre_marca || FLUX_DEFAULT.nombre_marca,
              color_primario: p.color_primario || FLUX_DEFAULT.color_primario,
              logo_url: p.logo_url || FLUX_DEFAULT.logo_url
            });
            return;
          }
        }

        // Si es atleta independiente o sin marca asignada con sesión activa, consultar superadmin
        if (session) {
          const superadminRows = await dbGet("profiles?role=eq.superadmin&select=nombre_marca,color_primario,logo_url&limit=1");
          if (active && superadminRows && superadminRows.length > 0 && superadminRows[0].color_primario) {
            const sa = superadminRows[0];
            setBrand({
              nombre_marca: sa.nombre_marca || FLUX_DEFAULT.nombre_marca,
              color_primario: sa.color_primario || FLUX_DEFAULT.color_primario,
              logo_url: sa.logo_url || FLUX_DEFAULT.logo_url
            });
            return;
          }
        }

        if (active) {
          setBrand(prev => (prev?.color_primario && prev.color_primario !== "#1A6FD4" ? prev : FLUX_DEFAULT));
        }
      } catch (e) {
        if (active) {
          setBrand(prev => (prev?.color_primario && prev.color_primario !== "#1A6FD4" ? prev : FLUX_DEFAULT));
        }
      }
    };

    fetchBrand();
    return () => { active = false; };
  }, [session]);

  // Generamos variables CSS dinámicas basadas en el color primario de la marca.
  const cssVars = {
    "--brand-primary": brand.color_primario,
    "--brand-secondary": `color-mix(in srgb, ${brand.color_primario} 12%, white)`,
    "--brand-primary-hover": `color-mix(in srgb, ${brand.color_primario} 85%, black)`,
    "--brand-primary-light": `color-mix(in srgb, ${brand.color_primario} 20%, white)`,
  };

  return (
    <BrandContext.Provider value={brand}>
      <div style={{ ...cssVars, minHeight: "100vh" }}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
