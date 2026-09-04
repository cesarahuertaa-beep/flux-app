import { useState } from "react";
import { Flame, ChevronRight, Apple } from "lucide-react";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const FULL_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MEAL_LABELS = [
  { key: "desayuno", label: "Desayuno", time: "7:00 AM" },
  { key: "colacion1", label: "Colación", time: "10:00 AM" },
  { key: "almuerzo", label: "Almuerzo", time: "1:00 PM" },
  { key: "colacion2", label: "Colación", time: "4:00 PM" },
  { key: "cena", label: "Cena", time: "7:30 PM" },
];

type MealItem = { name: string; kcal: number; image: string; portion: string };
type DayPlan = { desayuno: MealItem; colacion1: MealItem; almuerzo: MealItem; colacion2: MealItem; cena: MealItem };

const plan: DayPlan[] = [
  {
    desayuno: { name: "Avena con fruta y semillas", kcal: 320, portion: "1 taza + 1 plátano", image: "photo-1517673400267-0251440c45dc" },
    colacion1: { name: "Manzana con mantequilla de almendra", kcal: 180, portion: "1 manzana + 1 cda", image: "photo-1568702846914-96b305d2aaeb" },
    almuerzo: { name: "Pechuga de pollo a la plancha con verduras", kcal: 450, portion: "200g proteína + 150g verduras", image: "photo-1467003909585-2f8a72700288" },
    colacion2: { name: "Yogurt griego con granola", kcal: 210, portion: "150g yogurt + 30g granola", image: "photo-1488477181946-6428a0291777" },
    cena: { name: "Salmón con camote y brócoli", kcal: 520, portion: "150g + 100g + 100g", image: "photo-1519708227418-c8fd9a32b7a2" },
  },
  {
    desayuno: { name: "Huevos revueltos con espinacas", kcal: 280, portion: "3 huevos + 50g espinacas", image: "photo-1525351484163-7529414344d8" },
    colacion1: { name: "Nueces mixtas", kcal: 160, portion: "30g", image: "photo-1508061253366-f7da158b6d46" },
    almuerzo: { name: "Ensalada de atún con aguacate", kcal: 420, portion: "1 lata + ½ aguacate", image: "photo-1546069901-ba9599a7e63c" },
    colacion2: { name: "Jícama con limón y chile", kcal: 90, portion: "200g", image: "photo-1512621776951-a57141f2eefd" },
    cena: { name: "Caldo de res con vegetales", kcal: 380, portion: "1 tazón grande", image: "photo-1547592180-85f173990554" },
  },
  {
    desayuno: { name: "Smoothie verde proteico", kcal: 310, portion: "500ml", image: "photo-1610970881699-44a5587cabec" },
    colacion1: { name: "Galletas de arroz con queso cottage", kcal: 140, portion: "3 galletas + 100g", image: "photo-1486297678162-eb2a19b0a32d" },
    almuerzo: { name: "Bowl de quinoa con verduras asadas", kcal: 480, portion: "200g quinoa + 150g verduras", image: "photo-1512621776951-a57141f2eefd" },
    colacion2: { name: "Proteína de suero con agua", kcal: 130, portion: "1 medida / 300ml", image: "photo-1593095948071-474c5cc2989d" },
    cena: { name: "Tacos de lechuga con carne molida", kcal: 390, portion: "3 tacos de lechuga", image: "photo-1565299585323-38d6b0865b47" },
  },
  {
    desayuno: { name: "Tostadas de aguacate con huevo pochado", kcal: 340, portion: "2 tostadas + 2 huevos", image: "photo-1541519227354-08fa5d50c820" },
    colacion1: { name: "Fruta de temporada", kcal: 120, portion: "1 taza mixta", image: "photo-1490474418585-ba9bad8fd0ea" },
    almuerzo: { name: "Pavo molido con lentejas", kcal: 460, portion: "150g + 1 taza lentejas", image: "photo-1547592180-85f173990554" },
    colacion2: { name: "Pepino con hummus", kcal: 110, portion: "150g + 2 cdas", image: "photo-1505253716362-afaea1d3d1af" },
    cena: { name: "Filete de tilapia al vapor", kcal: 340, portion: "200g + ensalada", image: "photo-1467003909585-2f8a72700288" },
  },
  {
    desayuno: { name: "Pancakes de proteína con moras", kcal: 360, portion: "3 pancakes medianos", image: "photo-1567620905732-2d1ec7ab7445" },
    colacion1: { name: "Bastones de zanahoria y apio", kcal: 70, portion: "150g", image: "photo-1598170845058-32b9d6a5da37" },
    almuerzo: { name: "Pozole verde con pollo", kcal: 490, portion: "1 tazón + 200g pollo", image: "photo-1547592180-85f173990554" },
    colacion2: { name: "Edamame con sal de mar", kcal: 150, portion: "100g", image: "photo-1512621776951-a57141f2eefd" },
    cena: { name: "Camarones al ajillo con espárragos", kcal: 370, portion: "200g + 100g", image: "photo-1565299507177-b0ac66763828" },
  },
  {
    desayuno: { name: "Chilaquiles verdes proteicos", kcal: 380, portion: "1 plato + 2 claras", image: "photo-1565299585323-38d6b0865b47" },
    colacion1: { name: "Smoothie de proteína y plátano", kcal: 220, portion: "400ml", image: "photo-1610970881699-44a5587cabec" },
    almuerzo: { name: "Pollo al pastor con nopales", kcal: 440, portion: "200g + 100g nopales", image: "photo-1565299507177-b0ac66763828" },
    colacion2: { name: "Queso panela con tomate cherry", kcal: 180, portion: "100g + 100g", image: "photo-1486297678162-eb2a19b0a32d" },
    cena: { name: "Ensalada de espinacas con salmón ahumado", kcal: 360, portion: "200g ensalada + 80g salmón", image: "photo-1519708227418-c8fd9a32b7a2" },
  },
  {
    desayuno: { name: "Omelette de claras con champiñones", kcal: 260, portion: "5 claras + 80g champiñones", image: "photo-1525351484163-7529414344d8" },
    colacion1: { name: "Arroz de coliflor con almendras", kcal: 130, portion: "150g", image: "photo-1512621776951-a57141f2eefd" },
    almuerzo: { name: "Sopa de fideo seco con caldo de pollo", kcal: 350, portion: "1 plato mediano", image: "photo-1547592180-85f173990554" },
    colacion2: { name: "Palomitas de maíz naturales", kcal: 90, portion: "2 tazas", image: "photo-1508061253366-f7da158b6d46" },
    cena: { name: "Ceviche de camarón con tostada horneada", kcal: 310, portion: "200g + 1 tostada", image: "photo-1565299507177-b0ac66763828" },
  },
];

