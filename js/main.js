import { appState, stationStates } from "./state.js";
import { loadConfiguration, renderConfigs } from "./configuration.js";
import { renderDevices } from "./panels.js";
import { initializeEventEngine } from "./events.js";
import { initializeAdmin } from "./admin.js";
import { detectionCapabilities } from "./detection.js";
import { $ } from "./utils.js";

async function boot() {
 try {
  const config = await loadConfiguration();
  config.stations.forEach(station => appState.stations.set(station.id, { ...station, enabled: true, state: stationStates.IDLE }));
  renderConfigs();
  renderDevices();
  initializeEventEngine();
  initializeAdmin();
  $("#system-status").textContent = "Sistema preparado";
  console.info("Capacidades del prototipo:", detectionCapabilities);
 } catch (error) {
  $("#system-status").textContent = "Error de configuración";
  console.error(error);
  const host = $("#station-configs");
  host.innerHTML = `<p role="alert">No se pudo cargar la configuración. Comprueba que el servidor local está activo y que <code>data/contenido.json</code> existe. ${error.message}</p>`;
 }
}
boot();
