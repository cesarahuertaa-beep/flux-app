const fs = require('fs');
let code = fs.readFileSync('src/pages/Landing.jsx', 'utf-8');

// 1. Add dbGet import
code = code.replace(/import { Link } from "react-router-dom";/, 'import { Link } from "react-router-dom";\nimport { dbGet } from "../lib/supabase";\nimport { useEffect } from "react";');

// 2. Rename global mock data arrays to avoid conflicts
code = code.replace(/const supplements = \[/g, 'const MOCK_SUPPLEMENTS = [');
code = code.replace(/const apparel = \[/g, 'const MOCK_APPAREL = [');
code = code.replace(/const nutritionists = \[/g, 'const MOCK_NUTRITIONISTS = [');
code = code.replace(/const mapPins = \[/g, 'const MOCK_MAPPINS = [');

// 3. Update section components to accept props
code = code.replace(/function SupplementsSection\(\) \{/g, 'function SupplementsSection({ supplements }) {');
code = code.replace(/function ApparelSection\(\) \{/g, 'function ApparelSection({ apparel }) {');
code = code.replace(/function NutritionistsSection\(\) \{/g, 'function NutritionistsSection({ nutritionists }) {');
code = code.replace(/function MapSection\(\) \{/g, 'function MapSection({ mapPins }) {');

// 4. Update the main Landing component
const landingComponentStart = 'export default function Landing({ session }) {';
const newLandingStart = `export default function Landing({ session }) {
  const [dbSupplements, setDbSupplements] = useState([]);
  const [dbApparel, setDbApparel] = useState([]);
  const [dbNutritionists, setDbNutritionists] = useState([]);
  const [dbMapPins, setDbMapPins] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const prod = await dbGet('productos?activo=eq.true');
        if (prod && prod.length > 0) {
          // Format for frontend mapping
          const mappedProd = prod.map(p => ({
            id: p.id,
            name: p.nombre,
            subtitle: p.subtitulo,
            price: p.precio,
            rating: p.rating,
            reviews: p.num_reviews,
            tag: p.badge,
            img: p.imagen_url || 'photo-1593095948071-474c5cc2989d',
            flavors: p.variantes || [],
            sizes: p.variantes || [],
            badge: p.badge ? 'bg-blue-100 text-blue-700' : ''
          }));
          setDbSupplements(mappedProd.filter(p => p.categoria === 'suplemento'));
          setDbApparel(mappedProd.filter(p => p.categoria === 'ropa'));
        }
      } catch (e) { console.error('Error cargando productos', e); }

      try {
        const nutris = await dbGet('profiles?role=eq.nutriologo&activo=eq.true&select=id,nombre,nombre_marca,especialidad,ubicacion_texto,pin_top,pin_left,rating,verificado,logo_url');
        if (nutris && nutris.length > 0) {
          const formattedNutris = nutris.map(n => ({
            id: n.id,
            name: n.nombre_marca || n.nombre,
            specialty: n.especialidad || 'Nutrición Integral',
            location: n.ubicacion_texto || 'Consulta Online',
            rating: n.rating || 5.0,
            patients: 0,
            available: true,
            img: n.logo_url || 'photo-1559839734-2b71ea197ec2',
            verified: n.verificado || false
          }));
          setDbNutritionists(formattedNutris);

          const pins = nutris.filter(n => n.pin_top && n.pin_left).map(n => ({
            top: n.pin_top,
            left: n.pin_left,
            name: n.nombre_marca || n.nombre,
            available: true
          }));
          setDbMapPins(pins);
        }
      } catch (e) { console.error('Error cargando nutris', e); }
    };
    loadData();
  }, []);

  const activeSupplements = dbSupplements.length > 0 ? dbSupplements : MOCK_SUPPLEMENTS;
  const activeApparel = dbApparel.length > 0 ? dbApparel : MOCK_APPAREL;
  const activeNutritionists = dbNutritionists.length > 0 ? dbNutritionists : MOCK_NUTRITIONISTS;
  const activeMapPins = dbMapPins.length > 0 ? dbMapPins : MOCK_MAPPINS;
`;

code = code.replace(landingComponentStart, newLandingStart);

// 5. Update component invocations inside Landing
code = code.replace(/<SupplementsSection \/>/g, '<SupplementsSection supplements={activeSupplements} />');
code = code.replace(/<ApparelSection \/>/g, '<ApparelSection apparel={activeApparel} />');
code = code.replace(/<NutritionistsSection \/>/g, '<NutritionistsSection nutritionists={activeNutritionists} />');
code = code.replace(/<MapSection \/>/g, '<MapSection mapPins={activeMapPins} />');

fs.writeFileSync('src/pages/Landing.jsx', code, 'utf-8');
console.log('Dynamic mapping complete.');
