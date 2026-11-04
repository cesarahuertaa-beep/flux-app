import { useBrand } from "../BrandContext";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Users, AlertCircle, CheckCircle2, XCircle, Folder, MessageCircle, Mail, 
  Loader2, Circle, CircleDashed, Trash2, Crown, ChevronRight, ArrowLeft, 
  Check, Shield, Plus, Briefcase, Lock, UserCheck, Sliders, Edit2,
  CalendarDays, ShoppingBag, Banknote, Activity, UtensilsCrossed, Dumbbell, Camera, UsersRound,
  Copy, DollarSign, Wallet, CreditCard, ChevronDown, Calendar, Send, Clock, Search, X
} from "lucide-react";
import { 
  authInvite, authResetPassword, dbPeek, dbGet, dbGetFresh, dbPost, 
  dbPatch, getProfileId, updateQueryCache, invalidateCache, syncPersonalData 
} from "../../lib/supabase";
import { useBackButton } from "../../lib/backButtonHandler";
import { getLatestConfiguredRates } from "../../utils/tarifas";
import { CustomSelect } from "../ui/CustomSelect";
import { checkAndCleanOrphanedEmail, deleteCollaboratorAccount } from "../../lib/authRoles";

// ─── TODAS LAS PESTAÑAS DISPONIBLES DE SUPERADMIN ────────────────────────────
export const SUPERADMIN_TABS = [
  { id: "clientes",         nombre: "Directorio",          desc: "Especialistas, atletas y pacientes", icon: "Users" },
  { id: "agenda",           nombre: "Agenda",              desc: "Citas y disponibilidad médica", icon: "CalendarDays" },
  { id: "equipo",           nombre: "Mi Equipo",           desc: "Gestión de colaboradores y roles", icon: "UsersRound" },
  { id: "aprobaciones",     nombre: "Aprobaciones",        desc: "Solicitudes de registro profesional", icon: "UserCheck" },
  { id: "biblioteca",       nombre: "Biblioteca",          desc: "Catálogo de ejercicios y movimientos", icon: "Folder" },
  { id: "tienda",           nombre: "Tienda Oficial",      desc: "Productos, ropa y suplementos", icon: "ShoppingBag" },
  { id: "pagos",            nombre: "Control de Ingresos", desc: "Auditoría financiera y suscripciones", icon: "Banknote" },
  { id: "mi_entrenamiento", nombre: "Mi Plan",             desc: "Plan personal de salud y bienestar", icon: "Activity" },
  { id: "nutricion",        nombre: "Nutrición",           desc: "Prescripción y comidas", icon: "UtensilsCrossed" },
  { id: "entrenamiento",    nombre: "Entrenamiento",       desc: "Rutinas y series de ejercicios", icon: "Dumbbell" },
  { id: "progreso_atleta",  nombre: "Progreso",            desc: "Fotografías corporales y evolución", icon: "Camera" },
];

// ─── ROLES PREDETERMINADOS CORPORATIVOS (FLUX STAFF) ─────────────────────────
export const DEFAULT_STAFF_ROLES = [
  {
    id: "staff_general",
    nombre: "Staff Corporativo (General)",
    departamento: "Operaciones",
    descripcion: "Acceso estándar a operaciones diarias, directorio general, biblioteca y tienda.",
    modulos: ["clientes", "biblioteca", "tienda"],
    colorBadge: "bg-blue-50 text-blue-700 border-blue-200"
  },
  {
    id: "staff_ventas",
    nombre: "Ventas y Afiliaciones",
    departamento: "Comercial",
    descripcion: "Prospección, validación de solicitudes profesionales de especialistas y tienda.",
    modulos: ["clientes", "aprobaciones", "tienda"],
    colorBadge: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    id: "staff_finanzas",
    nombre: "Finanzas y Liquidaciones",
    departamento: "Administración",
    descripcion: "Auditoría financiera, control de recibos, tarifas vigentes y comisiones.",
    modulos: ["pagos", "clientes"],
    colorBadge: "bg-purple-50 text-purple-700 border-purple-200"
  },
  {
    id: "staff_marketing",
    nombre: "Marketing y Catálogo",
    departamento: "Marketing",
    descripcion: "Gestión de catálogo de suplementos, promociones de tienda y biblioteca visual.",
    modulos: ["tienda", "biblioteca"],
    colorBadge: "bg-amber-50 text-amber-700 border-amber-200"
  },
  {
    id: "staff_soporte",
    nombre: "Soporte y Operaciones",
    departamento: "Atención a Usuarios",
    descripcion: "Resolución de incidencias, altas asistidas y validación de especialistas.",
    modulos: ["clientes", "aprobaciones"],
    colorBadge: "bg-cyan-50 text-cyan-700 border-cyan-200"
  }
];

const ROLES_STORAGE_KEY = "flux_staff_roles_v4";
const COMPENSACIONES_STORAGE_KEY = "flux_staff_compensaciones_v1";

const DEFAULT_COMP = {
  modalidad: "solo_comision",
  sueldoBase: 0,
  comisionPct: 35,
  bonoFijo: 0,
  banco: "",
  clabe: "",
  titular: "",
  notas: ""
};

