import { ArrowLeft, Shield } from"lucide-react";

export default function Privacidad() {
  const currentDate = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-[#6B7A8D] font-bold mb-8 hover:text-[#0B1929] transition-colors"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Shield size={24} />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0B1929] font-['Space_Grotesk'] tracking-tight">
            Aviso de Privacidad
          </h1>
        </div>

        <div className="prose prose-sm md:prose-base prose-slate max-w-none text-[#475569] leading-relaxed space-y-6">
          <p>
            <strong>Responsable del tratamiento de datos personales</strong><br/>
            Cesar Alberto Huerta Aguilar, con marca comercial"Flux Sports" y dominio www.flux-sport.com (en adelante"Flux Sports" o"nosotros"), es responsable del tratamiento de los datos personales que usted nos proporciona, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.
          </p>

          <p>
            <strong>Datos personales que recabamos</strong><br/>
            Para prestar nuestros servicios de suscripción que enlazan a pacientes con nutriólogos, recabamos:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Datos de identificación: nombre, correo electrónico, teléfono.</li>
            <li>Datos de facturación y pago (procesados a través de terceros especializados; Flux Sports no almacena números completos de tarjeta).</li>
            <li><strong>Datos sensibles de salud:</strong> peso, estatura, composición corporal, fotos de progreso físico, historial médico y nutricional relevante, hábitos alimenticios, resultados de evaluaciones antropométricas o de bioimpedancia, y cualquier otra información que usted o su nutriólogo registren dentro de la app para el seguimiento de su plan.</li>
          </ul>
          <p>
            De conformidad con el artículo 9 de la LFPDPPP, al tratarse de datos sensibles, requerimos su <strong>consentimiento expreso y por escrito</strong>, mismo que otorga al marcar la casilla de aceptación de este Aviso al momento de registrarse en la app.
          </p>

          <p>
            <strong>Finalidades del tratamiento</strong><br/>
            <em>Finalidades primarias (necesarias para el servicio):</em>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Crear y administrar su cuenta y suscripción.</li>
            <li>Conectarlo con el nutriólogo asignado y permitir el seguimiento de su plan nutricional y/o de entrenamiento.</li>
            <li>Procesar pagos de la suscripción.</li>
            <li>Brindar soporte técnico y atención al cliente.</li>
          </ul>

          <p>
            <em>Finalidades secundarias (opcionales, puede oponerse sin que afecte el servicio):</em>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Enviar promociones, novedades o información sobre nuevos productos Flux Sports (suplementos, ropa) cuando estén disponibles.</li>
            <li>Elaborar estadísticas internas para mejorar la app.</li>
          </ul>
          <p>
            Si no desea que sus datos se usen para las finalidades secundarias, puede indicarlo escribiendo a cesar.a.huerta.a@gmail.com.
          </p>

          <p>
            <strong>Transferencia de datos</strong><br/>
            Sus datos de salud son compartidos únicamente con el profesional que usted tiene asignado dentro de la plataforma (si aplica), para efectos del seguimiento de su plan. No vendemos ni compartimos sus datos sensibles con terceros ajenos al servicio. Podemos compartir datos no sensibles con proveedores de infraestructura (hosting, procesamiento de pagos) únicamente para operar el servicio, quienes están obligados contractualmente a proteger su información.
          </p>

          <p>
            <strong>Derechos ARCO y Eliminación Definitiva</strong><br/>
            Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse (derechos ARCO) al tratamiento de sus datos personales, así como a revocar su consentimiento en cualquier momento. De manera adicional, nuestra plataforma le permite eliminar de forma **definitiva e irreversible** todos sus registros, fotografías, historiales y métricas en cualquier momento desde la configuración de su perfil.
            <br/><br/>
            Para ejercer derechos ARCO formalmente, envíe una solicitud a:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Correo: cesar.a.huerta.a@gmail.com</li>
            <li>Teléfono: 775 101 67 33</li>
          </ul>
          <p>
            Su solicitud deberá incluir: nombre completo, descripción clara del derecho que desea ejercer, y documento que acredite su identidad. Responderemos en un plazo máximo de 20 días hábiles, conforme a la ley.
          </p>

          <p>
            <strong>Medidas de seguridad</strong><br/>
            Flux Sports implementa medidas de seguridad técnicas y administrativas (cifrado de datos, control de acceso por roles, autenticación segura, políticas RLS en base de datos) para proteger sus datos personales contra daño, pérdida, alteración, acceso o uso no autorizado.
          </p>

          <p>
            <strong>Uso de cookies y tecnologías similares</strong><br/>
            Nuestra app y sitio web pueden utilizar cookies y tecnologías similares para mejorar su experiencia de uso. Usted puede deshabilitarlas desde la configuración de su dispositivo o navegador, aunque esto podría limitar algunas funciones.
          </p>

          <p>
            <strong>Cambios al Aviso de Privacidad</strong><br/>
            Nos reservamos el derecho de actualizar este Aviso de Privacidad. Cualquier modificación será publicada en www.flux-sport.com y, de ser relevante, notificada dentro de la app.
          </p>

          <p className="pt-8 border-t border-gray-200 text-sm text-gray-500 font-bold">
            Fecha de última actualización: {currentDate}
          </p>
        </div>
      </div>
    </div>
  );
}
