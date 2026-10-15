import { appState } from "./state.js";
import { $, escapeHTML } from "./utils.js";

const iconShapes = {
 apparatology: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
 makeup: '<path d="M8 3h8v4H8zM9 7h6l1 13H8z"/><path d="M10 3V1h4v2"/>',
 haircare: '<path d="M5 3c5 2 2 7 7 9s2 6 7 9"/><path d="M8 2c4 4 0 7 5 10s2 6 5 8"/><path d="M4 10c1 5 5 5 5 10"/>',
 newness: '<path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/>',
 haircolor: '<path d="M5 3v18M9 3v18M13 3v18M17 3v18M21 3v18"/><path d="M3 7h20M3 13h20M3 18h20"/>',
 sensor: '<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>'
};
export function iconSVG(name) {
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconShapes[name] || iconShapes.newness}</svg>`;
}
export async function loadConfiguration() {
 const response = await fetch("./data/contenido.json");
 if (!response.ok) throw new Error("No se ha podido cargar data/contenido.json");
 const data = await response.json();
 if (!Array.isArray(data.stations) || data.stations.length !== 5) throw new Error("La configuración debe contener cinco estaciones comerciales.");
 appState.config = data;
 return data;
}
export function renderConfigs() {
 const host = $("#station-configs");
 host.innerHTML = appState.config.stations.map((station, index) => `
  <article class="config-card" style="--card-tint:${station.tint};--card-deep:${station.deep}">
   <div class="config-card-head"><span class="config-icon">${iconSVG(station.icon)}</span><div><span class="station-number">ESTACIÓN 0${index+1}</span><h3>${escapeHTML(station.name)}</h3></div></div>
   <label for="family-${station.id}">Familia comercial</label>
   <select id="family-${station.id}" data-config="family" data-id="${station.id}">
    ${[station.family,"Rutina esencial","Selección premium","Campaña de temporada"].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option ${v===station.family?"selected":""}>${escapeHTML(v)}</option>`).join("")}
   </select>
   <label for="campaign-${station.id}">Campaña activa</label>
   <select id="campaign-${station.id}" data-config="campaign" data-id="${station.id}">
    ${[station.campaign,"Selección editorial","Ritual diario","Novedad destacada"].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option ${v===station.campaign?"selected":""}>${escapeHTML(v)}</option>`).join("")}
   </select>
   <label class="toggle-row" for="enabled-${station.id}"><span>Estación activa</span><span class="toggle"><input id="enabled-${station.id}" data-config="enabled" data-id="${station.id}" type="checkbox" checked><span class="toggle-track"></span></span></label>
  </article>`).join("");
}
