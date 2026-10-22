# Beauty Tech Retail Experience

**Versión 18.** Prototipo navegable para presentar una experiencia de retail de belleza con cinco estaciones, un panel de administración y una vista pública separada.

Prototipo web local para presentar una experiencia de recomendación automática en una tienda de belleza. Incluye cinco estaciones comerciales, una pantalla de entrada/sensor conceptual, administración, modo público y detección experimental de personas mediante cámara.

## Arranque rápido en Windows

1. Extrae el ZIP completo en una carpeta.
2. Haz doble clic en `INICIAR-DEMO.bat`.
3. Se abrirá la dirección local que muestra la ventana del servidor. Déjala abierta durante la presentación.
4. Mantén abierta la ventana negra del servidor mientras utilices la demo.

Se recomienda Python 3; no requiere Node.js ni instalación de paquetes. No abras `index.html` directamente: los módulos necesitan un servidor local. El servidor solo escucha en el equipo (`127.0.0.1`).

## Cómo hacer la demostración

1. La entrada normal es el modo trabajador: selecciona una sección activa y pulsa **Iniciar experiencia**. La primera sección activa aparece preseleccionada.
2. Permite el acceso a la cámara. La tablet entra en pantalla completa y espera; cuando detecta presencia, muestra automáticamente el contenido en bucle. Al alejarse la persona, vuelve a esperar. **Salir · Administración** detiene la cámara y abre la configuración.
3. Para preparar contenido, pulsa **Administración**. En «Vídeos de demostración», asigna a cada sección hasta dos vídeos MP4/WebM/Ogg. Se pueden etiquetar para audiencia/perfil; los enlaces directos compatibles se reproducen automáticamente. YouTube, TikTok e Instagram se abren fuera de la experiencia, así que no son aptos para el bucle automático.
4. Si no puedes usar una cámara durante la presentación, **Probar estación** y **Iniciar demostración guiada** simulan el flujo; la pantalla indica que es una simulación.

## Funciones implementadas

- Cinco estaciones editables con nombre, descripción, familia, campaña, tipo de contenido, estado y tiempos individuales de permanencia y espera.
- Guardado local de configuración, zonas de cámara, confianza mínima y duración de la demostración; **Restaurar valores iniciales** restaura preferencias y estaciones.
- Modo público sin controles administrativos, sensor ni códigos técnicos.
- Prueba manual individual, prueba rápida y recorrido guiado secuencial (12–45 s por estación), completamente utilizable sin cámara.
- Hasta dos vídeos por estación: archivos locales (MP4, WebM u Ogg), URLs de YouTube, TikTok o Instagram y enlaces directos a esos formatos. Los vídeos locales y enlaces directos compatibles se reproducen en secuencia al terminar cada clip y en bucle mientras dura la presencia; las redes sociales se abren fuera de la app y no forman parte del bucle. Los archivos locales no se suben y deben seleccionarse de nuevo tras recargar.
- Configuración inicial de estaciones en `data/contenido.json`.
- Motor de eventos `beautytech:event` y estados `idle`, `attention`, `playing`, `cooldown` y `disabled`.
- Recomendación demostrativa de dos piezas por estación, con transición y regreso al reposo.
- Detección experimental con BlazeFace/TensorFlow.js y COCO-SSD. Al detectar un rostro en modo público, carga @vladmandic/face-api y estima localmente un rango de edad; muestra sugerencias de producto y permite corregir el rango.
- Modo presentación a pantalla completa: una selección de sección y un toque inician la cámara y el modo público. Solo se ve esa sección, una indicación de espera cuando no hay nadie, y el botón de salida arriba a la derecha (también Escape). Al detectar presencia se muestran los clips/vídeos en bucle; el ciclo se detiene al perder presencia.
- Perfil de escenario opcional para probar selección de vídeos por rango de edad, textura y longitud del pelo o vello facial. El trabajador lo selecciona manualmente; la cámara solo detecta presencia y no infiere género ni rasgos personales.
- Cada vídeo se puede asignar a un perfil orientativo; con un escenario elegido, la reproducción prioriza vídeos coincidentes y añade los marcados para cualquier perfil.
- Reproducción de vídeos MP4, WebM u Ogg en secuencia con avance al final real del vídeo y repetición en bucle mientras dura la presencia. Para una presentación fiable, prepara los vídeos locales o enlaces directos compatibles con antelación.
- Recomendaciones orientativas por rangos: menos de 18, 18–24, 25–34, 35–44 y 45 o más. No se muestra una edad exacta ni se utilizan predicciones de género.
- Cinco zonas asignables y umbral de confianza ajustable. La cámara detecta presencia aproximada, no atención ni interés.
- El lanzador Python elige un puerto libre si el puerto 8000 está ocupado.
- Diseño responsive y respeto de preferencias de movimiento reducido.

