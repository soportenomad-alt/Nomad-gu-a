// app.js (no-module, compat)
// BUNDLE_VERSION: v4_20260220
console.log('[Nomad Guias] bundle v4 loaded'); 
// Nota: Este build usa Firebase *compat* para evitar problemas de ES modules (CORS/MIME) en algunos hostings.

function initializeApp(cfg){ return firebase.initializeApp(cfg); }
function getFirestore(){ return firebase.firestore(); }
function getAuth(){ return firebase.auth(); }

function signInWithEmailAndPassword(auth, email, pass){ return auth.signInWithEmailAndPassword(email, pass); }
function signInAnonymously(auth){ return auth.signInAnonymously(); }
function signOut(auth){ return auth.signOut(); }
function onAuthStateChanged(auth, cb){ return auth.onAuthStateChanged(cb); }

function serverTimestamp(){ return firebase.firestore.FieldValue.serverTimestamp(); }

function collection(db, ...segments){
  if (!db) throw new Error("Firestore no inicializado");
  let ref = db.collection(segments[0]);
  for (let i = 1; i < segments.length; i++){
    const seg = segments[i];
    if (i % 2 === 1){
      ref = ref.doc(seg);
    } else {
      ref = ref.collection(seg);
    }
  }
  return ref; // normalmente termina en CollectionReference
}

function doc(db, ...segments){
  if (!db) throw new Error("Firestore no inicializado");
  let ref = db.collection(segments[0]);
  for (let i = 1; i < segments.length; i++){
    const seg = segments[i];
    if (i % 2 === 1){
      ref = ref.doc(seg);
    } else {
      ref = ref.collection(seg);
    }
  }
  return ref; // normalmente termina en DocumentReference
}

function addDoc(colRef, data){ return colRef.add(data); }
function updateDoc(docRef, data){ return docRef.update(data); }

function orderBy(field, dir){ return { __type: "orderBy", field, dir: dir || "asc" }; }
function limit(n){ return { __type: "limit", n }; }

function query(baseRef, ...constraints){
  let q = baseRef;
  for (const c of constraints){
    if (!c) continue;
    if (c.__type === "orderBy") q = q.orderBy(c.field, c.dir);
    if (c.__type === "limit") q = q.limit(c.n);
  }
  return q;
}

function onSnapshot(q, next, error){
  return q.onSnapshot(next, error);
}

function getDocs(q){
  return q.get();
}



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
    body.innerHTML = '<tr><td colspan="16" class="small">Sin datos.</td></tr>';
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
      <td>
        <button class="btn btn-mini btn-follow" type="button"
          data-id="${escapeHtml(it.id || "")}"
          data-medico="${escapeHtml(it.medico || "")}"
          data-kam="${escapeHtml(it.kam || "")}">
          Seguimiento
        </button>
        <div class="small muted" style="margin-top:6px;">
          ${escapeHtml(it.seguimientoEstado || "")}${it.seguimientoProximaFecha ? " • " + escapeHtml(it.seguimientoProximaFecha) : ""}
        </div>
      </td>
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


// ---------- Seguimiento (CRM-style) ----------
let currentSeguimientoId = null;
let currentSeguimientoMedico = "";

function qs(id){ return document.getElementById(id); }

function openSeguimientoModal({id, medico, kam}){
  currentSeguimientoId = id;
  currentSeguimientoMedico = medico || "";
  const modal = qs("seguimientoModal");
  if (!modal) return;

  qs("seguimientoTitle").textContent = `Seguimiento — ${currentSeguimientoMedico || "Solicitud"}`;

  // Pre-fill KAM
  const kamInput = qs("segKam");
  if (kamInput) kamInput.value = kam || "";

  // Reset inputs (do not wipe KAM)
  const estadoSel = qs("segEstado");
  const prox = qs("segProxima");
  const com = qs("segComentario");
  if (estadoSel) estadoSel.value = "";
  if (prox) prox.value = "";
  if (com) com.value = "";

  modal.style.display = "flex";
  loadSeguimientoHistorial();
}

function closeSeguimientoModal(){
  const modal = qs("seguimientoModal");
  if (!modal) return;
  modal.style.display = "none";
  currentSeguimientoId = null;
  currentSeguimientoMedico = "";
}

function fmtDate(d){
  try{
    return d ? d.toLocaleString() : "";
  }catch(e){
    return "";
  }
}

