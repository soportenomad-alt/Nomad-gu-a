// app.js (ES module)

// ---------- Firebase (Realtime Panel) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, limit, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


// ---------- Utilidades ----------
function escapeHtml(v){
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

let fbApp = null;
let db = null;
let auth = null;
let unsubscribe = null;
let lastRealtimeRows = [];

const BACKOFFICE_EMAILS = ["log.mx@nomadgenetics.com", "backoffice@nomadgenetics.com"];

function initFirebase(){
  const cfg = window.NOMAD_FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId){
    console.warn("Firebase config missing: window.NOMAD_FIREBASE_CONFIG");
    return;
  }
  fbApp = initializeApp(cfg);
  db = getFirestore(fbApp);
  auth = getAuth(fbApp);
}

async function ensureAnonSession(){
  // Para que cualquier KAM pueda registrar sin credenciales,
  // iniciamos sesión anónima en segundo plano (si aún no hay sesión).
  if (!auth) return;
  if (auth.currentUser) return;
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error(e);
  }
}

function fmtDate(ts){
  try{
    if (!ts) return "";
    // Firestore Timestamp
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  }catch(_){
    return "";
  }
}


function toggleDataWrap(show){
  const wrap = document.getElementById("rtDataWrap");
  if (wrap) wrap.style.display = show ? "" : "none";
}

function setAuthUI(user){
  const authStatus = document.getElementById("authStatus");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnExport = document.getElementById("btnExport");

  if (!authStatus) return;

  if (user){
    const email = (user.email || "").toLowerCase();
    if (!BACKOFFICE_EMAILS.map(e=>e.toLowerCase()).includes(email)){
      authStatus.textContent = `Sin acceso para: ${user.email || "usuario"}.`;
      toggleDataWrap(false);
      btnLogin.style.display = "none";
      btnLogout.style.display = "";
      btnRefresh.style.display = "none";
    if (btnExport) btnExport.style.display = "none";
      if (btnExport) btnExport.style.display = "none";
      return;
    }
    authStatus.textContent = `Sesión Backoffice: ${user.email}`;
    toggleDataWrap(true);
    btnLogin.style.display = "none";
    btnLogout.style.display = "";
    btnRefresh.style.display = "";
    if (btnExport) btnExport.style.display = "";
  } else {
    authStatus.textContent = "Acceso solo para Backoffice. Inicia sesión con usuario/contraseña.";
    toggleDataWrap(false);
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    btnRefresh.style.display = "none";
    if (btnExport) btnExport.style.display = "none";
      if (btnExport) btnExport.style.display = "none";
  }
}

