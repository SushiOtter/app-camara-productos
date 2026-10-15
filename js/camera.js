import { appState } from "./state.js";
import { emitEvent } from "./events.js";
import { $ } from "./utils.js";

const TF_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
const COCO_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js";
const BLAZEFACE_URL = "https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js";

let stream = null;
let video = null;
let canvas = null;
let context = null;
let personModel = null;
let faceModel = null;
let rafId = 0;
let inferenceBusy = false;
let inferenceFailed = false;
let lastInferenceAt = 0;
let personStartedAt = 0;
let personPresent = false;
let triggeredThisPresence = false;
let latestZone = -1;
let lastAdminNoticeAt = 0;
let zoneAssignments = [];
let librariesPromise = null;
let startToken = 0;
let lastStatusKey = "";
const lastTriggerByStation = new Map();
const MIN_PERSON_CONFIDENCE = 0.38;
const MIN_FACE_CONFIDENCE = 0.45;
const MIN_PERSON_AREA = 0.012;
const MIN_FACE_AREA = 0.0035;
const HOLD_MS = 1400;
const TRIGGER_COOLDOWN_MS = 12000;
const INFERENCE_INTERVAL_MS = 350;
const ZONE_COUNT = 5;

function status(message, active = false) {
  // Evita repintar y volver a anunciar el mismo mensaje cada fotograma.
  if (message !== lastStatusKey) {
    const label = $("#camera-status");
    if (label) label.textContent = message;
    lastStatusKey = message;
  }
  const dot = $("#camera-status-dot");
  if (dot) dot.classList.toggle("is-active", active);
}

function setControls(active) {
  const start = $("#camera-start");
  const stop = $("#camera-stop");
  if (start) start.disabled = active;
  if (stop) stop.disabled = !active;
}

function loadScript(src, test, label, timeoutMs = 25000) {
  if (test()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    };
    const timeout = setTimeout(() => finish(new Error(`Se agotó el tiempo de descarga de ${label}.`)), timeoutMs);
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => test() ? finish() : finish(new Error(`${label} se descargó, pero no se inicializó.`));
    script.onerror = () => finish(new Error(`No se pudo descargar ${label}; comprueba internet, firewall o bloqueadores.`));
    document.head.appendChild(script);
  });
}

async function ensureModels(onProgress) {
  if (personModel || faceModel) return;
  if (!librariesPromise) {
    librariesPromise = (async () => {
      onProgress("Descargando TensorFlow.js…");
      await loadScript(TF_URL, () => Boolean(window.tf), "TensorFlow.js");
      await window.tf.ready();

      onProgress("Preparando detección de personas…");
      try {
        await loadScript(COCO_URL, () => Boolean(window.cocoSsd), "COCO-SSD");
        personModel = await window.cocoSsd.load({ base: "lite_mobilenet_v2" });
      } catch (error) {
        console.warn("COCO-SSD no está disponible; se intentará detección de rostro.", error);
      }

      onProgress("Preparando detección complementaria de rostro…");
      try {
        await loadScript(BLAZEFACE_URL, () => Boolean(window.blazeface), "BlazeFace");
        faceModel = await window.blazeface.load();
      } catch (error) {
        console.warn("BlazeFace no está disponible.", error);
      }

      if (!personModel && !faceModel) throw new Error("No se pudo cargar ningún modelo de detección. Comprueba la conexión a internet o los bloqueadores.");
    })().catch(error => {
      librariesPromise = null;
      throw error;
    });
  }
  return librariesPromise;
}

function buildZoneSelectors() {
  const root = $("#zone-selects");
  if (!root) return;
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
  $("#camera-start")?.addEventListener("click", startCamera);
  $("#camera-stop")?.addEventListener("click", () => stopCamera());
  video = $("#camera-preview");
  canvas = $("#camera-overlay");
  context = canvas?.getContext("2d") || null;
}

