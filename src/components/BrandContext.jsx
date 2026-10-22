import { createContext, useContext, useEffect, useState } from"react";
import { dbGet, getProfileId } from"../lib/supabase";

const BrandContext = createContext(null);

export const useBrand = () => useContext(BrandContext);

// Default FLUX brand - used for superadmin or unauthenticated state
const FLUX_DEFAULT = { 
  nombre_marca:"FLUX", 
  color_primario:"#1A6FD4", 
  logo_url:"/flux_logo.jpeg" 
};

export function BrandProvider({ children, session }) {
  const [brand, setBrand] = useState(FLUX_DEFAULT);

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
              nombre_marca: p.nombre_marca || "FLUX",
              color_primario: p.color_primario || FLUX_DEFAULT.color_primario,
              logo_url: p.logo_url || FLUX_DEFAULT.logo_url
            });
            return;
          }
        }

        // Si es atleta independiente o sin marca asignada, cargar la marca corporativa de FLUX (del superadmin)
        const superadminRows = await dbGet("profiles?role=eq.superadmin&select=nombre_marca,color_primario,logo_url&limit=1");
        if (active && superadminRows && superadminRows.length > 0 && superadminRows[0].color_primario) {
          const sa = superadminRows[0];
          setBrand({
            nombre_marca: sa.nombre_marca || "FLUX",
            color_primario: sa.color_primario || FLUX_DEFAULT.color_primario,
            logo_url: sa.logo_url || FLUX_DEFAULT.logo_url
          });
        } else if (active) {
          setBrand(FLUX_DEFAULT);
        }
      } catch (e) {
        if (active) setBrand(FLUX_DEFAULT);
      }
    };

    fetchBrand();
    return () => { active = false; };
  }, [session]);

  // Generamos variables CSS dinámicas basadas en el color primario de la marca.
  // Usamos color-mix para generar fondos ligeros y tonos oscuros (Figma style).
  const cssVars = {
"--brand-primary": brand.color_primario,
    // Fondo claro con 10% de opacidad para componentes seleccionados (ej: sidebar activo)
"--brand-secondary": `color-mix(in srgb, ${brand.color_primario} 10%, white)`,
"--brand-primary-hover": `color-mix(in srgb, ${brand.color_primario} 85%, black)`,
"--brand-primary-light": `color-mix(in srgb, ${brand.color_primario} 20%, white)`,
  };

  return (
    <BrandContext.Provider value={brand}>
      <div style={{ ...cssVars, minHeight:"100vh" }}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
