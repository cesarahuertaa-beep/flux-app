import { createContext, useContext, useEffect, useState } from "react";
import { dbGet, getProfileId } from "../lib/supabase";

const BrandContext = createContext(null);

export const useBrand = () => useContext(BrandContext);

// Default FLUX brand - used for superadmin or unauthenticated state
const FLUX_DEFAULT = { 
  nombre_marca: "FLUX", 
  color_primario: "#1A6FD4", 
  logo_url: "/flux_logo.jpeg" 
};

export function BrandProvider({ children, session }) {
  const [brand, setBrand] = useState(FLUX_DEFAULT);

  useEffect(() => {
    // Sin sesión o superadmin/admin → siempre FLUX
    if (!session || session.role === "superadmin" || session.role === "admin") {
      setBrand(FLUX_DEFAULT);
      return;
    }

    const fetchBrand = async () => {
      try {
        let profileIdToFetch = null;

        if (session.role === "client" && session.data?.nutriologo_id) {
          // Cliente ve la marca de su nutriólogo
          profileIdToFetch = session.data.nutriologo_id;
        } else if (session.role === "nutriologo") {
          // Nutriólogo ve su propia marca
          profileIdToFetch = session.profileId || getProfileId();
        }

        if (profileIdToFetch) {
          const res = await dbGet(`profiles?id=eq.${profileIdToFetch}&select=nombre_marca,color_primario,logo_url`);
          if (res.length > 0) {
            const p = res[0];
            setBrand({
              nombre_marca: p.nombre_marca || "FLUX",
              color_primario: p.color_primario || "#1A6FD4",
              logo_url: p.logo_url || "/flux_logo.jpeg"
            });
          }
        }
      } catch (e) {
        console.error("Error cargando branding", e);
      }
    };

    fetchBrand();
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
      <div style={{ ...cssVars, minHeight: "100vh" }}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
