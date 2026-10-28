# Publicar e instalar Jarvis

## HTTPS

La geolocalización y la instalación PWA solo funcionan en un contexto seguro. En desarrollo, `http://localhost` es una excepción segura en el mismo dispositivo; una dirección HTTP de red local no lo es. No es posible emitir un certificado HTTPS público desde el JavaScript de la página.

1. Ejecuta `npm run build` y publica el contenido de `dist/` en un hosting estático que provea TLS válido, bajo un dominio que controles.
2. Comprueba que `https://tu-dominio/manifest.webmanifest`, `https://tu-dominio/service-worker.js` e iconos responden correctamente.
3. En Android, abre el sitio en Chrome. Usa el botón **Instalar** o el menú **Instalar aplicación / Añadir a pantalla de inicio**. Si no aparece, revisa HTTPS, manifiesto, service worker e iconos.

El botón usa el evento estándar `beforeinstallprompt` cuando Chrome lo ofrece. En otros navegadores indica cómo instalar desde el menú propio. La PWA es instalable; eso no descarga un archivo APK.

## Empaquetar como APK/AAB

Una TWA abre el sitio HTTPS en un contenedor Android verificado. No es un sitio copiado dentro de un APK ni una app nativa sin conexión.

1. Publica y prueba primero la PWA en un teléfono real, incluyendo GPS, selección de audio y controles de notificación.
2. Entra en [PWABuilder](https://www.pwabuilder.com/), analiza la URL HTTPS y resuelve los avisos del manifiesto/service worker.
3. Elige **Package for stores > Android**. Configura el identificador único del paquete y genera APK de prueba o AAB para Google Play.
4. Firma el paquete. Guarda la clave y contraseñas en un gestor seguro, fuera del repositorio, con copia de seguridad. Una clave perdida puede impedir publicar actualizaciones.
5. Publica `/.well-known/assetlinks.json` en el mismo dominio, con el ID del paquete y la huella SHA-256 del certificado de firma. Sigue los valores exactos que proporciona el paquete generado.
6. Instala el APK y valida dominio, verificación TWA, permiso GPS, MediaSession y modo sin conexión antes de compartirlo.

También puedes abrir el proyecto TWA generado por PWABuilder en Android Studio y crear un paquete firmado desde **Build > Generate Signed Bundle / APK**. Descarga Android Studio/SDK únicamente desde [developer.android.com](https://developer.android.com/studio). PWABuilder genera el proyecto/paquete; la firma final y el certificado pertenecen al propietario de la app.

## Privacidad

El velocímetro calcula y filtra velocidad en el navegador; no comparte las coordenadas con el estado de clima/rutas ni las guarda. El reproductor solo usa URLs `blob:` creadas a partir de archivos seleccionados y el service worker excluye audio/video del caché. Las funciones preexistentes de reconocimiento de voz y búsqueda de destinos pueden comunicarse con el navegador/proveedores externos cuando se usan.