import { appState, stationStates } from "./state.js";
import { $, escapeHTML } from "./utils.js";
import { iconSVG } from "./configuration.js";

function deviceMarkup(station, index) {
 const playing = station.state === stationStates.PLAYING || station.state === stationStates.ATTENTION;
 const disabled = !station.enabled;
 const stateLabel = disabled ? "DESACTIVADA" : station.state === stationStates.ATTENTION ? "INTERÉS DETECTADO" :
   station.state === stationStates.PLAYING ? "RECOMENDACIÓN ACTIVA" : station.state === stationStates.COOLDOWN ? "EN ESPERA" : "EN REPOSO";
 const clip = station.currentClip;
 const title = clip ? clip.title : station.headline;
 const subtitle = clip ? clip.subtitle : station.copy;
 const campaign = clip ? `SELECCIÓN ${Math.min((station.clipIndex || 0) + 1, 2)} DE 2` : station.campaign;
 const tags = clip ? (clip.tags || []).slice(0,3).join(" · ") : (station.tags || []).join(" · ");
 return `<article class="device ${playing?"is-playing":""} ${!station.enabled?"is-disabled":""}" style="--device-accent:${station.tint};--device-deep:${station.deep}" aria-label="${escapeHTML(station.name)}: ${stateLabel}">
  <div class="device-screen">
   <div class="device-top"><span class="device-icon">${iconSVG(station.icon)}</span><span class="device-index">BT / 0${index+1}</span></div>
   <div class="device-content">
    <p class="device-kicker">${escapeHTML(playing ? campaign : station.family)}</p>
    <h3 class="device-title">${escapeHTML(title)}</h3>
    <p class="device-copy">${escapeHTML(playing ? subtitle : station.copy)}</p>
    ${playing ? `<div class="clip-meta"><span class="clip-dot"></span><span>${escapeHTML(tags)}</span></div>` : ""}
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
 const markup = [...appState.stations.values()].map((s,i)=>deviceMarkup(s,i)).join("") + sensorMarkup();
 const admin = $("#device-grid"), pub = $("#public-grid");
 if (admin) admin.innerHTML = markup;
 if (pub) pub.innerHTML = markup;
}
