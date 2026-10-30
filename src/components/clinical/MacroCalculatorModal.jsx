import { useState, useEffect, useMemo } from "react";
import { CustomSelect } from "../ui/CustomSelect";
import { X, Calculator, Check, Flame, Sparkles, RotateCcw, Target } from "lucide-react";
import {
  TMB_FORMULAS,
  ACTIVITY_FACTORS,
  GOAL_PRESETS,
  calculateEnergyPrescription,
  calcEdadFromBirthdate,
  normalizeSexo,
  enrichMetrica,
  prepareMetricaPayload,
  calculateBodyComposition,
  generateSmartMacroPrescription,
} from "../../lib/bodyComposition";
import { dbPatch, updateQueryCache } from "../../lib/supabase";

export default function MacroCalculatorModal({
  isOpen,
  onClose,
  cliente,
  latestMetrica = null,
  clinicalRec = null,
  cicloNombre = "",
  onApplyMacros, // ({ calorias, proteinas, carbohidratos, grasas }) => void
}) {
  const enriched = useMemo(
    () => (latestMetrica ? enrichMetrica(latestMetrica) : null),
    [latestMetrica]
  );

  const smartDefault = useMemo(
    () =>
      generateSmartMacroPrescription({
        cliente,
        metrica: enriched,
        clinicalRec,
        cicloNombre,
      }),
    [cliente, enriched, clinicalRec, cicloNombre]
  );

  const [sexo, setSexo] = useState("M");
  const [edad, setEdad] = useState(25);
  const [peso, setPeso] = useState("");
  const [estatura, setEstatura] = useState("");
  const [mlg, setMlg] = useState("");
  const [biaBmr, setBiaBmr] = useState("");

  const [formula, setFormula] = useState("mifflin");
  const [faf, setFaf] = useState(1.55);
  const [goalPct, setGoalPct] = useState(0);
  const [customKcal, setCustomKcal] = useState("");

  const [mode, setMode] = useState("g_kg"); // 'g_kg' | 'pct'
  const [protGKg, setProtGKg] = useState(2.0);
  const [fatGKg, setFatGKg] = useState(0.9);
  const [protPct, setProtPct] = useState(30);
  const [carbPct, setCarbPct] = useState(45);
  const [fatPct, setFatPct] = useState(25);

  const applySmartDefaults = () => {
    const s = smartDefault.sexo || normalizeSexo(cliente?.genero || cliente?.sexo || "M");
    const e = smartDefault.edad || calcEdadFromBirthdate(cliente?.fecha_nacimiento, 25);
    const p = enriched?.peso || cliente?.peso || "";
    const h = enriched?.estatura || cliente?.estatura || "";
    const ffm = enriched?.masa_libre_grasa || (smartDefault.mlg > 0 ? smartDefault.mlg : "");
    const bmr = enriched?.inbody_bmr || "";

    setSexo(s);
    setEdad(e);
    setPeso(p ? String(p) : "");
    setEstatura(h ? String(h) : "");
    setMlg(ffm ? String(ffm) : "");
    setBiaBmr(bmr ? String(bmr) : "");

    setFormula(smartDefault.formula || (ffm && Number(ffm) > 0 ? "katch" : "mifflin"));
    setFaf(smartDefault.faf || 1.55);
    setGoalPct(smartDefault.goalPct ?? 0);
    setCustomKcal("");
    setMode("g_kg");
    setProtGKg(smartDefault.protGKg || 2.0);
    setFatGKg(smartDefault.fatGKg || 0.9);
  };

  useEffect(() => {
    if (!isOpen) return;
    applySmartDefaults();
  }, [isOpen, cliente?.id, enriched?.id]);

  const prescription = useMemo(
    () =>
      calculateEnergyPrescription({
        formula,
        peso,
        estatura,
        edad,
        sexo,
        mlg,
        biaBmr,
        faf,
        goalPct,
        customKcal,
        mode,
        protGKg,
        fatGKg,
        protPct,
        carbPct,
        fatPct,
      }),
    [
      formula,
      peso,
      estatura,
      edad,
      sexo,
      mlg,
      biaBmr,
      faf,
      goalPct,
      customKcal,
      mode,
      protGKg,
      fatGKg,
      protPct,
      carbPct,
      fatPct,
    ]
  );

  if (!isOpen) return null;

  const handleApply = async () => {
    // 1. Sincronizar peso en el perfil del paciente si cambió
    if (cliente?.id) {
      const patch = {};
      if (peso && Number(peso) > 0 && Number(cliente.peso) !== Number(peso)) {
        patch.peso = Number(peso);
      }
      if (Object.keys(patch).length > 0) {
        dbPatch(`clientes?id=eq.${cliente.id}`, patch).catch(() => {});
      }
    }

    // 2. Sincronizar objetivo de la etapa (eval_objetivo) y FAF (eval_faf) de vuelta a la evaluación activa si cambió
    if (enriched?.id && !String(enriched.id).startsWith("temp_")) {
      const matchedGoal = GOAL_PRESETS.find((g) => g.pct === Number(goalPct));
      const nextGoalId = matchedGoal ? matchedGoal.id : (enriched.eval_objetivo || "maint");
      const nextFafStr = String(faf);
      const nextPeso = peso && Number(peso) > 0 ? Number(peso) : enriched.peso;
      const nextEstatura = estatura && Number(estatura) > 0 ? Number(estatura) : enriched.estatura;

      const updatedRaw = {
        ...enriched,
        peso: nextPeso,
        estatura: nextEstatura,
        eval_objetivo: nextGoalId,
        eval_faf: nextFafStr,
        evalSexo: sexo,
        evalEdad: edad,
      };
      const calc = calculateBodyComposition(updatedRaw, sexo, edad);
      const payload = prepareMetricaPayload(updatedRaw, calc);
      dbPatch(`metricas_progreso?id=eq.${enriched.id}`, payload)
        .then(() => {
          updateQueryCache("metricas_progreso", (list) => {
            if (!Array.isArray(list)) return list;
            return list.map((m) => (String(m.id) === String(enriched.id) ? { ...m, ...payload } : m));
          });
          if (typeof window !== "undefined" && cliente?.id) {
            window.dispatchEvent(
              new CustomEvent("flux:metricas-updated", {
                detail: { clienteId: cliente.id, source: "MacroCalculatorModal" },
              })
            );
          }
        })
        .catch(() => {});
    }

    if (onApplyMacros && prescription.targetKcal > 0) {
      onApplyMacros({
        calorias: prescription.targetKcal,
        proteinas: prescription.proteinasG,
        carbohidratos: prescription.carbohidratosG,
        grasas: prescription.grasasG,
      });
    }
    onClose();
  };

  const pctSum =
    (Number(protPct) || 0) + (Number(carbPct) || 0) + (Number(fatPct) || 0);

  return (
    <div className="fixed inset-0 z-[110] bg-[#0B1929]/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#0B1929]">
                  Simulador & Prescripción Energética IA
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F0F4FA] text-[#6B7A8D]">
                  {sexo === "F" ? "Mujer" : "Hombre"} · {edad} años
                </span>
              </div>
              {cliente?.nombre && (
                <p className="text-xs text-[#6B7A8D] truncate">
                  {cliente.nombre} {enriched?.fecha ? `· Alimentado por evaluación (${enriched.fecha.split("T")[0]})` : "· Alimentado por perfil clínico"}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7A8D] hover:text-[#0B1929] hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Banner de Diagnóstico y Sugerencia IA */}
          {smartDefault.hasEnoughData && (
            <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-emerald-50/50 border border-indigo-100 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Criterio Automático IA ({smartDefault.goalInfo?.title} · FAF {smartDefault.faf})</span>
                </div>
                <p className="text-[11px] text-[#6B7A8D] leading-relaxed">
                  {smartDefault.rationale}
                </p>
              </div>
              <button
                type="button"
                onClick={applySmartDefaults}
                className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer shadow-2xs transition-colors"
                title="Restaurar los parámetros calculados automáticamente por la IA"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sugerencia IA</span>
              </button>
            </div>
          )}

          {/* 1. Datos antropométricos base enlazados a la evaluación */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase mb-1">
                Edad (años)
              </label>
              <input
                type="number"
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase mb-1">
                Peso Eval. (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="70"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#6B7A8D] uppercase mb-1">
                Estatura (cm)
              </label>
              <input
                type="number"
                step="0.5"
                value={estatura}
                onChange={(e) => setEstatura(e.target.value)}
                placeholder="170"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-bold text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-1">
                MLG Magra (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={mlg}
                onChange={(e) => setMlg(e.target.value)}
                placeholder="Auto eval."
                className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-3 py-2 text-sm font-bold text-emerald-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 2. Fórmula TMB y Factor de Actividad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#0B1929] mb-1.5">
                Ecuación TMB
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {TMB_FORMULAS.map((f) => {
                  const disabled = f.requiresMLG && (!mlg || Number(mlg) <= 0);
                  const active = formula === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setFormula(f.id)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-bold border text-left transition-colors cursor-pointer ${
                        active
                          ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                          : disabled
                          ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                          : "bg-[#F8FAFC] text-[#0B1929] border-[#E2E8F0] hover:bg-gray-100"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
                {biaBmr && Number(biaBmr) > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormula("bia")}
                    className={`col-span-2 px-2.5 py-2 rounded-xl text-xs font-bold border text-left transition-colors cursor-pointer ${
                      formula === "bia"
                        ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]"
                        : "bg-[#F8FAFC] text-[#0B1929] border-[#E2E8F0]"
                    }`}
                  >
                    BMR Bioimpedancia ({biaBmr} kcal)
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0B1929] mb-1.5">
                Factor de Actividad (FAF)
              </label>
              <CustomSelect
                value={faf}
                onChange={(val) => setFaf(Number(val))}
                options={ACTIVITY_FACTORS.map((af) => ({
                  value: af.value,
                  label: `${af.short} — ${af.label}`,
                }))}
              />

              <label className="block text-xs font-bold text-[#0B1929] mt-3 mb-1.5">
                Objetivo Energético
              </label>
              <div className="flex gap-1 flex-wrap">
                {GOAL_PRESETS.map((g) => {
                  const active = !customKcal && goalPct === g.pct;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setCustomKcal("");
                        setGoalPct(g.pct);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#0B1929] text-white border-[#0B1929]"
                          : "bg-[#F8FAFC] text-[#6B7A8D] border-[#E2E8F0] hover:text-[#0B1929]"
                      }`}
                    >
                      {g.pct === 0
                        ? "Mant."
                        : `${g.pct > 0 ? "+" : ""}${g.pct}%`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Barra de resultados energéticos TMB -> GET -> Meta */}
          <div className="grid grid-cols-3 gap-3 bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0]">
            <div>
              <div className="text-[11px] font-bold text-[#6B7A8D] uppercase">
                TMB Basal
              </div>
              <div className="text-xl font-black text-[#0B1929] font-['Rajdhani']">
                {prescription.tmb || "—"}{" "}
                <span className="text-xs font-normal text-[#6B7A8D]">kcal</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#6B7A8D] uppercase">
                GET Mantenimiento
              </div>
              <div className="text-xl font-black text-[#0B1929] font-['Rajdhani']">
                {prescription.get || "—"}{" "}
                <span className="text-xs font-normal text-[#6B7A8D]">kcal</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-[var(--brand-primary)] uppercase flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Kcal Meta
              </div>
              <input
                type="number"
                value={customKcal !== "" ? customKcal : prescription.targetKcal || ""}
                onChange={(e) => setCustomKcal(e.target.value)}
                placeholder="2000"
                className="w-full bg-white border border-[var(--brand-primary)]/40 rounded-lg px-2.5 py-1 text-lg font-black text-[var(--brand-primary)] font-['Rajdhani'] focus:outline-none"
              />
            </div>
          </div>

          {/* 4. Distribución de Macronutrientes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                Distribución de Macronutrientes
              </span>
              <div className="flex bg-[#F0F4FA] rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setMode("g_kg")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    mode === "g_kg"
                      ? "bg-white text-[#0B1929] shadow-sm"
                      : "text-[#6B7A8D]"
                  }`}
                >
                  g / kg peso
                </button>
                <button
                  type="button"
                  onClick={() => setMode("pct")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    mode === "pct"
                      ? "bg-white text-[#0B1929] shadow-sm"
                      : "text-[#6B7A8D]"
                  }`}
                >
                  % Calorías
                </button>
              </div>
            </div>

            {mode === "g_kg" ? (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="flex justify-between text-xs font-bold text-[#0B1929] mb-1.5">
                    <span>Proteína (g/kg)</span>
                    <span className="text-[var(--brand-primary)]">
                      {protGKg} g/kg
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.2"
                    step="0.1"
                    value={protGKg}
                    onChange={(e) => setProtGKg(Number(e.target.value))}
                    className="w-full accent-[var(--brand-primary)]"
                  />
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                  <div className="flex justify-between text-xs font-bold text-[#0B1929] mb-1.5">
                    <span>Grasas (g/kg)</span>
                    <span className="text-amber-600">{fatGKg} g/kg</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={fatGKg}
                    onChange={(e) => setFatGKg(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7A8D] mb-1">
                    % Proteína
                  </label>
                  <input
                    type="number"
                    value={protPct}
                    onChange={(e) => setProtPct(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm font-bold text-[#0B1929]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7A8D] mb-1">
                    % Carbohidratos
                  </label>
                  <input
                    type="number"
                    value={carbPct}
                    onChange={(e) => setCarbPct(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm font-bold text-[#0B1929]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7A8D] mb-1">
                    % Grasas {pctSum !== 100 && `(${pctSum}%)`}
                  </label>
                  <input
                    type="number"
                    value={fatPct}
                    onChange={(e) => setFatPct(Number(e.target.value))}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm font-bold text-[#0B1929]"
                  />
                </div>
              </div>
            )}

            {/* Tarjetas resultado final de Macros */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-center">
                <div className="text-[11px] font-bold text-blue-700 uppercase">
                  Proteínas
                </div>
                <div className="text-xl font-black text-[#0B1929] font-['Rajdhani']">
                  {prescription.proteinasG}g
                </div>
                <div className="text-[11px] text-[#6B7A8D] font-semibold">
                  {prescription.protGKg} g/kg · {prescription.protPct}%
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-[11px] font-bold text-emerald-700 uppercase">
                  Carbohidratos
                </div>
                <div className="text-xl font-black text-[#0B1929] font-['Rajdhani']">
                  {prescription.carbohidratosG}g
                </div>
                <div className="text-[11px] text-[#6B7A8D] font-semibold">
                  {prescription.carbGKg} g/kg · {prescription.carbPct}%
                </div>
              </div>

              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-center">
                <div className="text-[11px] font-bold text-amber-700 uppercase">
                  Grasas
                </div>
                <div className="text-xl font-black text-[#0B1929] font-['Rajdhani']">
                  {prescription.grasasG}g
                </div>
                <div className="text-[11px] text-[#6B7A8D] font-semibold">
                  {prescription.fatGKg} g/kg · {prescription.fatPct}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#6B7A8D] hover:bg-gray-50 cursor-pointer"
          >
            Cancelar
          </button>
          {onApplyMacros && (
            <button
              type="button"
              disabled={prescription.targetKcal <= 0}
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Aplicar al plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
