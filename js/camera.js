/*
 * Detector visual local de movimiento para la primera demo.
 * Importante: no es un modelo de IA ni reconoce personas o miradas. Compara
 * fotogramas en el navegador; sirve como prueba de integración con cámara.
 * No se almacenan ni se envían imágenes.
 */
import { appState } from "./state.js";
import { emitEvent } from "./events.js";
import { $ } from "./utils.js";

let stream = null;
let video = null;
let canvas = null;
let context = null;
let rafId = 0;
let previous = null;
let motionStartedAt = 0;
let lastTriggerAt = 0;
let motionActive = false;
let targetId = "";
const WIDTH = 112;
const HEIGHT = 84;
const MOTION_THRESHOLD = 0.055;
const HOLD_MS = 1200;
const TRIGGER_COOLDOWN_MS = 12000;

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
  try {
    status("Solicitando permiso para usar la cámara…");
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video = $("#camera-preview");
    video.srcObject = stream;
    await video.play();
    canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    context = canvas.getContext("2d", { willReadFrequently: true });
    previous = null;
    motionStartedAt = 0;
    motionActive = false;
    setControls(true);
    status("Cámara activa. Esperando movimiento sostenido…", true);
    rafId = requestAnimationFrame(scanFrame);
  } catch (error) {
    stopCamera(false);
    status(error?.name === "NotAllowedError"
      ? "Permiso denegado. Puedes seguir usando la simulación guiada."
      : `No se pudo iniciar la cámara: ${error?.message || "error desconocido"}`);
  }
}

function scanFrame(now) {
  if (!stream || !video || video.readyState < 2) {
    rafId = requestAnimationFrame(scanFrame);
    return;
  }
  context.drawImage(video, 0, 0, WIDTH, HEIGHT);
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  if (previous) {
    let changed = 0;
    // Comparación luminosa de baja resolución para mantener el procesamiento ligero.
    for (let i = 0; i < pixels.length; i += 16) {
      const currentLuma = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      const oldLuma = previous[i] * 0.299 + previous[i + 1] * 0.587 + previous[i + 2] * 0.114;
      if (Math.abs(currentLuma - oldLuma) > 28) changed++;
    }
    const ratio = changed / (pixels.length / 16);
    if (ratio >= MOTION_THRESHOLD) {
      if (!motionStartedAt) motionStartedAt = now;
      if (!motionActive && now - motionStartedAt >= HOLD_MS) {
        motionActive = true;
        onSustainedMotion(ratio, now);
      }
    } else {
      motionStartedAt = 0;
      motionActive = false;
    }
  }
  previous = new Uint8ClampedArray(pixels);
  rafId = requestAnimationFrame(scanFrame);
}

function onSustainedMotion(ratio, now) {
  if (now - lastTriggerAt < TRIGGER_COOLDOWN_MS) {
    status("Movimiento detectado, pero la estación está en periodo de espera.", true);
    return;
  }
  if (appState.mode !== "public") {
    status("Movimiento detectado. Inicia el modo público para probar la activación automática.", true);
    return;
  }
  const station = appState.stations.get(targetId);
  if (!station?.enabled) {
    status("Hay movimiento, pero la estación seleccionada está desactivada.", true);
    return;
  }
  lastTriggerAt = now;
  emitEvent("entry");
  emitEvent("attention", targetId, {
    proximity: Math.min(0.95, 0.55 + ratio * 2),
    dwellMs: HOLD_MS,
    orientation: null,
    source: "local-motion-detector"
  });
  status(`Movimiento sostenido detectado: activando ${station.name}.`, true);
}

export function stopCamera(updateStatus = true) {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  if (video) video.srcObject = null;
  previous = null;
  motionStartedAt = 0;
  motionActive = false;
  setControls(false);
  if (updateStatus) status("Cámara apagada. No se está capturando imagen.");
}