export default function Nutrition() {
  const [activeDay, setActiveDay] = useState(0);
  const [expandedMeal, setExpandedMeal] = useState<string | null>("desayuno");

  const dayPlan = plan[activeDay];
  const totalKcal = Object.values(dayPlan).reduce((sum, m) => sum + m.kcal, 0);

  return (
    <div className="h-full flex flex-col gap-0">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-1">Plan de Alimentación</p>
            <h1 className="text-2xl font-bold text-[#0B1929]" style={{ fontFamily: 'DM Sans' }}>Nutrición Semanal</h1>
            <p className="text-sm text-[#6B7A8D] mt-1">Paciente: <span className="text-[#1A6FD4] font-medium">Carlos Mendoza</span></p>
          </div>
          <div className="text-right bg-[#E8F1FB] rounded-xl px-5 py-3">
            <p className="text-xs text-[#6B7A8D] font-mono">TOTAL DÍA</p>
            <p className="text-2xl font-bold text-[#1A6FD4] font-mono">{totalKcal}</p>
            <p className="text-xs text-[#6B7A8D]">kcal</p>
          </div>
        </div>
      </div>

      {/* Day tabs */}
      <div className="px-8 flex gap-2 mb-6">
        {DAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setActiveDay(i)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeDay === i
                ? "bg-[#1A6FD4] text-white shadow-md"
                : "bg-white text-[#6B7A8D] hover:bg-[#E8F1FB] border border-[#E2E8F0]"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Meals */}
      <div className="px-8 flex-1 overflow-y-auto space-y-3 pb-8">
        <p className="text-xs font-mono tracking-widest text-[#6B7A8D] uppercase mb-4">{FULL_DAYS[activeDay]}</p>
        {MEAL_LABELS.map(({ key, label, time }) => {
          const meal = dayPlan[key as keyof DayPlan];
          const isExpanded = expandedMeal === key;
          return (
            <div
              key={key}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${isExpanded ? "border-[#1A6FD4] shadow-sm" : "border-[#E2E8F0]"}`}
            >
              <button
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedMeal(isExpanded ? null : key)}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isExpanded ? "bg-[#1A6FD4]" : "bg-[#CBD5E1]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#6B7A8D]">{time}</span>
                    <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                    <span className="text-xs font-semibold text-[#1A6FD4] uppercase tracking-wide">{label}</span>
                  </div>
                  <p className="text-sm font-medium text-[#0B1929] mt-0.5 truncate">{meal.name}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 bg-[#FFF7ED] px-2 py-1 rounded-lg">
                    <Flame size={12} className="text-orange-400" />
                    <span className="text-xs font-mono font-semibold text-orange-500">{meal.kcal}</span>
                  </div>
                  <ChevronRight size={16} className={`text-[#CBD5E1] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 flex gap-5 border-t border-[#F0F4FA]">
                  <img
                    src={`https://images.unsplash.com/${meal.image}?w=200&h=140&fit=crop&auto=format`}
                    alt={meal.name}
                    className="w-36 h-24 rounded-lg object-cover flex-shrink-0 bg-[#F0F4FA]"
                  />
                  <div className="flex flex-col justify-center gap-2">
                    <p className="text-base font-semibold text-[#0B1929]">{meal.name}</p>
                    <p className="text-xs text-[#6B7A8D]">{meal.portion}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 bg-[#E8F1FB] px-2 py-1 rounded">
                        <Flame size={11} className="text-[#1A6FD4]" />
                        <span className="text-xs font-mono font-bold text-[#1A6FD4]">{meal.kcal} kcal</span>
                      </div>
                      <div className="flex items-center gap-1 bg-[#F0FDF4] px-2 py-1 rounded">
                        <Apple size={11} className="text-green-500" />
                        <span className="text-xs font-mono text-green-600">Saludable</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
