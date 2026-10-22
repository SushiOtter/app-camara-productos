import { appState, stationStates } from "./state.js";
import { $, escapeHTML } from "./utils.js";
import { iconSVG } from "./configuration.js";

function deviceMarkup(station, index, withVideo = false, publicMode = false) {
 const playing = station.state === stationStates.PLAYING || station.state === stationStates.ATTENTION;
 const disabled = !station.enabled;
 const stateLabel = disabled ? "DESACTIVADA" : station.state === stationStates.ATTENTION ? "INTERÉS DETECTADO" :
   station.state === stationStates.PLAYING ? "RECOMENDACIÓN ACTIVA" : station.state === stationStates.COOLDOWN ? "EN ESPERA" : "EN REPOSO";
 const clip = station.currentClip;
 const title = clip ? clip.title : station.headline;
 const subtitle = clip ? clip.subtitle : station.copy;
 const campaign = clip ? `SELECCIÓN ${Math.min((station.clipIndex || 0) + 1, 2)} DE 2` : `${station.contentType || "Campaña"} · ${station.family}`;
 const tags = clip ? (clip.tags || []).slice(0,3).join(" · ") : (station.tags || []).join(" · ");
 const mediaSlot = station.mediaSlot === null ? -1 : station.mediaSlot ?? station.clipIndex;
 const media = withVideo && playing && mediaSlot >= 0 ? station.mediaFiles?.[mediaSlot] : null;
 const mediaMarkup = media?.kind === "external"
   ? `<a class="media-external-link" href="${escapeHTML(media.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir vídeo de ${escapeHTML(station.name)} en ${escapeHTML(media.provider)}"><span class="media-external-provider">${escapeHTML(media.provider)}</span><span class="media-external-title">Ver vídeo</span><span class="media-external-hint">Se abrirá fuera de la experiencia</span></a>`
   : media?.failed
     ? `<a class="media-external-link" href="${escapeHTML(media.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir vídeo de ${escapeHTML(station.name)} en una pestaña nueva"><span class="media-external-provider">Vídeo no disponible aquí</span><span class="media-external-title">Abrir enlace</span><span class="media-external-hint">Comprueba el acceso o el formato en el sitio original</span></a>`
     : media ? `<video class="device-video" src="${escapeHTML(media.url)}" data-station="${station.id}" data-slot="${mediaSlot || 0}" data-media-url="${escapeHTML(media.url)}" muted autoplay playsinline aria-label="Vídeo de ${escapeHTML(station.name)}"></video>` : "";
 return `<article class="device ${playing?"is-playing":""} ${!station.enabled?"is-disabled":""}" data-station-id="${escapeHTML(station.id)}" style="--device-accent:${station.tint};--device-deep:${station.deep}" aria-label="${escapeHTML(station.name)}: ${stateLabel}">
  <div class="device-screen ${media ? "has-video" : ""}">
  ${mediaMarkup}
  <div class="device-top"><span class="device-icon">${iconSVG(station.icon)}</span>${publicMode ? "" : `<span class="device-index">BT / 0${index+1}</span>`}</div>
   <div class="device-content">
    <p class="device-kicker">${escapeHTML(playing ? campaign : station.family)}</p>
    <h3 class="device-title">${escapeHTML(title)}</h3>
    <p class="device-copy">${escapeHTML(playing ? subtitle : station.copy)}</p>
    ${playing ? `<div class="clip-meta"><span class="clip-dot"></span><span>${escapeHTML(tags)}</span></div>` : appState.presentationMode ? `<p class="presentation-prompt">Acércate para descubrir productos</p><div class="clip-meta"><span class="clip-dot"></span><span>${escapeHTML((station.tags || []).join(" · "))}</span></div>` : ""}
    <div class="product-orbit" aria-hidden="true"></div><div class="product-shape" aria-hidden="true"></div>
   </div>
   <div class="device-bottom"><span>${stateLabel}</span><span aria-hidden="true">${playing ? `${Math.min((station.clipIndex || 0)+1,2)}/2` : "↗"}</span></div>
  </div>
 </article>`;
}
function sensorMarkup() {
 return `<article class="device" aria-label="Sensor de entrada: simulación"><div class="device-screen sensor-screen"><div class="device-top"><span class="device-icon">${iconSVG("sensor")}</span><span class="device-index">BT / 06</span></div><div class="device-content"><p class="device-kicker">PUNTO DE ENTRADA</p><h3 class="device-title">La experiencia empieza aquí</h3><p class="device-copy">Presencia y sesión representadas en la demo.</p><div class="sensor-radar" aria-hidden="true"></div></div><div class="device-bottom"><span>${appState.sessionActive?"SESIÓN ACTIVA":"ESPERANDO ENTRADA"}</span><span aria-hidden="true">⌁</span></div></div></article>`;
}
export function renderDevices() {
 const stations = [...appState.stations.values()];
 const admin = $("#device-grid"), pub = $("#public-grid");
 if (admin) admin.innerHTML = stations.map((s,i)=>deviceMarkup(s,i, appState.mode !== "public")).join("") + sensorMarkup();
 if (pub) {
  const visibleStations = stations.filter(station => station.enabled && (!appState.presentationMode || station.id === appState.presentationStationId));
  pub.innerHTML = visibleStations.map((s,i)=>deviceMarkup(s,i, true, true)).join("");
 }
 document.querySelectorAll(".device-video").forEach(video => {
  video.addEventListener("ended", () => {
   window.dispatchEvent(new CustomEvent("beautytech:media-ended", { detail: { stationId: video.dataset.station, slot: Number(video.dataset.slot), url: video.dataset.mediaUrl } }));
  }, { once: true });
  video.addEventListener("error", () => {
   const station = appState.stations.get(video.dataset.station);
   const slot = Number(video.dataset.slot);
   if (!station || station.mediaFiles?.[slot]?.url !== video.dataset.mediaUrl) return;
   const media = station.mediaFiles[slot];
   if (media.sourceUrl) media.failed = true;
   else station.mediaFiles[slot] = null;
   const status = $("#media-status");
   if (status) status.textContent = `No se pudo reproducir el vídeo de ${station.name}. Revisa el enlace, los permisos y el formato; puedes abrirlo desde la pantalla o sustituirlo.`;
   window.dispatchEvent(new CustomEvent("beautytech:media-error", { detail: { stationId: station.id, slot, url: video.dataset.mediaUrl } }));
   renderDevices();
  }, { once: true });
 });
}
