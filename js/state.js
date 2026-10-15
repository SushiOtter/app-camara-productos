export const stationStates = Object.freeze({
  IDLE: "idle", ATTENTION: "attention", PLAYING: "playing",
  COOLDOWN: "cooldown", DISABLED: "disabled", ERROR: "error"
});
export const appState = { mode: "admin", sessionActive: false, sessionTimer: null, stations: new Map(), config: null };