## Límites importantes

- La estimación visual de edad puede ser inexacta y no representa la edad real. El rango solo selecciona sugerencias generales; la edad no determina las necesidades de la piel.
- La cámara de esta demo no detecta ni clasifica género, barba, longitud del pelo o pelo rizado/liso. Tampoco determina qué necesita alguien; las recomendaciones por edad son ideas generales y experimentales. Para una sección capilar, se pueden preparar vídeos organizados por tipo de producto o necesidad del catálogo, sin inferir rasgos personales.
- La IA no identifica personas, no detecta la mirada y no confirma interés real. No realiza reconocimiento de identidad ni usa predicciones de género.
- La zona se calcula dividiendo la imagen en cinco franjas horizontales. El empleado debe asociarlas manualmente a las estaciones visibles de izquierda a derecha. No es una calibración física de la tienda.
- La presencia sostenida y el tamaño de la detección son aproximaciones, no una medición fiable de distancia o atención.
- El código no guarda ni envía fotogramas. La inferencia y el rango estimado se procesan en el navegador; el rango permanece solo en la vista pública mientras está abierta y no se guarda ni se envía a un servidor. El navegador necesita permiso explícito para activar la cámara.
- No se incluyen vídeos comerciales ni fotografías de producto. Sin vídeos locales, las estaciones muestran composiciones visuales propias de demostración.
- No incluye comunicación entre tablets físicas, backend, modo kiosco ni analítica de producción.
- La cámara usa BlazeFace/TensorFlow.js desde jsDelivr y necesita permiso, navegador compatible e internet en el primer arranque. La IA disponible detecta rostro/persona y puede estimar un rango de edad orientativo en segundo plano; no reconoce género, barba, longitud ni textura del pelo.
- El recorrido guiado es una simulación para presentar el flujo; no representa una detección real. Para un despliegue real hay que revisar accesibilidad, rendimiento, dispositivos, consentimiento/información, base jurídica y obligaciones de privacidad con los responsables correspondientes.

## Diagnóstico si algo no aparece

- Si se abre el archivo directamente, la página muestra un aviso para iniciar el servidor local.
- Si aparece “No se pudo cargar la configuración”, comprueba que `data/contenido.json` está dentro de la carpeta y vuelve a iniciar el lanzador.
- Si falla la IA, prueba primero **Probar recomendación**. La detección de presencia y el estimador de edad requieren conexión para descargar bibliotecas y pesos; la interfaz y la simulación no dependen de esa conexión.
- La cámara necesita permiso y el navegador debe permitirla en localhost. Los modelos requieren conexión y acceso a `cdn.jsdelivr.net`; la UI y la demostración guiada funcionan sin conexión externa.

## Estructura

