// Punto de extensión para carga y validación de contenido de producto.
// Los textos de las estaciones proceden de data/contenido.json; no se duplican aquí.
export function validateStation(station) {
 return Boolean(station && station.id && station.name && station.headline && Array.isArray(station.tags));
}
