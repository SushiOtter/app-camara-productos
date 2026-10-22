import { appState } from "./state.js";
import { emitEvent } from "./events.js";
import { $, escapeHTML } from "./utils.js";
import { estimateAgeRange } from "./age.js";

const TF_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const BLAZEFACE_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js";
const COCO_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";

let stream = null, video = null, canvas = null, context = null;
let personModel = null, faceModel = null, librariesPromise = null, personModelPromise = null;
let rafId = 0, inferenceBusy = false, inferenceFailed = false, lastInferenceAt = 0;
let personStartedAt = 0, personPresent = false, triggeredThisPresence = false, latestZone = -1;
let lastAdminNoticeAt = 0, zoneAssignments = [], startToken = 0, lastStatusKey = "";
let missedDetectionSince = 0, cpuFallbackAttempted = false, inferenceCount = 0;
let activeTargetStationId = "";
const MIN_PERSON_CONFIDENCE = 0.20;
const MIN_FACE_CONFIDENCE = 0.22;
const MIN_PERSON_AREA = 0.003;
const MIN_FACE_AREA = 0.0008;
const INFERENCE_INTERVAL_MS = 220;
const ZONE_COUNT = 5;
const ZONE_STORAGE_KEY = "beauty-tech-camera-zones-v1";
const CONFIDENCE_STORAGE_KEY = "beauty-tech-camera-confidence-v1";
const STATION_STORAGE_KEY = "beauty-tech-camera-station-v1";
let activationConfidence = 0.2;

