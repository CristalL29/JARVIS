const speedValue = document.querySelector('#speed-value')
const speedometer = document.querySelector('.speedometer')
const gauge = document.querySelector('.gauge-value')
const gpsButton = document.querySelector('#gps-toggle')
const gpsStatus = document.querySelector('#gps-status')
const gpsDot = document.querySelector('#gps-dot')
const filePicker = document.querySelector('#audio-files')
const audio = document.querySelector('#audio-player')
const playButton = document.querySelector('#play-toggle')
const trackTitle = document.querySelector('#track-title')
const trackSubtitle = document.querySelector('#track-subtitle')
const trackList = document.querySelector('#track-list')
const mediaMessage = document.querySelector('#media-message')
const seekBar = document.querySelector('#seek-bar')
const volumeControl = document.querySelector('#volume-control')
const volumeValue = document.querySelector('#volume-value')

let watchId = null
let previousFix = null
let filteredSpeed = 0
let lastGoodFixAt = 0
let tracks = []
let activeTrack = -1
const gaugeLength = gauge.getTotalLength()

gauge.style.strokeDasharray = `${gaugeLength}`
gauge.style.strokeDashoffset = `${gaugeLength}`
audio.volume = Number(volumeControl.value)

function setSpeed(value) {
  const boundedSpeed = Math.min(240, Math.max(0, value))
  speedValue.textContent = String(Math.round(boundedSpeed))
  const progress = Math.min(1, boundedSpeed / 180)
  gauge.style.strokeDashoffset = `${gaugeLength * (1 - progress)}`
  speedometer.setAttribute('aria-label', `Velocidad actual: ${Math.round(boundedSpeed)} kilómetros por hora`)
}

function distanceBetween(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const latitude1 = radians(first.latitude)
  const latitude2 = radians(second.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function handlePosition(position) {
  const { latitude, longitude, accuracy, speed } = position.coords
  if (!Number.isFinite(accuracy) || accuracy > 35) {
    gpsStatus.textContent = 'Señal imprecisa; esperando GPS'
    gpsDot.classList.remove('is-active')
    return
  }

  const currentFix = { latitude, longitude, accuracy, timestamp: position.timestamp }
  let measuredSpeed = Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : null

  if (measuredSpeed === null && previousFix) {
    const elapsedSeconds = (currentFix.timestamp - previousFix.timestamp) / 1000
    if (elapsedSeconds > 0.5 && elapsedSeconds <= 10) {
      const distance = distanceBetween(previousFix, currentFix)
      const movementThreshold = Math.max(1.5, (previousFix.accuracy + currentFix.accuracy) * 0.65)
      measuredSpeed = distance >= movementThreshold ? (distance / elapsedSeconds) * 3.6 : 0
    }
  }
  if (measuredSpeed === null) measuredSpeed = 0

  previousFix = currentFix
  lastGoodFixAt = Date.now()
  gpsStatus.textContent = 'GPS activo · señal precisa'
  gpsDot.classList.add('is-active')

  if (measuredSpeed === null || !Number.isFinite(measuredSpeed) || measuredSpeed > 240) return
  if (measuredSpeed < 1.2) filteredSpeed = 0
  else filteredSpeed = filteredSpeed === 0 ? measuredSpeed : filteredSpeed * 0.72 + measuredSpeed * 0.28
  setSpeed(filteredSpeed)
}

function handlePositionError(error) {
  const messages = {
    1: 'Permiso de ubicación denegado. Revisa los permisos del sitio.',
    2: 'Ubicación no disponible. Comprueba el GPS del dispositivo.',
    3: 'Se agotó el tiempo de espera del GPS. Inténtalo de nuevo.',
  }
  gpsStatus.textContent = messages[error.code] || 'No se pudo obtener la ubicación.'
  gpsDot.classList.remove('is-active')
  filteredSpeed = 0
  setSpeed(0)
  if (error.code === 1 && watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
    gpsButton.textContent = 'Reintentar GPS'
  }
}

gpsButton.addEventListener('click', () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
    previousFix = null
    filteredSpeed = 0
    setSpeed(0)
    gpsStatus.textContent = 'GPS detenido'
    gpsDot.classList.remove('is-active')
    gpsButton.textContent = 'Iniciar GPS'
    return
  }

  if (!window.isSecureContext) {
    gpsStatus.textContent = 'El GPS requiere HTTPS o localhost seguro.'
    return
  }
  if (!navigator.geolocation) {
    gpsStatus.textContent = 'Este navegador no ofrece geolocalización.'
    return
  }

  gpsStatus.textContent = 'Esperando permiso y señal GPS…'
  gpsButton.textContent = 'Detener GPS'
  watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 15000,
  })
})

window.setInterval(() => {
  if (watchId !== null && lastGoodFixAt && Date.now() - lastGoodFixAt > 4000) {
    filteredSpeed = 0
    setSpeed(0)
    gpsStatus.textContent = 'Esperando una señal GPS precisa'
    gpsDot.classList.remove('is-active')
  }
}, 1000)

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

