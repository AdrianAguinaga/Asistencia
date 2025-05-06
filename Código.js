// === Codigo.gs – backend unificado v3 ========================
// © 2025 UABC · LIDE
// -------------------------------------------------------------

/*************************
 *  0.  HTML  include()  *
 *************************/
function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

/****************
 *  1. Router   *
 ****************/
function doGet(e) {
  const page = e?.parameter?.page || 'index';
  const tpl  = chooseTpl_(page);
  tpl.baseUrl = ScriptApp.getService().getUrl();        // → para todas las vistas
  return tpl.evaluate()
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
            .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function chooseTpl_(page) {
  switch (page) {
    case 'alumno':     return HtmlService.createTemplateFromFile('FormularioAlumno');
    case 'invitado':   return HtmlService.createTemplateFromFile('FormularioInvitado');
    case 'solicitar':  return HtmlService.createTemplateFromFile('SolicitudRegistro');
    case 'revisar': {
      const t = HtmlService.createTemplateFromFile('RevisarSolicitudes');
      t.solicitudes = getSolicitudesPending();
      return t;
    }
    case 'estadisticas': return HtmlService.createTemplateFromFile('Estadisticas');
    default:              return HtmlService.createTemplateFromFile('Index');
  }
}

/*****************************
 *  2.  Short server helpers *
 *****************************/
function ping()                       { return true; }
function obtenerUrlEstadisticas()     { return ScriptApp.getService().getUrl() + '?page=estadisticas'; }
function esUsuarioAdministrador() {
  const admins = PropertiesService.getScriptProperties().getProperty('ADMINS')?.split(',') || [];
  return admins.includes(Session.getActiveUser().getEmail());
}

/********************************
 *  3.  Registro de asistencia  *
 ********************************/
function registrarAsistencia(nombre, matricula, estado, observaciones) {
  return appendAsistenciaRow_(nombre, matricula, estado, observaciones, 'Alumno');
}

/********************************
 *  Visitantes                   *
 ********************************/

const SH_VIS = 'Visitantes';

function registrarVisitante(nombre, correo, motivo, matricula) {
  try {
    const sh = ensureSheet_(SH_VIS,
      ['Fecha','Hora','Nombre','Correo','Motivo','Matrícula']);
    const fecha = new Date();
    sh.appendRow([
      Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm:ss'),
      nombre,
      correo,
      motivo,
      matricula || ''
    ]);
    return { success:true, message:'✅ Visitante registrado correctamente' };
  } catch (err) {
    return { success:false, message:err.toString() };
  }
}


function appendAsistenciaRow_(nombre, matricula, estado, observaciones, tipo, correo) {
  try {
    const ss  = SpreadsheetApp.getActive();
    const sh  = ss.getSheetByName('Asistencia Detallada') || ss.insertSheet('Asistencia Detallada');
    if (sh.getLastRow() === 0) sh.appendRow(
      ['Fecha','Hora','Nombre','Matrícula','Estado','Observaciones','Tipo','Correo']
    );

    const fecha = new Date();
    sh.appendRow([
      Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm:ss'),
      nombre,
      matricula,
      estado,
      observaciones || '',
      tipo,
      correo || ''
    ]);

    return { success:true, message:'✅ Registro guardado correctamente' };
  } catch (err) {
    return { success:false, message:err.toString() };
  }
}

/********************************
 *  4.  Módulo Solicitudes      *
 ********************************/
const SH_SOL = 'Solicitudes';

function submitSolicitud(data) {
  if (!data?.nombre || !data?.email)
    return { success:false, message:'Datos incompletos' };

  const sh  = ensureSheet_(SH_SOL, ['idx','timestamp','nombre','email','grupo','matricula','estado']);
  const idx = Utilities.getUuid();
  sh.appendRow([idx, new Date(), data.nombre, data.email, data.grupo||'', data.matricula||'', 'pendiente']);
  return { success:true };
}

function getSolicitudesPending() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_SOL);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1)
           .filter(r => r[6] === 'pendiente')
           .map(r => ({ idx:r[0], timestamp:r[1], nombre:r[2], email:r[3], grupo:r[4], matricula:r[5] }));
}

