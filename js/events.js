import { appState, stationStates } from "./state.js";
import { announce } from "./utils.js";
import { renderDevices } from "./panels.js";

const timers = new Map();
const attentionTimers = new Map();

/*
 * Contrato de eventos normalizado:
 * { type: "attention", stationId, signals: { proximity, dwellMs, orientation } }
 * En la demo las señales se simulan. Un futuro adaptador de sensores deberá emitir
 * el mismo contrato sin modificar la lógica de recomendación.
 */
export function emitEvent(type, stationId = null, signals = {}) {
  window.dispatchEvent(new CustomEvent("beautytech:event", {
    detail: { type, stationId, signals, timestamp: Date.now(), source: "demo-simulator" }
  }));
}

export function initializeEventEngine() {
  window.addEventListener("beautytech:event", ({ detail }) => {
    if (detail.type === "entry") startSession();
    if (detail.type === "attention" && detail.stationId) activateStation(detail.stationId, detail.signals);
    if (detail.type === "lost-attention" && detail.stationId) finishStation(detail.stationId, "lost");
    if (detail.type === "session-end") endSession();
  });
}

function startSession() {
  appState.sessionActive = true;
  refreshSessionTimeout();
  announce("Visitante detectado · sesión de demostración iniciada.");
}

function refreshSessionTimeout() {
  clearTimeout(appState.sessionTimer);
  appState.sessionTimer = setTimeout(endSession, appState.config.settings.sessionTimeoutMs);
}

/* Algoritmo demostrativo: puntúa clips según familia/campaña y señales disponibles.
   No aprende de personas reales ni infiere preferencias personales. */
function rankClips(station, signals = {}) {
  const clips = Array.isArray(station.clips) && station.clips.length
    ? station.clips
    : [{ id: "fallback", title: station.headline, subtitle: station.campaign, tags: station.tags || [], durationMs: 6000 }];
  const familyTerms = `${station.family || ""} ${station.campaign || ""} ${station.name || ""}`.toLowerCase();
  const dwell = Math.max(0, Number(signals.dwellMs) || 0);
  const proximity = Math.max(0, Math.min(1, Number(signals.proximity) || 0.7));
  const orientation = signals.orientation === false ? 0 : 1;
  return clips.map((clip, index) => {
    const text = `${clip.title} ${clip.subtitle} ${(clip.tags || []).join(" ")}`.toLowerCase();
    const overlap = (station.tags || []).filter(tag => text.includes(String(tag).toLowerCase())).length;
    const categoryMatch = familyTerms.split(/\s+/).filter(term => term.length > 3 && text.includes(term)).length;
    const score = 50 + overlap * 8 + categoryMatch * 4 + Math.min(dwell / 500, 20) + proximity * 10 + orientation * 5 - index * 0.25;
    return { ...clip, score };
  }).sort((a, b) => b.score - a.score).slice(0, 2);
}

function activateStation(id, signals = {}) {
  const station = appState.stations.get(id);
  if (!station || !station.enabled || appState.mode !== "public") return;
  if (String(signals.source || "").includes("detection")) {
    const modeLabel = document.querySelector("#public-mode-label");
    if (modeLabel) modeLabel.textContent = "DETECCIÓN EN TIEMPO REAL";
  }
  if ([stationStates.COOLDOWN, stationStates.DISABLED, stationStates.PLAYING, stationStates.ATTENTION].includes(station.state)) return;
  const playing = [...appState.stations.values()].filter(s => s.state === stationStates.PLAYING || s.state === stationStates.ATTENTION).length;
  if (playing >= appState.config.settings.maxConcurrent) {
    announce("Límite de recomendaciones simultáneas alcanzado.");
    return;
  }
  clearTimeout(timers.get(id));
  clearTimeout(attentionTimers.get(id));
  station.state = stationStates.ATTENTION;
  station.activeSignals = signals;
  station.recommendations = rankClips(station, signals);
  station.clipIndex = 0;
  renderDevices();

  const attentionTimer = setTimeout(() => {
    attentionTimers.delete(id);
    if (appState.mode !== "public" || !station.enabled || station.state !== stationStates.ATTENTION) return;
    station.state = stationStates.PLAYING;
    renderDevices();
    refreshSessionTimeout();
    playNextClip(station);
  }, Math.max(0, Number(station.dwellMs ?? appState.config.settings.attentionThresholdMs) - Math.max(0, Number(signals.dwellMs) || 0)));
  attentionTimers.set(id, attentionTimer);
}

function playNextClip(station) {
  if (appState.mode !== "public" || !station.enabled) return;
  const clips = station.recommendations || [];
  if (station.clipIndex >= clips.length) {
    finishStation(station.id, "complete");
    return;
  }
  station.currentClip = clips[station.clipIndex];
  renderDevices();
  const duration = Math.max(2500, Number(station.currentClip.durationMs) || 6000);
  timers.set(station.id, setTimeout(() => {
    station.clipIndex += 1;
    playNextClip(station);
  }, duration));
}

function finishStation(id, reason = "complete") {
  const station = appState.stations.get(id);
  if (!station) return;
  clearTimeout(timers.get(id));
  clearTimeout(attentionTimers.get(id));
  attentionTimers.delete(id);
  station.currentClip = null;
  station.recommendations = [];
  station.state = station.enabled ? stationStates.COOLDOWN : stationStates.DISABLED;
  if (reason === "lost" && appState.mode === "public") {
    const modeLabel = document.querySelector("#public-mode-label");
    if (modeLabel) modeLabel.textContent = "ESPERA DE PRESENCIA";
  }
  renderDevices();
  timers.set(id, setTimeout(() => {
    station.state = station.enabled ? stationStates.IDLE : stationStates.DISABLED;
    renderDevices();
  }, Math.max(1000, Number(station.cooldownMs ?? appState.config.settings.cooldownMs))));
}

function endSession() {
  clearTimeout(appState.sessionTimer);
  appState.sessionActive = false;
  for (const [id, station] of appState.stations) {
    clearTimeout(timers.get(id));
    clearTimeout(attentionTimers.get(id));
    attentionTimers.delete(id);
    station.state = station.enabled ? stationStates.IDLE : stationStates.DISABLED;
    station.currentClip = null;
    station.recommendations = [];
  }
  renderDevices();
  announce("Sesión finalizada. Las estaciones vuelven al estado ambiental.");
}

export function resetStation(id) {
  const station = appState.stations.get(id);
  if (!station) return;
  clearTimeout(timers.get(id));
  clearTimeout(attentionTimers.get(id));
  timers.delete(id);
  attentionTimers.delete(id);
  station.state = station.enabled ? stationStates.IDLE : stationStates.DISABLED;
  station.currentClip = null;
  station.recommendations = [];
  station.clipIndex = 0;
  station.activeSignals = null;
}

export function resetStations() {
  for (const timer of timers.values()) clearTimeout(timer);
  for (const timer of attentionTimers.values()) clearTimeout(timer);
  timers.clear(); attentionTimers.clear();
  for (const station of appState.stations.values()) resetStation(station.id);
  renderDevices();
}