function updatePlayButton() {
  const isPlaying = !audio.paused
  playButton.textContent = isPlaying ? 'Ⅱ' : '▶'
  playButton.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir')
  playButton.title = isPlaying ? 'Pausar' : 'Reproducir'
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return
  navigator.mediaSession.metadata = new MediaMetadata({ title: track.file.name, artist: 'Biblioteca local', album: 'Conecta tu música' })
}

function selectTrack(index) {
  if (!tracks.length) return
  activeTrack = (index + tracks.length) % tracks.length
  const track = tracks[activeTrack]
  audio.src = track.url
  trackTitle.textContent = track.file.name
  trackSubtitle.textContent = `${activeTrack + 1} de ${tracks.length} · Archivo local`
  playButton.disabled = false
  seekBar.disabled = false
  mediaMessage.textContent = 'Reproducción local. El archivo no sale de este dispositivo.'
  updateMediaSession(track)
  renderTrackList()
}

function renderTrackList() {
  trackList.replaceChildren()
  tracks.forEach((track, index) => {
    const row = document.createElement('li')
    row.className = index === activeTrack ? 'track-row is-current' : 'track-row'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'track-select'
    button.textContent = track.file.name
    button.setAttribute('aria-current', index === activeTrack ? 'true' : 'false')
    button.addEventListener('click', () => selectTrack(index))
    const number = document.createElement('span')
    number.className = 'track-number'
    number.textContent = String(index + 1).padStart(2, '0')
    row.append(number, button)
    trackList.append(row)
  })
}

filePicker.addEventListener('change', () => {
  const audioFiles = [...filePicker.files].filter((file) => file.type.startsWith('audio/'))
  if (!audioFiles.length) {
    mediaMessage.textContent = 'No se encontraron archivos de audio compatibles.'
    filePicker.value = ''
    return
  }

  const firstNewTrack = tracks.length
  audioFiles.forEach((file) => tracks.push({ file, url: URL.createObjectURL(file) }))
  if (activeTrack === -1) selectTrack(firstNewTrack)
  else renderTrackList()
  mediaMessage.textContent = `${audioFiles.length} archivo${audioFiles.length === 1 ? '' : 's'} añadido${audioFiles.length === 1 ? '' : 's'} desde este dispositivo.`
  filePicker.value = ''
})

playButton.addEventListener('click', () => {
  if (!audio.src) return
  if (audio.paused) audio.play().catch(() => {
    mediaMessage.textContent = 'No se pudo reproducir este archivo en el navegador.'
  })
  else audio.pause()
})

document.querySelector('#previous-track').addEventListener('click', () => selectTrack(activeTrack <= 0 ? tracks.length - 1 : activeTrack - 1))
document.querySelector('#next-track').addEventListener('click', () => selectTrack(activeTrack + 1))
audio.addEventListener('play', updatePlayButton)
audio.addEventListener('pause', updatePlayButton)
audio.addEventListener('ended', () => selectTrack(activeTrack + 1))
audio.addEventListener('timeupdate', () => {
  document.querySelector('#elapsed-time').textContent = formatTime(audio.currentTime)
  if (Number.isFinite(audio.duration) && audio.duration > 0) seekBar.value = String((audio.currentTime / audio.duration) * 100)
})
audio.addEventListener('loadedmetadata', () => {
  document.querySelector('#duration-time').textContent = formatTime(audio.duration)
})
audio.addEventListener('error', () => {
  mediaMessage.textContent = 'El navegador no pudo decodificar este archivo de audio.'
})
seekBar.addEventListener('input', () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seekBar.value) / 100) * audio.duration
})
volumeControl.addEventListener('input', () => {
  audio.volume = Number(volumeControl.value)
  volumeValue.textContent = `${Math.round(audio.volume * 100)}%`
})

if ('mediaSession' in navigator) {
  const actions = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    previoustrack: () => selectTrack(activeTrack <= 0 ? tracks.length - 1 : activeTrack - 1),
    nexttrack: () => selectTrack(activeTrack + 1),
    seekbackward: (details) => { audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10)) },
    seekforward: (details) => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10)) },
  }
  Object.entries(actions).forEach(([action, handler]) => {
    try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* Acción no admitida por este navegador. */ }
  })
}

window.addEventListener('pagehide', () => {
  if (watchId !== null) navigator.geolocation?.clearWatch(watchId)
  tracks.forEach((track) => URL.revokeObjectURL(track.url))
})

if ('serviceWorker' in navigator && window.isSecureContext && !import.meta.env.DEV) {
  navigator.serviceWorker.register('/service-worker.js').then(() => {
    document.querySelector('#pwa-status').textContent = 'Lista para instalar'
  }).catch(() => {
    document.querySelector('#pwa-status').textContent = 'Modo web'
  })
}