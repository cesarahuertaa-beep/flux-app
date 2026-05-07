import { createContext, useContext, useEffect, useState } from "react";
import { dbGet, getProfileId } from "../lib/supabase";

const BrandContext = createContext(null);

export const useBrand = () => useContext(BrandContext);

export function BrandProvider({ children, session }) {
  const [brand, setBrand] = useState({
    nombre_marca: "FLUX",
    color_primario: "#56CCF2",
    logo_url: "/logo.png"
  });

  const FLUX_DEFAULT = { nombre_marca: "FLUX", color_primario: "#56CCF2", logo_url: "/logo.png" };

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
              color_primario: p.color_primario || "#56CCF2",
              logo_url: p.logo_url || "/logo.png"
            });
          }
        }
      } catch (e) {
        console.error("Error cargando branding", e);
      }
    };

    fetchBrand();
  }, [session]);

  // Generamos tonos más oscuros usando color-mix nativo de CSS para inyectarlos en el :root
  const cssVars = {
    "--brand-accent": brand.color_primario,
    "--brand-accent-mid": `color-mix(in srgb, ${brand.color_primario} 80%, black)`,
    "--brand-accent-dark": `color-mix(in srgb, ${brand.color_primario} 50%, black)`,
    "--brand-accent-deep": `color-mix(in srgb, ${brand.color_primario} 30%, black)`
  };

  return (
    <BrandContext.Provider value={brand}>
      <div style={{ ...cssVars, minHeight: "100vh" }}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
