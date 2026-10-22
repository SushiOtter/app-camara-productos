import { appState } from "./state.js";
import { $, announce, escapeHTML } from "./utils.js";
import { renderDevices } from "./panels.js?v=18";
import { emitEvent, resetStation, resetStations } from "./events.js?v=18";
import { initializeCameraControls, resetCameraPreferences, startCamera, stopCamera } from "./camera.js?v=18";
import { clearSavedConfiguration, loadConfiguration, renderConfigs, saveConfiguration } from "./configuration.js";
import { ageProfiles, getAgeProfile } from "./products.js";

let guidedTimer = null;
let guidedIndex = 0;
const GUIDED_INTERVAL_KEY = "beauty-tech-guided-interval-v1";
function syncWorkerStationSelection() {
 const select = $("#worker-station");
 const cameraSelect = $("#camera-station");
 if (!select || !cameraSelect) return;
 const enabled = [...appState.stations.values()].filter(station => station.enabled);
 select.innerHTML = enabled.map(station => `<option value="${escapeHTML(station.id)}">${escapeHTML(station.name)}</option>`).join("");
 const selected = enabled.some(station => station.id === cameraSelect.value) ? cameraSelect.value : enabled[0]?.id || "";
 select.value = selected;
 cameraSelect.value = selected;
 if (!enabled.length) {
   $("#worker-start").disabled = true;
   $("#start-section-experience").disabled = true;
 } else {
   $("#worker-start").disabled = false;
   $("#start-section-experience").disabled = false;
 }
}
async function startSelectedExperience(stationId, startButton) {
 const station = appState.stations.get(stationId);
 if (!stationId) return announce("Activa al menos una sección antes de iniciar la experiencia.");
 if (!station?.enabled) return announce("Elige una sección activa.");
 startButton.disabled = true;
 startButton.textContent = "Preparando experiencia…";
 appState.demoProfile = {
   ageRange: $("#demo-age-range")?.value || "",
   hairTexture: $("#demo-hair-texture")?.value || "",
   hairLength: $("#demo-hair-length")?.value || "",
   beard: $("#demo-beard")?.value || ""
 };
 setPublicMode(true, station.id);
 $("#public-mode-label").textContent = "PREPARANDO DETECCIÓN";
 try {
   const cameraReady = await startCamera();
   if (!cameraReady) {
     setPublicMode(false);
     announce("No se pudo iniciar la cámara. Revisa el permiso y la conexión y vuelve a intentarlo.");
     return;
   }
   announce(`Experiencia automática lista para ${station.name}. Se activará al detectar a una persona.`);
 } finally {
   startButton.disabled = false;
   startButton.textContent = "Iniciar experiencia";
 }
}
function updateAgeRecommendations(range, manuallySelected = false) {
 const panel = $("#age-recommendation-panel");
 const validRange = Object.prototype.hasOwnProperty.call(ageProfiles, range) && range !== "general";
 const selectedRange = validRange ? range : null;
 const profile = getAgeProfile(selectedRange);
 const title = $("#age-recommendation-title");
 const copy = $("#age-recommendation-copy");
 const list = $("#age-product-list");
 const select = $("#age-range-select");
 panel.hidden = false;
 title.textContent = selectedRange
  ? `${manuallySelected ? "Rango seleccionado" : "Rango estimado"}: ${profile.label}`
  : "No se pudo estimar la edad";
 copy.textContent = selectedRange
  ? manuallySelected
   ? "Estas sugerencias generales se muestran para el rango que has elegido."
   : "Estas sugerencias generales se muestran para el rango estimado. Puedes corregirlo si no coincide contigo."
  : "Se muestran ideas generales. Si quieres, selecciona un rango para adaptar las sugerencias.";
 list.replaceChildren(...profile.products.map(product => {
  const item = document.createElement("li");
  item.textContent = product;
  return item;
 }));
 if (select) select.value = selectedRange || "";
}
function resetAgeRecommendations() {
 const panel = $("#age-recommendation-panel");
 if (panel) panel.hidden = true;
 const select = $("#age-range-select");
 if (select) select.value = "";
}
function initializeAgeRecommendations() {
 const select = $("#age-range-select");
 select.innerHTML = `<option value="" selected disabled>Selecciona un rango</option>${Object.entries(ageProfiles)
  .filter(([range]) => range !== "general")
  .map(([range, profile]) => `<option value="${range}">${profile.label}</option>`).join("")}`;
 $("#age-range-update").addEventListener("click", () => {
  if (!ageProfiles[select.value] || select.value === "general") return announce("Selecciona un rango de edad para actualizar las sugerencias.");
  updateAgeRecommendations(select.value, true);
  announce("Sugerencias actualizadas para el rango seleccionado.");
 });
 window.addEventListener("beautytech:age-estimated", ({ detail = {} }) => {
  if (appState.mode === "public") updateAgeRecommendations(detail.ageGroup);
 });
}
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
 syncWorkerStationSelection();
 $("#worker-station")?.addEventListener("change", event => {
   const cameraSelect = $("#camera-station");
   cameraSelect.value = event.target.value;
   cameraSelect.dispatchEvent(new Event("change"));
 });
 $("#worker-start")?.addEventListener("click", event => startSelectedExperience($("#worker-station").value, event.currentTarget));
 initializeAgeRecommendations();
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
   syncWorkerStationSelection();
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
     document.querySelectorAll(`#media-station option[value="${station.id}"], #camera-station option[value="${station.id}"], #worker-station option[value="${station.id}"], #zone-selects option[value="${station.id}"]`).forEach(option => { option.textContent = value; });
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
     syncWorkerStationSelection();
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
 $("#start-section-experience")?.addEventListener("click", event => startSelectedExperience($("#camera-station")?.value || "", event.currentTarget));
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
   if (appState.mode === "public") {
     stopCamera();
     appState.returnToWorker = false;
     setPublicMode(false);
     return;
   }
   const showAdmin = $("#admin-view").hidden;
   appState.returnToWorker = !showAdmin;
   $("#worker-view").hidden = showAdmin;
   $("#admin-view").hidden = !showAdmin;
   $("#admin-lock").textContent = showAdmin ? "Modo trabajador ↗" : "Administración ↗";
 });
 $("#presentation-exit")?.addEventListener("click", () => {
   stopCamera();
   appState.returnToWorker = false;
   setPublicMode(false);
 });
 window.addEventListener("keydown", event => {
   if (event.key === "Escape" && appState.presentationMode) {
     stopCamera();
     appState.returnToWorker = false;
     setPublicMode(false);
   }
 });
}
export function setPublicMode(enabled, presentationStationId = "") {
 if (!enabled) stopGuidedDemo();
 if (enabled) appState.returnToWorker = !$("#worker-view").hidden;
 // Cancela temporizadores de sesiones anteriores al cambiar de modo.
 clearTimeout(appState.sessionTimer);
 appState.sessionTimer = null;
 appState.mode = enabled ? "public" : "admin";
 appState.presentationMode = enabled && Boolean(presentationStationId);
 appState.presentationStationId = appState.presentationMode ? presentationStationId : "";
 document.body.classList.toggle("presentation-mode", appState.presentationMode);
 $("#worker-view").hidden = enabled || !appState.returnToWorker;
 $("#admin-view").hidden = enabled || appState.returnToWorker;
 $("#public-view").hidden = !enabled;
 $("#presentation-exit").hidden = !appState.presentationMode;
 $("#public-mode-label").textContent = "ESPERA DE PRESENCIA";
 resetAgeRecommendations();
 $("#guided-complete").hidden = true;
 $("#guided-stop").hidden = true;
 $("#admin-lock").textContent = enabled ? "Salir · Administración ↗" : appState.returnToWorker ? "Administración ↗" : "Modo trabajador ↗";
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
