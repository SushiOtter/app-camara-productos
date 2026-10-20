import { appState } from "./state.js";
import { $, announce } from "./utils.js";
import { renderDevices } from "./panels.js";
import { emitEvent, resetStation, resetStations } from "./events.js";
import { initializeCameraControls, resetCameraPreferences, stopCamera } from "./camera.js";
import { clearSavedConfiguration, loadConfiguration, renderConfigs, saveConfiguration } from "./configuration.js";

let guidedTimer = null;
let guidedIndex = 0;
const GUIDED_INTERVAL_KEY = "beauty-tech-guided-interval-v1";
function guidedIntervalMs() {
 const field = $("#guided-interval");
 const seconds = Math.max(12, Math.min(45, Number(field.value) || 14.5));
 field.value = String(seconds);
 return seconds * 1000;
}
function stopGuidedDemo() { if (guidedTimer) clearTimeout(guidedTimer); guidedTimer = null; guidedIndex = 0; $("#guided-stop").hidden = true; $("#guided-complete").hidden = true; }
function runGuidedStep() {
 const enabled = [...appState.stations.values()].filter(station => station.enabled);
 if (appState.mode !== "public" || !enabled.length || guidedIndex >= enabled.length) {
  guidedTimer = null;
  resetStations();
  $("#guided-stop").hidden = true;
  $("#guided-complete").hidden = false;
  announce("Demostración guiada completada.");
  return;
 }
 const station = enabled[guidedIndex++];
 emitEvent("entry");
 const interval = guidedIntervalMs();
 emitEvent("attention", station.id, { proximity: 0.85, dwellMs: interval, orientation: null, source: "guided-demo" });
 announce(`Recorrido guiado · ${guidedIndex}/${enabled.length}: ${station.name}`);
 guidedTimer = setTimeout(runGuidedStep, interval);
}

function startGuidedDemo() {
 const enabled = [...appState.stations.values()].filter(station => station.enabled);
 if (!enabled.length) return announce("Activa al menos una estación para iniciar la demostración.");
 stopGuidedDemo();
 stopCamera();
 setPublicMode(true);
 $("#public-mode-label").textContent = "SIMULACIÓN GUIADA";
 $("#guided-stop").hidden = false;
 runGuidedStep();
}

