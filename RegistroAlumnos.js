// Función para añadir un nuevo alumno
function agregarAlumno(nombre, matricula, grupo) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var hojaAlumnos = spreadsheet.getSheetByName("Alumnos");

    // ✅ Si la hoja no existe, la crea con encabezados
    if (!hojaAlumnos) {
      hojaAlumnos = spreadsheet.insertSheet("Alumnos");
      hojaAlumnos.appendRow(["Nombre", "Matrícula", "Grupo", "Estado"]);
    }

    // ✅ Si la hoja está vacía (sin encabezado), se agregan los encabezados
    var numRows = hojaAlumnos.getLastRow();
    if (numRows === 0) { 
      hojaAlumnos.appendRow(["Nombre", "Matrícula", "Grupo", "Estado"]);
      numRows = 1;  // Actualizar número de filas
    }

    // ✅ Si solo tiene encabezado, evitamos leer datos inexistentes
    var datos = numRows === 1 ? [] : hojaAlumnos.getRange(2, 1, numRows - 1, 2).getValues();

    // ✅ Verificar si la matrícula ya existe antes de agregar un nuevo alumno
    if (datos.some(fila => fila[1] == matricula)) {
      throw new Error("❌ Ya existe un alumno con esta Matrícula.");
    }

    // ✅ Agregar nuevo alumno a la hoja
    hojaAlumnos.appendRow([nombre, matricula, grupo, "Activo"]);

    return { success: true, message: "✅ Alumno registrado correctamente." };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}



// Función para editar información de un alumno
function editarAlumno(matriculaOriginal, nuevoNombre, nuevaMatricula, nuevoGrupo) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var hojaAlumnos = spreadsheet.getSheetByName("Alumnos");

    if (!hojaAlumnos) {
      throw new Error("La hoja de Alumnos no existe");
    }

    var datos = hojaAlumnos.getRange(2, 1, hojaAlumnos.getLastRow() - 1, 4).getValues();
    var filaEncontrada = -1;

    // Verificar si la nueva matrícula ya existe
    for (var i = 0; i < datos.length; i++) {
      if (datos[i][1] == nuevaMatricula && datos[i][1] != matriculaOriginal) {
        throw new Error("La nueva Matrícula ya está en uso por otro alumno.");
      }
      if (datos[i][1] == matriculaOriginal) {
        filaEncontrada = i + 2;
      }
    }

    if (filaEncontrada === -1) {
      throw new Error("Alumno no encontrado");
    }

    // Actualizar datos
    hojaAlumnos.getRange(filaEncontrada, 1, 1, 3).setValues([[nuevoNombre, nuevaMatricula, nuevoGrupo]]);

    return { success: true, message: "Alumno actualizado correctamente" };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// Función para obtener lista de alumnos activos
function obtenerListaAlumnos() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var hojaAlumnos = spreadsheet.getSheetByName("Alumnos");

  if (!hojaAlumnos) {
    return [];
  }

  var numRows = hojaAlumnos.getLastRow();

  // ✅ Si solo tiene encabezado o está vacía, devolvemos una lista vacía.
  if (numRows <= 1) {
    return [];
  }

  var datos = hojaAlumnos.getRange(2, 1, numRows - 1, 4).getValues(); 

  return datos.map(alumno => ({
    nombre: alumno[0],
    matricula: alumno[1],
    grupo: alumno[2]
  }));
}