async function startCamera() {
  if (stream) return;
  const token = ++startToken;
  if (!navigator.mediaDevices?.getUserMedia) {
    status("Este navegador no permite usar la cámara. Abre la demo desde localhost en Chrome o Edge actualizado.");
    return;
  }
  setControls(true);
  status("Solicitando permiso de cámara…");
  try {
    // Abrimos primero la cámara para que el usuario vea imagen mientras se descargan los modelos.
    const acquiredStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    if (token !== startToken) {
      acquiredStream.getTracks().forEach(track => track.stop());
      return;
    }
    stream = acquiredStream;
    video.srcObject = stream;
    await video.play();
    personStartedAt = 0;
    personPresent = false;
    triggeredThisPresence = false;
    latestZone = -1;
    lastInferenceAt = 0;
    inferenceBusy = false;
    inferenceFailed = false;
    status("Cámara activa. Descargando los modelos de IA…", true);

    try {
      await ensureModels(message => { if (token === startToken && stream) status(message, true); });
    } catch (modelError) {
      if (token !== startToken || !stream) return;
      console.error("No se pudieron cargar los modelos de IA:", modelError);
      status(`Cámara conectada, pero no se pudo cargar la IA: ${modelError?.message || "error de descarga"}. Comprueba internet y vuelve a intentarlo.`, true);
      return;
    }
    if (token !== startToken || !stream) return;
    const available = [personModel ? "personas" : "", faceModel ? "rostros" : ""].filter(Boolean).join(" y ");
    status(`IA lista (${available}). Encuadra tu cabeza y torso y permanece en una zona.`, true);
    rafId = requestAnimationFrame(scanFrame);
  } catch (error) {
    if (token !== startToken) return;
    console.error("No se pudo iniciar cámara/detección:", error);
    stopCamera(false);
    const detail = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
      ? "Permiso de cámara denegado. Permite el acceso en el icono junto a la dirección del navegador."
      : error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError"
        ? "No se ha encontrado ninguna cámara conectada."
        : error?.name === "NotReadableError" || error?.name === "TrackStartError"
          ? "La cámara está ocupada por otra aplicación. Cierra Teams/Zoom u otra app y vuelve a intentarlo."
          : `No se pudo iniciar la detección: ${error?.message || "error desconocido"}`;
    status(detail);
  }
}

