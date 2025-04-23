// Código.js

/**
 * Manejo de páginas: Index y Estadísticas con autenticación.
 */
function doGet(e) {
  const params = e.parameter || {};
  const page = (params.page || 'index').toLowerCase();
  let template;

  switch (page) {
    case 'estadisticas':
      // Validación de contraseña de administrador
      const pass = params.pass || '';
      if (!validarAccesoAdministrador(pass)) {
        // Mostrar pantalla de login si no autenticado
        template = HtmlService.createTemplateFromFile('LoginStats');
        template.mensajeError = pass ? 'Contraseña incorrecta.' : '';
        template.baseUrl = ScriptApp.getService().getUrl();
      } else {
        // Ya autenticado, carga estadísticas
        template = HtmlService.createTemplateFromFile('Estadisticas');
      }
      break;

    default:
      template = HtmlService.createTemplateFromFile('Index');
  }

  return template.evaluate()
    .setTitle('Registro de Asistencia')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Incluir fragmentos HTML.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Función ping para verificar conexión.
 */
function ping() {
  return 'pong';
}

/**
 * Retorna URL de estadísticas.
 */
function obtenerUrlEstadisticas() {
  return ScriptApp.getService().getUrl() + '?page=estadisticas';
}

/**
 * Autenticación de administrador.
 * La contraseña se almacena en las propiedades del script como 'ADMIN_PASS'.
 */
function validarAccesoAdministrador(passIngresado) {
  const props = PropertiesService.getScriptProperties();
  const passReal = props.getProperty('ADMIN_PASS');
  return passIngresado === passReal;
}

/**
 * Configuración inicial de hojas (opcional).
 */
function configuracionInicial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // ... lógica de configuración (Alumnos, Asistencia Detallada, Visitantes)
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Asistencia')
    .addItem('Configuración Inicial','configuracionInicial')
    .addToUi();
}

/**
 * Obtiene la lista de alumnos para el dropdown.
 */
function obtenerListaAlumnos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('Alumnos');
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues().slice(1);
  return datos.map(r => ({ nombre: r[0], matricula: r[1], grupo: r[2], estado: r[3] }));
}

/**
 * Registra asistencia de alumno.
 */
function registrarAsistencia(nombre, matricula, estado, observaciones) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName('Asistencia Detallada');
  if (!hoja) {
    hoja = ss.insertSheet('Asistencia Detallada');
    hoja.appendRow(['Fecha','Hora','Nombre','Matrícula','Estado','Observaciones','Grupo']);
  }
  const fecha = new Date();
  const alumno = obtenerListaAlumnos().find(a => a.matricula === matricula);
  const grupo = alumno ? alumno.grupo : 'Sin grupo';
  hoja.appendRow([
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm:ss'),
    nombre, matricula, estado, observaciones||'', grupo
  ]);
  return { success: true, message: '✅ Asistencia registrada correctamente.' };
}

// **
//  * Registra invitado, recibe matrícula opcional.
//  */
function registrarVisitante(nombre, correo, motivo, matricula) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName('Visitantes');

  // Crear hoja si no existe o está vacía, con encabezado actualizado
  if (!hoja) {
    hoja = ss.insertSheet('Visitantes');
    hoja.appendRow(['Fecha','Hora','Nombre','Matrícula','Correo','Motivo']);
  } else if (hoja.getLastRow() === 0) {
    hoja.appendRow(['Fecha','Hora','Nombre','Matrícula','Correo','Motivo']);
  }

  const fecha = new Date();
  hoja.appendRow([
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'HH:mm:ss'),
    nombre,
    matricula || '',
    correo,
    motivo
  ]);

  return { success: true, message: '✅ Invitado registrado correctamente.' };
}


/**
 * Estadísticas: última semana e histórico.
 */
function obtenerAsistenciaUltimaSemana() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('Asistencia Detallada');
  if (!hoja) return [];
  const data = hoja.getDataRange().getValues();
  const hoy = new Date(), hace7 = new Date(hoy.getTime() - 6*24*60*60*1000);
  const map = {};
  data.slice(1).forEach(r => {
    const fecha = r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : r[0];
    const objFecha = new Date(fecha);
    if (objFecha >= hace7 && objFecha <= hoy) map[fecha] = (map[fecha]||0)+1;
  });
  return Object.keys(map).sort().map(f => ({ fecha: f, total: map[f] }));
}

function obtenerAsistenciaHistorica() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('Asistencia Detallada');
  if (!hoja) return [];
  const data = hoja.getDataRange().getValues();
  const map = {};
  data.slice(1).forEach(r => {
    const fecha = r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : r[0];
    map[fecha] = (map[fecha]||0)+1;
  });
  return Object.keys(map).sort().map(f => ({ fecha: f, total: map[f] }));
}

/**
 * Devuelve ambas estadísticas.
 */
function obtenerEstadisticasCompletas() {
  return { semana: obtenerAsistenciaUltimaSemana(), historico: obtenerAsistenciaHistorica() };
}