async function login(){
  if (!auth) return alert("Firebase Auth no está inicializado.");
  const email = (document.getElementById("loginEmail")?.value || "").trim();
  const pass  = (document.getElementById("loginPass")?.value || "").trim();
  if (!email || !pass) return alert("Escribe usuario y contraseña.");

  try{
    // Si hay sesión anónima previa, cerramos para evitar conflictos
    if (auth.currentUser?.isAnonymous){
      await signOut(auth);
    }
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(e){
    console.error(e);
    const code = e?.code || "";
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")){
      alert("Usuario o contraseña incorrectos. Verifica que el correo exista en Firebase Authentication y que la contraseña sea la correcta.");
    } else if (code.includes("auth/too-many-requests")){
      alert("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
    } else if (code.includes("auth/unauthorized-domain")){
      alert("Dominio no autorizado. Si estás abriendo el archivo local (file://), súbelo a Hosting o agrega el dominio autorizado en Firebase Auth > Configuración > Dominios autorizados.");
    } else {
      alert("No se pudo iniciar sesión. Revisa la consola para más detalles.");
    }
  }
}

async function logout(){
  if (!auth) return;
  await signOut(auth);
}

function renderRows(items){
  const body = document.getElementById("rtBody");
  if (!body) return;

  body.innerHTML = "";
  if (!items || !items.length){
    body.innerHTML = '<tr><td colspan="14" class="small">Sin datos.</td></tr>';
    return;
  }

  for (const it of items){
    // createdAt puede ser Timestamp (Firestore) u objeto Date
    let createdAtText = "";
    try{
      const ca = it.createdAt;
      const d = (ca && typeof ca.toDate === "function") ? ca.toDate() : (ca instanceof Date ? ca : null);
      createdAtText = d ? d.toLocaleString() : "";
    }catch(e){ createdAtText = ""; }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(createdAtText)}</td>
      <td>${escapeHtml(it.tipoSolicitud || "")}</td>
      <td>${escapeHtml(it.kam || "")}</td>
      <td>${escapeHtml(it.kamEmail || "")}</td>
      <td>${escapeHtml(it.medico || "")}</td>
      <td>${escapeHtml(Array.isArray(it.pacientes) ? it.pacientes.join(" | ") : (it.pacientes || ""))}</td>
      <td>${escapeHtml(it.prueba || "")}</td>
      <td>${escapeHtml(it.contacto || "")}</td>
      <td>${escapeHtml(it.telefono || "")}</td>
      <td>${escapeHtml(it.hospital || "")}</td>
      <td>${escapeHtml(it.direccion || "")}</td>
      <td>${escapeHtml(it.referencias || "")}</td>
      <td>${escapeHtml(it.comentarios || "")}</td>
      <td>${escapeHtml(it.fecha || "")}</td>
      <td>${escapeHtml(it.horario || "")}</td>
    `;
    body.appendChild(tr);
  }
}

function exportToExcel(){
  const table = document.getElementById("rtTable");
  const tbody = document.getElementById("rtBody");
  if (!table || !tbody){
    alert("No se encontró la tabla para exportar.");
    return;
  }

  // Headers
  const headers = Array.from(table.querySelectorAll("thead th")).map(th => (th.textContent || "").trim()).filter(Boolean);

  // Rows
  const rows = [];
  tbody.querySelectorAll("tr").forEach(tr => {
    const tds = Array.from(tr.querySelectorAll("td")).map(td => (td.textContent || "").trim());
    if (tds.length === 0) return;
    if ((tds[0] || "").toLowerCase().includes("sin datos")) return;

    const obj = {};
    headers.forEach((h, i) => { obj[h] = tds[i] ?? ""; });
    rows.push(obj);
  });

  if (rows.length === 0){
    alert("No hay datos para exportar (primero carga/actualiza las solicitudes).");
    return;
  }

  const filename = `Solicitudes_Nomad_${new Date().toISOString().slice(0,10)}.xlsx`;

  if (window.XLSX){
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
    XLSX.writeFile(wb, filename);
    return;
  }

  // Fallback CSV
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => esc(r[h])).join(","))).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(".xlsx",".csv");
  document.body.appendChild(a);
  a.click();
  a.remove();
}


function subscribeRealtime(){
  if (!db) return;
  // Limpia suscripción previa
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  const q = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRows(items);
  }, (err) => {
    console.error(err);
    const body = document.getElementById("rtBody");
    if (body){
      body.innerHTML = '<tr><td colspan="14" class="small">No se pudo leer Firestore (revisa reglas / login).</td></tr>';
    }
  });
}

async function refreshOnce(){
  if (!db) return;
  const q = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderRows(items);
}

async function logSolicitudIfPossible(payload){
  // payload contiene {to, cc, subject, body} pero también usamos el formulario actual
  if (!db || !auth) return;
  if (!auth.currentUser){
    // No bloqueamos el flujo, solo avisamos con un console warn
    console.warn("No auth session. Not logging to Firestore.");
    return;
  }

  // Construimos data desde el formulario (más estructurado que el body)
  const kam = document.getElementById("kam")?.value?.trim() || "";
  const kamEmail = document.getElementById("kamEmail")?.value?.trim() || "";
  const medico = document.getElementById("medico")?.value?.trim() || "";
  const pacientes = getPatients();
  let prueba = "";
  const pats = getPatients();
  if (pats.length <= 1) {
    prueba = document.getElementById("prueba")?.value?.trim() || "";
  } else {
    const det = getPatientsWithTests();
    prueba = det.map(d => `${d.paciente}: ${d.prueba}`).join(" | ");
  }
  const contacto = document.getElementById("contacto")?.value?.trim() || "";
  const hospital = document.getElementById("hospital")?.value?.trim() || "";
  const direccion = document.getElementById("direccion")?.value?.trim() || "";
  const referencias = document.getElementById("referencias")?.value?.trim() || "";
  const telefono = document.getElementById("telefono")?.value?.trim() || "";
  const comentarios = document.getElementById("comentarios")?.value?.trim() || "";
  const fecha = document.getElementById("fecha")?.value?.trim() || "";
  const horario = document.getElementById("horario")?.value?.trim() || "";

  await addDoc(collection(db, "solicitudes"), {
    createdAt: serverTimestamp(),
    createdByUid: auth.currentUser.uid,
    createdByEmail: auth.currentUser.email || null,
    kam, kamEmail, medico, pacientes,
    prueba, contacto, hospital, direccion, referencias, telefono,
    comentarios,
    fecha, horario,
    emailTo: payload.to,
    emailCc: payload.cc,
    emailSubject: payload.subject
  });
}

// ---------- Form logic ----------
async function loadDoctors() {
  const input = document.getElementById("medico");
  const list = document.getElementById("medicoList");
  if (!input || !list) return;

  // Limpia lista
  list.innerHTML = "";

  try{
    const res = await fetch("./doctors.json", {cache:"no-store"});
    const doctors = await res.json();

    // Para rendimiento, usamos datalist (búsqueda por escritura)
    doctors.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      list.appendChild(opt);
    });

    // Opcional: si quieres limpiar el valor al cargar
    // input.value = "";

  }catch(e){
    console.error(e);
    const err = document.getElementById("errorBox");
    err.style.display = "block";
    err.textContent = "No se pudo cargar la base de médicos (doctors.json). Verifica que el archivo esté junto a index.html.";
  }
}

function setKamEmailFromSelection() {
  const cfg = window.NOMAD_FORM_CONFIG;
  const kamSel = document.getElementById("kam");
  const email = cfg.kamEmails[kamSel.value] || "";
  const kamEmail = document.getElementById("kamEmail");
  kamEmail.value = email;
}

function addPatient(value="") {
  const wrap = document.getElementById("patientsWrap");
  const item = document.createElement("div");
  item.className = "patient-item";

  const name = document.createElement("input");
  name.type = "text";
  name.placeholder = "Nombre del paciente";
  name.value = value;
  name.required = true;
  name.className = "patient-name";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "remove";
  btn.textContent = "Quitar";
  btn.addEventListener("click", () => {
    item.remove();
    ensureAtLeastOnePatient();
    updatePatientsUI();
  });

  item.appendChild(name);
  item.appendChild(btn);
  wrap.appendChild(item);

  updatePatientsUI();
}

function getPatients() {
  const wrap = document.getElementById("patientsWrap");
  const inputs = [...wrap.querySelectorAll(".patient-name")];
  return inputs.map(i => i.value.trim()).filter(Boolean);
}

function getPatientsWithTests() {
  const wrap = document.getElementById("patientsWrap");
  const items = [...wrap.querySelectorAll(".patient-item")];
  return items.map(it => ({
    paciente: (it.querySelector(".patient-name")?.value || "").trim(),
    prueba: (it.querySelector(".patient-test")?.value || "").trim(),
  })).filter(o => o.paciente);
}

function updatePatientsUI() {
  const wrap = document.getElementById("patientsWrap");
  const items = [...wrap.querySelectorAll(".patient-item")];
  const multi = items.length > 1;

  const pruebaInput = document.getElementById("prueba");
  const pruebaField = pruebaInput ? pruebaInput.closest(".field") : null;

  if (multi) {
    if (pruebaField) pruebaField.style.display = "none";
    if (pruebaInput) pruebaInput.required = false;

    for (const item of items) {
      let t = item.querySelector(".patient-test");
      if (!t) {
        t = document.createElement("input");
        t.type = "text";
        t.placeholder = "Prueba";
        t.className = "patient-test";
        const name = item.querySelector(".patient-name");
        name.insertAdjacentElement("afterend", t);
      }
      t.required = true;
    }
  } else {
    if (pruebaField) pruebaField.style.display = "";
    if (pruebaInput) pruebaInput.required = true;

    for (const item of items) {
      const t = item.querySelector(".patient-test");
      if (t) t.remove();
    }
  }
}

function ensureAtLeastOnePatient() {
  const wrap = document.getElementById("patientsWrap");
  if (wrap.querySelectorAll(".patient-name").length === 0) addPatient("");
  updatePatientsUI();
}


function buildEmailPayload() {
  const cfg = window.NOMAD_FORM_CONFIG;

  const kam = document.getElementById("kam").value.trim();
  const kamEmail = document.getElementById("kamEmail").value.trim();
  const medico = document.getElementById("medico").value.trim();
  const pacientes = getPatients();

  const contacto = document.getElementById("contacto").value.trim();
  const hospital = document.getElementById("hospital").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const referencias = document.getElementById("referencias").value.trim();
  const tel = document.getElementById("telefono").value.trim();
  const comentarios = (document.getElementById("comentarios")?.value || "").trim();
  const fecha = document.getElementById("fecha").value.trim();
  const horario = document.getElementById("horario").value.trim();

  let prueba = "";
  let pacientesYPruebasLines = [];

  if (pacientes.length <= 1) {
    prueba = document.getElementById("prueba").value.trim();
  } else {
    const det = getPatientsWithTests();
    prueba = det.map(d => `${d.paciente}: ${d.prueba}`).join(" | ");
    pacientesYPruebasLines = det.map(d => `- ${d.paciente}: ${d.prueba}`);
  }

  const patientLabel =
    pacientes.length === 1 ? pacientes[0] :
    (pacientes.length > 1 ? `${pacientes[0]} +${pacientes.length - 1}` : "");

  const subject = `Solicitud de recolección | ${patientLabel || medico} | ${hospital} | ${fecha}`;

  const lines = [
    "SOLICITUD DE RECOLECCIÓN / LOGÍSTICA - NOMAD",
    "------------------------------------------------------------",
    `KAM: ${kam}`,
    `Correo KAM: ${kamEmail}`,
    "",
    `Médico: ${medico}`,
  ];

  if (pacientes.length <= 1) {
    lines.push(`Paciente(s): ${pacientes.join(" | ")}`);
    lines.push(`Prueba: ${prueba}`);
  } else {
    lines.push("Pacientes y Pruebas:");
    lines.push(...pacientesYPruebasLines);
  }

  lines.push(
    `Contacto (médico/responsable muestra): ${contacto}`,
    "",
    `Hospital: ${hospital}`,
    `Dirección: ${direccion}`,
    `Referencias: ${referencias}`,
    `Teléfono contacto: ${tel}`,
    (comentarios ? `Comentarios: ${comentarios}` : ""),
    "",
    `Fecha: ${fecha}`,
    `Horario: ${horario}`,
    "------------------------------------------------------------",
    "Nota: Responder a este correo para coordinar confirmación y ajustes.",
  );

  const body = lines.join("\n");

  return {
    to: cfg.recipients.join(","),
    cc: kamEmail || "",
    subject,
    body
  };
}

function validateRequired() {
  const reqIds = [
    "kam", "kamEmail", "medico", "contacto", "hospital",
    "direccion","referencias", "telefono", "fecha", "horario"
  ];
  for (const id of reqIds){
    const el = document.getElementById(id);
    if (!el.value || !String(el.value).trim()) return false;
  }

  const pats = getPatients();
  if (pats.length === 0 || !pats.every(p => p.length > 0)) return false;

  if (pats.length <= 1) {
    const prueba = document.getElementById("prueba");
    return !!(prueba && String(prueba.value || "").trim());
  }

  const det = getPatientsWithTests();
  return det.length === pats.length && det.every(d => d.prueba && d.prueba.trim().length > 0);
}


function openGmailCompose({to, cc, subject, body}) {
  // Abre el redactor de Gmail en el navegador
  const url = "https://mail.google.com/mail/?view=cm&fs=1" +
    `&to=${encodeURIComponent(to)}` +
    (cc ? `&cc=${encodeURIComponent(cc)}` : "") +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank");
}

function copySummaryToClipboard(payload){
  const txt = `TO: ${payload.to}\nCC: ${payload.cc}\nSUBJECT: ${payload.subject}\n\n${payload.body}`;
  navigator.clipboard.writeText(txt)
    .then(()=> console.log("Texto copiado ✅"))
    .catch(()=> console.warn("No se pudo copiar."));
}

async function onSubmit(ev){
  ev.preventDefault();

  const err = document.getElementById("errorBox");
  err.style.display="none";
  err.textContent="";

  if (!validateRequired()){
    err.style.display="block";
    err.textContent="Faltan campos obligatorios. Revisa KAM, correo KAM, médico, al menos 1 paciente y los datos de logística.";
    return;
  }

  const payload = buildEmailPayload();

  // Copia al portapapeles como respaldo
  copySummaryToClipboard(payload);

  // Guarda en Firestore (asegura sesión anónima si no hay login)
  try{
    await ensureAnonSession();
    await logSolicitudIfPossible(payload);
  }catch(e){
    console.error(e);
  }

  // Abre Gmail compose
  openGmailCompose(payload);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Form
  await loadDoctors();

  document.getElementById("kam").addEventListener("change", setKamEmailFromSelection);

  document.getElementById("addPatientBtn").addEventListener("click", () => addPatient(""));
  ensureAtLeastOnePatient();

  document.getElementById("solicitudForm").addEventListener("submit", onSubmit);

  // Firebase + Realtime panel
  initFirebase();

  // Attach auth buttons
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnExport = document.getElementById("btnExport");
  if (btnLogin) btnLogin.addEventListener("click", () => login().catch(console.error));
  if (btnLogout) btnLogout.addEventListener("click", () => logout().catch(console.error));
  if (btnRefresh) btnRefresh.addEventListener("click", () => refreshOnce().catch(console.error));
  if (btnExport) btnExport.addEventListener("click", () => exportToExcel());

  if (auth){
    onAuthStateChanged(auth, (user) => {
      setAuthUI(user);
      if (user){
        const email = (user.email || "").toLowerCase();
        if (BACKOFFICE_EMAILS.map(e=>e.toLowerCase()).includes(email)){
          subscribeRealtime();
        } else {
          renderRows([]);
          if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        }
      } else {
        renderRows([]);
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      }
    });
  }
});