function drawOverlay(detection) {
  if (!context || !video?.videoWidth || !video?.videoHeight) return;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  context.save();
  context.strokeStyle = "rgba(255,255,255,.78)";
  context.lineWidth = Math.max(1.5, width / 320);
  for (let i = 1; i < ZONE_COUNT; i++) {
    const x = width * i / ZONE_COUNT;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  if (detection) {
    const [x, y, boxWidth, boxHeight] = detection.bbox;
    context.strokeStyle = detection.kind === "face" ? "#83b7a5" : "#c8a977";
    context.lineWidth = Math.max(3, width / 180);
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.fillStyle = detection.kind === "face" ? "rgba(131,183,165,.98)" : "rgba(200,169,119,.98)";
    context.font = `bold ${Math.max(13, width / 28)}px sans-serif`;
    context.fillText(`${detection.kind === "face" ? "ROSTRO" : "PERSONA"} ${Math.round(detection.score * 100)}%`, Math.max(4, x), Math.max(18, y - 7));
  }
  context.restore();
}

async function detectPresence() {
  let people = [];
  if (personModel) {
    const predictions = await personModel.detect(video);
    people = predictions
      .filter(item => item.class === "person" && item.score >= MIN_PERSON_CONFIDENCE)
      .map(item => ({ bbox: item.bbox, score: item.score, kind: "person" }))
      .sort((a, b) => b.score - a.score);
  }
  if (people.length) return people[0];

  // COCO-SSD a menudo no reconoce la clase "person" si solo se ve la cara o el torso.
  // BlazeFace sirve como alternativa de presencia, sin identificar a nadie.
  if (faceModel) {
    const faces = await faceModel.estimateFaces(video, false);
    const normalized = faces.map(face => {
      const topLeft = Array.isArray(face.topLeft) ? face.topLeft : face.topLeft?.arraySync?.();
      const bottomRight = Array.isArray(face.bottomRight) ? face.bottomRight : face.bottomRight?.arraySync?.();
      const probability = Array.isArray(face.probability) ? Number(face.probability[0]) : Number(face.probability?.[0] ?? 0.8);
      if (!topLeft || !bottomRight) return null;
      return {
        bbox: [Number(topLeft[0]), Number(topLeft[1]), Number(bottomRight[0]) - Number(topLeft[0]), Number(bottomRight[1]) - Number(topLeft[1])],
        score: Number.isFinite(probability) ? probability : 0.8,
        kind: "face"
      };
    }).filter(face => face && face.score >= MIN_FACE_CONFIDENCE && face.bbox.every(Number.isFinite));
    if (normalized.length) return normalized.sort((a, b) => b.score - a.score)[0];
  }
  return null;
}

function resetPresence() {
  personPresent = false;
  personStartedAt = 0;
  triggeredThisPresence = false;
  latestZone = -1;
}

function scanFrame(now) {
  if (!stream || !video) { rafId = 0; return; }
  if (video.readyState < 2) {
    rafId = requestAnimationFrame(scanFrame);
    return;
  }
  if (!inferenceFailed && !inferenceBusy && now - lastInferenceAt >= INFERENCE_INTERVAL_MS) {
    inferenceBusy = true;
    lastInferenceAt = now;
    detectPresence().then(detection => {
      if (!stream) return;
      if (!detection) {
        drawOverlay(null);
        resetPresence();
        status("No detecto cuerpo ni rostro. Acércate, mejora la iluminación y encuadra cabeza y torso.", true);
        return;
      }
      drawOverlay(detection);
      const [x, , boxWidth, boxHeight] = detection.bbox;
      const areaRatio = Math.max(0, Math.min(1, (boxWidth * boxHeight) / Math.max(1, video.videoWidth * video.videoHeight)));
      const minArea = detection.kind === "face" ? MIN_FACE_AREA : MIN_PERSON_AREA;
      if (areaRatio < minArea) {
        resetPresence();
        status(`${detection.kind === "face" ? "Rostro" : "Persona"} detectado (${Math.round(detection.score * 100)}%), pero está lejos o ocupa poco espacio. Acércate a la cámara.`, true);
        return;
      }
      // La vista previa está espejada; invertimos X para calcular la zona que ve el usuario.
      const mirroredCenterX = 1 - ((x + boxWidth / 2) / video.videoWidth);
      const zone = Math.max(0, Math.min(ZONE_COUNT - 1, Math.floor(mirroredCenterX * ZONE_COUNT)));
      if (!personPresent || zone !== latestZone) {
        personPresent = true;
        personStartedAt = performance.now();
        triggeredThisPresence = false;
      }
      latestZone = zone;
      const dwellMs = performance.now() - personStartedAt;
      const stationId = zoneAssignments[zone];
      const station = stationId ? appState.stations.get(stationId) : null;
      const zoneText = station ? `Zona ${zone + 1} → ${station.name}` : `Zona ${zone + 1} sin estación asignada`;
      const sourceText = detection.kind === "face" ? "Rostro" : "Persona";
      status(`${sourceText} detectado (${Math.round(detection.score * 100)}%) · ${zoneText} · ${Math.max(1, Math.floor(dwellMs / 1000))} s`, true);
      if (dwellMs >= HOLD_MS && !triggeredThisPresence) {
        onSustainedPresence({ confidence: detection.score, areaRatio, dwellMs, zone, station, kind: detection.kind });
      }
    }).catch(error => {
      console.error("Error en la inferencia de visión:", error);
      inferenceFailed = true;
      status(`La cámara funciona, pero la IA ha fallado: ${error?.message || "error de inferencia"}. Reinicia la cámara para volver a intentarlo.`);
      // Pausamos la inferencia para evitar cientos de errores por segundo; la vista previa sigue visible.
    }).finally(() => { inferenceBusy = false; });
  }
  if (stream) rafId = requestAnimationFrame(scanFrame);
}

function onSustainedPresence({ confidence, areaRatio, dwellMs, zone, station, kind }) {
  const now = performance.now();
  if (!station) {
    status(`Zona ${zone + 1} sin estación asignada.`, true);
    triggeredThisPresence = true;
    return;
  }
  if (now - (lastTriggerByStation.get(station.id) || -Infinity) < TRIGGER_COOLDOWN_MS) {
    status(`${station.name} está en pausa para evitar activaciones repetidas.`, true);
    triggeredThisPresence = true;
    return;
  }
  if (appState.mode !== "public") {
    if (now - lastAdminNoticeAt > 4000) {
      status(`${kind === "face" ? "Rostro" : "Persona"} detectado. Inicia el modo público para probar la activación automática.`, true);
      lastAdminNoticeAt = now;
    }
    return;
  }
  if (!station.enabled) {
    status(`La estación ${station.name} está desactivada.`, true);
    triggeredThisPresence = true;
    return;
  }
  lastTriggerByStation.set(station.id, now);
  emitEvent("entry");
  emitEvent("attention", station.id, {
    proximity: Math.min(0.95, 0.45 + areaRatio * 2.5),
    dwellMs,
    orientation: null,
    confidence,
    zone: zone + 1,
    source: kind === "face" ? "blazeface-face-zone-detection" : "coco-ssd-person-zone-detection"
  });
  status(`Zona ${zone + 1} detectada por IA. Activando ${station.name}.`, true);
  triggeredThisPresence = true;
}

export function stopCamera(updateStatus = true) {
  startToken += 1;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  if (video) {
    video.pause();
    video.srcObject = null;
  }
  if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
  inferenceBusy = false;
  inferenceFailed = false;
  resetPresence();
  setControls(false);
  if (updateStatus) status("Cámara apagada. No se está capturando imagen.");
}