function status(message, active = false) {
  if (message !== lastStatusKey) {
    const label = $("#camera-status");
    if (label) label.textContent = message;
    lastStatusKey = message;
  }
  $("#camera-status-dot")?.classList.toggle("is-active", active);
}
function metric(id, value) { const el = $(id); if (el) el.textContent = value; }
function setControls(active) {
  if ($("#camera-start")) $("#camera-start").disabled = active;
  if ($("#camera-stop")) $("#camera-stop").disabled = !active;
}
function loadScript(src, test, label, timeoutMs = 22000) {
  if (test()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timeout); script.onload = null; script.onerror = null;
      if (error) { script.remove(); reject(error); } else resolve();
    };
    const timeout = setTimeout(() => finish(new Error(`Tiempo agotado al descargar ${label}.`)), timeoutMs);
    script.src = src; script.async = true; script.crossOrigin = "anonymous";
    script.onload = () => test() ? finish() : finish(new Error(`${label} se descargó, pero no se inicializó.`));
    script.onerror = () => finish(new Error(`No se pudo descargar ${label}. Comprueba internet o el bloqueo de CDN.`));
    document.head.appendChild(script);
  });
}
async function loadPersonModel(onProgress) {
  if (personModel) return personModel;
  if (!personModelPromise) {
    personModelPromise = (async () => {
      onProgress("Cargando detector complementario de persona…");
      await loadScript(COCO_URL, () => Boolean(window.cocoSsd), "COCO-SSD");
      personModel = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
      metric("#metric-model", faceModel ? "Rostro + persona" : "Persona");
      return personModel;
    })().catch(error => { personModelPromise = null; throw error; });
  }
  return personModelPromise;
}
async function ensureModels(onProgress) {
  if (faceModel || personModel) {
    if (!faceModel && !personModel) throw new Error("No hay un modelo disponible.");
    return;
  }
  if (!librariesPromise) {
    librariesPromise = (async () => {
      onProgress("Descargando motor de IA…");
      await loadScript(TF_URL, () => Boolean(window.tf), "TensorFlow.js");
      await window.tf.ready();
      // BlazeFace es más ligero: permite empezar a detectar rostros sin esperar al modelo de cuerpo.
      onProgress("Preparando detección rápida de rostro…");
      try {
        await loadScript(BLAZEFACE_URL, () => Boolean(window.blazeface), "BlazeFace");
        faceModel = await window.blazeface.load({ maxFaces: 5 });
        metric("#metric-model", "Rostro (rápido)");
      } catch (error) { console.warn("BlazeFace no disponible; se usará COCO-SSD.", error); }
      if (!faceModel) await loadPersonModel(onProgress);
      if (!faceModel && !personModel) throw new Error("No se pudo cargar ningún modelo. Comprueba la conexión y que la red permita jsdelivr.net.");
    })().catch(error => { librariesPromise = null; throw error; });
  }
  return librariesPromise;
}
function buildZoneSelectors() {
  const root = $("#zone-selects"); if (!root) return;
  const stations = [...appState.stations.values()];
  const options = stations.map(station => `<option value="${station.id}">${escapeHTML(station.name)}</option>`).join("");
  const cameraStation = $("#camera-station");
  if (cameraStation) {
    cameraStation.innerHTML = `${options}<option value="">Usar asignación por zonas</option>`;
    let savedStation = "";
    try { savedStation = localStorage.getItem(STATION_STORAGE_KEY) || ""; }
    catch (error) { console.warn("No se pudo recuperar la sección de cámara.", error); }
    cameraStation.value = stations.some(station => station.id === savedStation && station.enabled)
      ? savedStation
      : stations.find(station => station.enabled)?.id || "";
    cameraStation.addEventListener("change", () => {
      try { localStorage.setItem(STATION_STORAGE_KEY, cameraStation.value); }
      catch (error) { console.error("No se pudo guardar la sección de cámara:", error); status("No se pudo guardar la sección seleccionada."); }
    });
  }
  root.innerHTML = Array.from({ length: ZONE_COUNT }, (_, index) => `
    <label class="zone-select" for="camera-zone-${index}">Zona ${index + 1}
      <select id="camera-zone-${index}" class="field-select" data-zone="${index}">${options}<option value="">No activar</option></select>
    </label>`).join("");
  try {
    const saved = JSON.parse(localStorage.getItem(ZONE_STORAGE_KEY) || "null");
    zoneAssignments = Array.from({ length: ZONE_COUNT }, (_, index) => {
      const candidate = Array.isArray(saved) ? saved[index] : null;
      return candidate === "" ? "" : stations.some(station => station.id === candidate) ? candidate : stations[index]?.id || "";
    });
  } catch (error) {
    console.warn("No se pudieron recuperar las zonas de cámara; se usarán las asignaciones iniciales.", error);
    zoneAssignments = Array.from({ length: ZONE_COUNT }, (_, index) => stations[index]?.id || "");
  }
  root.querySelectorAll("select[data-zone]").forEach((select, index) => {
    select.value = zoneAssignments[index];
    select.addEventListener("change", () => {
      zoneAssignments[index] = select.value;
      try { localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(zoneAssignments)); }
      catch (error) { console.error("No se pudieron guardar las zonas de cámara:", error); status("No se pudo guardar la asignación de zonas en este navegador."); }
    });
  });
}
export function initializeCameraControls() {
  buildZoneSelectors();
  const confidenceControl = $("#camera-confidence");
  try {
    const savedConfidence = Number(localStorage.getItem(CONFIDENCE_STORAGE_KEY));
    if (Number.isFinite(savedConfidence) && savedConfidence >= 0.2 && savedConfidence <= 0.9) activationConfidence = savedConfidence;
  } catch (error) { console.warn("No se pudo recuperar el umbral de confianza.", error); }
  confidenceControl.value = String(activationConfidence);
  $("#camera-confidence-value").value = `${Math.round(activationConfidence * 100)}%`;
  confidenceControl.addEventListener("input", () => {
    activationConfidence = Number(confidenceControl.value);
    $("#camera-confidence-value").value = `${Math.round(activationConfidence * 100)}%`;
  });
  confidenceControl.addEventListener("change", () => {
    try { localStorage.setItem(CONFIDENCE_STORAGE_KEY, String(activationConfidence)); }
    catch (error) { console.error("No se pudo guardar el umbral de confianza:", error); status("No se pudo guardar el umbral de confianza en este navegador."); }
  });
  $("#camera-start")?.addEventListener("click", startCamera);
  $("#camera-stop")?.addEventListener("click", () => stopCamera());
  video = $("#camera-preview"); canvas = $("#camera-overlay"); context = canvas?.getContext("2d") || null;
}
export function resetCameraPreferences() {
  try {
    localStorage.removeItem(ZONE_STORAGE_KEY);
    localStorage.removeItem(CONFIDENCE_STORAGE_KEY);
    localStorage.removeItem(STATION_STORAGE_KEY);
  } catch (error) { console.error("No se pudieron restablecer las preferencias de cámara:", error); }
  activationConfidence = 0.2;
  $("#camera-confidence").value = "0.2";
  $("#camera-confidence-value").value = "20%";
  if ($("#camera-station")) $("#camera-station").value = "";
  zoneAssignments = [...appState.stations.keys()];
  $("#zone-selects")?.querySelectorAll("select[data-zone]").forEach((select, index) => { select.value = zoneAssignments[index] || ""; });
}
export async function startCamera() {
  if (stream) return true;
  const token = ++startToken;
  if (!navigator.mediaDevices?.getUserMedia) {
    status("Este navegador no permite usar la cámara. Abre la demo en Chrome o Edge desde localhost."); return false;
  }
  setControls(true); status("Solicitando permiso de cámara…");
  metric("#metric-model", "Cargando"); metric("#metric-confidence", "—"); metric("#metric-latency", "—"); metric("#metric-zone", "—"); metric("#metric-last-detection", "—");
  try {
    const acquiredStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } }, audio: false
    });
    if (token !== startToken) { acquiredStream.getTracks().forEach(track => track.stop()); return; }
    stream = acquiredStream; video.srcObject = stream; await video.play();
    personStartedAt = 0; personPresent = false; triggeredThisPresence = false; latestZone = -1;
    lastInferenceAt = 0; inferenceBusy = false; inferenceFailed = false; missedDetectionSince = 0; cpuFallbackAttempted = false; inferenceCount = 0;
    status("Cámara activa. Cargando el detector ligero…", true);
    try { await ensureModels(message => { if (token === startToken && stream) status(message, true); }); }
    catch (error) {
      if (token !== startToken || !stream) return false;
      console.error("Carga de IA fallida:", error);
      stopCamera(false);
      status(`La cámara funciona, pero no se pudo cargar la IA: ${error?.message || "error de descarga"}. Detén la cámara y vuelve a intentarlo.`, true);
      metric("#metric-model", "Error de carga"); return false;
    }
    if (token !== startToken || !stream) return false;
    status(`IA lista (${faceModel ? "rostro rápido" : "persona"}${personModel ? " + detector de persona" : ""}). Ponte en una zona y permanece un instante.`, true);
    metric("#metric-model", faceModel && personModel ? "Rostro + persona" : faceModel ? "Rostro rápido" : "Persona");
    rafId = requestAnimationFrame(now => scanFrame(now, token));
    return true;
  } catch (error) {
    if (token !== startToken) return false;
    console.error("No se pudo iniciar la cámara:", error); stopCamera(false);
    const detail = ["NotAllowedError", "PermissionDeniedError"].includes(error?.name)
      ? "Permiso denegado. Permite el acceso a la cámara desde el icono junto a la dirección."
      : ["NotFoundError", "DevicesNotFoundError"].includes(error?.name)
        ? "No se ha encontrado una cámara conectada."
        : ["NotReadableError", "TrackStartError"].includes(error?.name)
          ? "La cámara está ocupada por otra aplicación. Cierra Teams, Zoom u otra app y vuelve a intentarlo."
          : `No se pudo iniciar la cámara: ${error?.message || "error desconocido"}`;
    status(detail); metric("#metric-model", "Sin cámara"); return false;
  }
}
function drawOverlay(detection) {
  if (!context || !video?.videoWidth || !video?.videoHeight) return;
  const width = video.videoWidth, height = video.videoHeight;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  context.clearRect(0, 0, width, height); context.save();
  context.strokeStyle = "rgba(255,255,255,.76)"; context.lineWidth = Math.max(1.5, width / 320);
  for (let i = 1; i < ZONE_COUNT; i++) { const x = width * i / ZONE_COUNT; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  if (detection) {
    const [x, y, w, h] = detection.bbox;
    context.strokeStyle = detection.kind === "face" ? "#83b7a5" : "#c8a977"; context.lineWidth = Math.max(3, width / 180); context.strokeRect(x, y, w, h);
    context.fillStyle = context.strokeStyle; context.font = `bold ${Math.max(13, width / 28)}px sans-serif`;
    context.fillText(`${detection.kind === "face" ? "ROSTRO" : "PERSONA"} ${Math.round(detection.score * 100)}%`, Math.max(4, x), Math.max(18, y - 7));
  }
  context.restore();
}
async function detectPresence() {
  // Preferimos rostro: suele responder mejor cuando la cámara está cerca del visitante.
  if (faceModel) {
    const faces = await faceModel.estimateFaces(video, false);
    const normalized = faces.map(face => {
      const topLeft = Array.isArray(face.topLeft) ? face.topLeft : face.topLeft?.arraySync?.();
      const bottomRight = Array.isArray(face.bottomRight) ? face.bottomRight : face.bottomRight?.arraySync?.();
      const probability = Array.isArray(face.probability) ? Number(face.probability[0]) : Number(face.probability?.[0] ?? 0.8);
      if (!topLeft || !bottomRight) return null;
      return { bbox: [Number(topLeft[0]), Number(topLeft[1]), Number(bottomRight[0]) - Number(topLeft[0]), Number(bottomRight[1]) - Number(topLeft[1])], score: Number.isFinite(probability) ? probability : 0.8, kind: "face" };
    }).filter(face => face && face.score >= MIN_FACE_CONFIDENCE && face.bbox.every(Number.isFinite));
    if (normalized.length) return normalized.sort((a,b) => b.score - a.score)[0];
  }
  if (personModel) {
    const predictions = await personModel.detect(video, 5, 0.20);
    const people = predictions.filter(item => item.class === "person" && item.score >= MIN_PERSON_CONFIDENCE)
      .map(item => ({ bbox: item.bbox, score: item.score, kind: "person" })).sort((a,b) => b.score-a.score);
    if (people.length) return people[0];
  }
  return null;
}
function resetPresence() {
  if (personPresent && triggeredThisPresence && latestZone >= 0) {
    const stationId = activeTargetStationId || zoneAssignments[latestZone];
    if (stationId && appState.mode === "public") emitEvent("lost-attention", stationId, { source: "camera-presence-ended" });
  }
  personPresent = false; personStartedAt = 0; triggeredThisPresence = false; latestZone = -1; activeTargetStationId = ""; metric("#metric-zone", "—");
}
function scanFrame(now, token) {
  if (!stream || !video || token !== startToken) { rafId = 0; return; }
  if (video.readyState < 2) { rafId = requestAnimationFrame(t => scanFrame(t, token)); return; }
  if (!inferenceFailed && !inferenceBusy && now - lastInferenceAt >= INFERENCE_INTERVAL_MS) {
    inferenceBusy = true; lastInferenceAt = now; const started = performance.now();
    detectPresence().then(detection => {
      if (!stream || token !== startToken) return;
      metric("#metric-latency", `${Math.round(performance.now() - started)} ms`);
      if (detection) {
        metric("#metric-confidence", `${Math.round(detection.score * 100)}%`);
        metric("#metric-last-detection", new Date().toLocaleTimeString());
      }
      if (!detection || detection.score < activationConfidence) {
        drawOverlay(null);
        if (!missedDetectionSince) missedDetectionSince = performance.now();
        if (performance.now() - missedDetectionSince > 850) resetPresence();
        status(detection ? `Confianza inferior al mínimo (${Math.round(activationConfidence * 100)}%).` : personPresent ? "Detección intermitente; mantén la posición…" : "Buscando rostro o persona… mejora la luz y acércate un poco.", true);
        return;
      }
      missedDetectionSince = 0; drawOverlay(detection);
      const [x, , w, h] = detection.bbox;
      const areaRatio = Math.max(0, Math.min(1, (w * h) / Math.max(1, video.videoWidth * video.videoHeight)));
      if (areaRatio < (detection.kind === "face" ? MIN_FACE_AREA : MIN_PERSON_AREA)) {
        resetPresence(); status(`${detection.kind === "face" ? "Rostro" : "Persona"} detectado, pero ocupa poco espacio. Acércate a la cámara.`, true); return;
      }
      const zone = Math.max(0, Math.min(ZONE_COUNT - 1, Math.floor((1 - ((x + w / 2) / video.videoWidth)) * ZONE_COUNT)));
      const selectedStationId = $("#camera-station")?.value || "";
      if (personPresent && zone !== latestZone && triggeredThisPresence && !selectedStationId && appState.mode === "public") {
        const previousStationId = zoneAssignments[latestZone];
        if (previousStationId) emitEvent("lost-attention", previousStationId, { source: "camera-zone-changed" });
      }
      if (!personPresent || (!selectedStationId && zone !== latestZone)) { personPresent = true; personStartedAt = performance.now(); triggeredThisPresence = false; }
      latestZone = zone; const dwellMs = performance.now() - personStartedAt;
      const stationId = selectedStationId || zoneAssignments[zone], station = stationId ? appState.stations.get(stationId) : null;
      activeTargetStationId = stationId;
      metric("#metric-zone", `Z${zone + 1}${station ? ` · ${station.name}` : " · vacía"}`);
      status(`${detection.kind === "face" ? "Rostro" : "Persona"} detectado · ${Math.round(detection.score * 100)}% · ${selectedStationId ? "Sección" : `Zona ${zone + 1}`}${station ? ` → ${station.name}` : " sin asignar"} · ${(dwellMs / 1000).toFixed(1)} s`, true);
      if (station?.state === "cooldown") triggeredThisPresence = false;
      if (station && station.state !== "cooldown" && dwellMs >= Number(station.dwellMs ?? appState.config.settings.attentionThresholdMs) && !triggeredThisPresence) {
        void onSustainedPresence({ confidence: detection.score, areaRatio, dwellMs, zone, station, kind: detection.kind, token });
      }
    }).catch(async error => {
      if (!stream || token !== startToken) return;
      console.error("Error de inferencia:", error);
      if (!cpuFallbackAttempted && window.tf?.setBackend) {
        cpuFallbackAttempted = true;
        try { status("Adaptando la IA a este equipo…", true); await window.tf.setBackend("cpu"); await window.tf.ready(); status("IA adaptada. Continuando detección…", true); return; }
        catch (backendError) { console.warn("No se pudo cambiar el backend:", backendError); }
      }
      inferenceFailed = true; status(`La cámara funciona, pero la IA ha fallado: ${error?.message || "error de inferencia"}. Detén y vuelve a activar la cámara.`);
    }).finally(() => { if (token === startToken) inferenceBusy = false; });
  }
  if (stream && token === startToken) rafId = requestAnimationFrame(t => scanFrame(t, token));
}
async function onSustainedPresence({ confidence, areaRatio, dwellMs, zone, station, kind, token }) {
  const now = performance.now();
  if (!station) { status(`Zona ${zone + 1} sin estación asignada.`, true); triggeredThisPresence = true; return; }
  if (appState.mode !== "public") {
    if (now - lastAdminNoticeAt > 3500) { status(`${kind === "face" ? "Rostro" : "Persona"} detectado. Inicia el modo público para activar la estación automáticamente.`, true); lastAdminNoticeAt = now; }
    return;
  }
  if (!station.enabled) { status(`${station.name} está desactivada.`, true); triggeredThisPresence = true; return; }
  triggeredThisPresence = true;
  emitEvent("entry");
  emitEvent("attention", station.id, { proximity: Math.min(0.95, 0.45 + areaRatio * 2.5), dwellMs, orientation: null, confidence, zone: zone + 1, source: kind === "face" ? "blazeface-face-zone-detection" : "coco-ssd-person-zone-detection" });
  status(`Presencia detectada por IA. Activando ${station.name}.`, true);
  if (kind === "face") {
    void estimateAgeRange(video).then(ageGroup => {
      if (!stream || token !== startToken || appState.mode !== "public" || !personPresent || activeTargetStationId !== station.id) return;
      window.dispatchEvent(new CustomEvent("beautytech:age-estimated", { detail: { stationId: station.id, ageGroup } }));
    }).catch(error => {
      if (!stream || token !== startToken) return;
      console.error("No se pudo estimar el rango de edad:", error);
      status("No se pudo estimar la edad; continúan las recomendaciones generales.", true);
    });
  }
}
export function stopCamera(updateStatus = true) {
  startToken += 1; if (rafId) cancelAnimationFrame(rafId); rafId = 0;
  if (stream) stream.getTracks().forEach(track => track.stop()); stream = null;
  if (video) { video.pause(); video.srcObject = null; }
  if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
  inferenceBusy = false; inferenceFailed = false; missedDetectionSince = 0; resetPresence(); setControls(false);
  if (updateStatus) status("Cámara apagada. No se está capturando imagen.");
}
