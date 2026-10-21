// Punto de extensión para carga y validación de contenido de producto.
// Los textos de las estaciones proceden de data/contenido.json; no se duplican aquí.
export function validateStation(station) {
 return Boolean(station && station.id && station.name && station.headline && Array.isArray(station.tags));
}

export const ageProfiles = Object.freeze({
  under18: Object.freeze({
    label: "Menos de 18",
    products: ["Limpiador suave", "Hidratante ligera", "Protector solar SPF 30+", "Bálsamo labial"]
  }),
  "18-24": Object.freeze({
    label: "18–24 años",
    products: ["Limpiador suave", "Sérum hidratante", "Hidratante ligera", "Protector solar SPF 30+"]
  }),
  "25-34": Object.freeze({
    label: "25–34 años",
    products: ["Limpiador facial", "Sérum antioxidante", "Hidratante para la barrera cutánea", "Protector solar SPF 30+"]
  }),
  "35-44": Object.freeze({
    label: "35–44 años",
    products: ["Sérum hidratante", "Crema nutritiva", "Protector solar SPF 30+", "Maquillaje de acabado luminoso"]
  }),
  "45-plus": Object.freeze({
    label: "45 años o más",
    products: ["Sérum hidratante", "Crema nutritiva", "Protector solar SPF 30+", "Tratamiento capilar nutritivo"]
  }),
  general: Object.freeze({
    label: "Recomendación general",
    products: ["Limpiador suave", "Hidratante", "Protector solar SPF 30+"]
  })
});

export function getAgeRange(age) {
  if (!Number.isFinite(age) || age < 0) return null;
  if (age < 18) return "under18";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  return "45-plus";
}

export function getAgeProfile(range) {
  return ageProfiles[range] || ageProfiles.general;
}
