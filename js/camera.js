/*
 * Detección local de personas con COCO-SSD / TensorFlow.js.
 * La zona se estima por la posición horizontal del cuerpo en la imagen.
 * No detecta mirada, identidad ni interés real. No se guardan ni envían fotogramas.
 */
import { appState } from "./state.js";
import { emitEvent } from "./events.js";
import { $ } from "./utils.js";

let stream = null;
let video = null;
let canvas = null;
let context = null;
let model = null;
let rafId = 0;
let inferenceBusy = false;
let lastInferenceAt = 0;
let personStartedAt = 0;
let lastTriggerAt = 0;
let personPresent = false;
let triggeredThisPresence = false;
let lastAdminNoticeAt = 0;
let latestZone = -1;
let latestAreaRatio = 0;
let zoneAssignments = [];
const MIN_CONFIDENCE = 0.55;
const MIN_PERSON_AREA = 0.035;
const HOLD_MS = 1400;
const TRIGGER_COOLDOWN_MS = 12000;
const INFERENCE_INTERVAL_MS = 300;
const ZONE_COUNT = 5;

function status(message, active = false) {
  const label = $("#camera-status");
  const dot = $("#camera-status-dot");
  if (label) label.textContent = message;
  if (dot) dot.classList.toggle("is-active", active);
}

function setControls(active) {
  $("#camera-start").disabled = active;
  $("#camera-stop").disabled = !active;
}

function buildZoneSelectors() {
  const root = $("#zone-selects");
  const stations = [...appState.stations.values()];
  const options = stations.map(station => `<option value="${station.id}">${station.name}</option>`).join("");
  root.innerHTML = Array.from({ length: ZONE_COUNT }, (_, index) => `
    <label class="zone-select" for="camera-zone-${index}">
      Zona ${index + 1}
      <select id="camera-zone-${index}" class="field-select" data-zone="${index}">${options}<option value="">No activar</option></select>
    </label>`).join("");
  zoneAssignments = Array.from({ length: ZONE_COUNT }, (_, index) => stations[index]?.id || "");
  root.querySelectorAll("select[data-zone]").forEach((select, index) => {
    select.value = zoneAssignments[index];
    select.addEventListener("change", () => { zoneAssignments[index] = select.value; });
  });
}

export function initializeCameraControls() {
  buildZoneSelectors();
  $("#camera-start").addEventListener("click", startCamera);
  $("#camera-stop").addEventListener("click", stopCamera);
  video = $("#camera-preview");
  canvas = $("#camera-overlay");
  context = canvas.getContext("2d");
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    status("Este navegador no permite acceder a la cámara. Usa localhost y un navegador actualizado.");
    return;
  }
  if (!window.tf || !window.cocoSsd) {
    status("No se ha podido cargar la biblioteca de IA. Comprueba la conexión a internet y recarga la página.");
    return;
  }
  try {
    status("Cargando el modelo de detección de personas…");
    await window.tf.ready();
    model = model || await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
    status("Modelo de IA listo. Solicitando permiso para la cámara…");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    personStartedAt = 0;
    personPresent = false;
    triggeredThisPresence = false;
    lastInferenceAt = 0;
    lastTriggerAt = 0;
    setControls(true);
    status("IA activa. Busca una persona en la imagen…", true);
    rafId = requestAnimationFrame(scanFrame);
  } catch (error) {
    stopCamera(false);
    status(error?.name === "NotAllowedError"
      ? "Permiso de cámara denegado. Puedes seguir usando la simulación guiada."
      : `No se pudo iniciar la detección: ${error?.message || "error desconocido"}`);
  }
}

