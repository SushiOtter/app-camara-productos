/* Capacidades reales del prototipo actual. */
export const detectionCapabilities = Object.freeze({
  cameraAccess: true,
  motionDetection: false,
  personDetectionAI: true,
  personModel: "COCO-SSD / TensorFlow.js (clase person)",
  proximity: "estimación aproximada por tamaño de la detección",
  orientation: false,
  gaze: false,
  attentionInference: "solo presencia sostenida; no equivale a atención real",
  ageEstimation: false,
  stationSelection: "manual por el empleado en este prototipo"
});
