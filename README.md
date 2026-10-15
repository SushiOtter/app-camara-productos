# Beauty Tech — Demo de retail inteligente

Prototipo web local para presentar una experiencia de recomendación automática en una tienda de belleza. Incluye cinco estaciones comerciales, una pantalla de entrada/sensor conceptual, administración, modo público y detección experimental de personas mediante cámara.

## Arranque rápido en Windows

1. Descomprime la carpeta `beauty-tech-demo` completa.
2. Haz doble clic en `INICIAR-DEMO.bat`.
3. Se abrirá el navegador en una dirección local que se muestra en la consola. Si el puerto 8000 ya está ocupado, el lanzador elige otro puerto libre automáticamente.
4. Mantén abierta la ventana negra del servidor mientras utilices la demo.

No abras `index.html` con doble clic: los módulos JavaScript y el JSON necesitan un servidor HTTP. El proyecto no necesita Node.js ni instalar paquetes.

## Cómo hacer la demostración

1. En Administración, cambia la familia o campaña de cada estación y activa/desactiva estaciones.
2. Pulsa **Probar recomendación** para verificar que el flujo de contenido funciona sin cámara.
3. Pulsa **Iniciar modo público** para ocultar los controles administrativos.
4. Para simular una estación concreta mientras estás en modo público, usa `Ctrl + Alt + 1..5`.
5. Para probar detección real, vuelve a administración, asigna las cinco zonas horizontales a estaciones, pulsa **Activar cámara** y concede permiso. Las bibliotecas de IA se descargan solo al pulsar ese botón.
6. Vuelve al modo público para que una presencia sostenida en una zona asignada pueda activar la estación correspondiente.

## Funciones implementadas

- Administración de familia, campaña y estado de cada estación.
- Modo público sin controles visibles para visitantes.
- Seis pantallas de previsualización con identidad visual diferenciada.
- Configuración comercial en `data/contenido.json`.
- Motor de eventos `beautytech:event` y estados `idle`, `attention`, `playing`, `cooldown` y `disabled`.
- Recomendación demostrativa de dos piezas por estación, con transición y regreso al reposo.
- Detección de personas con COCO-SSD y TensorFlow.js, cargados de forma diferida al activar la cámara. Si los CDN no están disponibles, el resto de la web sigue funcionando y muestra un mensaje explicativo.
- Superposición visual de persona y zonas en la vista previa.
- El lanzador Python elige un puerto libre si el puerto 8000 está ocupado.
- Diseño responsive y respeto de preferencias de movimiento reducido.

## Límites importantes

- La IA detecta la clase genérica `person`; no identifica personas, no estima edad, no detecta la mirada y no confirma interés real.
- La zona se calcula dividiendo la imagen en cinco franjas horizontales. El empleado debe asociarlas manualmente a las estaciones visibles de izquierda a derecha. No es una calibración física de la tienda.
- La presencia sostenida y el tamaño de la detección son aproximaciones, no una medición fiable de distancia o atención.
- El código no guarda ni envía fotogramas. El navegador necesita permiso explícito para activar la cámara.
- No se incluyen vídeos MP4 ni fotografías reales de producto; las pantallas usan composiciones CSS de demostración. El reproductor de vídeo real queda pendiente.
- No incluye comunicación entre tablets físicas, backend, modo kiosco ni analítica de producción.
- Para un despliegue real hay que revisar accesibilidad, rendimiento, dispositivos, consentimiento/información, base jurídica y obligaciones de privacidad con los responsables correspondientes.

## Diagnóstico si algo no aparece

- Si se abre el archivo directamente, la página muestra un aviso para iniciar el servidor local.
- Si aparece “No se pudo cargar la configuración”, comprueba que `data/contenido.json` está dentro de la carpeta y vuelve a iniciar el lanzador.
- Si falla la IA, prueba primero **Probar recomendación**. La IA requiere conexión a internet para descargar sus bibliotecas y pesos; la interfaz y la simulación no dependen de esa conexión.
- Si el navegador no pide permiso para la cámara, asegúrate de abrir la dirección `http://127.0.0.1:PUERTO/` que ha mostrado el lanzador y de no haber bloqueado la cámara en los permisos del navegador.

## Estructura

- `index.html`: estructura semántica y vistas.
- `css/`: estilos, variables, componentes, responsive y animaciones.
- `js/main.js`: arranque de la aplicación.
- `js/state.js`: estado global.
- `js/configuration.js`: carga de JSON y formulario de configuración.
- `js/events.js`: motor de eventos y ciclo de recomendación.
- `js/panels.js`: renderizado de las seis pantallas.
- `js/admin.js`: administración y cambio de modo.
- `js/camera.js`, `js/detection.js`: cámara y detección experimental.
- `data/contenido.json`: contenido y parámetros operativos.
- `iniciar_demo.py`, `INICIAR-DEMO.bat`: arranque local en Windows.