function drawOverlay(person) {
  if (!context || !video?.videoWidth || !video?.videoHeight) return;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  context.save();
  context.strokeStyle = "rgba(255,255,255,.75)";
  context.lineWidth = Math.max(1.5, width / 320);
  for (let i = 1; i < ZONE_COUNT; i++) {
    const x = width * i / ZONE_COUNT;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  if (person) {
    const [x, y, boxWidth, boxHeight] = person.bbox;
    context.strokeStyle = "#c8a977";
    context.lineWidth = Math.max(3, width / 180);
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.fillStyle = "rgba(200,169,119,.95)";
    context.font = `bold ${Math.max(13, width / 28)}px sans-serif`;
    context.fillText(`PERSONA ${Math.round(person.score * 100)}%`, Math.max(4, x), Math.max(18, y - 7));
  }
  context.restore();
}

function scanFrame(now) {
  if (!stream || !video || video.readyState < 2) {
    rafId = requestAnimationFrame(scanFrame);
    return;
  }
  if (!inferenceBusy && now - lastInferenceAt >= INFERENCE_INTERVAL_MS) {
    inferenceBusy = true;
    lastInferenceAt = now;
    model.detect(video).then(predictions => {
      const people = predictions.filter(item => item.class === "person" && item.score >= MIN_CONFIDENCE);
      const best = people.sort((a, b) => b.score - a.score)[0];
      if (!best) {
        drawOverlay(null);
        personPresent = false;
        personStartedAt = 0;
        triggeredThisPresence = false;
        latestZone = -1;
        status("IA activa. No se detecta ninguna persona en la imagen.", true);
        return;
      }
      drawOverlay(best);
      const [x, , boxWidth, boxHeight] = best.bbox;
      const areaRatio = Math.max(0, Math.min(1, (boxWidth * boxHeight) / Math.max(1, video.videoWidth * video.videoHeight)));
      if (areaRatio < MIN_PERSON_AREA) {
        personPresent = false;
        personStartedAt = 0;
        triggeredThisPresence = false;
        latestZone = -1;
        status(`Persona detectada (${Math.round(best.score * 100)}%), pero está lejos o ocupa poco espacio en la imagen.`, true);
        return;
      }
      // La vista previa está espejada, así que invertimos X para que las zonas coincidan visualmente.
      const mirroredCenterX = 1 - ((x + boxWidth / 2) / video.videoWidth);
      const zone = Math.max(0, Math.min(ZONE_COUNT - 1, Math.floor(mirroredCenterX * ZONE_COUNT)));
      if (!personPresent || zone !== latestZone) {
        personPresent = true;
        personStartedAt = performance.now();
        triggeredThisPresence = false;
      }
      latestZone = zone;
      latestAreaRatio = areaRatio;
      const dwellMs = performance.now() - personStartedAt;
      const stationId = zoneAssignments[zone];
      const station = stationId ? appState.stations.get(stationId) : null;
      const zoneText = station ? `Zona ${zone + 1} → ${station.name}` : `Zona ${zone + 1} sin estación asignada`;
      status(`Persona ${Math.round(best.score * 100)}% · ${zoneText} · ${Math.max(1, Math.floor(dwellMs / 1000))} s`, true);
      if (dwellMs >= HOLD_MS && !triggeredThisPresence) onSustainedPerson({ confidence: best.score, areaRatio, dwellMs, zone, station });
    }).catch(error => {
      console.error("Error en el modelo de visión artificial:", error);
      status("La detección de IA ha fallado. Detén la cámara y usa la simulación.");
    }).finally(() => { inferenceBusy = false; });
  }
  rafId = requestAnimationFrame(scanFrame);
}

function onSustainedPerson({ confidence, areaRatio, dwellMs, zone, station }) {
  if (lastTriggerAt > 0 && performance.now() - lastTriggerAt < TRIGGER_COOLDOWN_MS) return;
  if (appState.mode !== "public") {
    if (performance.now() - lastAdminNoticeAt > 4000) {
      status("Persona detectada. Inicia el modo público para probar la activación automática.", true);
      lastAdminNoticeAt = performance.now();
    }
    return;
  }
  if (!station?.enabled) {
    status(station ? `La estación ${station.name} está desactivada.` : `La zona ${zone + 1} no tiene estación asignada.`, true);
    triggeredThisPresence = true;
    return;
  }
  lastTriggerAt = performance.now();
  emitEvent("entry");
  emitEvent("attention", station.id, {
    proximity: Math.min(0.95, 0.45 + areaRatio * 2.5),
    dwellMs,
    orientation: null,
    confidence,
    zone: zone + 1,
    source: "coco-ssd-person-zone-detection"
  });
  status(`Zona ${zone + 1} detectada por IA. Activando ${station.name}.`, true);
  triggeredThisPresence = true;
}

export function stopCamera(updateStatus = true) {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  if (video) video.srcObject = null;
  if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
  inferenceBusy = false;
  personStartedAt = 0;
  personPresent = false;
  triggeredThisPresence = false;
  latestZone = -1;
  setControls(false);
  if (updateStatus) status("Cámara apagada. No se está capturando imagen.");
}
