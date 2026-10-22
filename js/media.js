import { appState } from "./state.js";
import { $, escapeHTML } from "./utils.js";
import { renderDevices } from "./panels.js?v=18";

const objectUrls = new Set();
let selectedStationId = "";
const MEDIA_STORAGE_KEY = "beauty-tech-retail-media-urls-v1";

function currentStation() {
  return appState.stations.get(selectedStationId) || [...appState.stations.values()][0] || null;
}

function updateMediaLabels() {
  const station = currentStation();
  if (!station) return;
  station.mediaFiles ||= [null, null];
  $("#media-name-1").textContent = station.mediaFiles[0]?.name || "Sin vídeo seleccionado";
  $("#media-name-2").textContent = station.mediaFiles[1]?.name || "Sin vídeo seleccionado";
  $("#media-url-1").value = station.mediaFiles[0]?.sourceUrl || "";
  $("#media-url-2").value = station.mediaFiles[1]?.sourceUrl || "";
  $("#media-audience-1").value = station.mediaFiles[0]?.audience || "all";
  $("#media-audience-2").value = station.mediaFiles[1]?.audience || "all";
}

function releaseMedia(station, slot) {
  const old = station.mediaFiles?.[slot];
  if (old?.url && objectUrls.has(old.url)) {
    URL.revokeObjectURL(old.url);
    objectUrls.delete(old.url);
  }
}

function saveMediaLinks() {
  const links = Object.fromEntries([...appState.stations.values()].map(station => [
    station.id,
    (station.mediaFiles || [null, null]).map(media => media?.sourceUrl
      ? { url: media.sourceUrl, audience: media.audience || "all" }
      : null)
  ]));
  try {
    localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(links));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los enlaces de vídeo:", error);
    return false;
  }
}

function setMedia(station, slot, media, persistLink = false) {
  const replacingSavedLink = Boolean(station.mediaFiles?.[slot]?.sourceUrl);
  station.mediaFiles ||= [null, null];
  media.audience = $(`#media-audience-${slot + 1}`)?.value || "all";
  releaseMedia(station, slot);
  station.mediaFiles[slot] = media;
  updateMediaLabels();
  renderDevices();
  const saved = persistLink || replacingSavedLink ? saveMediaLinks() : true;
  const persistenceMessage = !saved ? " No se pudieron actualizar los enlaces guardados en este navegador." : "";
  $("#media-status").textContent = `Vídeo ${slot + 1} preparado para ${station.name}. En modo público se mostrará al activar esa estación.${persistenceMessage}`;
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
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  setMedia(station, slot, { name: file.name, url, kind: "video" });
  $(`#media-url-${slot + 1}`).value = "";
}

function parseVideoUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Pega una URL válida con formato https://.");
  }
  if (url.protocol !== "https:") throw new Error("Por seguridad, usa enlaces que empiecen por https://.");

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    const videoId = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) throw new Error("No se encontró un vídeo de YouTube válido en ese enlace.");
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return { name: `YouTube · ${videoId}`, url: watchUrl, sourceUrl: watchUrl, provider: "YouTube", kind: "external" };
  }
  if (["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(host)) {
    const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1] || url.pathname.match(/^\/player\/v1\/(\d+)/)?.[1];
    if (!videoId) throw new Error("Usa el enlace completo de TikTok (no el enlace corto) para preparar el vídeo.");
    return { name: `TikTok · ${videoId}`, url: url.href, sourceUrl: url.href, provider: "TikTok", kind: "external" };
  }
  if (host === "instagram.com") {
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) throw new Error("El enlace de Instagram debe ser una publicación, un reel o un vídeo.");
    return { name: `Instagram · ${match[2]}`, url: url.href, sourceUrl: url.href, provider: "Instagram", kind: "external" };
  }
  if (/\.(mp4|webm|ogv|ogg)$/i.test(url.pathname)) {
    return { name: url.pathname.split("/").filter(Boolean).pop() || "Vídeo enlazado", url: url.href, sourceUrl: url.href, kind: "video" };
  }
  throw new Error("Enlace no compatible. Usa YouTube, TikTok, Instagram o una URL directa a MP4, WebM u Ogg.");
}

function setVideoUrl(slot) {
  const station = currentStation();
  const input = $(`#media-url-${slot + 1}`);
  if (!station || !input) return;
  try {
    setMedia(station, slot, parseVideoUrl(input.value), true);
    $(`#media-video-${slot + 1}`).value = "";
  } catch (error) {
    $("#media-status").textContent = error.message;
  }
}

function restoreMediaLinks() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEDIA_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
    for (const [stationId, urls] of Object.entries(saved)) {
      const station = appState.stations.get(stationId);
      if (!station || !Array.isArray(urls)) continue;
      station.mediaFiles = [null, null];
      urls.slice(0, 2).forEach((value, slot) => {
        const sourceUrl = typeof value === "string" ? value : value?.url;
        if (typeof sourceUrl !== "string" || !sourceUrl.trim()) return;
        try {
          station.mediaFiles[slot] = parseVideoUrl(sourceUrl);
          station.mediaFiles[slot].audience = value?.audience || "all";
        } catch (error) {
          console.warn(`Se omitió un enlace de vídeo guardado no válido para ${stationId}:`, error);
        }
      });
    }
  } catch (error) {
    console.warn("No se pudieron recuperar los enlaces de vídeo guardados.", error);
    try { localStorage.removeItem(MEDIA_STORAGE_KEY); }
    catch (clearError) { console.warn("No se pudieron borrar los enlaces de vídeo dañados.", clearError); }
  }
}

export function initializeMediaControls() {
  const select = $("#media-station");
  if (!select) return;
  restoreMediaLinks();
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
  document.querySelectorAll(".media-audience").forEach(select => select.addEventListener("change", () => {
    const slot = Number(select.id.slice(-1)) - 1;
    const station = currentStation();
    if (!station?.mediaFiles?.[slot]) return;
    station.mediaFiles[slot].audience = select.value;
    if (station.mediaFiles[slot].sourceUrl && !saveMediaLinks()) {
      $("#media-status").textContent = "No se pudo guardar el perfil asignado al enlace.";
    } else {
      $("#media-status").textContent = `Contenido del vídeo ${slot + 1} asignado a ${select.selectedOptions[0].textContent.toLowerCase()}.`;
    }
  }));
  document.querySelectorAll("[data-media-url-slot]").forEach(button => button.addEventListener("click", () => {
    setVideoUrl(Number(button.dataset.mediaUrlSlot));
  }));
  window.addEventListener("beforeunload", () => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  });
}
