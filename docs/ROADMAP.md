# Roadmap y Futuras Mejoras de FLUX (V2.0+)

Este documento almacena las ideas y oportunidades de mejora identificadas para la aplicación, divididas por rol de usuario, para ser implementadas en fases futuras del proyecto.

## 1. Rol: Nutriólogo (El cliente de pago)
**Oportunidades de Mejora (Features "Killer"):**
- **Plantillas (Templates):** Poder guardar "Plantillas de Rutina" (ej. *Hipertrofia 4 días*) o "Plantillas de Dieta" para asignarlas a un cliente nuevo con un clic y luego solo ajustar macros, multiplicando su velocidad de trabajo.
- **Generador de Lista del Súper:** Un botón que le genere al paciente un PDF con la lista de compras exacta para la semana, basándose en la dieta asignada.
- **Chat Interno:** Un sistema simple de mensajería dentro de la app para centralizar la comunicación y evitar que el paciente le hable por WhatsApp en horarios no laborales.

## 2. Rol: Cliente / Paciente (El usuario final)
**Oportunidades de Mejora (Fidelización y Adherencia):**
- **Cronómetro de Descanso Integrado:** Cuando el cliente esté en el gimnasio registrando sus series, un temporizador (ej. 90s) entre series evitaría que cambien a otra app de cronómetro.
- **Tracker de Hábitos Diarios:** Un panel con checkboxes diarios: *"¿Tomé 2L de agua?", "¿Dormí 7 horas?", "¿Cumplí mi dieta?"*. Esto genera uso diario de la app (engagement).
- **PWA (Progressive Web App):** Configurar el manifiesto web para que el cliente pueda "Instalar" la página web en su pantalla de inicio de iPhone/Android como si fuera una app nativa, quitando la barra del navegador de Safari/Chrome.

## 3. Rol: Superadmin (Gestión del SaaS)
**Oportunidades de Mejora (Escalabilidad del Negocio):**
- **Módulo de Suscripciones (Stripe):** Integrar pagos automatizados donde el nutriólogo pierda acceso temporalmente o no pueda agregar clientes si su suscripción mensual expira.
- **Dashboard de Analíticas Globales:** Una vista donde el Superadmin pueda ver métricas de uso: ¿Cuántos clientes activos tiene cada nutriólogo? ¿Cuáles son las funciones más usadas?
- **Límites de Clientes por Plan (Tier Pricing):** Capacidad de ponerle a un nutriólogo un límite según su pago (ej. "Plan Básico: Máximo 20 pacientes activos").

---
*Nota: La recomendación actual es no desarrollar estas funciones hasta conseguir a los primeros usuarios de pago y validar cuáles de estas necesidades son las más urgentes para ellos.*
