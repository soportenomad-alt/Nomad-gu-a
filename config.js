// Configuración del formulario (edita si cambian correos)
window.NOMAD_FORM_CONFIG = {
  recipients: ["log.mx@nomadgenetics.com", "backoffice@nomadgenetics.com"],
  kamEmails: {"Ángel": "kam2.mx@nomadgenetics.com", "Andrea": "kam3.mx@nomadgenetics.com", "Marymar": "ger.genomica@nomadgenetics.com", "Claudia": "kam.gdl1@nomadgenetics.com", "KAM MTY": "kam.mty1@nomadgenetics.com",
    "Implant Puebla": "vanvanmed@hotmail.com, vanvan.molecular@coionco.com"
},
  // Modo de envío:
  // "mailto" abre el cliente de correo del KAM con To/Cc/Asunto/Cuerpo prellenado.
  // Para envío automático vía Google Apps Script, cambia a "apps_script" y pon tu endpoint.
  sendMode: "mailto",
  appsScriptEndpoint: "" // ej: https://script.google.com/macros/s/XXXXX/exec
};

// Firebase (para panel en tiempo real)
window.NOMAD_FIREBASE_CONFIG = {
  "apiKey": "AIzaSyAX9RykR0eNo1nJkMZwCI-lC3WOhy-x1Q8",
  "authDomain": "guias-de-nomad.firebaseapp.com",
  "projectId": "guias-de-nomad",
  "storageBucket": "guias-de-nomad.firebasestorage.app",
  "messagingSenderId": "967018231893",
  "appId": "1:967018231893:web:2627f7dd419ad71d71bcdc"
};
