# JARVIS

JARVIS es un prototipo de tablero web adaptable para navegador y móvil. Reúne información del dispositivo, navegación, mantenimiento y reproducción multimedia. No está conectado a los sistemas del vehículo ni reemplaza sus instrumentos o medidas de seguridad.

## Funciones

- **Dashboard:** fecha y hora, clima actual y pronóstico de tres días, ubicación y velocidad estimada por GPS, y estado e historial de batería del dispositivo cuando el navegador lo admite.
- **Navegación:** búsqueda de destinos, mapa y rutas en coche, con indicaciones de voz cuando el navegador las permite.
- **Mantenimiento/Kanban:** tareas con fechas y columnas Pendiente, En curso y Hecho; permite archivar tareas y solicitar recordatorios del navegador. Las tareas se guardan en el almacenamiento local del navegador.
- **Almacenamiento:** biblioteca local en IndexedDB, con carpetas, filtros, búsqueda, vista previa, descarga y eliminación de archivos.
- **Multimedia:** reproducción de archivos de audio locales y conexión opcional con Spotify.
- **YouTube:** búsqueda y reproducción de videos incrustados. El inicio de sesión que muestra esta sección es una demostración; no autentica una cuenta de Google o YouTube.
- **PWA:** se puede instalar desde navegadores compatibles y guarda una copia de la interfaz para facilitar la carga sin conexión. Las funciones que dependen de Internet siguen necesitando conexión.
- **Voz y apariencia:** lectura en voz alta, comandos de voz y tema claro/oscuro cuando el navegador ofrece las funciones necesarias.

La velocidad, ubicación y batería son las del dispositivo, no las del vehículo. El bloqueo de video de YouTube usa la velocidad estimada por el GPS del dispositivo y un estado de freno de estacionamiento fijo en el código; no recibe datos del vehículo ni constituye una función de seguridad.

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0` (requisito de Vite 8).
- npm y Git.
- Navegador moderno. GPS, notificaciones e instalación PWA dependen del navegador y los permisos; la geolocalización y la PWA requieren HTTPS o `localhost`.
- Conexión a Internet para mapas, rutas, clima, Spotify y búsqueda de YouTube.

## Instalación y desarrollo

```bash
git clone https://github.com/CristalL29/JARVIS.git
cd JARVIS
npm ci
npm run dev
```

Abre la dirección que indique Vite. El servidor de desarrollo escucha en la red local; para usar funciones que requieren un contexto seguro, abre la aplicación mediante `localhost` en el mismo dispositivo o publícala con HTTPS.

### Configurar Spotify

Spotify necesita un Client ID propio para habilitar la conexión. Créalo en [Spotify for Developers](https://developer.spotify.com/dashboard/) y, en la raíz del proyecto, crea un archivo local llamado `.env` con:

```dotenv
VITE_SPOTIFY_CLIENT_ID=tu_client_id
```

`.env` está excluido de Git. No existe un `.env.example` en este repositorio, así que crea el archivo manualmente. El Client ID es un identificador público que la aplicación web necesita; **no** agregues un Client Secret ni contraseñas al código del navegador o al repositorio.

Después de iniciar la aplicación, abre **Multimedia > Spotify**. La interfaz muestra la **Redirect URI** que debes registrar en la configuración de tu aplicación de Spotify for Developers; cópiala exactamente, incluida la ruta y la barra final. En el servidor local habitual será `http://127.0.0.1:5173/`. JARVIS convierte `localhost` en `127.0.0.1` para el callback. Si Vite usa otro puerto, registra la URI que muestra la aplicación. También puedes definir opcionalmente `VITE_SPOTIFY_REDIRECT_URI` en `.env`; debe coincidir exactamente con una URI registrada. Reinicia Vite después de cambiar `.env`.

La conexión usa OAuth con PKCE y no requiere Client Secret. La reproducción mediante Spotify Web Playback SDK requiere Spotify Premium, Internet y una cuenta autorizada para tu aplicación según la configuración de Spotify.

### Configurar la búsqueda de YouTube

La búsqueda usa YouTube Data API v3. La clave actual está definida en `youtubeService.js`; para usar una clave propia, configúrala allí y restríngela en Google Cloud a la API y los sitios web permitidos. Una clave incluida en una aplicación web es visible para sus usuarios y no debe tratarse como una contraseña. El botón de inicio de sesión de YouTube es solo una simulación local.

## Comprobaciones

```bash
npm run lint
npm run build
npm run preview
```

La compilación de producción queda en `dist/`. Hay pruebas del servicio de YouTube que se pueden ejecutar con Node.js:

```bash
node --test youtubeService.test.js
```

## Uso y límites

