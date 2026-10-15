# Beauty Tech — Demo de retail inteligente

Demo web local para presentar un concepto de recomendación automática en una tienda de belleza. Incluye cinco estaciones comerciales, una pantalla de entrada/sensor conceptual, administración y modo público.

## Requisitos

- Windows 10/11.
- PHP instalado y disponible desde la terminal (`php -v`).
- Navegador moderno (Chrome, Edge o Firefox).
- No necesita Node.js ni compilación. La detección IA requiere conexión a internet para cargar TensorFlow.js, COCO-SSD y sus pesos la primera vez.

## Ejecutar en Windows

1. Descomprime la carpeta `beauty-tech-demo`.
2. Abre CMD o PowerShell dentro de esa carpeta.
3. Ejecuta:

   ```bash
   php -S localhost:8000
   ```

4. Abre `http://localhost:8000`.

No abras `index.html` con doble clic: los módulos JavaScript y el JSON necesitan servirse mediante HTTP. `localhost` permite solicitar permiso de cámara.

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
- Detección de personas mediante COCO-SSD y TensorFlow.js en el navegador. El modelo detecta la clase genérica “person”; una presencia suficientemente sostenida puede activar la estación asignada a la zona detectada. El análisis se ejecuta en el navegador y el código no guarda ni envía fotogramas.
- La cámara se activa solo cuando el empleado pulsa el botón y concede permiso. El procesamiento se hace en el navegador; las imágenes no se guardan ni se envían.
- Adaptación responsive y preferencia de movimiento reducido.

## Qué está simulado o pendiente

- La IA detecta personas, pero no identidad, orientación corporal, mirada ni interés real. La proximidad se estima de forma muy aproximada según el tamaño de la detección en la imagen.
- El empleado asigna cinco zonas horizontales de la imagen a estaciones. El detector dibuja la caja de la persona y las divisiones de zona sobre la vista previa. Si la persona permanece en una zona durante un tiempo mínimo, se puede activar la estación asignada a esa zona. Es una aproximación espacial para la demo: no infiere qué tablet mira el visitante ni confirma interés real. La cámara debe colocarse de modo que las estaciones aparezcan de izquierda a derecha en la imagen.
- No se incluyen vídeos MP4 ni imágenes de producto reales; se utilizan escenarios vectoriales CSS de ejemplo.
- La reproducción de vídeos locales está prevista en los datos, pero la integración completa del reproductor debe realizarse en una siguiente fase.
- La estimación de edad y los modelos de detección no están instalados ni habilitados.
- La comunicación entre tablets físicas, backend, modo kiosco y analítica no forman parte de esta demo.
- Las tipografías WOFF2 no se incluyen; añade versiones con licencia en `assets/fonts/` para que se utilicen localmente. Si no, hay fuentes alternativas.
- La cámara permanece deshabilitada hasta que el empleado la activa. La detección IA requiere conexión a internet para descargar bibliotecas y pesos del modelo. Para una instalación pública real hay que evaluar información, base jurídica, autorización cuando corresponda, RGPD y otras obligaciones con el responsable de privacidad/asesoría legal.

## Arquitectura

- `index.html`: estructura semántica y vistas.
- `css/`: tokens, tipografías, estructura, componentes, animación, responsive y estilos administrativos.
- `js/main.js`: inicialización.
- `js/state.js`: estado global y catálogo de estados.
- `js/configuration.js`: lectura del JSON y formulario de configuración.
- `js/events.js`: motor de eventos y ciclo de recomendación.
- `js/panels.js`: renderizado de las seis pantallas.
- `js/admin.js`: controles de administración y cambio de modo.
- `js/camera.js`, `js/detection.js`: acceso a cámara y detector de personas con IA.
- `data/contenido.json`: contenido comercial y parámetros operativos.

## Pruebas realizadas / pendientes

- Sintaxis JavaScript revisada con Node.js.
- Pendiente de validar en tu navegador que las dependencias CDN cargan correctamente y que el modelo detecta personas con tu cámara.
- No se han realizado pruebas con tablets físicas ni con varias cámaras.

## Inicio rápido

En Windows, haz doble clic en `INICIAR-DEMO.bat`. Intenta usar PHP primero y, si no está instalado, utiliza Python si está disponible. Se abrirá el navegador en `http://127.0.0.1:8000/`. No cierres la ventana del servidor durante la presentación.
