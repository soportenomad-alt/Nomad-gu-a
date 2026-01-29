# Formulario de Solicitud (Nomad) – Recolección / Logística

## Qué hace
- KAM: lista (Ángel, Andrea, Marymar, Claudia, KAM MTY) y **autocompleta el correo** del KAM.
- Médico: selector cargado desde `doctors.json` (base extraída del Formulario Nomad).
- Paciente(s): permite **agregar varios**.
- Campos manuales: Prueba, Contacto, Hospital, Dirección, Referencias, Teléfono, Fecha, Horario.
- Al enviar:
  - Genera el correo dirigido a: **log.mx@nomadgenetics.com** y **backoffice@nomadgenetics.com**
  - Agrega al **KAM en CC**
  - Copia el texto al portapapeles como respaldo.

## Uso rápido (sin backend) – Modo GMAIL (compose) (recomendado para empezar)
1) Abre `index.html` (ideal: desde un servidor/hosting; también funciona local).
2) Selecciona KAM → se llena el correo.
3) Completa y envía.
4) Se abrirá tu cliente de correo con el mensaje listo para enviar.

> Importante: En modo Gmail compose (web), el “From” será el correo con el que el KAM tenga abierta su sesión en su correo/cliente.

## Envío automático (opcional) – Google Apps Script (Web App)
Si quieres que al dar “Enviar” se mande sin abrir el correo:

1) En Google Drive crea un proyecto en **Apps Script**.
2) Pega el contenido de `apps_script/Code.gs`.
3) Deploy -> New deployment -> Web app:
   - Execute as: **Me**
   - Who has access: (ideal) **Anyone within your domain**
4) Copia la URL del Web App.
5) En `config.js`:
   - `sendMode: "apps_script"`
   - `appsScriptEndpoint: "TU_URL"`

Notas:
- El remitente real será el dueño del Apps Script, salvo que configures “Send mail as”/alias o delegación.
- Igual se pone `Reply-To` y `CC` con el correo del KAM.

## Cambiar correos KAM o destinatarios
Edita `config.js`:
- `kamEmails` (mapa KAM -> correo)
- `recipients` (Karla y Melina)


## Panel en tiempo real (Firestore)
Este ZIP ya incluye un panel "Solicitudes en tiempo real" que:
- Guarda cada solicitud en Firestore (colección `solicitudes`) **si hay sesión iniciada**.
- Muestra las últimas 20 solicitudes en tiempo real.

Requisitos:
1) En Firebase Console -> Authentication -> habilita **Google** como proveedor.
2) En Firestore Database -> crea la base (modo producción recomendado).
3) Pega reglas (te puedo ajustar según usuarios/correos).



## Login Backoffice (Usuario/Contraseña)
Para que el panel funcione con usuario/contraseña:

1) Firebase Console -> Authentication -> Sign-in method -> habilita **Email/Password**
2) Authentication -> Users -> **Add user**:
   - log.mx@nomadgenetics.com
   - backoffice@nomadgenetics.com
3) Listo. Solo esos 2 correos pueden ver el panel (validación en UI + reglas sugeridas).



## KAM sin login (registro automático)
Este formulario registra solicitudes en Firestore **sin pedir usuario/contraseña** al KAM.
¿Cómo? Inicia una **sesión anónima** en Firebase Auth en segundo plano.

Requisito:
- Firebase Console -> Authentication -> Método de acceso -> **Anónimo = Habilitado**

Backoffice:
- Karla/Melina entran al panel con Email/Password para ver las solicitudes.

