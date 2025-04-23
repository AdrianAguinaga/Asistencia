function registrarAsistencia(nombre, matricula, estado, observaciones) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var hojaAsistencia = spreadsheet.getSheetByName("Asistencia Detallada") || spreadsheet.insertSheet("Asistencia Detallada");

  if (hojaAsistencia.getLastRow() === 0) { 
    hojaAsistencia.appendRow(["Fecha", "Hora", "Nombre", "Matrícula", "Estado", "Observaciones", "Grupo"]);
  }

  var fecha = new Date();
  var alumno = obtenerDetallesAlumno(matricula);

  hojaAsistencia.appendRow([
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), "HH:mm:ss"),
    nombre,
    matricula,
    estado,
    observaciones || "",
    alumno ? alumno.grupo : "Sin grupo"
  ]);

  return { success: true, message: "✅ Asistencia registrada correctamente" };
}

// 📌 Función intermedia para el botón
function registrarDesdeBoton() {
  try {
    var nombre = "Ejemplo";
    var matricula = "12345";
    var estado = "Presente";
    var observaciones = "Ninguna";

    var resultado = registrarAsistencia(nombre, matricula, estado, observaciones);
    
    // Muestra un mensaje en la UI
    SpreadsheetApp.getUi().alert(resultado.message);
  } catch (error) {
    SpreadsheetApp.getUi().alert("❌ Error al registrar la asistencia: " + error.toString());
    Logger.log("Error en registrarDesdeBoton: " + error.toString());
  }
}

// 📌 Optimización en obtenerDetallesAlumno
function obtenerDetallesAlumno(id) {
  try {
    var hojaAlumnos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Alumnos");
    if (!hojaAlumnos) return null;

    var datos = hojaAlumnos.getDataRange().getValues();
    var alumnosMap = datos.slice(1).reduce((map, fila) => {
      if (fila[1]) {  // Evitar registros vacíos
        map[fila[1]] = { nombre: fila[0], id: fila[1], grupo: fila[2], estado: fila[3] };
      }
      return map;
    }, {});

    return alumnosMap[id] || null;
  } catch (error) {
    Logger.log("Error en obtenerDetallesAlumno: " + error.toString());
    return null;
  }
}

// 📌 Optimización en actualizarResumenAsistencia
function actualizarResumenAsistencia() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var hojaAsistencia = spreadsheet.getSheetByName("Asistencia Detallada");
    var hojaResumen = spreadsheet.getSheetByName("Resumen Asistencia") || spreadsheet.insertSheet("Resumen Asistencia");

    if (hojaResumen.getLastRow() === 0) {
      hojaResumen.appendRow(["Fecha", "Total Alumnos", "Presentes", "Ausentes", "Tarde"]);
    }

    var datos = hojaAsistencia.getDataRange().getValues().slice(1);
    var resumenPorFecha = {};

    datos.forEach(([fecha, , , , estado]) => {
      if (!resumenPorFecha[fecha]) {
        resumenPorFecha[fecha] = { totalAlumnos: 0, presentes: 0, ausentes: 0, tarde: 0 };
      }
      resumenPorFecha[fecha].totalAlumnos++;

      if (estado) {
        var estadoKey = estado.toLowerCase();
        resumenPorFecha[fecha][estadoKey] = (resumenPorFecha[fecha][estadoKey] || 0) + 1;
      }
    });

    hojaResumen.getRange(2, 1, hojaResumen.getLastRow() - 1, 5).clearContent();

    Object.keys(resumenPorFecha).forEach(fecha => {
      hojaResumen.appendRow([
        fecha,
        resumenPorFecha[fecha].totalAlumnos,
        resumenPorFecha[fecha].presentes || 0,
        resumenPorFecha[fecha].ausentes || 0,
        resumenPorFecha[fecha].tarde || 0
      ]);
    });

  } catch (error) {
    Logger.log("Error en actualizarResumenAsistencia: " + error.toString());
  }
}