export function initializeAdmin() {
 initializeCameraControls();
 try {
   const savedInterval = Number(localStorage.getItem(GUIDED_INTERVAL_KEY));
   if (Number.isFinite(savedInterval) && savedInterval >= 12 && savedInterval <= 45) $("#guided-interval").value = String(savedInterval);
 } catch (error) { console.warn("No se pudo recuperar la duración de la demo.", error); }
 $("#guided-interval").addEventListener("change", event => {
   const interval = guidedIntervalMs() / 1000;
   try { localStorage.setItem(GUIDED_INTERVAL_KEY, String(interval)); }
   catch (error) { console.error("No se pudo guardar la duración de la demo:", error); announce("No se pudo guardar la preferencia en este navegador."); }
 });
 $("#station-configs").addEventListener("change", event => {
  const control = event.target;
  const id = control.dataset.id;
  const station = appState.stations.get(id);
  if (!station) return;
  if (control.dataset.config === "enabled") {
   station.enabled = control.checked;
   resetStation(id);
  } else if (control.dataset.config) {
   const field = control.dataset.config;
   let value = control.value;
   if (["dwellMs", "cooldownMs"].includes(field)) {
     const seconds = Number(control.value);
     if (!Number.isFinite(seconds)) return;
     const min = field === "dwellMs" ? 0 : 1;
     const max = field === "dwellMs" ? 30 : 120;
     value = Math.max(min, Math.min(max, seconds)) * 1000;
     control.value = String(value / 1000);
   }
   if (field === "name" && !String(value).trim()) {
     $("#save-status").textContent = "El nombre de estación no puede estar vacío";
     return;
   }
   station[field] = value;
  }
  saveConfiguration();
  renderDevices();
 });
 $("#station-configs").addEventListener("input", event => {
   const control = event.target;
   const station = appState.stations.get(control.dataset.id);
   if (!station || !["name", "copy"].includes(control.dataset.config)) return;
   const value = control.value.trim();
   if (control.dataset.config === "name" && !value) {
     $("#save-status").textContent = "El nombre de estación no puede estar vacío";
     return;
   }
   station[control.dataset.config] = value;
   if (control.dataset.config === "name") {
     control.closest(".config-card").querySelector("h3").textContent = value;
     document.querySelectorAll(`#media-station option[value="${station.id}"], #zone-selects option[value="${station.id}"]`).forEach(option => { option.textContent = value; });
   }
   saveConfiguration();
   renderDevices();
 });
 $("#station-configs").addEventListener("click", event => {
   const button = event.target.closest("[data-test-station]");
   if (!button) return;
   const station = appState.stations.get(button.dataset.testStation);
   if (!station?.enabled) return announce("Activa esta estación antes de probarla.");
   setPublicMode(true);
  $("#public-mode-label").textContent = "SIMULACIÓN MANUAL";
   emitEvent("entry");
   emitEvent("attention", station.id, { proximity: 0.9, dwellMs: station.dwellMs ?? appState.config.settings.attentionThresholdMs, source: "manual-test" });
   announce(`Simulación manual: ${station.name}.`);
 });
 $("#restore-defaults").addEventListener("click", async () => {
   if (!window.confirm("¿Restaurar la configuración inicial de las cinco estaciones?")) return;
  if (!clearSavedConfiguration()) return announce("No se pudo borrar la configuración guardada; no se ha restablecido.");
  resetCameraPreferences();
  try { localStorage.removeItem(GUIDED_INTERVAL_KEY); } catch (error) { console.warn("No se pudo restablecer la duración de la demo.", error); }
   try {
     const config = await loadConfiguration();
     appState.stations = new Map(config.stations.map(station => [station.id, { ...station, enabled: true, state: "idle" }]));
     renderConfigs();
     renderDevices();
    $("#guided-interval").value = "14.5";
     saveConfiguration();
     announce("Se restauraron los valores iniciales.");
   } catch (error) {
     console.error("No se pudo restaurar la configuración:", error);
     announce("No se pudo restaurar la configuración inicial.");
   }
 });
 $("#test-event").addEventListener("click", () => {
   const target = [...appState.stations.values()].find(s => s.enabled);
   if (!target) return announce("Activa al menos una estación para probarla.");
   if (appState.mode !== "public") {
     // El botón de prueba cambia temporalmente a modo público para que la misma lógica gestione el evento.
     setPublicMode(true);
     $("#public-mode-label").textContent = "SIMULACIÓN MANUAL";
     emitEvent("entry");
     emitEvent("attention", target.id);
   } else emitEvent("attention", target.id);
 });
 $("#start-public").addEventListener("click", () => setPublicMode(true));
 $("#guided-demo").addEventListener("click", startGuidedDemo);
 $("#guided-stop").addEventListener("click", () => setPublicMode(false));
 $("#guided-repeat").addEventListener("click", startGuidedDemo);
 $("#guided-return").addEventListener("click", () => setPublicMode(false));
 // Atajos de presentación para el empleado: Ctrl+Alt+1..5 simula interés en una estación.
 // No se muestran botones ni controles al visitante en modo público.
 window.addEventListener("keydown", event => {
   if (!event.ctrlKey || !event.altKey || !/^[1-5]$/.test(event.key)) return;
   if (appState.mode !== "public") return;
   event.preventDefault();
   const station = [...appState.stations.values()][Number(event.key) - 1];
   if (!station || !station.enabled) return announce("Esa estación está desactivada.");
   emitEvent("entry");
   emitEvent("attention", station.id, { proximity: 0.9, dwellMs: 2400, orientation: true });
  $("#public-mode-label").textContent = "SIMULACIÓN MANUAL";
   announce(`Simulación: interés detectado en ${station.name}.`);
 });
 $("#admin-lock").addEventListener("click", () => {
   if (appState.mode === "public") setPublicMode(false);
   else announce("Ya estás en administración.");
 });
}
export function setPublicMode(enabled) {
 if (!enabled) stopGuidedDemo();
 // Cancela temporizadores de sesiones anteriores al cambiar de modo.
 clearTimeout(appState.sessionTimer);
 appState.sessionTimer = null;
 appState.mode = enabled ? "public" : "admin";
 $("#admin-view").hidden = enabled;
 $("#public-view").hidden = !enabled;
 $("#public-mode-label").textContent = "ESPERA DE PRESENCIA";
 $("#guided-complete").hidden = true;
 $("#guided-stop").hidden = true;
 $("#admin-lock").textContent = enabled ? "Volver a administración ↗" : "Administración ↗";
 $("#system-status").textContent = enabled ? "Modo público activo" : "Sistema preparado";
 if (enabled) {
   appState.sessionActive = false;
   resetStations();
   announce("Modo público activo. La instalación espera señales de interés.");
 } else {
   appState.sessionActive = false;
   resetStations();
   announce("Administración disponible.");
 }
 renderDevices();
}
