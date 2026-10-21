import { getAgeRange } from "./products.js";

const FACE_API_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

let libraryPromise = null;
let modelsPromise = null;

function loadFaceApi() {
  if (window.faceapi) return Promise.resolve(window.faceapi);
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          libraryPromise = null;
          reject(error);
        } else resolve(window.faceapi);
      };
      const timeout = setTimeout(() => finish(new Error("Tiempo agotado al descargar el estimador de edad.")), 22000);
      script.src = FACE_API_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => finish(window.faceapi ? null : new Error("El estimador de edad se descargó, pero no se inicializó."));
      script.onerror = () => finish(new Error("No se pudo descargar el estimador de edad."));
      document.head.appendChild(script);
    });
  }
  return libraryPromise;
}

async function ensureAgeModels() {
  const faceapi = await loadFaceApi();
  if (!modelsPromise) {
    modelsPromise = (async () => {
      if (!faceapi.nets.tinyFaceDetector.isLoaded) await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      if (!faceapi.nets.ageGenderNet.isLoaded) await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
    })().catch(error => {
      modelsPromise = null;
      throw error;
    });
  }
  await modelsPromise;
  return faceapi;
}

export async function estimateAgeRange(video) {
  const faceapi = await ensureAgeModels();
  const result = await faceapi.detectSingleFace(
    video,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
  ).withAgeAndGender();
  return result && Number.isFinite(result.age) ? getAgeRange(result.age) : null;
}