- **Dashboard y navegación:** concede permiso de ubicación. El clima usa Open-Meteo; la búsqueda de lugares usa Nominatim, el cálculo de rutas usa OSRM y el mapa carga mosaicos de OpenStreetMap. Las indicaciones habladas dependen de la síntesis de voz del navegador.
- **Mantenimiento/Kanban:** crea tareas, cambia su estado entre las tres columnas, edita fechas o archívalas. Los recordatorios requieren permiso de notificaciones. Los datos se guardan en el almacenamiento local del navegador.
- **Almacenamiento:** los archivos seleccionados se guardan en IndexedDB en este navegador y dispositivo. El espacio disponible y la persistencia dependen del navegador; borrar los datos del sitio puede eliminarlos.
- **Multimedia local:** permite seleccionar archivos para reproducirlos en el navegador; no se suben a un servicio.
- **Spotify:** conecta la cuenta, busca canciones y controla la reproducción desde el reproductor web. La sesión OAuth se mantiene en `sessionStorage` del navegador.
- **YouTube:** el inicio de sesión es de demostración, no una autenticación real; la búsqueda utiliza YouTube Data API y el video se reproduce mediante un reproductor incrustado.

La PWA almacena la interfaz y recursos propios para permitir la carga básica sin conexión; los datos de servicios externos y la reproducción en línea no quedan disponibles sin Internet. La ubicación se utiliza para mostrar el GPS, solicitar el clima y calcular rutas. No se envía telemetría del vehículo porque esta aplicación no está conectada a él.

JARVIS es un prototipo, no un sistema certificado de navegación o seguridad automotriz. La velocidad puede ser inexacta y la disponibilidad de GPS, batería, voz y reproducción multimedia depende del dispositivo. No configures la aplicación ni manipules sus controles mientras conduces.

## Tecnologías

- JavaScript ES modules, React 19 y Vite 8.
- React Leaflet 5 y Leaflet 1.9 con mosaicos de OpenStreetMap.
- APIs del navegador: Geolocation, Battery Status, IndexedDB, Web Audio, voz, notificaciones y reproducción multimedia.
- Service worker para recursos de la aplicación y experiencia PWA.
- OAuth PKCE y Spotify Web Playback SDK para la integración con Spotify.
- Oxlint para análisis estático.

## Estructura principal

```text
JARVIS/
├── components/
│   ├── ChecklistView.jsx      # Tablero de mantenimiento
│   └── NavigationView.jsx     # Mapa, destinos y rutas
├── public/
│   └── service-worker.js      # Caché de la interfaz
├── App.jsx                    # Vistas y estado principal
├── SpotifyPlayer.jsx          # Reproductor de Spotify
├── spotifyAuth.js             # OAuth PKCE y gestión de sesión
├── YoutubePlayer.jsx          # Búsqueda y reproductor de YouTube
├── youtubeService.js          # API y reglas de reproducción de YouTube
├── StorageView.jsx            # Biblioteca local de archivos
├── localFileStore.js           # Persistencia de archivos en IndexedDB
├── checklistService.js         # Persistencia y operaciones de tareas
├── main.jsx                    # Punto de entrada de React
├── manifest.webmanifest        # Metadatos de instalación PWA
├── package.json                # Dependencias y comandos npm
└── vite.config.js              # Configuración de Vite
```

## Publicación y Android

GitHub Pages se publica automáticamente desde la rama `main` mediante GitHub Actions. En **Settings > Pages**, selecciona **GitHub Actions** como fuente de publicación; el workflow compila Vite y despliega `dist/` bajo `/JARVIS/`. También puedes ejecutar `npm run build` y publicar el contenido de `dist/` en un hosting estático con HTTPS. Para la instalación PWA y el empaquetado Android como TWA, consulta [DEPLOY-APK.md](./DEPLOY-APK.md) y [PWA-APK.md](./PWA-APK.md). El proyecto no lee sensores ni datos reales del vehículo.

## Contribuciones

Abre un issue para reportar problemas o proponer mejoras. Para cambios, crea una rama enfocada, ejecuta `npm run lint`, `npm run build` y las pruebas pertinentes, y abre un pull request con un resumen y los pasos de validación. No incluyas Client Secrets, tokens, claves de firma Android ni datos personales en cambios públicos.

## Autores y créditos

- **CristalL29** — repositorio y desarrollo de JARVIS.
- **OpenStreetMap** — datos de mapa y mosaicos.
- **Open-Meteo** — servicio meteorológico.
- **Nominatim / OSRM** — búsqueda de lugares y cálculo de rutas.
- **Spotify / YouTube** — servicios multimedia opcionales.
- Comunidad de React, Vite y Leaflet — herramientas de desarrollo.

## Licencia

Este repositorio no incluye un archivo de licencia. No debe asumirse que el código puede reutilizarse o distribuirse bajo una licencia de código abierto.