function processSolicitud(idx, accion) {
  if (!['aceptar','rechazar'].includes(accion)) return { success:false, message:'Acción inválida' };
  const sh = SpreadsheetApp.getActive().getSheetByName(SH_SOL);
  if (!sh) return { success:false, message:'Hoja no encontrada' };
  const data = sh.getDataRange().getValues();
  const row  = data.findIndex(r => r[0] == idx);
  if (row < 1) return { success:false, message:'ID inexistente' };
  sh.getRange(row+1,7).setValue(accion);
  return { success:true };
}

/************************************
 *  5.  Estadísticas completas v2   *
 ************************************/
function obtenerEstadisticasCompletas() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Resumen Asistencia');

  // 1) Si la hoja existe y tiene datos, leemos de ahí
  if (sh && sh.getLastRow() > 1) {
    const rows = sh.getDataRange().getValues().slice(1)
      .map(r => ({ fecha:r[0], total:Number(r[1])||0 }))
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    const hoy   = new Date();
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 6);

    return {
      semana:    rows.filter(r => new Date(r.fecha) >= hace7),
      historico: rows
    };
  }

  // 2) Si no existe o está vacía, generamos al vuelo
  const provisional = buildResumenFromSources_();    // ← helper nuevo
  return {
    semana:    provisional.slice(-7),
    historico: provisional
  };
}

/* ------------------------------------------------------- *
 *  Helper: reconstruye array  [{fecha:'yyyy-MM-dd',total}] *
 *  combinando Asistencia Detallada + Visitantes            *
 * ------------------------------------------------------- */
function buildResumenFromSources_() {
  const ss = SpreadsheetApp.getActive();
  const srcSheets = ['Asistencia Detallada', 'Visitantes'];
  const map = {};

  srcSheets.forEach(name => {
    const s = ss.getSheetByName(name);
    if (!s || s.getLastRow() < 2) return;

    const data = s.getDataRange().getValues().slice(1);
    data.forEach(row => {
      const fecha = row[0];                              // col A (Fecha)
      if (!fecha) return;
      const key = Utilities.formatDate(new Date(fecha), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      map[key] = (map[key] || 0) + 1;
    });
  });

  return Object.keys(map).sort().map(k => ({ fecha:k, total:map[k] }));
}
/* -------------------------------------------------- *
 *  Actualiza (o crea) 1 fila en “Resumen Asistencia” *
 *  para la fecha dada                                *
 * -------------------------------------------------- */
function updateResumenAsistencia_(fechaObj){
  const ss = SpreadsheetApp.getActive();
  const sh = ensureSheet_('Resumen Asistencia',
    ['Fecha','Total Alumnos','Presentes','Ausentes','Tarde','Visitantes']);

  const fecha = Utilities.formatDate(fechaObj, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const rows  = sh.getDataRange().getValues();
  let rowIdx  = rows.findIndex((r,i)=> i>0 && r[0] && Utilities.formatDate(r[0], ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === fecha);

  if (rowIdx === -1) { // nueva fila
    sh.appendRow([fecha,1]);        // pondremos los demás luego
    rowIdx = sh.getLastRow() - 1;
  } else {
    sh.getRange(rowIdx+1,2).setValue( Number(rows[rowIdx][1]||0) + 1 ); // ++ total
  }
}

/*******************************************************
 *  Inserta al alumno si NO existe; si existe, actualiza
 *******************************************************/
function addOrUpdateAlumno_({nombre, matricula, grupo}) {
  try {
    const sh = ensureSheet_('Alumnos',
      ['Nombre','Matrícula','Grupo','Estado']);

    // Buscar por matrícula
    const mats = sh.getRange(2,2,Math.max(sh.getLastRow()-1,0),1).getValues().flat();
    const idx  = mats.findIndex(m => String(m) === String(matricula));

    if (idx === -1) {
      // 🔹 Nuevo alumno
      sh.appendRow([nombre, matricula, grupo || '', 'Activo']);
    } else {
      // 🔹 Actualiza datos (nombre / grupo) manteniendo la fila
      const row = idx + 2;
      sh.getRange(row, 1, 1, 3)
        .setValues([[nombre, matricula, grupo || '']]);
    }
    return { success:true };
  } catch (err) {
    return { success:false, message:'Error al guardar en Alumnos: '+err };
  }
}


/********************************
 *  6.  Utilidad interno        *
 ********************************/
function ensureSheet_(name, headers){
  const ss = SpreadsheetApp.getActive();
  let sh   = ss.getSheetByName(name);
  if (!sh){ sh = ss.insertSheet(name); sh.appendRow(headers); }
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}
