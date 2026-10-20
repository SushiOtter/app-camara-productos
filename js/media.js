import { appState } from "./state.js";
import { $, escapeHTML } from "./utils.js";
import { renderDevices } from "./panels.js";

const objectUrls = new Set();
let selectedStationId = "";

function currentStation() {
  return appState.stations.get(selectedStationId) || [...appState.stations.values()][0] || null;
}

function updateMediaLabels() {
  const station = currentStation();
  if (!station) return;
  station.mediaFiles ||= [null, null];
  $("#media-name-1").textContent = station.mediaFiles[0]?.name || "Sin vídeo seleccionado";
  $("#media-name-2").textContent = station.mediaFiles[1]?.name || "Sin vídeo seleccionado";
}

function setVideo(slot, file) {
  const station = currentStation();
  if (!station || !file) return;
  const supportedType = ["video/mp4", "video/webm", "video/ogg"].includes(file.type);
  const supportedExtension = /\.(mp4|webm|ogv|ogg)$/i.test(file.name);
  if (!supportedType && !(file.type === "" && supportedExtension)) {
    $("#media-status").textContent = "Formato no admitido. Selecciona un archivo MP4, WebM u Ogg.";
    return;
  }
  station.mediaFiles ||= [null, null];
  const old = station.mediaFiles[slot];
  if (old?.url && objectUrls.has(old.url)) {
    URL.revokeObjectURL(old.url);
    objectUrls.delete(old.url);
  }
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  station.mediaFiles[slot] = { name: file.name, url };
  updateMediaLabels();
  renderDevices();
  $("#media-status").textContent = `Vídeo ${slot + 1} preparado para ${station.name}. En modo público se reproducirá cuando se active esa estación.`;
}

export function initializeMediaControls() {
  const select = $("#media-station");
  if (!select) return;
  select.innerHTML = [...appState.stations.values()].map(station => `<option value="${station.id}">${escapeHTML(station.name)}</option>`).join("");
  selectedStationId = select.value;
  updateMediaLabels();
  select.addEventListener("change", () => {
    selectedStationId = select.value;
    $("#media-video-1").value = "";
    $("#media-video-2").value = "";
    updateMediaLabels();
    $("#media-status").textContent = `Configurando contenido para ${currentStation()?.name || "la estación"}.`;
  });
  $("#media-video-1")?.addEventListener("change", event => setVideo(0, event.target.files?.[0]));
  $("#media-video-2")?.addEventListener("change", event => setVideo(1, event.target.files?.[0]));
  window.addEventListener("beforeunload", () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  });
}
