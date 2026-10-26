import React from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[FLUX ErrorBoundary]", error, errorInfo);

    // Auto-recuperación si falla la carga dinámica de un módulo/chunk tras un despliegue reciente
    const msg = String(error?.message || "");
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module");

    if (isChunkError) {
      try {
        const lastReload = sessionStorage.getItem("flux_chunk_retry");
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 10000) {
          sessionStorage.setItem("flux_chunk_retry", String(now));
          window.location.reload();
        }
      } catch {}
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem("flux_role");
      localStorage.removeItem("flux_session_snapshot");
      sessionStorage.clear();
    } catch {}
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4 font-['Inter',sans-serif]">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertCircle size={28} />
            </div>

            <h2 className="text-xl font-bold text-[#0B1929] mb-2" style={{ fontFamily: "DM Sans, sans-serif" }}>
              Ocurrió un problema al cargar
            </h2>
            <p className="text-sm text-[#6B7A8D] mb-6 leading-relaxed">
              La aplicación no pudo cargar la pantalla solicitada. Puedes recargar la página o volver al inicio.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3.5 px-4 rounded-xl bg-[var(--brand-primary)] hover:opacity-90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw size={16} />
                Recargar aplicación
              </button>
              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 rounded-xl bg-gray-50 hover:bg-gray-100 text-[#0B1929] font-semibold text-sm flex items-center justify-center gap-2 border border-[#E2E8F0] transition-colors cursor-pointer"
              >
                <Home size={16} />
                Volver al inicio
              </button>
            </div>

            {this.state.error && (
              <details className="mt-4 text-left bg-red-50/80 border border-red-200/80 rounded-2xl p-3 text-xs text-red-900">
                <summary className="font-bold cursor-pointer text-red-700">
                  Detalles del error técnico
                </summary>
                <pre className="mt-2 text-[10px] font-mono whitespace-pre-wrap break-all overflow-x-auto text-red-800">
                  {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
