import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Terminos() {
  const navigate = useNavigate();
  const currentDate = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1929] font-['Inter',sans-serif] selection:bg-[#1A6FD4] selection:text-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#6B7A8D] font-bold mb-8 hover:text-[#0B1929] transition-colors"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <FileText size={24} />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0B1929] font-['Space_Grotesk'] tracking-tight">
            Términos y Condiciones Generales
          </h1>
        </div>

        <div className="prose prose-sm md:prose-base prose-slate max-w-none text-[#475569] leading-relaxed space-y-6">
          <p>Última actualización: {currentDate}</p>
          <p>
            Bienvenido a <strong>FLUX Sports</strong>. Al utilizar nuestra plataforma web, aplicación móvil (PWA) y cualquier servicio asociado (en adelante, la "Plataforma"), usted acepta estar sujeto a los siguientes Términos y Condiciones. Por favor, léalos detenidamente.
          </p>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">1. Uso de la Plataforma (Software)</h2>
          <p>
            FLUX Sports proporciona un sistema de gestión para profesionales de la salud (Nutriólogos) y sus clientes (Pacientes o Atletas). 
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Para Pacientes/Atletas:</strong> La Plataforma le permite visualizar planes nutricionales, rutinas y progreso proporcionados por su Nutriólogo. FLUX Sports <strong>no provee servicios médicos ni asesoría nutricional directa</strong>. Cualquier duda clínica debe consultarse con el profesional contratado.</li>
            <li><strong>Para Profesionales (Nutriólogos):</strong> Usted es responsable del contenido médico, planes y recomendaciones que asigne a sus pacientes. FLUX Sports opera como una herramienta tecnológica y se exime de cualquier responsabilidad derivada de negligencia médica o malas prácticas profesionales.</li>
          </ul>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">2. Tienda en Línea (Suplementos y Ropa)</h2>
          <p>
            La Plataforma ofrece la venta de productos físicos, incluyendo suplementos y ropa deportiva. Las siguientes políticas aplican a todas las compras:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Envíos:</strong> Los tiempos de entrega son estimados y pueden variar según la logística del proveedor de paquetería.</li>
            <li><strong>Devoluciones (Ropa):</strong> Aceptamos devoluciones dentro de los primeros 15 días tras la recepción, siempre y cuando la prenda no haya sido usada y conserve sus etiquetas originales.</li>
            <li><strong>Devoluciones (Suplementos):</strong> Por motivos de salud e higiene, <strong>no aceptamos devoluciones de suplementos alimenticios</strong> que hayan sido abiertos o cuyo sello de seguridad esté roto, salvo defectos de fabricación.</li>
          </ul>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">3. Pagos y Suscripciones</h2>
          <p>
            Los pagos realizados dentro de la plataforma (ya sea por software o productos) son procesados por pasarelas de pago de terceros seguras. FLUX Sports no almacena datos sensibles de tarjetas de crédito. 
          </p>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">4. Propiedad Intelectual</h2>
          <p>
            Todo el contenido visual, diseño, logotipos, texto, gráficos y código fuente de la Plataforma son propiedad exclusiva de FLUX Sports y están protegidos por leyes de derechos de autor y propiedad intelectual aplicables. Se prohíbe su reproducción, distribución o modificación sin consentimiento expreso.
          </p>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">5. Privacidad y Datos</h2>
          <p>
            El manejo de su información personal y médica está estrictamente gobernado por nuestro <a href="/privacidad" className="text-[#1A6FD4] font-medium hover:underline">Aviso de Privacidad</a>, alineado con las leyes de protección de datos vigentes.
          </p>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">6. Limitación de Responsabilidad</h2>
          <p>
            Bajo ninguna circunstancia FLUX Sports, sus directores, empleados o afiliados serán responsables de daños indirectos, incidentales o consecuentes derivados del uso de la Plataforma, la imposibilidad de acceder a ella o las interacciones entre Usuarios y Nutriólogos.
          </p>

          <h2 className="text-lg font-bold text-[#0B1929] mt-8 mb-4">7. Modificaciones</h2>
          <p>
            Nos reservamos el derecho de actualizar o modificar estos Términos y Condiciones en cualquier momento. Se le notificará a través de la Plataforma sobre cambios sustanciales. El uso continuo de los servicios constituye la aceptación de dichas modificaciones.
          </p>

          <div className="mt-12 p-6 bg-white rounded-xl border border-[#E2E5EA]">
            <p className="font-bold text-[#0B1929] mb-2">¿Tienes preguntas?</p>
            <p>Si tienes alguna duda sobre estos términos, contáctanos a soporte@flux-sport.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