- `index.html`: estructura semántica y vistas.
- `css/`: estilos, variables, componentes, responsive y animaciones.
- `js/main.js`: arranque de la aplicación.
- `js/state.js`: estado global.
- `js/configuration.js`: carga, edición y persistencia local de configuración.
- `js/events.js`: motor de eventos y ciclo de recomendación.
- `js/panels.js`: renderizado de pantallas administrativas y públicas.
- `js/admin.js`: administración y cambio de modo.
- `js/camera.js`, `js/detection.js`, `js/age.js`: cámara, detección experimental, estimación orientativa de edad y métricas de diagnóstico.
- `js/products.js`: sugerencias demostrativas para cada rango de edad.
- `data/contenido.json`: contenido y parámetros operativos.
- `iniciar_demo.py`, `INICIAR-DEMO.bat`: arranque local en Windows.

## Qué se guarda y privacidad

La configuración, las zonas asignadas, el umbral de confianza, la duración del recorrido y los enlaces de vídeo se guardan en `localStorage` de este navegador. No hay cuentas, backend ni sincronización. Los archivos de vídeo locales solo viven en memoria y deben volver a seleccionarse tras recargar; no se suben. Los enlaces de YouTube, TikTok e Instagram se abren en el servicio original fuera de la app; sus páginas pueden solicitar cookies o inicio de sesión según sus propias políticas. Los fotogramas y el rango de edad no se guardan ni se envían a un servidor: el procesamiento ocurre en el navegador y el rango solo permanece en memoria mientras está abierta la vista pública. La aplicación sí descarga bibliotecas y pesos de modelos desde `cdn.jsdelivr.net`.

La división de la imagen en cinco franjas es solo una aproximación: no prueba que una persona mire una tablet ni representa necesariamente la geometría real de la tienda. Un despliegue real puede requerir calibración, sensores o cámaras adicionales y una revisión independiente de las obligaciones legales y de privacidad.

## Limitaciones y problemas frecuentes

- No se probó una cámara física ni la descarga/inferencia del modelo en este entorno. El navegador, dispositivo, permiso y red afectan esa función; la demostración guiada es la alternativa fiable.
- Si la cámara no inicia, comprueba permisos y cierra aplicaciones que la estén usando. Si falla la descarga del modelo, comprueba la conexión y prueba el recorrido guiado.
- Si la configuración no carga, inicia la demo mediante el `.bat` y confirma que `data/contenido.json` existe.
- No hay conexión entre tablets, backend, autenticación, modo kiosco ni analítica de producción.

## Verificación realizada

En el navegador integrado se comprobó la carga de cinco estaciones, persistencia de cambios tras recargar, activación de contenido en simulación manual, entrada/parada/repetición del modo guiado, etiquetado de las modalidades, exclusión del sensor y códigos técnicos del modo público, recuperación tras un vídeo inválido, respuesta HTTP correcta del favicon, ausencia de errores JavaScript y ausencia de desbordamiento horizontal móvil. El editor no detectó errores en los módulos modificados.

No se probó cámara física, la descarga real de modelos ni un archivo de vídeo concreto.

### Si la IA dice que no detecta a nadie

- Asegúrate de que la vista previa muestra tu imagen en directo y no está negra/congelada.
- Ponte frente a la cámara con buena iluminación; al principio prueba mostrando cabeza y torso, no solo la cara ni una silueta muy pequeña.
- Esta versión prioriza BlazeFace (rostro) y carga COCO-SSD como detector complementario. Ajusta el umbral de confianza y los segundos de permanencia desde Administración. Un rostro detectado significa presencia aproximada, no identidad ni interés real.
- Si indica que no puede descargar un modelo, comprueba conexión a internet y que la red no bloquee `cdn.jsdelivr.net`; pulsa Detener cámara y vuelve a activarla.
- Si la cámara se ve pero no detecta nada, prueba Chrome o Edge actualizados, cierra aplicaciones que puedan estar usando la cámara, mejora la iluminación y evita que la cara quede muy pequeña. Revisa los indicadores de confianza y latencia. Si la detección falla por incompatibilidad del backend gráfico, la app intenta cambiar a CPU; puede ser más lenta.
