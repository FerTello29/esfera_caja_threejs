Práctica 1.2 — Esferas rebotando en una caja de cristal

Simulación 3D interactiva desarrollada con Three.js, que representa múltiples esferas rebotando dentro de una caja de cristal, con colisiones físicas entre esferas y paredes, efectos visuales de impacto/explosión, sonido sintetizado y una alfombra procedural generada sin imágenes externas.

Datos del alumno
Nombre: Fernando Rosales Tello
Número de control: 23200171
Descripción del proyecto

El proyecto simula el comportamiento físico de varias esferas dentro de un contenedor cúbico transparente, aplicando conceptos de:

Movimiento en 3D mediante vectores de velocidad.
Detección y resolución de colisiones (esfera-pared y esfera-esfera).
Colisión elástica de masas iguales.
Renderizado de materiales con transparencia y refracción (efecto "cristal").
Iluminación y sombras dinámicas.
Post-procesado de imagen (Bloom) para efectos de brillo.
Generación procedural de texturas (alfombra tipo mandala) sin uso de imágenes externas.
Síntesis de sonido en tiempo real con la Web Audio API.
Interfaz de usuario con controles interactivos (sliders) para ajustar la simulación en vivo.
Características principales
Característica	Descripción
Caja de cristal	Contenedor con material MeshPhysicalMaterial (transmisión y transparencia)
Múltiples esferas	De 1 a 20 esferas simultáneas, controlables con un slider
Colisión esfera-pared	Rebote con marca visual (anillo) en el punto de contacto
Colisión esfera-esfera	Física elástica con separación de solapamiento y efecto de explosión
Explosiones	Partículas con AdditiveBlending + luz puntual + Bloom
Alfombra procedural	Textura tipo mandala dibujada con <canvas> y aplicada como CanvasTexture
Sombras dinámicas	Luz direccional con shadow map habilitado
Sonido	Efectos de "pop" (rebote) y "explosión" generados con Web Audio API (sin archivos de audio)
Cámara orbital	Control de cámara con OrbitControls (rotar, hacer zoom, desplazar)
Panel de controles	Ajuste de velocidad por eje (X, Y, Z), número de esferas, volumen y mute
Controles disponibles
Número de esferas: agrega o elimina esferas en tiempo real (máximo 20).
Velocidad X / Y / Z: ajusta la rapidez de movimiento en cada eje para todas las esferas.
Sonido activado: activa o silencia los efectos de audio.
Volumen: controla el nivel general del sonido.
Cámara: clic izquierdo + arrastrar para rotar, scroll para zoom, clic derecho + arrastrar para desplazar.
Tecnologías utilizadas
Three.js r180 (vía CDN con importmap)
OrbitControls para el manejo de cámara
EffectComposer + UnrealBloomPass para el post-procesado
Web Audio API para la generación de sonido en tiempo real
HTML5 <canvas> 2D para la generación procedural de texturas
HTML5, CSS3 y JavaScript (módulos ES)
Estructura del proyecto
proyecto/
├── index.html
└── assets/
    ├── css/
    │   └── styles.css
    └── js/
        └── main.js