async function loadSeguimientoHistorial(){
  const box = qs("segHistorial");
  if (!box) return;

  if (!db || !currentSeguimientoId){
    box.innerHTML = '<div class="small">—</div>';
    return;
  }

  box.innerHTML = '<div class="small">Cargando…</div>';

  try{
    const qh = query(
      collection(db, "solicitudes", currentSeguimientoId, "seguimiento"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snap = await getDocs(qh);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!items.length){
      box.innerHTML = '<div class="small">Sin historial aún.</div>';
      return;
    }

    box.innerHTML = items.map(it => {
      let created = "";
      try{
        const ca = it.createdAt;
        const d = (ca && typeof ca.toDate === "function") ? ca.toDate() : (ca instanceof Date ? ca : null);
        created = fmtDate(d);
      }catch(e){ created = ""; }

      const estado = it.estado || "";
      const prox = it.proximaFecha || "";
      const kam = it.kam || it.createdBy || "";
      const txt = it.comentario || "";

      return `
        <div class="history-item">
          <div class="h-top">
            <span class="h-date">${escapeHtml(created)}</span>
            ${estado ? `<span class="badge">${escapeHtml(estado)}</span>` : ""}
            ${prox ? `<span class="small muted">Próxima: ${escapeHtml(prox)}</span>` : ""}
            ${kam ? `<span class="small muted">(${escapeHtml(kam)})</span>` : ""}
          </div>
          ${txt ? `<div class="h-text">${escapeHtml(txt)}</div>` : ""}
        </div>
      `;
    }).join("");
  }catch(err){
    console.error(err);
    box.innerHTML = '<div class="small">No se pudo cargar el historial (revisa reglas/permisos).</div>';
  }
}

async function saveSeguimiento(){
  if (!db || !auth || !auth.currentUser){
    alert("Necesitas iniciar sesión para guardar seguimiento.");
    return;
  }
  if (!currentSeguimientoId){
    alert("No hay solicitud seleccionada.");
    return;
  }

  const estado = (qs("segEstado")?.value || "").trim();
  const proximaFecha = (qs("segProxima")?.value || "").trim();
  const kam = (qs("segKam")?.value || "").trim();
  const comentario = (qs("segComentario")?.value || "").trim();

  if (!estado && !comentario && !proximaFecha){
    alert("Agrega al menos un Estado, una Fecha o un Comentario.");
    return;
  }

  try{
    const createdBy = auth.currentUser.email || "usuario";
    // 1) Registrar entrada en subcolección
    await addDoc(collection(db, "solicitudes", currentSeguimientoId, "seguimiento"), {
      estado: estado || "",
      proximaFecha: proximaFecha || "",
      kam: kam || "",
      comentario: comentario || "",
      createdBy,
      createdAt: serverTimestamp()
    });

    // 2) Resumen en documento padre (para verlo en la tabla)
    const parentRef = doc(db, "solicitudes", currentSeguimientoId);
    await updateDoc(parentRef, {
      seguimientoEstado: estado || "",
      seguimientoProximaFecha: proximaFecha || "",
      seguimientoUltimoComentario: comentario || "",
      seguimientoUpdatedAt: serverTimestamp()
    });

    // Limpia comentario y recarga historial
    const com = qs("segComentario");
    if (com) com.value = "";
    await loadSeguimientoHistorial();

    // Refresca tabla sin esperar snapshot
    try{ await refreshOnce(); }catch(e){}
  }catch(err){
    console.error(err);
    alert("No se pudo guardar el seguimiento. Revisa consola/reglas Firestore.");
  }
}

function bindSeguimientoUI(){
  // Close handlers
  qs("btnSeguimientoClose")?.addEventListener("click", closeSeguimientoModal);
  qs("seguimientoBackdrop")?.addEventListener("click", closeSeguimientoModal);

  // Save
  qs("btnSeguimientoSave")?.addEventListener("click", saveSeguimiento);

  // Delegación: botón en tabla
  document.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.(".btn-follow");
    if (!btn) return;
    const id = btn.getAttribute("data-id") || "";
    const medico = btn.getAttribute("data-medico") || "";
    const kam = btn.getAttribute("data-kam") || "";
    if (!id) return;
    openSeguimientoModal({id, medico, kam});
  });

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      const modal = qs("seguimientoModal");
      if (modal && modal.style.display !== "none") closeSeguimientoModal();
    }
  });
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
      body.innerHTML = '<tr><td colspan="16" class="small">No se pudo leer Firestore (revisa reglas / login).</td></tr>';
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
  const prueba = document.getElementById("prueba")?.value?.trim() || "";
  const contacto = document.getElementById("contacto")?.value?.trim() || "";
  const hospital = document.getElementById("hospital")?.value?.trim() || "";
  const direccion = document.getElementById("direccion")?.value?.trim() || "";
  const referencias = document.getElementById("referencias")?.value?.trim() || "";
  const telefono = document.getElementById("telefono")?.value?.trim() || "";
  const fecha = document.getElementById("fecha")?.value?.trim() || "";
  const horario = document.getElementById("horario")?.value?.trim() || "";
  const tipoSolicitud = document.getElementById("tipoSolicitud")?.value?.trim() || "";


  await addDoc(collection(db, "solicitudes"), {
    createdAt: serverTimestamp(),
    createdByUid: auth.currentUser.uid,
    createdByEmail: auth.currentUser.email || null,
    kam, kamEmail, medico, pacientes,
    prueba, contacto, hospital, direccion, referencias, telefono,
    fecha, horario,
    tipoSolicitud,
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

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Nombre del paciente";
  input.value = value;
  input.required = true;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "remove";
  btn.textContent = "Quitar";
  btn.addEventListener("click", () => {
    item.remove();
    ensureAtLeastOnePatient();
  });

  item.appendChild(input);
  item.appendChild(btn);
  wrap.appendChild(item);
}

function getPatients() {
  const wrap = document.getElementById("patientsWrap");
  const inputs = [...wrap.querySelectorAll("input")];
  return inputs.map(i => i.value.trim()).filter(Boolean);
}

function ensureAtLeastOnePatient() {
  const wrap = document.getElementById("patientsWrap");
  if (wrap.querySelectorAll("input").length === 0) addPatient("");
}

function buildEmailPayload() {
  const cfg = window.NOMAD_FORM_CONFIG;

  const kam = document.getElementById("kam").value.trim();
  const kamEmail = document.getElementById("kamEmail").value.trim();
  const medico = document.getElementById("medico").value.trim();
  const pacientes = getPatients();

  const prueba = document.getElementById("prueba").value.trim();
  const contacto = document.getElementById("contacto").value.trim();
  const hospital = document.getElementById("hospital").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const referencias = document.getElementById("referencias").value.trim();
  const tel = document.getElementById("telefono").value.trim();
  const fecha = document.getElementById("fecha").value.trim();
  const horario = document.getElementById("horario").value.trim();
  const tipoSolicitud = document.getElementById("tipoSolicitud").value.trim();


  const subject = `Solicitud de recolección | ${medico} | ${hospital} | ${fecha}`;

  const lines = [
    "SOLICITUD DE RECOLECCIÓN / LOGÍSTICA - NOMAD",
    "------------------------------------------------------------",
    `Tipo de solicitud: ${tipoSolicitud || "-"}`,
    `KAM: ${kam}`,
    `Correo KAM: ${kamEmail}`,
    "",
    `Médico: ${medico}`,
    `Paciente(s): ${pacientes.join(" | ")}`,
    `Prueba: ${prueba}`,
    `Contacto (médico/responsable muestra): ${contacto}`,
    "",
    `Hospital: ${hospital}`,
    `Dirección: ${direccion}`,
    `Referencias: ${referencias}`,
    `Teléfono contacto: ${tel}`,
    "",
    `Fecha: ${fecha}`,
    `Horario: ${horario}`,
    "------------------------------------------------------------",
    "Nota: Responder a este correo para coordinar confirmación y ajustes.",
  ];

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
    "kam", "kamEmail", "medico", "prueba", "contacto", "hospital",
    "direccion","referencias", "telefono", "fecha", "horario"
  ];
  for (const id of reqIds){
    const el = document.getElementById(id);
    if (!el.value || !String(el.value).trim()) return false;
  }
  const pats = getPatients();
  return pats.length > 0 && pats.every(p => p.length > 0);
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

  // Persist tipo de solicitud (se registra al seleccionarlo)
  const tipoSel = document.getElementById("tipoSolicitud");
  if (tipoSel){
    const savedTipo = localStorage.getItem("nomad_tipoSolicitud");
    if (savedTipo && !tipoSel.value) tipoSel.value = savedTipo;
    tipoSel.addEventListener("change", () => {
      localStorage.setItem("nomad_tipoSolicitud", tipoSel.value || "");
    });
  }

  document.getElementById("addPatientBtn").addEventListener("click", () => addPatient(""));
  ensureAtLeastOnePatient();

  document.getElementById("solicitudForm").addEventListener("submit", onSubmit);

  // Firebase + Realtime panel
  initFirebase();

  // Seguimiento modal
  bindSeguimientoUI();

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

// Expose key functions for safety (in case hosting wraps scopes)
try{ window.bindSeguimientoUI = bindSeguimientoUI; }catch(e){}
try{ window.openSeguimientoModal = openSeguimientoModal; }catch(e){}
try{ window.saveSeguimiento = saveSeguimiento; }catch(e){}