const loadCompensaciones = () => {
  try {
    const raw = localStorage.getItem(COMPENSACIONES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

const saveCompensaciones = (data) => {
  try {
    localStorage.setItem(COMPENSACIONES_STORAGE_KEY, JSON.stringify(data));
  } catch {}
};

const formatMesNomina = (yyyyMm) => {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split('-');
  if (!y || !m) return yyyyMm;
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
};

// Renderizador visual del icono de cada pestaña
function TabIcon({ id, size = 15, className = "" }) {
  switch (id) {
    case "clientes": return <Users size={size} className={className} />;
    case "agenda": return <CalendarDays size={size} className={className} />;
    case "equipo": return <UsersRound size={size} className={className} />;
    case "aprobaciones": return <UserCheck size={size} className={className} />;
    case "biblioteca": return <Folder size={size} className={className} />;
    case "tienda": return <ShoppingBag size={size} className={className} />;
    case "pagos": return <Banknote size={size} className={className} />;
    case "mi_entrenamiento": return <Activity size={size} className={className} />;
    case "nutricion": return <UtensilsCrossed size={size} className={className} />;
    case "entrenamiento": return <Dumbbell size={size} className={className} />;
    case "progreso_atleta": return <Camera size={size} className={className} />;
    default: return <Circle size={size} className={className} />;
  }
}

// ─── Componente Principal GestionEquipo ──────────────────────────────────────
export function GestionEquipo({ setMsg, profileId, isSuperadmin, role }) {
  const myId = profileId || getProfileId();
  const _peekRows = dbPeek("profiles?select=id,nombre,email,telefono,activo,role,nutriologo_id,especialidad&order=nombre.asc");
  const [equipo, setEquipo]         = useState(() =>
    Array.isArray(_peekRows)
      ? _peekRows.filter(r => (r.role === "administrativo" && r.nutriologo_id === myId) || (isSuperadmin && r.role === "staff"))
      : []
  );
  const [loading, setLoading]       = useState(() => _peekRows === null);
  const hasLoadedRef                = useRef(_peekRows !== null);

  // Subpestañas principales (Superadmin): 'colaboradores' | 'roles'
  const [activeSubTab, setActiveSubTab] = useState("colaboradores");
  const [roleFilter, setRoleFilter]     = useState("todos");

  // Edición Inline de Colaborador (Al hacer clic en la tarjeta)
  const [editUser, setEditUser]     = useState(null);
  const [editForm, setEditForm]     = useState({ nombre: "", telefono: "", roleAssigned: "staff_general" });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Invitación
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState("staff_general");
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ nombre: "", email: "", telefono: "" });
  
  // Interceptor State
  const [conflictUser, setConflictUser] = useState(null);

  // Premium patrocinado (administrativos)
  const isEstudiante = role === "nutriologo_estudiante";
  const [patrocinios, setPatrocinios] = useState({}); // miembro_profile_id -> registro activo
  const [tarifaAdmin, setTarifaAdmin] = useState(50);
  const [confirmPremium, setConfirmPremium] = useState(null); // { miembro, activar }

  // ─── ROLES Y PERMISOS EDITABLES Y GENERADOR ────────────────────────────────
  const [allStaffRoles, setAllStaffRoles] = useState(() => {
    try {
      const saved = localStorage.getItem(ROLES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_STAFF_ROLES;
  });

  // ─── ESQUEMA DE COMPENSACIÓN (MOTOR DE NÓMINAS) ────────────────────────────
  const [compensaciones, setCompensaciones] = useState(() => loadCompensaciones());
  const [editComp, setEditComp]             = useState(DEFAULT_COMP);

  // ─── ESTADO NÓMINAS Y PAGOS (SUPERADMIN) ──────────────────────────────────
  const [nominasRecibos, setNominasRecibos]         = useState([]);
  const [nominasNutris, setNominasNutris]           = useState({});
  const [nominasDb, setNominasDb]                   = useState({});
  const [loadingNominas, setLoadingNominas]         = useState(false);
  const [filtroMesNomina, setFiltroMesNomina]       = useState("");
  const [filtroEstadoNomina, setFiltroEstadoNomina] = useState("todos");
  const [busquedaNomina, setBusquedaNomina]         = useState("");
  const [copiedClabeId, setCopiedClabeId]           = useState(null);
  const [transferringColab, setTransferringColab]   = useState(null);

  // Modal para editar permisos/pestañas de un rol existente
  const [editingRole, setEditingRole] = useState(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(false);
  const [editingRoleForm, setEditingRoleForm] = useState({
    nombre: "",
    departamento: "",
    descripcion: "",
    modulos: []
  });

  // Modal para crear un nuevo rol
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    nombre: "",
    departamento: "",
    descripcion: "",
    modulos: ["clientes", "tienda", "biblioteca"]
  });

  // Manejador de botón atrás (Capacitor y navegador)
  useBackButton(!!showConfirmDelete, () => { setShowConfirmDelete(false); setConfirmDeleteText(""); }, 50);
  useBackButton(!!confirmDeleteRole, () => setConfirmDeleteRole(false), 45);
  useBackButton(!!editingRole, () => { setEditingRole(null); setConfirmDeleteRole(false); }, 40);
  useBackButton(!!showNewRoleModal, () => setShowNewRoleModal(false), 35);
  useBackButton(!!conflictUser, () => setConflictUser(null), 30);
  useBackButton(!!confirmPremium, () => setConfirmPremium(null), 25);
  useBackButton(showInvite, () => setShowInvite(false), 20);
  useBackButton(!!editUser, () => { setEditUser(null); setShowConfirmDelete(false); setConfirmDeleteText(""); }, 15);

  const deletingColabIdsRef = useRef(new Set());

  const load = useCallback(async ({ forceFresh = false } = {}) => {
    if (!hasLoadedRef.current) setLoading(true);
    const fetcher = forceFresh ? dbGetFresh : dbGet;
    try {
      const rows = await fetcher(`profiles?select=id,nombre,email,telefono,activo,role,nutriologo_id,especialidad&order=nombre.asc`);
      const myTeam = (rows || []).filter(r => 
        !deletingColabIdsRef.current.has(r.id) &&
        ((r.role === "administrativo" && r.nutriologo_id === myId) || 
        (isSuperadmin && r.role === "staff"))
      );
      setEquipo(myTeam);

      // Patrocinios premium activos + tarifa vigente (solo aplica a nutriólogos)
      if (!isSuperadmin) {
        try {
          const [pats, cfg] = await Promise.all([
            fetcher(`premium_patrocinado?patrocinador_id=eq.${myId}&desactivado_en=is.null`),
            fetcher("configuracion_plataforma?id=eq.1")
          ]);
          const m = {};
          (pats || []).forEach(x => { m[x.miembro_profile_id] = x; });
          setPatrocinios(m);
          if (cfg && cfg.length > 0) setTarifaAdmin(getLatestConfiguredRates(cfg[0]).admin_premium);
        } catch { }
      }
    } catch { }
    hasLoadedRef.current = true;
    setLoading(false);
  }, [myId, isSuperadmin]);

  const loadNominasData = useCallback(async () => {
    if (!isSuperadmin) return;
    setLoadingNominas(true);
    try {
      const [recibos, nutris, nominas] = await Promise.all([
        dbGet("recibos_pago?order=created_at.desc"),
        dbGet("profiles?role=in.(nutriologo,nutriologo_estudiante)&select=id,nombre,creado_por_nombre"),
        dbGet("nomina_colaboradores")
      ]);
      setNominasRecibos(recibos || []);
      const nMap = {};
      (nutris || []).forEach(n => { nMap[n.id] = n; });
      setNominasNutris(nMap);
      const nomMap = {};
      (nominas || []).forEach(nom => {
        nomMap[`${nom.colaborador_nombre}|${nom.mes_facturacion}`] = nom;
      });
      setNominasDb(nomMap);
    } catch (err) {
      console.error("Error cargando nóminas:", err);
    }
    setLoadingNominas(false);
  }, [isSuperadmin]);

  useEffect(() => {
    load();
    if (isSuperadmin) loadNominasData();

    let timer = null;
    const onCacheUpdated = (ev) => {
      if (deletingColabIdsRef.current.size > 0) return;
      const table = ev?.detail?.table;
      if (table && !["profiles", "nomina_colaboradores", "recibos_pago", "*"].includes(table)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (deletingColabIdsRef.current.size === 0) {
          load();
          if (isSuperadmin) loadNominasData();
        }
      }, 250);
    };
    window.addEventListener("flux:cache-updated", onCacheUpdated);
    window.addEventListener("flux:synced", onCacheUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("flux:cache-updated", onCacheUpdated);
      window.removeEventListener("flux:synced", onCacheUpdated);
    };
  }, [load, loadNominasData, isSuperadmin]);

  // ─── LÓGICA Y CÁLCULO DE NÓMINAS Y LIQUIDACIONES (SUPERADMIN) ─────────────
  const mesesNominasDisponibles = useMemo(() => {
    const setMeses = new Set();
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    setMeses.add(currentMonthStr);
    nominasRecibos.forEach(r => {
      if (r.fecha_corte_mes) setMeses.add(r.fecha_corte_mes.substring(0, 7));
    });
    Object.values(nominasDb).forEach(n => {
      if (n.mes_facturacion) setMeses.add(n.mes_facturacion);
    });
    return Array.from(setMeses).sort().reverse();
  }, [nominasRecibos, nominasDb]);

  useEffect(() => {
    if (!filtroMesNomina && mesesNominasDisponibles.length > 0) {
      const now = new Date();
      // Si estamos antes del corte del día 10 del mes, el periodo 100% cobrado y listo para conciliar es el mes anterior
      if (now.getDate() < 11 && mesesNominasDisponibles.length > 1) {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
        if (mesesNominasDisponibles.includes(prevMonthStr)) {
          setFiltroMesNomina(prevMonthStr);
          return;
        }
      }
      setFiltroMesNomina(mesesNominasDisponibles[0]);
    }
  }, [mesesNominasDisponibles, filtroMesNomina]);

  const nominasColabsCalculados = useMemo(() => {
    if (!isSuperadmin) return [];
    const staffMembers = equipo.filter(c => c.role === "staff");
    const mes = filtroMesNomina || new Date().toISOString().substring(0, 7);

    return staffMembers.map(colab => {
      const comp = compensaciones[colab.id] || DEFAULT_COMP;
      const modalidad = comp.modalidad || "solo_comision";
      const sueldoBase = Number(comp.sueldoBase) || 0;
      const comisionPct = comp.comisionPct != null ? Number(comp.comisionPct) : 35;
      const bonoFijo = Number(comp.bonoFijo) || 0;

      // Nutriólogos asignados a este colaborador
      const nutrisAsignados = Object.values(nominasNutris).filter(n => 
        (n.creado_por_nombre || "").trim().toLowerCase() === (colab.nombre || "").trim().toLowerCase()
      );
      const nutriIds = new Set(nutrisAsignados.map(n => n.id));

      // Recibos aprobados del mes
      const recibosAprobadosMes = nominasRecibos.filter(r => {
        const isNutri = nutriIds.has(r.nutriologo_id);
        const isAprobado = r.estado === "aprobado";
        const isMes = r.fecha_corte_mes && r.fecha_corte_mes.startsWith(mes);
        return isNutri && isAprobado && isMes;
      });

      const totalVentasNutris = recibosAprobadosMes.reduce((acc, r) => {
        return acc + Math.max(0, (Number(r.monto) || 0) - (Number(r.monto_admin_premium) || 0));
      }, 0);

      const tieneComision = modalidad === "solo_comision" || modalidad === "mixto";
      const tieneSueldo = modalidad === "sueldo_fijo" || modalidad === "mixto" || modalidad === "honorarios";

      const sueldoMonto = tieneSueldo ? sueldoBase : 0;
      const comisionMonto = tieneComision ? (totalVentasNutris * (comisionPct / 100)) : 0;
      const bonoMonto = bonoFijo;
      const totalCalculado = sueldoMonto + comisionMonto + bonoMonto;

      // Estado en BD
      const dbKey = `${colab.nombre}|${mes}`;
      const dbRecord = nominasDb[dbKey];
      const isTransferido = !!dbRecord?.transferido_por_admin;
      const isConfirmado = !!dbRecord?.confirmado_por_colaborador;
      const fechaConfirmacion = dbRecord?.fecha_confirmacion;
      const montoFinal = (isTransferido && dbRecord?.monto != null) ? Number(dbRecord.monto) : totalCalculado;

      let estadoNomina = "pendiente";
      if (isConfirmado) estadoNomina = "firmado";
      else if (isTransferido) estadoNomina = "transferido";

      return {
        colab,
        comp,
        nutrisAsignados,
        totalVentasNutris,
        recibosCount: recibosAprobadosMes.length,
        sueldoMonto,
        comisionMonto,
        bonoMonto,
        totalCalculado,
        montoFinal,
        isTransferido,
        isConfirmado,
        fechaConfirmacion,
        dbRecord,
        estadoNomina
      };
    });
  }, [isSuperadmin, equipo, filtroMesNomina, compensaciones, nominasNutris, nominasRecibos, nominasDb]);

  const kpisNomina = useMemo(() => {
    // Solo consideramos colaboradores con balance positivo (>0) o que ya hayan sido transferidos/firmados
    const conMonto = nominasColabsCalculados.filter(c => c.montoFinal > 0 || c.isTransferido);
    return {
      totalNeto: conMonto.reduce((acc, c) => acc + c.montoFinal, 0),
      totalSueldos: conMonto.reduce((acc, c) => acc + c.sueldoMonto, 0),
      totalComisiones: conMonto.reduce((acc, c) => acc + c.comisionMonto, 0),
      totalBonos: conMonto.reduce((acc, c) => acc + c.bonoMonto, 0),
      pendientes: conMonto.filter(c => c.estadoNomina === "pendiente").length,
      transferidos: conMonto.filter(c => c.estadoNomina === "transferido").length,
      firmados: conMonto.filter(c => c.estadoNomina === "firmado").length,
      totalVisibles: conMonto.length
    };
  }, [nominasColabsCalculados]);

  const nominasFiltradas = useMemo(() => {
    return nominasColabsCalculados.filter(c => {
      // Si el pago es $0 y no tiene transferencia registrada, no mostrar
      if (c.montoFinal <= 0 && !c.isTransferido) return false;

      const matchEstado = filtroEstadoNomina === "todos" ? true : c.estadoNomina === filtroEstadoNomina;
      const matchBusqueda = !busquedaNomina.trim() ? true : (
        (c.colab.nombre || "").toLowerCase().includes(busquedaNomina.toLowerCase()) ||
        (c.colab.email || "").toLowerCase().includes(busquedaNomina.toLowerCase())
      );
      return matchEstado && matchBusqueda;
    });
  }, [nominasColabsCalculados, filtroEstadoNomina, busquedaNomina]);

  const handleTransferirNomina = async (colabNombre, monto) => {
    try {
      setTransferringColab(colabNombre);
      const mes = filtroMesNomina || new Date().toISOString().substring(0, 7);
      const key = `${colabNombre}|${mes}`;
      const existing = nominasDb[key];
      if (existing) {
        await dbPatch(`nomina_colaboradores?id=eq.${existing.id}`, {
          transferido_por_admin: true,
          monto: Number(monto)
        });
      } else {
        await dbPost("nomina_colaboradores", {
          colaborador_nombre: colabNombre,
          mes_facturacion: mes,
          monto: Number(monto),
          transferido_por_admin: true
        });
      }
      setMsg(`✓ Transferencia de $${Number(monto).toFixed(2)} MXN registrada para ${colabNombre}.`);
      await loadNominasData();
    } catch (e) {
      setMsg("❌ Error registrando transferencia: " + e.message);
    }
    setTransferringColab(null);
  };

  const handleRevertirTransferencia = async (existingId, colabNombre) => {
    if (!existingId) return;
    try {
      await dbPatch(`nomina_colaboradores?id=eq.${existingId}`, {
        transferido_por_admin: false,
        confirmado_por_colaborador: false,
        fecha_confirmacion: null
      });
      setMsg(`✓ Transferencia revertida a pendiente para ${colabNombre}`);
      await loadNominasData();
    } catch (e) {
      setMsg("❌ Error: " + e.message);
    }
  };

  const handleCopyClabe = (clabe, colabId) => {
    if (!clabe) {
      setMsg("⚠️ No hay cuenta CLABE configurada para este colaborador.");
      return;
    }
    navigator.clipboard.writeText(clabe);
    setCopiedClabeId(colabId);
    setMsg("✓ CLABE copiada: " + clabe);
    setTimeout(() => setCopiedClabeId(null), 2500);
  };

  const getRoleInfo = (roleKey) => {
    return allStaffRoles.find(r => r.id === roleKey) || allStaffRoles[0] || DEFAULT_STAFF_ROLES[0];
  };

  // Opciones de filtro por rol (homologado con Agenda)
  const roleFilters = useMemo(() => {
    if (!isSuperadmin) {
      return [
        ["todos", `Todos (${equipo.length})`],
        ["activos", `Activos (${equipo.filter(c => c.activo !== false).length})`],
        ["suspendidos", `Suspendidos (${equipo.filter(c => c.activo === false).length})`]
      ];
    }
    return [
      ["todos", `Todos (${equipo.length})`],
      ...allStaffRoles.map(r => {
        const cleanName = r.nombre.replace(" (General)", "");
        const count = equipo.filter(c => (c.especialidad || "staff_general") === r.id).length;
        return [r.id, `${cleanName} (${count})`];
      })
    ];
  }, [isSuperadmin, equipo, allStaffRoles]);

  const filteredEquipo = useMemo(() => {
    if (roleFilter === "todos") return equipo;
    if (isSuperadmin) {
      return equipo.filter(c => (c.especialidad || "staff_general") === roleFilter);
    }
    if (roleFilter === "activos") return equipo.filter(c => c.activo !== false);
    if (roleFilter === "suspendidos") return equipo.filter(c => c.activo === false);
    return equipo;
  }, [equipo, roleFilter, isSuperadmin]);

  // Abrir vista completa de edición al interactuar con la tarjeta del colaborador
  const openEdit = (collaborator) => {
    setEditUser(collaborator);
    setEditForm({
      nombre: collaborator.nombre || "",
      telefono: collaborator.telefono || "",
      roleAssigned: collaborator.especialidad || "staff_general"
    });
    const currentComps = compensaciones || loadCompensaciones();
    const existingComp = currentComps[collaborator.id] || {};
    setEditComp({
      modalidad: existingComp.modalidad || "solo_comision",
      sueldoBase: existingComp.sueldoBase != null ? existingComp.sueldoBase : 0,
      comisionPct: existingComp.comisionPct != null ? existingComp.comisionPct : 35,
      bonoFijo: existingComp.bonoFijo != null ? existingComp.bonoFijo : 0,
      banco: existingComp.banco || "",
      clabe: existingComp.clabe || "",
      titular: existingComp.titular || collaborator.nombre || "",
      notas: existingComp.notas || ""
    });
    setShowConfirmDelete(false);
    setConfirmDeleteText("");
  };

  const closeEdit = () => {
    setEditUser(null);
    setShowConfirmDelete(false);
    setConfirmDeleteText("");
  };

  const invite = async () => {
    const cleanEmail = (form.email || "").trim().toLowerCase();
    const cleanNombre = (form.nombre || "").trim();
    if (!cleanEmail || !cleanNombre) {
      setMsg("⚠️ Nombre y email son obligatorios");
      return;
    }
    if (isEstudiante && equipo.length >= 1) {
      setMsg("⚠️ Como nutriólogo estudiante solo puedes tener 1 administrativo");
      return;
    }
    setSaving(true);
    try {
      const { existingProfiles, existingClientes } = await checkAndCleanOrphanedEmail(cleanEmail);
      
      if (existingProfiles.length > 0 || existingClientes.length > 0) {
        setConflictUser({ 
          profile: existingProfiles[0], 
          cliente: existingClientes[0], 
          email: cleanEmail,
          typedData: { nombre: cleanNombre, telefono: form.telefono }
        });
        setShowInvite(false);
        setSaving(false);
        return;
      }

      const targetRole = isSuperadmin ? "staff" : "administrativo";
      const authUser = await authInvite(cleanEmail, {
        role: targetRole,
        nombre: cleanNombre,
        telefono: form.telefono,
        nutriologo_id: myId
      });
      
      const patchData = {
        nutriologo_id: myId,
        role: targetRole
      };
      if (isSuperadmin) {
        patchData.especialidad = inviteRole;
      }

      await dbPatch(`profiles?id=eq.${authUser.id}`, patchData);

      setMsg(`✅ Invitación enviada — el ${isSuperadmin ? 'colaborador de staff' : 'administrativo'} recibirá un correo para crear su contraseña`);
      setShowInvite(false);
      setForm({ nombre: "", email: "", telefono: "" });
      setTimeout(load, 1000);
    } catch (e) { 
      if (e.message?.includes("already been registered")) {
        try {
          await authResetPassword(cleanEmail);
          setMsg("⚠️ El correo ya existía; se le envió un enlace para configurar su contraseña.");
        } catch {
          setMsg("❌ Este usuario ya tiene cuenta registrada.");
        }
      } else {
        setMsg("❌ " + e.message); 
      }
    }
    setSaving(false);
  };

  const resendCollaboratorAccess = async (emailToSend) => {
    if (!emailToSend) return;
    setSaving(true);
    try {
      await authResetPassword(emailToSend.trim());
      setMsg(`✅ Enlace de acceso enviado a ${emailToSend}`);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  };

  const resolveConflict = async (useNewData) => {
    if (isEstudiante && equipo.length >= 1) {
      setMsg("⚠️ Como nutriólogo estudiante solo puedes tener 1 administrativo");
      setConflictUser(null);
      return;
    }
    setSaving(true);
    try {
      const p = conflictUser.profile;
      const c = conflictUser.cliente;
      const targetId = p?.id || c?.auth_id;
      
      const finalNombre = useNewData ? conflictUser.typedData.nombre : (p?.nombre || c?.nombre || conflictUser.typedData.nombre);
      const finalTelefono = useNewData ? conflictUser.typedData.telefono : (p?.telefono || c?.telefono || conflictUser.typedData.telefono);
      const newRole = isSuperadmin ? "staff" : "administrativo";

      const payload = {
        role: newRole,
        nutriologo_id: myId,
        nombre: finalNombre,
        telefono: finalTelefono,
        activo: true
      };
      if (isSuperadmin) payload.especialidad = inviteRole;

      if (p) {
        await dbPatch(`profiles?id=eq.${p.id}`, payload);
      } else if (targetId) {
        await dbPost("profiles", {
          id: targetId,
          email: conflictUser.email,
          ...payload
        });
      }

      if (c && useNewData) {
        await dbPatch(`clientes?id=eq.${c.id}`, {
          nombre: finalNombre,
          telefono: finalTelefono
        });
      }
      if (useNewData && conflictUser.email) {
        await syncPersonalData(conflictUser.email, { nombre: finalNombre, telefono: finalTelefono }).catch(() => {});
      }

      setMsg(`✅ Permisos otorgados exitosamente. El colaborador podrá acceder de inmediato.`);
      setConflictUser(null);
      setForm({ nombre: "", email: "", telefono: "" });
      load();
    } catch (e) {
      setMsg("❌ Error al otorgar accesos: " + e.message);
    }
    setSaving(false);
  };

  const cambiarPremium = async () => {
    if (!confirmPremium) return;
    const { miembro, activar } = confirmPremium;
    setSaving(true);
    try {
      await dbPost(activar ? "rpc/activar_premium_equipo" : "rpc/desactivar_premium_equipo", { p_miembro: miembro.id });
      setMsg(activar
        ? `✅ ${miembro.nombre || "El administrativo"} ahora tiene cuenta Premium de atleta`
        : `Premium retirado a ${miembro.nombre || "el administrativo"}`);
      setConfirmPremium(null);
      load();
    } catch (e) { setMsg("❌ " + e.message); }
    setSaving(false);
  };

  const toggleActivoFromEdit = async () => {
    if (!editUser) return;
    const nextActivo = !editUser.activo;
    setEditUser(prev => ({ ...prev, activo: nextActivo }));
    setEquipo(prev => prev.map(item => item.id === editUser.id ? { ...item, activo: nextActivo } : item));
    updateQueryCache("profiles", (list) => Array.isArray(list) ? list.map(item => item.id === editUser.id ? { ...item, activo: nextActivo } : item) : list);
    setMsg(nextActivo ? "🟢 Acceso reactivado para este colaborador" : "🔴 Acceso suspendido para este colaborador");
    try {
      await dbPatch(`profiles?id=eq.${editUser.id}`, { activo: nextActivo });
      invalidateCache("profiles");
    } catch (e) {
      setMsg("❌ " + e.message);
      load({ forceFresh: true });
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    const targetId = editUser.id;
    const { nombre, telefono, roleAssigned } = editForm;

    setEquipo(prev => prev.map(item => item.id === targetId ? { 
      ...item, 
      nombre, 
      telefono, 
      especialidad: isSuperadmin ? roleAssigned : item.especialidad 
    } : item));

    if (isSuperadmin) {
      const currentComps = loadCompensaciones();
      currentComps[targetId] = {
        ...editComp,
        titular: editComp.titular || nombre
      };
      saveCompensaciones(currentComps);
      setCompensaciones(currentComps);
    }

    setMsg("✅ Colaborador actualizado con éxito.");
    closeEdit();

    try {
      const patchData = { nombre, telefono };
      if (isSuperadmin && roleAssigned) {
        patchData.especialidad = roleAssigned;
      }
      await dbPatch(`profiles?id=eq.${targetId}`, patchData);
      if (editUser.email) {
        await syncPersonalData(editUser.email, { nombre, telefono }).catch(() => {});
      }
      invalidateCache("profiles");
      load({ forceFresh: true });
    } catch (e) {
      setMsg("❌ " + e.message);
      load({ forceFresh: true });
    }
    setSaving(false);
  };

  const deleteCollaborator = async () => {
    if (confirmDeleteText !== "ELIMINAR" || !editUser) return;
    const targetId = editUser.id;
    const colabEmail = (editUser.email || "").trim();
    const prevEquipo = equipo;

    deletingColabIdsRef.current.add(targetId);
    setEquipo(prev => prev.filter(c => c.id !== targetId));
    closeEdit();
    updateQueryCache("profiles", (list) => Array.isArray(list) ? list.filter(p => p.id !== targetId) : list);
    setMsg("✅ Colaborador eliminado del equipo permanentemente.");

    setSaving(true);
    try {
      await deleteCollaboratorAccount({ profileId: targetId, email: colabEmail });
      deletingColabIdsRef.current.delete(targetId);
      invalidateCache("profiles");
      invalidateCache("clientes");
      await load({ forceFresh: true });
    } catch (e) {
      deletingColabIdsRef.current.delete(targetId);
      setEquipo(prevEquipo);
      setMsg("❌ Error eliminando colaborador: " + e.message);
    }
    setSaving(false);
  };

  // ─── GESTIÓN DE ROLES: EDITAR PESTAÑAS Y CREAR NUEVO ROL ───────────────────
  const openEditRoleModal = (roleItem) => {
    setEditingRole(roleItem);
    setConfirmDeleteRole(false);
    setEditingRoleForm({
      nombre: roleItem.nombre || "",
      departamento: roleItem.departamento || "",
      descripcion: roleItem.descripcion || "",
      modulos: Array.isArray(roleItem.modulos) ? [...roleItem.modulos] : []
    });
  };

  const saveRoleEdit = () => {
    if (!editingRole) return;
    const cleanNombre = (editingRoleForm.nombre || "").trim();
    if (!cleanNombre) {
      setMsg("⚠️ El nombre del rol no puede quedar vacío");
      return;
    }
    const roleId = editingRole.id;
    const updatedList = allStaffRoles.map(r => {
      if (r.id === roleId) {
        return {
          ...r,
          nombre: cleanNombre,
          departamento: editingRoleForm.departamento.trim() || r.departamento || "Corporativo",
          descripcion: editingRoleForm.descripcion.trim() || r.descripcion || "",
          modulos: editingRoleForm.modulos
        };
      }
      return r;
    });

    setAllStaffRoles(updatedList);
    try {
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    setMsg(`✅ Rol "${cleanNombre}" actualizado con éxito.`);
    setEditingRole(null);
    setConfirmDeleteRole(false);
  };

  const handleDeleteRole = (roleId) => {
    const updated = allStaffRoles.filter(r => r.id !== roleId);
    setAllStaffRoles(updated);
    try {
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setMsg("✓ Rol eliminado del catálogo corporativo.");
    setEditingRole(null);
    setConfirmDeleteRole(false);
  };

  const handleCreateCustomRole = () => {
    const cleanNombre = (newRoleForm.nombre || "").trim();
    if (!cleanNombre) {
      setMsg("⚠️ El nombre del rol es obligatorio");
      return;
    }
    const newId = "custom_" + cleanNombre.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString(36);
    const newRole = {
      id: newId,
      nombre: cleanNombre,
      departamento: newRoleForm.departamento.trim() || "Corporativo",
      descripcion: newRoleForm.descripcion.trim() || "Rol personalizado creado por Superadmin",
      modulos: newRoleForm.modulos.length > 0 ? newRoleForm.modulos : ["clientes"],
      colorBadge: "bg-indigo-50 text-indigo-700 border-indigo-200"
    };

    const updated = [...allStaffRoles, newRole];
    setAllStaffRoles(updated);
    try {
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    setMsg(`✅ Rol "${cleanNombre}" creado con éxito.`);
    setShowNewRoleModal(false);
    setNewRoleForm({ nombre: "", departamento: "", descripcion: "", modulos: ["clientes", "tienda", "biblioteca"] });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA SUB-PÁGINA COMPLETA: EDITAR COLABORADOR (REEMPLAZA TODA LA PESTAÑA)
  // ═══════════════════════════════════════════════════════════════════════════
  if (editUser) {
    const assignedRoleInfo = isSuperadmin ? getRoleInfo(editForm.roleAssigned) : null;

    return (
      <div className="flex-1 flex flex-col w-full pb-28 md:pb-12 animate-in fade-in duration-200 px-4 md:px-0">
        {/* Cabecera de la ficha del colaborador */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 mb-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeEdit}
                className="w-10 h-10 rounded-xl bg-[#F0F4FA] hover:bg-[#E2E8F0] text-[#0B1929] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Volver a lista de colaboradores"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg md:text-xl font-bold text-[#0B1929]" style={{ fontFamily: "DM Sans" }}>
                    {editForm.nombre || editUser.nombre || "Colaborador"}
                  </h2>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${editUser.activo !== false ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]' : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]'}`}>
                    {editUser.activo !== false ? <Circle className="w-2.5 h-2.5 fill-current" /> : <CircleDashed className="w-2.5 h-2.5" />}
                    {editUser.activo !== false ? "Activo" : "Suspendido"}
                  </span>
                  {isSuperadmin && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${assignedRoleInfo?.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      <Shield size={12} />
                      {assignedRoleInfo?.nombre || "Staff Corporativo"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6B7A8D] mt-0.5">{editUser.email}</p>
              </div>
            </div>

            {/* Botón Guardar en cabecera */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={closeEdit}
                className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-[#6B7A8D] hover:bg-[#F0F4FA] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1.5 bg-[var(--brand-primary)] text-white px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-2xs hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
                <span>{saving ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas del Formulario */}
        <div className="space-y-4 md:space-y-5">
          {/* Tarjeta 1: Información Personal y de Contacto */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
              <UserCheck size={16} className="text-[var(--brand-primary)]" />
              Datos de Identidad y Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Nombre Completo</label>
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Sofía López"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1.5">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={editForm.telefono}
                  onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +52 55 1234 5678"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              <div className="md:col-span-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#6B7A8D] shrink-0">
                    <Mail size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0B1929]">Correo de Acceso (Credencial)</div>
                    <div className="text-xs text-[#6B7A8D]">{editUser.email || "Sin email registrado"}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => resendCollaboratorAccess(editUser.email)}
                  disabled={saving}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0F4FA] border border-[#CBD5E1] text-[var(--brand-primary)] text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
                >
                  <Mail size={14} /> Reenviar enlace de contraseña
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Asignación de Rol y Permisos (Especialmente relevante para Superadmin) */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-1 flex items-center gap-2">
              <Shield size={16} className="text-[var(--brand-primary)]" />
              Rol y Permisos en la Empresa
            </h3>
            <p className="text-xs text-[#6B7A8D] mb-4">
              {isSuperadmin 
                ? "Selecciona el rol asignado a este colaborador para definir qué pestañas corporativas tiene autorizadas."
                : "Como nutriólogo, tu colaborador adquiere el perfil de Administrativo de Clínica para gestionar tus pacientes y agenda."
              }
            </p>

            {isSuperadmin ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allStaffRoles.map(r => {
                    const isSelected = editForm.roleAssigned === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setEditForm(p => ({ ...p, roleAssigned: r.id }))}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected 
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/20 shadow-2xs' 
                            : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${r.colorBadge || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {r.departamento || "Corporativo"}
                            </span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-[#CBD5E1]'}`}>
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-[#0B1929] mb-1">{r.nombre}</div>
                          <p className="text-[11px] text-[#6B7A8D] leading-relaxed line-clamp-2 mb-2">{r.descripcion}</p>
                        </div>

                        <div className="pt-2 border-t border-[#E2E8F0]/70 flex flex-wrap gap-1">
                          {(r.modulos || []).map(tabId => {
                            const tabInfo = SUPERADMIN_TABS.find(t => t.id === tabId);
                            return (
                              <span key={tabId} className="text-[10px] font-semibold bg-[#F0F4FA] text-[#475569] px-1.5 py-0.5 rounded flex items-center gap-1">
                                <TabIcon id={tabId} size={10} />
                                {tabInfo?.nombre || tabId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[#F8FAFC] border border-[#BFDBFE] rounded-xl p-4 text-xs text-[#6B7A8D] leading-relaxed flex items-start gap-3">
                <Briefcase size={18} className="text-[var(--brand-primary)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#0B1929] block text-sm mb-1">Administrativo de Clínica</strong>
                  Tu colaborador tiene acceso exclusivo a la lista de pacientes y a la gestión de citas en tu agenda.
                  Por confidencialidad médica, <strong>no tiene acceso</strong> a los expedientes clínicos, dietas, rutinas ni métricas privadas.
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta: Esquema de Compensación y Nómina (Superadmin) */}
          {isSuperadmin && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-[var(--brand-primary)]" />
                  <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider">
                    Esquema de Compensación y Nómina
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                  Motor de Pagos
                </span>
              </div>

              {/* Selector de Modalidad */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-2">
                  Modalidad de Pago del Colaborador
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    { key: "solo_comision", label: "Solo Comisión", desc: "% sobre pagos de nutriólogos a cargo" },
                    { key: "sueldo_fijo", label: "Sueldo Fijo", desc: "Monto fijo garantizado mensual" },
                    { key: "mixto", label: "Mixto (Base + Com.)", desc: "Sueldo base fijo + comisiones" },
                    { key: "honorarios", label: "Honorarios", desc: "Factura por servicios prestados" }
                  ].map(mod => {
                    const isSelected = editComp.modalidad === mod.key;
                    return (
                      <div
                        key={mod.key}
                        onClick={() => setEditComp(p => ({ ...p, modalidad: mod.key }))}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-1 ring-[var(--brand-primary)] shadow-2xs'
                            : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#0B1929]">{mod.label}</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-[#CBD5E1]'}`}>
                            {isSelected && <Check size={8} strokeWidth={3} />}
                          </div>
                        </div>
                        <p className="text-[10px] text-[#6B7A8D] leading-tight">{mod.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campos de compensación */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {(editComp.modalidad === "sueldo_fijo" || editComp.modalidad === "mixto" || editComp.modalidad === "honorarios") && (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">Sueldo Base Mensual</label>
                    <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-[#6B7A8D] mr-1.5">$</span>
                      <input
                        type="number"
                        min="0"
                        value={editComp.sueldoBase}
                        onChange={e => setEditComp(p => ({ ...p, sueldoBase: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-transparent text-sm font-bold text-[#0B1929] outline-none"
                      />
                      <span className="text-xs text-[#6B7A8D] font-medium ml-1">MXN</span>
                    </div>
                  </div>
                )}

                {(editComp.modalidad === "solo_comision" || editComp.modalidad === "mixto") && (
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">Comisión por Nutriólogo</label>
                    <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editComp.comisionPct}
                        onChange={e => setEditComp(p => ({ ...p, comisionPct: e.target.value }))}
                        placeholder="35"
                        className="w-full bg-transparent text-sm font-bold text-[#0B1929] outline-none"
                      />
                      <span className="text-xs font-bold text-[#6B7A8D] ml-1">%</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Bono Mensual Recurrente</label>
                  <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-[#6B7A8D] mr-1.5">$</span>
                    <input
                      type="number"
                      min="0"
                      value={editComp.bonoFijo}
                      onChange={e => setEditComp(p => ({ ...p, bonoFijo: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-transparent text-sm font-bold text-[#0B1929] outline-none"
                    />
                    <span className="text-xs text-[#6B7A8D] font-medium ml-1">MXN</span>
                  </div>
                </div>
              </div>

              {/* Subsección Datos Bancarios para Dispersión */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={15} className="text-[#6B7A8D]" />
                  <span className="text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                    Datos Bancarios para Dispersión
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B7A8D] mb-1">Banco Receptor</label>
                    <input
                      type="text"
                      value={editComp.banco}
                      onChange={e => setEditComp(p => ({ ...p, banco: e.target.value }))}
                      placeholder="Ej. BBVA, Santander, Nu"
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B7A8D] mb-1">Cuenta CLABE (18 dígitos)</label>
                    <input
                      type="text"
                      maxLength={18}
                      value={editComp.clabe}
                      onChange={e => setEditComp(p => ({ ...p, clabe: e.target.value.replace(/\D/g, '') }))}
                      placeholder="012180000000000000"
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-mono text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6B7A8D] mb-1">Titular de la Cuenta</label>
                    <input
                      type="text"
                      value={editComp.titular}
                      onChange={e => setEditComp(p => ({ ...p, titular: e.target.value }))}
                      placeholder="Nombre del beneficiario"
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tarjeta 3: Estado de la Cuenta y Suspender Acceso */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-6 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B1929] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lock size={16} className="text-[var(--brand-primary)]" />
              Estado y Control de Acceso
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${editUser.activo !== false ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}></span>
                  <span className="text-sm font-bold text-[#0B1929]">
                    {editUser.activo !== false ? "Acceso al Sistema Habilitado" : "Acceso al Sistema Suspendido"}
                  </span>
                </div>
                <p className="text-xs text-[#6B7A8D] leading-relaxed max-w-xl">
                  {editUser.activo !== false
                    ? "El colaborador puede iniciar sesión y acceder a las pestañas asignadas. Si suspendes el acceso, su sesión se bloqueará de inmediato."
                    : "El colaborador no puede ingresar a la plataforma hasta que reactives su acceso. Su información se mantiene intacta."
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={toggleActivoFromEdit}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                  editUser.activo !== false
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >
                {editUser.activo !== false ? <CircleDashed size={14} /> : <CheckCircle2 size={14} />}
                <span>{editUser.activo !== false ? "Suspender acceso" : "Reactivar acceso"}</span>
              </button>
            </div>

            {/* Premium Patrocinado para Nutriólogos */}
            {!isSuperadmin && editUser.role === "administrativo" && (
              <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                    <Crown size={15} className="text-amber-500 shrink-0" />
                    Beneficio de Atleta Premium
                  </div>
                  <p className="text-[11px] text-[#6B7A8D]">
                    Otorga una cuenta de Atleta Independiente Premium a tu administrativo para sus propios entrenamientos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmPremium({ miembro: editUser, activar: !patrocinios[editUser.id] })}
                  className={`px-3.5 py-2 text-xs font-bold border rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    patrocinios[editUser.id] 
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" 
                      : "border-[#CBD5E1] text-[#6B7A8D] bg-white hover:bg-[#F8FAFC]"
                  }`}
                >
                  <Crown size={14} />
                  {patrocinios[editUser.id] ? "Quitar Premium" : "Otorgar Premium"}
                </button>
              </div>
            )}
          </div>

          {/* Tarjeta 4: Zona de Peligro (Eliminar Colaborador Homologado en el Cuerpo) */}
          <div className="bg-white rounded-2xl border border-red-100 p-4 md:p-6 shadow-2xs">
            {showConfirmDelete ? (
              <div className="bg-red-50/90 border border-red-200 p-4 rounded-xl animate-in fade-in">
                <p className="text-red-700 text-xs font-bold mb-2">
                  Esta acción revocará de forma permanente el acceso de este colaborador. Si el usuario cuenta con cuenta de atleta o paciente civil independiente, esa cuenta personal se conservará intacta.
                  Escribe la palabra <strong>ELIMINAR</strong> para confirmar.
                </p>
                <input 
                  value={confirmDeleteText}
                  onChange={e => setConfirmDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full bg-white border border-red-200 text-red-900 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-red-500 mb-2.5"
                />
                <div className="flex justify-end gap-2">
                  <button 
                    type="button"
                    onClick={() => { setShowConfirmDelete(false); setConfirmDeleteText(""); }} 
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7A8D] hover:bg-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button"
                    onClick={deleteCollaborator} 
                    disabled={confirmDeleteText !== "ELIMINAR" || saving} 
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {saving ? "Eliminando..." : "Eliminar Definitivamente"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[#0B1929] flex items-center gap-1.5">
                    <Trash2 size={14} className="text-red-500 shrink-0" />
                    Eliminar colaborador del equipo
                  </h4>
                  <p className="text-[11px] text-[#6B7A8D] leading-relaxed">
                    Revoca el rol de colaborador y lo desvincula de la clínica o empresa permanentemente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Eliminar colaborador
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA PRINCIPAL: LISTA DE COLABORADORES O GENERADOR DE ROLES
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="pb-28 md:pb-8">
      {/* Top action bar: Fijo en móvil sin scroll lateral, botón colapsado */}
      <div className="flex items-center justify-between sm:justify-start gap-2 mb-3 md:mb-5 px-4 pt-1 md:px-0 md:pt-0">
        {isSuperadmin ? (
          <div className="flex gap-1 bg-[#F0F4FA] p-1 rounded-xl shrink-0 overflow-x-auto scroll-hide">
            {[
              ["colaboradores", `Colaboradores (${equipo.length})`],
              ["roles", `Roles y Permisos (${allStaffRoles.length})`],
              ["nominas", "Nóminas y Pagos"]
            ].map(([k, lb]) => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveSubTab(k)}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeSubTab === k
                    ? "bg-white text-[var(--brand-primary)] shadow-sm font-bold"
                    : "text-[#6B7A8D] hover:text-[#0B1929]"
                }`}
              >
                {lb}
              </button>
            ))}
          </div>
        ) : null}

        {activeSubTab === "roles" && isSuperadmin ? (
          <button 
            type="button"
            onClick={() => setShowNewRoleModal(true)}
            className="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all focus:outline-none bg-[var(--brand-primary)] text-white shadow-sm hover:opacity-90 h-8 sm:h-auto px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm shrink-0 cursor-pointer"
            title="Crear Nuevo Rol"
            aria-label="Crear Nuevo Rol"
          >
            <Plus size={16} strokeWidth={2.5} className="shrink-0" />
            <span className="hidden sm:inline">Crear Nuevo Rol</span>
          </button>
        ) : activeSubTab === "colaboradores" ? (
          <button 
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all focus:outline-none bg-[var(--brand-primary)] text-white shadow-sm hover:opacity-90 h-8 sm:h-auto px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-sm shrink-0 cursor-pointer"
            title="Invitar colaborador"
            aria-label="Invitar colaborador"
          >
            <Plus size={16} strokeWidth={2.5} className="shrink-0" />
            <span className="hidden sm:inline">Invitar colaborador</span>
          </button>
        ) : null}
      </div>

      {/* ─── Subpestaña 1: NÓMINAS Y PAGOS (Superadmin) ─── */}
      {isSuperadmin && activeSubTab === "nominas" ? (
        <div className="space-y-4 px-4 md:px-0">
          {/* Barra de Filtros de Nómina: Mes, Buscador y Estado */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base md:text-lg font-bold text-[#0B1929] flex items-center gap-2">
                  <Wallet size={20} className="text-[var(--brand-primary)]" />
                  Nóminas, Salarios y Liquidación de Colaboradores
                </h3>
                <p className="hidden md:block text-xs text-[#6B7A8D] mt-0.5">
                  Cálculo automatizado de sueldos base, bonos corporativos y comisiones por nutriólogos asignados.
                </p>
              </div>

              {/* Selector de Mes */}
              <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 shrink-0 shadow-2xs">
                <Calendar size={15} className="text-[#6B7A8D] shrink-0" />
                <CustomSelect
                  title="Seleccionar mes de corte"
                  value={filtroMesNomina}
                  onChange={(v) => setFiltroMesNomina(v)}
                  className="bg-transparent text-xs sm:text-sm font-bold text-[#0B1929] focus:outline-none cursor-pointer capitalize border-none p-0 shadow-none"
                  options={mesesNominasDisponibles.map((m) => ({ value: m, label: formatMesNomina(m) }))}
                />
              </div>
            </div>

            {/* Buscador + Pills de Filtro de Estado de Nómina */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B0]" />
                <input
                  type="text"
                  placeholder="Buscar colaborador en nómina..."
                  value={busquedaNomina}
                  onChange={e => setBusquedaNomina(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0B1929] outline-none focus:border-[var(--brand-primary)] font-['Inter',sans-serif]"
                />
                {busquedaNomina && (
                  <button
                    onClick={() => setBusquedaNomina("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9BA5B0] hover:text-[#0B1929] p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scroll-hide">
                {[
                  { key: "todos", label: `Todos (${kpisNomina.totalVisibles})` },
                  { key: "pendiente", label: `Pendientes (${kpisNomina.pendientes})` },
                  { key: "transferido", label: `Transferidos (${kpisNomina.transferidos})` },
                  { key: "firmado", label: `Firmados (${kpisNomina.firmados})` },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setFiltroEstadoNomina(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      filtroEstadoNomina === p.key
                        ? "bg-[var(--brand-primary)] text-white shadow-2xs"
                        : "bg-white border border-[#E2E8F0] text-[#6B7A8D] hover:text-[#0B1929] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tarjetas KPI de Resumen Financiero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">Total Nómina a Dispersar</span>
              <div className="text-xl md:text-2xl font-black text-[#0B1929] mt-1">
                ${kpisNomina.totalNeto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">Mes: {formatMesNomina(filtroMesNomina)}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">Sueldos Base Fijos</span>
              <div className="text-xl md:text-2xl font-black text-[#0B1929] mt-1">
                ${kpisNomina.totalSueldos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-[#6B7A8D] mt-0.5 block">Monto base garantizado</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">Comisiones Ganadas</span>
              <div className="text-xl md:text-2xl font-black text-indigo-600 mt-1">
                ${kpisNomina.totalComisiones.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-[#6B7A8D] mt-0.5 block">Por pagos de nutriólogos</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D]">Bonos Asignados</span>
              <div className="text-xl md:text-2xl font-black text-amber-600 mt-1">
                ${kpisNomina.totalBonos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-[#6B7A8D] mt-0.5 block">Incentivos corporativos</span>
            </div>
          </div>

          {/* Lista de Colaboradores en Nómina */}
          {loadingNominas ? (
            <div className="text-center py-16 text-[#6B7A8D] flex flex-col items-center">
              <Loader2 className="w-9 h-9 text-[var(--brand-primary)] animate-spin mb-3.5" />
              Calculando nóminas del personal…
            </div>
          ) : nominasFiltradas.length === 0 ? (
            <div className="bg-white p-10 md:p-14 text-center rounded-2xl border border-[#E2E8F0] text-[#6B7A8D] shadow-2xs flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-[#9BA5B0] mb-1">
                <Banknote size={22} strokeWidth={1.5} />
              </div>
              <h4 className="font-bold text-[#0B1929] text-base">Sin dispersiones pendientes para este periodo</h4>
              <p className="text-xs text-[#6B7A8D] max-w-md">
                No hay colaboradores con saldo por pagar o transferencias en {formatMesNomina(filtroMesNomina)}. Los colaboradores con balance de $0.00 se omiten automáticamente para mantener limpia tu pantalla.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {nominasFiltradas.map((item) => {
                const { colab, comp, nutrisAsignados, sueldoMonto, comisionMonto, bonoMonto, montoFinal, isTransferido, isConfirmado, dbRecord } = item;
                const assignedRole = getRoleInfo(colab.especialidad);

                return (
                  <div
                    key={colab.id}
                    className="bg-white rounded-2xl border border-[#E2E8F0] p-4 md:p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col gap-4"
                  >
                    {/* Fila superior: Identidad y Modalidad */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#F0F4FA] border border-[#E2E8F0] flex items-center justify-center font-bold text-base text-[var(--brand-primary)] shrink-0">
                          {(colab.nombre || "C").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-base text-[#0B1929]">{colab.nombre}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${assignedRole?.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              {assignedRole?.nombre || "Staff Corporativo"}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 capitalize">
                              {comp.modalidad.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B7A8D] mt-0.5">{colab.email}</p>
                        </div>
                      </div>

                      {/* Badge de Estado del Pago */}
                      <div className="self-start sm:self-auto">
                        {isConfirmado ? (
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle2 size={14} className="text-emerald-600" /> Firmado Digitalmente
                          </span>
                        ) : isTransferido ? (
                          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                            <Clock size={14} className="text-amber-600" /> Transferido (Esperando Firma)
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-[#475569] border border-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                            <Clock size={14} className="text-[#6B7A8D]" /> Pendiente de Dispersión
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fila central: Desglose Financiero */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">Sueldo Base</span>
                        <span className="text-sm font-bold text-[#0B1929]">${sueldoMonto.toFixed(2)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">
                          Comisión ({comp.comisionPct || 35}%)
                        </span>
                        <span className="text-sm font-bold text-indigo-700">${comisionMonto.toFixed(2)}</span>
                        <span className="text-[10px] text-[#6B7A8D] block">
                          {nutrisAsignados.length} nutriólogo{nutrisAsignados.length !== 1 ? 's' : ''} a cargo
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A8D] block">Bono</span>
                        <span className="text-sm font-bold text-amber-700">${bonoMonto.toFixed(2)}</span>
                      </div>

                      <div className="border-l border-gray-200 pl-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-primary)] block">Total a Pagar</span>
                        <span className="text-base md:text-lg font-black text-[#0B1929] block">
                          ${montoFinal.toFixed(2)} <span className="text-xs font-semibold text-[#6B7A8D]">MXN</span>
                        </span>
                      </div>
                    </div>

                    {/* Fila inferior: Datos Bancarios + Acciones */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                      {/* Datos Bancarios y Botón de Copiar CLABE */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-[#0B1929]">
                        {comp.banco && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded-md font-bold text-[#475569] border border-gray-200">
                            {comp.banco}
                          </span>
                        )}
                        {comp.clabe ? (
                          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] px-2.5 py-1 rounded-lg">
                            <CreditCard size={13} className="text-[#6B7A8D]" />
                            <span className="font-mono font-bold text-xs">{comp.clabe}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyClabe(comp.clabe, colab.id)}
                              className="ml-1 p-1 hover:bg-gray-200 rounded text-[var(--brand-primary)] transition-colors cursor-pointer"
                              title="Copiar CLABE"
                            >
                              {copiedClabeId === colab.id ? (
                                <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-0.5">
                                  <Check size={12} strokeWidth={3} /> ¡Copiada!
                                </span>
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#94A3B8] italic text-xs">Sin cuenta bancaria registrada</span>
                        )}
                        {comp.titular && (
                          <span className="text-xs text-[#6B7A8D]">({comp.titular})</span>
                        )}
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(colab)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#6B7A8D] bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Configurar esquema de compensación"
                        >
                          <Sliders size={13} />
                          <span>Configurar Esquema</span>
                        </button>

                        {!isTransferido ? (
                          <button
                            type="button"
                            disabled={transferringColab === colab.nombre}
                            onClick={() => handleTransferirNomina(colab.nombre, montoFinal)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-[var(--brand-primary)] hover:opacity-90 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            {transferringColab === colab.nombre ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Send size={13} />
                            )}
                            <span>Registrar Transferencia</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevertirTransferencia(dbRecord?.id, colab.nombre)}
                            className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
                          >
                            Revertir a Pendiente
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isSuperadmin && activeSubTab === "roles" ? (
        <div className="space-y-4 px-4 md:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allStaffRoles.map(r => {
              const colaboradoresEnRol = equipo.filter(c => (c.especialidad || 'staff_general') === r.id);
              const isCustom = r.id.startsWith("custom_");
              const activeCount = (r.modulos || []).length;

              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${r.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {r.departamento || "Corporativo"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(r.id)}
                        className="text-[#94A3B8] hover:text-red-600 transition-colors cursor-pointer p-1"
                        title="Eliminar este rol"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <h4 className="text-base font-bold text-[#0B1929] mb-1.5">{r.nombre}</h4>
                    <p className="text-xs text-[#6B7A8D] leading-relaxed mb-4">{r.descripcion}</p>

                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Pestañas Habilitadas:</span>
                        <span className="text-[var(--brand-primary)] font-bold">{activeCount} de {SUPERADMIN_TABS.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                        {(r.modulos || []).map(mId => {
                          const tabInfo = SUPERADMIN_TABS.find(t => t.id === mId);
                          return (
                            <span key={mId} className="text-[11px] font-semibold bg-[#F0F4FA] text-[#0B1929] px-2 py-1 rounded-md border border-[#E2E8F0] flex items-center gap-1.5">
                              <TabIcon id={mId} size={12} className="text-[var(--brand-primary)]" />
                              {tabInfo?.nombre || mId}
                            </span>
                          );
                        })}
                        {activeCount === 0 && (
                          <span className="text-xs text-[#94A3B8] italic">Sin pestañas habilitadas</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2 mt-2">
                    <span className="text-xs text-[#6B7A8D] font-medium">
                      {colaboradoresEnRol.length} miembro{colaboradoresEnRol.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditRoleModal(r)}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Sliders size={13} />
                      Editar Rol y Pestañas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Subpestaña: LISTA DE COLABORADORES */
        <>
          {/* Barra de filtros horizontales por rol (homologado con Agenda) */}
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto scroll-hide pb-1 px-4 md:px-0">
              {roleFilters.map(([k, lb]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRoleFilter(k)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                    roleFilter === k
                      ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm"
                      : "bg-white text-[#6B7A8D] border-[#E2E8F0] hover:bg-[#E8F1FB]"
                  }`}
                >
                  {lb}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Colaboradores */}
          {loading ? (
            <div className="text-center py-16 text-[#6B7A8D] flex flex-col items-center">
              <Loader2 className="w-9 h-9 text-[var(--brand-primary)] animate-spin mb-3.5" />
              Cargando equipo…
            </div>
          ) : equipo.length === 0 ? (
            <div className="text-center py-20 text-[#6B7A8D] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col items-center mx-4 md:mx-0">
              <Folder className="w-12 h-12 text-[#94A3B8] mb-4" />
              <div className="text-base font-semibold mb-2 text-[#0B1929]">Sin colaboradores aún</div>
              <div className="text-sm">Invita a tu primer colaborador para comenzar a delegar</div>
              <div className="mt-5">
                <button 
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm text-sm cursor-pointer"
                >
                  + Invitar primer colaborador
                </button>
              </div>
            </div>
          ) : filteredEquipo.length === 0 ? (
            <div className="mx-4 md:mx-0 text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-[15px] font-semibold text-[#6B7A8D]">No hay colaboradores con este rol</div>
            </div>
          ) : (
            <div className="flex flex-col gap-0 md:gap-3">
              {filteredEquipo.map((p, i) => {
                const assignedRole = isSuperadmin ? getRoleInfo(p.especialidad) : null;

                return (
                  <div 
                    key={p.id} 
                    onClick={() => openEdit(p)}
                    className="animate-in bg-white rounded-none md:rounded-2xl border-b first:border-t md:first:border-t-0 md:border border-[#E2E8F0] p-4 md:p-5 flex items-center justify-between gap-3 relative overflow-hidden shadow-none md:shadow-2xs hover:shadow-md hover:border-[#CBD5E1] transition-all cursor-pointer group"
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    {/* Barra lateral de estado */}
                    <div className={`absolute left-0 top-[15%] bottom-[15%] w-1 rounded-r-md ${p.activo !== false ? 'bg-[var(--brand-primary)]' : 'bg-[#EF4444]'}`} />

                    {/* Información Principal del Empleado */}
                    <div className="pl-3.5 flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Avatar Inicial */}
                      <div className="w-10 h-10 rounded-xl bg-[#F0F4FA] group-hover:bg-[#E2E8F0] border border-[#E2E8F0] flex items-center justify-center font-bold text-sm text-[var(--brand-primary)] shrink-0 transition-colors">
                        {(p.nombre || "C").charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[15px] text-[#0B1929] group-hover:text-[var(--brand-primary)] transition-colors truncate">
                            {p.nombre || "Sin nombre"}
                          </span>

                          {/* Rol corporativo (si es staff) o administrativo */}
                          {isSuperadmin && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${assignedRole?.colorBadge || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              <Shield size={11} />
                              {assignedRole?.nombre || "Staff Corporativo"}
                            </span>
                          )}

                          {p.role === "administrativo" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              Administrativo
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#6B7A8D] flex items-center gap-3 flex-wrap mt-0.5">
                          <span className="truncate">{p.email || "Sin email"}</span>
                          {p.telefono && (
                            <a
                              href={`https://wa.me/${p.telefono.replace(/\D/g,"")}`}
                              target="_blank" 
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-[#22c55e] no-underline font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          )}
                        </div>

                        {/* Badges de estado */}
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${p.activo !== false ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]' : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]'}`}>
                            {p.activo !== false ? <Circle className="w-2.5 h-2.5 fill-current" /> : <CircleDashed className="w-2.5 h-2.5" />}
                            {p.activo !== false ? "Activo" : "Suspendido"}
                          </span>
                          
                          {p.role === "staff" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Crown className="w-3 h-3" /> Premium incluido
                            </span>
                          )}

                          {p.role === "administrativo" && patrocinios[p.id] && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Crown className="w-3 h-3" /> Premium{patrocinios[p.id].gratis ? " (incluido)" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Flecha indicadora de interacción */}
                    <div className="flex items-center text-[#94A3B8] group-hover:text-[var(--brand-primary)] group-hover:translate-x-0.5 transition-all shrink-0 pr-1">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL CONFIGURAR Y EDITAR ROL EXISTENTE                              */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {editingRole && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 md:p-6 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] shrink-0">
              <div>
                <span className="text-[10px] font-bold text-[#6B7A8D] uppercase tracking-wider">Configuración de Rol</span>
                <h3 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                  <Sliders size={18} className="text-[var(--brand-primary)]" />
                  Editar Rol: {editingRole.nombre}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => { setEditingRole(null); setConfirmDeleteRole(false); }}
                className="text-[#94A3B8] hover:text-[#0B1929] transition-colors p-1 cursor-pointer"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Campos editables: Nombre y Departamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Nombre del Rol</label>
                  <input
                    type="text"
                    value={editingRoleForm.nombre}
                    onChange={e => setEditingRoleForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej. Líder de Afiliaciones"
                    className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Departamento / Área</label>
                  <input
                    type="text"
                    value={editingRoleForm.departamento}
                    onChange={e => setEditingRoleForm(p => ({ ...p, departamento: e.target.value }))}
                    placeholder="Ej. Comercial o Administración"
                    className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              {/* Campo editable: Descripción */}
              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  value={editingRoleForm.descripcion}
                  onChange={e => setEditingRoleForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Explica qué funciones desempeña este perfil..."
                  className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                />
              </div>

              {/* Checklist de Pestañas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                    Pestañas Autorizadas ({editingRoleForm.modulos.length} de {SUPERADMIN_TABS.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRoleForm(p => ({ ...p, modulos: SUPERADMIN_TABS.map(t => t.id) }))}
                      className="text-xs font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-xs text-[#CBD5E1]">|</span>
                    <button
                      type="button"
                      onClick={() => setEditingRoleForm(p => ({ ...p, modulos: [] }))}
                      className="text-xs font-bold text-[#6B7A8D] hover:underline cursor-pointer"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUPERADMIN_TABS.map(tab => {
                    const isChecked = editingRoleForm.modulos.includes(tab.id);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setEditingRoleForm(p => ({
                            ...p,
                            modulos: isChecked 
                              ? p.modulos.filter(id => id !== tab.id)
                              : [...p.modulos, tab.id]
                          }));
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked 
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-1 ring-[var(--brand-primary)]/30' 
                            : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isChecked ? 'bg-[var(--brand-primary)] text-white' : 'bg-[#F0F4FA] text-[#6B7A8D]'}`}>
                            <TabIcon id={tab.id} size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-xs font-bold truncate ${isChecked ? 'text-[#0B1929]' : 'text-[#475569]'}`}>
                              {tab.nombre}
                            </div>
                            <div className="text-[11px] text-[#6B7A8D] truncate">
                              {tab.desc}
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' : 'border-[#CBD5E1] bg-white'
                        }`}>
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer con Eliminar Rol a la izquierda y Guardar a la derecha */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0] shrink-0">
              {confirmDeleteRole ? (
                <div className="flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-200">
                  <span className="text-xs text-red-700 font-bold">¿Borrar este rol?</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(editingRole.id)}
                    className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer shadow-2xs"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteRole(false)}
                    className="px-2.5 py-1.5 text-xs text-[#6B7A8D] hover:bg-white rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRole(true)}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Trash2 size={14} />
                  Eliminar Rol
                </button>
              )}

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => { setEditingRole(null); setConfirmDeleteRole(false); }}
                  className="px-4 py-2 text-xs font-semibold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveRoleEdit}
                  className="px-5 py-2 text-xs font-bold bg-[var(--brand-primary)] text-white rounded-xl hover:opacity-90 transition-opacity shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} strokeWidth={2.5} /> Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* MODAL CREAR NUEVO ROL (SUPERADMIN)                                   */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showNewRoleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 md:p-6 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-[#E2E8F0] shrink-0">
              <h3 className="text-lg font-bold text-[#0B1929] flex items-center gap-2">
                <Shield size={18} className="text-[var(--brand-primary)]" />
                Generador de Rol Corporativo
              </h3>
              <button 
                type="button" 
                onClick={() => setShowNewRoleModal(false)}
                className="text-[#94A3B8] hover:text-[#0B1929] transition-colors p-1"
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Nombre del Rol</label>
                  <input
                    type="text"
                    value={newRoleForm.nombre}
                    onChange={e => setNewRoleForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej. Líder de Afiliaciones"
                    className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Departamento / Área</label>
                  <input
                    type="text"
                    value={newRoleForm.departamento}
                    onChange={e => setNewRoleForm(p => ({ ...p, departamento: e.target.value }))}
                    placeholder="Ej. Comercial o Expansión"
                    className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7A8D] uppercase tracking-wider mb-1">Descripción Breve</label>
                <textarea
                  rows={2}
                  value={newRoleForm.descripcion}
                  onChange={e => setNewRoleForm(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Explica qué funciones desempeña este perfil..."
                  className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#0B1929] uppercase tracking-wider">
                    Pestañas Autorizadas ({newRoleForm.modulos.length} de {SUPERADMIN_TABS.length})
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewRoleForm(p => ({ ...p, modulos: SUPERADMIN_TABS.map(t => t.id) }))}
                      className="text-xs font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    <span className="text-xs text-[#CBD5E1]">|</span>
                    <button
                      type="button"
                      onClick={() => setNewRoleForm(p => ({ ...p, modulos: [] }))}
                      className="text-xs font-bold text-[#6B7A8D] hover:underline cursor-pointer"
                    >
                      Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUPERADMIN_TABS.map(tab => {
                    const isChecked = newRoleForm.modulos.includes(tab.id);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setNewRoleForm(p => ({
                            ...p,
                            modulos: isChecked 
                              ? p.modulos.filter(id => id !== tab.id)
                              : [...p.modulos, tab.id]
                          }));
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked 
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-1 ring-[var(--brand-primary)]/30' 
                            : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isChecked ? 'bg-[var(--brand-primary)] text-white' : 'bg-[#F0F4FA] text-[#6B7A8D]'}`}>
                            <TabIcon id={tab.id} size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className={`text-xs font-bold truncate ${isChecked ? 'text-[#0B1929]' : 'text-[#475569]'}`}>
                              {tab.nombre}
                            </div>
                            <div className="text-[11px] text-[#6B7A8D] truncate">
                              {tab.desc}
                            </div>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' : 'border-[#CBD5E1] bg-white'
                        }`}>
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0] shrink-0">
              <button
                type="button"
                onClick={() => setShowNewRoleModal(false)}
                className="px-4 py-2 text-xs font-semibold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCustomRole}
                className="px-5 py-2 text-xs font-bold bg-[var(--brand-primary)] text-white rounded-xl hover:opacity-90 transition-opacity shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={14} strokeWidth={2.5} /> Guardar Rol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación Premium patrocinado */}
      {confirmPremium && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-[#0B1929] flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-amber-500" />
              {confirmPremium.activar ? "Activar Premium" : "Quitar Premium"}
            </h3>
            {confirmPremium.activar ? (
              <p className="text-sm text-[#6B7A8D] leading-relaxed mb-5">
                <strong className="text-[#0B1929]">{confirmPremium.miembro.nombre}</strong> tendrá una cuenta Premium de atleta independiente
                (desde "Cambiar Perfil"). {isEstudiante
                  ? <>Como estudiante, este beneficio <strong>no tiene costo</strong> para ti.</>
                  : <>Se agregarán <strong className="text-[#0B1929]">${Number(tarifaAdmin).toFixed(2)} MXN / mes</strong> a tu facturación, prorrateado como tus pacientes.</>}
                {" "}Si tu cuenta tiene un adeudo y se bloquea, el Premium se suspende.
              </p>
            ) : (
              <p className="text-sm text-[#6B7A8D] leading-relaxed mb-5">
                {confirmPremium.miembro.nombre} volverá al plan Estándar. El cobro se calcula con la misma regla de bajas que tus pacientes.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPremium(null)} disabled={saving}
                className="px-4 py-2 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC]">Cancelar</button>
              <button onClick={cambiarPremium} disabled={saving}
                className="px-4 py-2 text-sm font-bold bg-[var(--brand-primary)] text-white rounded-xl hover:opacity-90 disabled:opacity-50">
                {saving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interceptor (Conflicto de Rol Existente) */}
      {conflictUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0B1929]/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Usuario Existente
              </h3>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm mb-5">
              El correo <strong>{conflictUser.email}</strong> ya está registrado en tu plataforma (posiblemente como paciente).
              <br/><br/>
              <strong>Datos Actuales Registrados:</strong><br/>
              Nombre: {conflictUser.profile?.nombre || conflictUser.cliente?.nombre || "Sin nombre"}<br/>
              Teléfono: {conflictUser.profile?.telefono || conflictUser.cliente?.telefono || "Sin teléfono"}
            </div>

            <p className="text-[#6B7A8D] text-sm mb-5">
              Al otorgarle permisos de colaborador, el usuario podrá ingresar a este panel usando su <strong>misma contraseña actual</strong>. ¿Qué datos deseas usar para su nuevo rol?
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => resolveConflict(false)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors flex items-start gap-3 cursor-pointer"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[var(--brand-primary)] flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-[var(--brand-primary)] rounded-full"></div>
                </div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Usar sus datos actuales</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Vincula su rol usando el nombre y teléfono que ya tenía registrado.</div>
                </div>
              </button>

              <button 
                onClick={() => resolveConflict(true)}
                disabled={saving}
                className="w-full text-left p-4 rounded-xl border border-[#E2E8F0] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-colors flex items-start gap-3 cursor-pointer"
              >
                <div className="w-5 h-5 mt-0.5 rounded-full border-2 border-[#E2E8F0] group-hover:border-[var(--brand-primary)] flex items-center justify-center">
                </div>
                <div>
                  <div className="font-bold text-[#0B1929] text-sm">Actualizar todo con los datos nuevos</div>
                  <div className="text-xs text-[#6B7A8D] mt-1">Sobrescribe su nombre y teléfono en todos sus roles usando la nueva información.</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-[#E2E8F0]">
              <button 
                onClick={() => setConflictUser(null)}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-bold border border-[#E2E8F0] text-[#6B7A8D] rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Invitar */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-none md:rounded-2xl border-0 md:border border-[#E2E8F0] shadow-xl w-full md:max-w-md h-full max-h-full md:h-auto p-5 md:p-6 overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-[#0B1929] flex items-center gap-2">
                <Folder className="w-5 h-5 text-[var(--brand-primary)]" /> Invitar colaborador
              </h3>
              <button onClick={() => setShowInvite(false)} className="text-[#94A3B8] hover:text-[#0B1929] transition-colors cursor-pointer">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Nombre completo</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej. Sofía López"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="sofia@clinica.com"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#475569] mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +525512345678"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition-all placeholder-[#94A3B8]"
                />
              </div>

              {/* Selector de Rol inicial si es Superadmin */}
              {isSuperadmin && (
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">Rol Inicial a Asignar</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-sm text-[#0B1929] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                  >
                    {allStaffRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre} ({r.departamento})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-[#F8FAFC] border border-[#BFDBFE] rounded-lg p-3 text-xs text-[#6B7A8D] leading-relaxed mt-2 flex gap-2">
                <Mail className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                <span>
                  El colaborador recibirá un correo de invitación para configurar su contraseña.
                  {isSuperadmin ? (
                    <>
                      {" "}Se le asignará el rol corporativo seleccionado con sus permisos correspondientes.
                    </>
                  ) : (
                    <>
                      {" "}Solo tendrá acceso a <strong className="text-[#0B1929]">Clientes</strong> y{" "}
                      <strong className="text-[#0B1929]">Agenda</strong> — sin acceso a información clínica confidencial.
                    </>
                  )}
                </span>
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button 
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm font-medium border border-[#E2E8F0] text-[#6B7A8D] rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={invite} 
                  disabled={saving}
                  className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Enviando invitación…" : "Invitar colaborador"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
