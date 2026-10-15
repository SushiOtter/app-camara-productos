/*
 * Detección de personas con COCO-SSD (TensorFlow.js) ejecutado en el navegador.
 * Limitaciones: detecta la clase "person", no identidad, mirada ni interés real.
 * El empleado selecciona la estación de prueba; no se infiere qué tablet mira.
 * Los fotogramas no se guardan ni se envían a un servidor desde este código.
 */
import { appState } from "./state.js";
import { emitEvent } from "./events.js";
import { $ } from "./utils.js";

let stream = null;
let video = null;
let model = null;
let rafId = 0;
let inferenceBusy = false;
let lastInferenceAt = 0;
let personStartedAt = 0;
let lastTriggerAt = 0;
let personPresent = false;
let triggeredThisPresence = false;
let lastAdminNoticeAt = 0;
let targetId = "";
let latestConfidence = 0;
let latestAreaRatio = 0;
const MIN_CONFIDENCE = 0.55;
const MIN_PERSON_AREA = 0.035;
const HOLD_MS = 1400;
const TRIGGER_COOLDOWN_MS = 12000;
const INFERENCE_INTERVAL_MS = 300;

function status(message, active = false) {
  const label = $("#camera-status");
  const dot = $("#camera-status-dot");
  if (label) label.textContent = message;
  if (dot) dot.classList.toggle("is-active", active);
}

function setControls(active) {
  $("#camera-start").disabled = active;
  $("#camera-stop").disabled = !active;
  $("#camera-target").disabled = active;
}

export function initializeCameraControls() {
  const select = $("#camera-target");
  select.innerHTML = [...appState.stations.values()].map(station =>
    `<option value="${station.id}">${station.name}</option>`
  ).join("");
  targetId = select.value;
  select.addEventListener("change", () => { targetId = select.value; });
  $("#camera-start").addEventListener("click", startCamera);
  $("#camera-stop").addEventListener("click", stopCamera);
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
    video = $("#camera-preview");
    video.srcObject = stream;
    await video.play();
    personStartedAt = 0;
    personPresent = false;
    triggeredThisPresence = false;
    latestConfidence = 0;
    latestAreaRatio = 0;
    lastInferenceAt = 0;
    setControls(true);
    status("IA activa. Esperando que detecte una persona…", true);
    rafId = requestAnimationFrame(scanFrame);
  } catch (error) {
    stopCamera(false);
    status(error?.name === "NotAllowedError"
      ? "Permiso de cámara denegado. Puedes seguir usando la simulación guiada."
      : `No se pudo iniciar la detección: ${error?.message || "error desconocido"}`);
  }
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
        personPresent = false;
        personStartedAt = 0;
        triggeredThisPresence = false;
        latestConfidence = 0;
        latestAreaRatio = 0;
        status("IA activa. No se detecta ninguna persona en la imagen.", true);
        return;
      }
      const [x, y, width, height] = best.bbox;
      latestConfidence = best.score;
      latestAreaRatio = Math.max(0, Math.min(1, (width * height) / Math.max(1, video.videoWidth * video.videoHeight)));
      if (latestAreaRatio < MIN_PERSON_AREA) {
        personPresent = false;
        personStartedAt = 0;
        triggeredThisPresence = false;
        status(`Persona detectada (${Math.round(best.score * 100)}%), pero está lejos o ocupa poco espacio en la imagen.`, true);
        return;
      }
      if (!personPresent) {
        personPresent = true;
        personStartedAt = performance.now();
        triggeredThisPresence = false;
      }
      const dwellMs = performance.now() - personStartedAt;
      status(`Persona detectada · confianza ${Math.round(best.score * 100)}% · presencia ${Math.max(1, Math.floor(dwellMs / 1000))} s.`, true);
      if (dwellMs >= HOLD_MS && !triggeredThisPresence) onSustainedPerson({ confidence: best.score, areaRatio: latestAreaRatio, dwellMs });
    }).catch(error => {
      console.error("Error en el modelo de visión artificial:", error);
      status("La detección de IA ha fallado. Puedes detener la cámara y usar la simulación.");
    }).finally(() => { inferenceBusy = false; });
  }
  rafId = requestAnimationFrame(scanFrame);
}

function onSustainedPerson({ confidence, areaRatio, dwellMs }) {
  if (performance.now() - lastTriggerAt < TRIGGER_COOLDOWN_MS) return;
  if (appState.mode !== "public") {
    if (performance.now() - lastAdminNoticeAt > 4000) {
      status("Persona detectada. Inicia el modo público para probar la activación automática.", true);
      lastAdminNoticeAt = performance.now();
    }
    return;
  }
  const station = appState.stations.get(targetId);
  if (!station?.enabled) {
    status("La IA detecta una persona, pero la estación seleccionada está desactivada.", true);
    return;
  }
  lastTriggerAt = performance.now();
  emitEvent("entry");
  emitEvent("attention", targetId, {
    proximity: Math.min(0.95, 0.45 + areaRatio * 2.5),
    dwellMs,
    orientation: null,
    confidence,
    source: "coco-ssd-person-detection"
  });
  status(`Persona detectada por IA. Activando ${station.name} (estación seleccionada para la prueba).`, true);
  // Evita múltiples activaciones mientras la misma persona permanece en escena.
  triggeredThisPresence = true;
}

export function stopCamera(updateStatus = true) {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  if (video) video.srcObject = null;
  inferenceBusy = false;
  personStartedAt = 0;
  personPresent = false;
  triggeredThisPresence = false;
  setControls(false);
  if (updateStatus) status("Cámara apagada. No se está capturando imagen.");
}
