# Publicar e instalar Jarvis

## HTTPS y PWA

La geolocalización y la instalación PWA requieren un contexto seguro. `http://localhost` es una excepción para desarrollo en el mismo dispositivo; una dirección HTTP de red local no lo es. El JavaScript no puede convertir HTTP en HTTPS ni emitir un certificado público.

1. Ejecuta `npm run build` y publica el contenido de `dist/` en un hosting estático que proporcione TLS válido, bajo un dominio que controles.
2. Comprueba que `https://tu-dominio/manifest.webmanifest`, `https://tu-dominio/service-worker.js` y los tres iconos responden correctamente.
3. Abre el sitio en Chrome Android. Usa **Instalar** o el menú **Instalar aplicación / Añadir a pantalla de inicio**. Si no aparece, revisa el manifiesto, iconos, service worker y HTTPS.

El botón usa `beforeinstallprompt` cuando Chrome lo proporciona; en otros navegadores muestra cómo instalar desde el menú. La PWA es instalable, pero no descarga un APK.

## Generar APK/AAB con PWABuilder

Una TWA (Trusted Web Activity) muestra tu PWA alojada dentro de Android. No incluye una copia autónoma del sitio: necesita el dominio HTTPS estable y un navegador Android compatible.

1. Publica y prueba la PWA en un teléfono Android: GPS, música local, controles de notificación y modo sin conexión.
2. Entra en [PWABuilder](https://www.pwabuilder.com/), analiza la URL HTTPS y resuelve las advertencias del manifiesto y del service worker.
3. Elige **Package for stores > Android**. Configura un identificador único y nombre; genera un APK para pruebas o AAB para Google Play.
4. Firma con una clave propia. Guarda la clave y contraseñas fuera del repositorio y conserva una copia de seguridad segura. No compartas el `.jks`.
5. Publica `/.well-known/assetlinks.json` en el mismo dominio, con el identificador del paquete y la huella SHA-256 del certificado de firma. Usa los valores exactos del paquete generado.
6. Instala y prueba el paquete en un dispositivo antes de distribuirlo.

También puedes abrir el proyecto TWA generado en Android Studio y usar **Build > Generate Signed Bundle / APK**. Descarga Android Studio y el SDK solo desde [developer.android.com](https://developer.android.com/studio). La firma final pertenece al propietario; si pierde la clave puede no poder publicar actualizaciones.

## Privacidad

El velocímetro filtra y calcula la velocidad en el navegador. La posición permanece en memoria para centrar el mapa y no se envía al clima. Al buscar un destino se consulta Nominatim; al calcular una ruta se envían origen y destino a OSRM, y el mapa carga mosaicos de OpenStreetMap. El reproductor solo usa archivos locales mediante URL `blob:`; el service worker no cachea audio ni video. El reconocimiento de voz también depende del navegador.