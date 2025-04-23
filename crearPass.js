// Ejecuta esto UNA sola vez para guardar la contraseña inicial
function establecerContrasenaInicial() {
    const contrasena = "L1D3"; // Cambia aquí tu contraseña inicial
    PropertiesService.getScriptProperties().setProperty("ADMIN_PASS", contrasena);
  }
  // crea una contraseña inicial
  // y la guarda en las propiedades del script