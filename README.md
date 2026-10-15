# Beauty Tech — Demo de retail inteligente

Demo web local para presentar un concepto de recomendación automática en una tienda de belleza. Incluye cinco estaciones comerciales, una pantalla de entrada/sensor conceptual, administración y modo público.

## Requisitos

- Windows 10/11.
- PHP instalado y disponible desde la terminal (`php -v`).
- Navegador moderno (Chrome, Edge o Firefox).
- No necesita Node.js, compilación ni servicios externos para el recorrido básico.

## Ejecutar en Windows

1. Descomprime la carpeta `beauty-tech-demo`.
2. Abre CMD o PowerShell dentro de esa carpeta.
3. Ejecuta:

   ```bash
   php -S localhost:8000
   ```

4. Abre `http://localhost:8000`.

No abras `index.html` con doble clic: los módulos JavaScript y el JSON necesitan servirse mediante HTTP. `localhost` es un contexto seguro para futuras funciones de cámara, aunque esta demo no activa cámara alguna.

## Cómo hacer la demostración

1. En Administración, cambia la familia o campaña de cada una de las cinco estaciones.
2. Desactiva una estación para demostrar que puede excluirse de la jornada.
3. Pulsa **Iniciar modo público**. Los controles administrativos desaparecen.
4. Para simular el interés de un visitante, vuelve a Administración y pulsa **Probar recomendación**. La demo activa la primera estación disponible y muestra las dos piezas de recomendación. También puedes usar `Ctrl + Alt + 1..5` mientras estás en modo público para seleccionar una estación concreta.
5. Usa el control superior para volver a Administración.

## Qué está implementado

- Interfaz de administración con controles reales para familia, campaña y activación de estaciones.
- Modo público sin controles visibles para clientes.
- Seis pantallas de previsualización con identidades gráficas diferenciadas.
- Configuración de contenido desde `data/contenido.json`.
- Motor de eventos normalizado mediante `beautytech:event`.
- Estados por estación: `idle`, `attention`, `playing`, `cooldown` y `disabled`.
- Activación simulada, límite de recomendaciones simultáneas, tiempo de espera y reinicio automático de la recomendación.
- Detector visual local experimental: permite abrir la cámara y detectar movimiento mediante comparación de fotogramas en el navegador. El empleado elige la estación de destino. No usa un modelo de IA, no identifica personas y no detecta mirada ni atención; sirve como primer test real de cámara y eventos.
- La cámara se activa solo cuando el empleado pulsa el botón y concede permiso. El procesamiento se hace en el navegador; las imágenes no se guardan ni se envían.
- Adaptación responsive y preferencia de movimiento reducido.

## Qué está simulado o pendiente

- No hay detección mediante IA de personas, proximidad, orientación, mirada o atención. La cámara experimental detecta movimiento visual, que puede deberse a una persona u otros cambios en la escena.
- La selección de la estación de destino en el detector visual la realiza el empleado; no se infiere automáticamente qué tablet está mirando el visitante. Los eventos de interés también se pueden simular desde administración.
- No se incluyen vídeos MP4 ni imágenes de producto reales; se utilizan escenarios vectoriales CSS de ejemplo.
- La reproducción de vídeos locales está prevista en la configuración, pero la integración completa del reproductor debe realizarse en una siguiente fase.
- La estimación de edad y los modelos de detección no están instalados ni habilitados.
- La comunicación entre tablets físicas, backend, modo kiosco y analítica no forman parte de esta demo.
- Las tipografías WOFF2 no se incluyen; añade versiones con licencia en `assets/fonts/` para que se utilicen localmente. Si no, hay fuentes alternativas.
- La cámara permanece deshabilitada hasta que el empleado la activa. Para una instalación pública real hay que evaluar información, base jurídica, autorización cuando corresponda, RGPD y otras obligaciones con el responsable de privacidad/asesoría legal.

## Arquitectura

- `index.html`: estructura semántica y vistas.
- `css/`: tokens, tipografías, estructura, componentes, animación, responsive y estilos administrativos.
- `js/main.js`: inicialización.
- `js/state.js`: estado global y catálogo de estados.
- `js/configuration.js`: lectura del JSON y formulario de configuración.
- `js/events.js`: motor de eventos y ciclo de recomendación.
- `js/panels.js`: renderizado de las seis pantallas.
- `js/admin.js`: controles de administración y cambio de modo.
- `js/camera.js`, `js/detection.js`: puntos de extensión deshabilitados.
- `data/contenido.json`: contenido comercial y parámetros operativos.

## Pruebas realizadas / pendientes

- Estructura de archivos generada y referencias internas revisadas durante la creación.
- Pendiente de ejecutar pruebas reales en navegador, revisar consola, accesibilidad con lector de pantalla y validar resoluciones 1280×800 y 800×1280 en dispositivos concretos.
- No se han realizado pruebas con hardware, cámara ni tablets físicas.

## Inicio rápido

En Windows, haz doble clic en `INICIAR-DEMO.bat`. Intenta usar PHP primero y, si no está instalado, utiliza Python si está disponible. Se abrirá el navegador en `http://127.0.0.1:8000/`. No cierres la ventana del servidor durante la presentación.
