# JARVIS

JARVIS es un prototipo de tablero digital web diseñado para reunir información útil durante un viaje en una interfaz adaptable. Su objetivo a largo plazo es servir como tablero de un vehículo eléctrico solar de dos plazas; la versión actual funciona en el navegador y todavía no se conecta a los sistemas del vehículo.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![PWA](https://img.shields.io/badge/PWA-instalable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/explore/progressive-web-apps)

## Contenido

- [Antecedentes](#antecedentes)
- [Características](#características)
- [Tecnologías](#tecnologías)
- [Requisitos e instalación](#requisitos-e-instalación)
- [Uso](#uso)
- [Estructura](#estructura)
- [Metodología](#metodología)
- [Desarrollo y alcance](#desarrollo-y-alcance)
- [Contribuciones](#contribuciones)
- [Autores y créditos](#autores-y-créditos)
- [Licencia](#licencia)

## Antecedentes

Un vehículo eléctrico solar de dos plazas necesita una interfaz clara que permita consultar información relevante sin distraer a quien conduce. JARVIS explora esa experiencia mediante un tablero web que agrupa navegación, velocidad, clima y herramientas de a bordo.

El proyecto se plantea como una base de prototipado: antes de integrarlo con un vehículo real, permite desarrollar y evaluar la interfaz y sus funciones en un navegador o dispositivo móvil. La lectura de datos reales del vehículo y de su sistema de energía queda fuera del alcance de esta versión.

## Características

- Panel principal con hora, clima actual y pronóstico de tres días.
- Velocidad y ubicación obtenidas mediante el GPS del dispositivo, con un mapa interactivo.
- Estado e historial de batería del **dispositivo** cuando el navegador ofrece la Battery Status API; no representa la batería del vehículo.
- Sección de mantenimiento con una lista de tareas.
- Reproductor de archivos de audio seleccionados localmente, sin subirlos a un servicio.
- Interfaz adaptable e instalable como aplicación web progresiva (PWA) en navegadores compatibles.
- Preparación para empaquetar la PWA como aplicación Android mediante Trusted Web Activity (TWA); consulta [PWA-APK.md](./PWA-APK.md) y [DEPLOY-APK.md](./DEPLOY-APK.md).

La disponibilidad de GPS, batería, instalación PWA y reconocimiento de voz depende del dispositivo, el navegador, los permisos y el contexto seguro (HTTPS o `localhost`).

## Tecnologías

- **JavaScript (ES modules)**, **React 19** y **Vite 8** para la aplicación web.
- **React Leaflet 5** y **Leaflet 1.9** para el mapa.
- **OpenStreetMap** para los mosaicos del mapa.
- **APIs web del navegador**, entre ellas Geolocation, Battery Status, almacenamiento local y reproducción de audio.
- **PWA y Capacitor**: manifiesto y service worker para instalación web, con configuración y herramientas Gradle para el flujo Android.
- **Oxlint** para análisis estático del código.

## Requisitos e instalación

### Requisitos previos

- Node.js `^20.19.0` o `>=22.12.0` (Vite 8).
- npm, incluido con Node.js.
- Git para clonar el repositorio.
- Un navegador moderno. El GPS y la instalación PWA requieren HTTPS; para desarrollo local, `localhost` es un contexto seguro.

### Configurar el proyecto

```bash
git clone https://github.com/CristalL29/JARVIS.git
cd JARVIS
npm ci
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Abre en el navegador la dirección local que muestra Vite. Para comprobar el proyecto antes de publicarlo:

```bash
npm run lint
npm run build
npm run preview
```

La compilación de producción se genera en `dist/`. Para publicar la PWA, despliega esa carpeta en un hosting estático con HTTPS. Consulta [DEPLOY-APK.md](./DEPLOY-APK.md) y [PWA-APK.md](./PWA-APK.md) para publicación y opciones de empaquetado Android.

## Uso

1. Ejecuta `npm run dev` y abre la dirección local indicada en la terminal.
2. Concede permiso de ubicación para consultar el GPS, centrar el mapa y mostrar información meteorológica local.
3. Explora las secciones de navegación y mantenimiento desde la interfaz.
4. En multimedia, selecciona archivos de audio del dispositivo para reproducirlos localmente.
5. En un dispositivo compatible y con el sitio publicado mediante HTTPS, usa la opción de instalación del navegador para añadir JARVIS a la pantalla de inicio.

Las funciones que consultan servicios externos necesitan conexión a Internet. La posición GPS se muestra en el navegador y sus coordenadas se envían a Open-Meteo para consultar el clima. El mapa carga mosaicos de OpenStreetMap. Los archivos de audio seleccionados se reproducen localmente.

## Estructura

```text
JARVIS/
├── components/
│   └── NavigationView.jsx  # Vista de mapa y navegación
├── App.jsx                 # Estado y vistas principales
├── App.css                 # Estilos de la aplicación
├── index.css               # Estilos globales
├── main.jsx                # Punto de entrada de React
├── main.js                 # Prototipo anterior; no es el punto de entrada actual
├── index.html              # Documento HTML de entrada
├── manifest.webmanifest    # Metadatos de instalación PWA
├── service-worker.js       # Caché y soporte sin conexión
├── package.json            # Dependencias y comandos npm
├── vite.config.js           # Configuración de Vite
├── capacitor.config.json   # Identidad y configuración de Capacitor
├── *.gradle                # Configuración Gradle para Android
├── DEPLOY-APK.md           # Guía de publicación y empaquetado
└── PWA-APK.md              # Guía de PWA y APK/AAB
```

## Metodología

El trabajo se organiza como prototipado incremental de una interfaz centrada en el uso a bordo:

1. Identificar la información que sería útil en un tablero y agruparla en vistas.
2. Implementar cada vista como interfaz web con React y componentes reutilizables.
3. Obtener datos disponibles en el dispositivo mediante APIs del navegador y servicios web cuando corresponde.
4. Comprobar la experiencia en navegador y dispositivo móvil, incluyendo permisos y disponibilidad de funciones.
5. Preparar la distribución como PWA y evaluar el empaquetado Android de forma separada.

La lectura desde el vehículo, la validación en el automóvil y la integración con sus sistemas deberán desarrollarse y probarse en etapas posteriores.

## Desarrollo y alcance

La aplicación actual es un prototipo de tablero web: el GPS, la velocidad calculada y el estado de batería provienen del dispositivo y del navegador. No lee telemetría, autonomía, carga, paneles solares ni otros datos del vehículo; tampoco controla sus sistemas. Por ello, no debe utilizarse como tablero certificado ni como sustituto de los instrumentos del automóvil.

El siguiente paso hacia el objetivo del proyecto es definir cómo obtener y validar de forma segura los datos del vehículo solar y diseñar una integración adecuada para el hardware y las condiciones reales de conducción.

Para empaquetar o publicar la PWA, revisa [DEPLOY-APK.md](./DEPLOY-APK.md) y [PWA-APK.md](./PWA-APK.md).

## Contribuciones

Las contribuciones son bienvenidas:

1. Abre un *issue* en [el repositorio](https://github.com/CristalL29/JARVIS/issues) para reportar un error o proponer una mejora. Incluye pasos para reproducirlo, el resultado esperado y el navegador/dispositivo utilizado.
2. Para cambios de código, crea una rama desde `main` y mantén cada cambio enfocado.
3. Ejecuta `npx oxlint App.jsx main.jsx components/NavigationView.jsx` y `npm run build`; incluye en tu propuesta cualquier limitación que no hayas podido validar.
4. Abre un *pull request* con un resumen del cambio y su forma de verificación.

No incluyas credenciales, claves de firma Android ni datos personales en issues o cambios.

## Autores y créditos

- **CristalL29** — repositorio y desarrollo de JARVIS.
- **OpenStreetMap** — datos de mapa y colaboradores de sus mosaicos.
- **Open-Meteo** — servicio de pronóstico meteorológico.
- Comunidad de React, Vite, Leaflet y Capacitor, por las herramientas de desarrollo.

## Licencia

El repositorio no incluye actualmente un archivo de licencia ni especifica una licencia de uso. Por tanto, no debe asumirse que el código puede reutilizarse, modificarse o distribuirse bajo una licencia de código abierto. La licencia queda pendiente de definir por las personas titulares del proyecto.
