/* Capacidades reales del prototipo actual. */
export const detectionCapabilities = Object.freeze({
  cameraAccess: true,
  motionDetection: false,
  personDetectionAI: true,
  personModel: "COCO-SSD / TensorFlow.js (clase person)",
  fallbackPresenceModel: "BlazeFace (rostro; no identidad)",
  proximity: "estimación aproximada por tamaño de detección",
  orientation: false,
  gaze: false,
  attentionInference: "presencia sostenida en una zona; no equivale a atención real",
  ageEstimation: "rango aproximado en el navegador mediante @vladmandic/face-api",
  stationSelection: "asignación manual de zonas por el empleado"
});
