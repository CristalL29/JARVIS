import { useEffect, useRef, useState } from 'react'
import './App.css'
import NavigationView from './components/NavigationView.jsx'

const assistantName = 'Jarvis'

const weatherDescriptions = {
  clear: 'Despejado', clouds: 'Nublado', rain: 'Lluvia', drizzle: 'Llovizna',
  thunderstorm: 'Tormenta', snow: 'Nieve', mist: 'Bruma', smoke: 'Humo',
  haze: 'Calima', dust: 'Polvo', fog: 'Niebla', sand: 'Arena', ash: 'Ceniza',
  squall: 'Ráfagas', tornado: 'Tornado',
}

function getWeatherCondition(code) {
  if (code === 0) return { main: 'Clear', description: 'Despejado', icon: 'clear' }
  if (code === 1) return { main: 'Clear', description: 'Mayormente despejado', icon: 'clear' }
  if (code === 2) return { main: 'Clouds', description: 'Parcialmente nublado', icon: 'clouds' }
  if (code === 3) return { main: 'Clouds', description: 'Nublado', icon: 'clouds' }
  if (code === 45 || code === 48) return { main: 'Fog', description: 'Niebla', icon: 'fog' }
  if ([51, 53, 55, 56, 57].includes(code)) return { main: 'Drizzle', description: 'Llovizna', icon: 'rain' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { main: 'Rain', description: 'Lluvia', icon: 'rain' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { main: 'Snow', description: 'Nieve', icon: 'snow' }
  if ([95, 96, 99].includes(code)) return { main: 'Thunderstorm', description: 'Tormenta', icon: 'storm' }
  return { main: 'Clouds', description: 'Condición variable', icon: 'clouds' }
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} h ${minutes} min`
}

function readBatteryHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('battery-consumption-history') || '[]')
    if (!Array.isArray(history)) return []
    return history.filter((sample, index) => index === 0
      || sample.level !== history[index - 1].level
      || sample.charging !== history[index - 1].charging).slice(0, 40)
  } catch {
    return []
  }
}

function getConsumptionRate(history) {
  const samples = []
  for (const sample of history) {
    if (sample.charging) break
    samples.push(sample)
  }
  if (samples.length < 2) return null
  const [latest, previous] = samples
  const elapsedHours = (Date.parse(latest.timestamp) - Date.parse(previous.timestamp)) / 3600000
  const consumed = previous.level - latest.level
  if (elapsedHours <= 0 || consumed <= 0) return null
  return consumed / elapsedHours
}

function playTabSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const volume = context.createGain()
  const now = context.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(660, now)
  oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.07)
  volume.gain.setValueAtTime(0.035, now)
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
  oscillator.connect(volume)
  volume.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.09)
  oscillator.onended = () => context.close()
}

function distanceBetween(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const latitude1 = radians(first.latitude)
  const latitude2 = radians(second.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function watchDeviceLocation(setSpeed, setLocationStatus, gpsState, setGpsActive, setNavigationLocation, setWeatherLocation) {
  return navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, speed } = position.coords
      if (!Number.isFinite(accuracy) || accuracy > 35) {
        gpsState.filteredSpeed = 0
        setSpeed(0)
        setGpsActive(false)
        setNavigationLocation(null)
        setLocationStatus('Señal GPS imprecisa; esperando una lectura mejor')
        return
      }

      const currentFix = { latitude, longitude, accuracy, timestamp: position.timestamp }
      let speedKmh = Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : null
      if (speedKmh === null && gpsState.previousFix) {
        const elapsed = (currentFix.timestamp - gpsState.previousFix.timestamp) / 1000
        if (elapsed > 0.5 && elapsed <= 10) {
          const distance = distanceBetween(gpsState.previousFix, currentFix)
          const noiseThreshold = Math.max(1.5, (accuracy + gpsState.previousFix.accuracy) * 0.65)
          speedKmh = distance > noiseThreshold ? (distance / elapsed) * 3.6 : 0
        }
      }

      gpsState.previousFix = currentFix
      gpsState.lastFixAt = Date.now()
      setNavigationLocation({ latitude, longitude })
      if (!gpsState.lastWeatherLocationAt || Date.now() - gpsState.lastWeatherLocationAt >= 600000) {
        gpsState.lastWeatherLocationAt = Date.now()
        setWeatherLocation({ latitude, longitude })
      }
      setGpsActive(true)
      setLocationStatus('Señal GPS activa')
      if (!Number.isFinite(speedKmh) || speedKmh > 240) speedKmh = 0
      gpsState.filteredSpeed = speedKmh < 1.2
        ? 0
        : gpsState.filteredSpeed === 0 ? speedKmh : gpsState.filteredSpeed * 0.72 + speedKmh * 0.28
      setSpeed(gpsState.filteredSpeed)
    },
    (error) => {
      const messages = {
        1: 'Permiso bloqueado en el navegador',
        2: 'No se pudo determinar la ubicación',
        3: 'Tiempo de espera de ubicación agotado',
      }
      setLocationStatus(messages[error.code] || 'No se pudo acceder a la ubicación')
      gpsState.filteredSpeed = 0
      setSpeed(0)
      setGpsActive(false)
      setNavigationLocation(null)
      setWeatherLocation(null)
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
  )
}

function WeatherIcon({ code, description, className = '' }) {
  const symbols = { clear: '☀', clouds: '☁', fog: '≋', rain: '☂', snow: '❄', storm: 'ϟ' }
  return <span className={`weather-icon-placeholder ${className}`} role="img" aria-label={description}>{symbols[code] || '☼'}</span>
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('dashboard-theme') || 'light')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isReading, setIsReading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceLanguage, setVoiceLanguage] = useState(() => localStorage.getItem('voice-command-language') || 'auto')
  const voiceRecognitionRef = useRef(null)
  const pendingVoiceReplyRef = useRef('')
  const [maintenanceTasks, setMaintenanceTasks] = useState([
    { id: 1, title: 'Revisar presión de neumáticos', lane: 0 },
    { id: 2, title: 'Comprobar nivel de aceite', lane: 1 },
    { id: 3, title: 'Limpieza exterior', lane: 2 },
  ])
  const [newTask, setNewTask] = useState('')
  const [tracks, setTracks] = useState([])
  const [activeTrackIndex, setActiveTrackIndex] = useState(-1)
  const [isMediaPlaying, setIsMediaPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const audioRef = useRef(null)
  const trackUrlsRef = useRef([])
  const [installPrompt, setInstallPrompt] = useState(null)
  const [location] = useState(null)
  const [navigationLocation, setNavigationLocation] = useState(null)
  const [gpsActive, setGpsActive] = useState(false)
  const [locationStatus, setLocationStatus] = useState(() => !window.isSecureContext
    ? 'La ubicación requiere una página HTTPS'
    : navigator.geolocation ? 'Solicitando permiso de ubicación' : 'Este navegador no ofrece geolocalización')
  const [speed, setSpeed] = useState(null)
  const locationWatchId = useRef(null)
  const gpsStateRef = useRef({ previousFix: null, filteredSpeed: 0, lastFixAt: 0, lastWeatherLocationAt: 0 })
  const [battery, setBattery] = useState(() => navigator.getBattery ? null : { unsupported: true })
  const [batteryHistory, setBatteryHistory] = useState(readBatteryHistory)
  const batterySampleRef = useRef(batteryHistory[0]
    ? { level: batteryHistory[0].level, charging: batteryHistory[0].charging }
    : null)
  const [weatherLocation, setWeatherLocation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('dashboard-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('voice-command-language', voiceLanguage)
  }, [voiceLanguage])

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
    voiceRecognitionRef.current?.stop()
  }, [])

  const requestLocation = (fromUser = false) => {
    if (!window.isSecureContext) {
      if (fromUser) setLocationStatus('La ubicación requiere abrir la versión HTTPS')
      return
    }
    if (!navigator.geolocation) {
      if (fromUser) setLocationStatus('Este navegador no ofrece geolocalización')
      return
    }

    if (locationWatchId.current !== null) navigator.geolocation.clearWatch(locationWatchId.current)
    if (fromUser) setLocationStatus('Esperando permiso de ubicación')
    gpsStateRef.current = { previousFix: null, filteredSpeed: 0, lastFixAt: 0, lastWeatherLocationAt: 0 }
    locationWatchId.current = watchDeviceLocation(setSpeed, setLocationStatus, gpsStateRef.current, setGpsActive, setNavigationLocation, setWeatherLocation)
  }

  useEffect(() => {
    if (window.isSecureContext && navigator.geolocation) {
      gpsStateRef.current = { previousFix: null, filteredSpeed: 0, lastFixAt: 0, lastWeatherLocationAt: 0 }
      locationWatchId.current = watchDeviceLocation(setSpeed, setLocationStatus, gpsStateRef.current, setGpsActive, setNavigationLocation, setWeatherLocation)
    }
    return () => {
      if (locationWatchId.current !== null) navigator.geolocation?.clearWatch(locationWatchId.current)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const gpsState = gpsStateRef.current
      if (gpsState.lastFixAt && Date.now() - gpsState.lastFixAt > 4000) {
        gpsState.filteredSpeed = 0
        setSpeed(0)
        setGpsActive(false)
        setNavigationLocation(null)
        setLocationStatus('Esperando una señal GPS precisa')
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {})
    }
  }, [])

  useEffect(() => () => {
    trackUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    let batteryManager
    let active = true
    const updateBattery = () => {
      if (!active || !batteryManager) return
      const sample = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        level: Math.round(batteryManager.level * 100),
        charging: batteryManager.charging,
      }
      const previousSample = batterySampleRef.current
      setBattery({
        level: batteryManager.level,
        charging: batteryManager.charging,
        chargingTime: batteryManager.chargingTime,
        dischargingTime: batteryManager.dischargingTime,
      })
      if (!previousSample || previousSample.level !== sample.level || previousSample.charging !== sample.charging) {
        const event = !previousSample
          ? 'Inicio del registro'
          : previousSample.charging !== sample.charging
            ? sample.charging ? 'Carga iniciada' : 'Carga detenida'
            : sample.level < previousSample.level ? 'Consumo' : 'Nivel recuperado'
        batterySampleRef.current = sample
        setBatteryHistory((history) => [{ ...sample, event }, ...history].slice(0, 40))
      }
    }

    if (!navigator.getBattery) {
      return undefined
    }

    navigator.getBattery().then((manager) => {
      if (!active) return
      batteryManager = manager
      updateBattery()
      manager.addEventListener('levelchange', updateBattery)
      manager.addEventListener('chargingchange', updateBattery)
      manager.addEventListener('chargingtimechange', updateBattery)
      manager.addEventListener('dischargingtimechange', updateBattery)
    }).catch(() => setBattery({ unsupported: true }))

    return () => {
      active = false
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery)
        batteryManager.removeEventListener('chargingchange', updateBattery)
        batteryManager.removeEventListener('chargingtimechange', updateBattery)
        batteryManager.removeEventListener('dischargingtimechange', updateBattery)
      }
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('battery-consumption-history', JSON.stringify(batteryHistory))
    } catch {}
  }, [batteryHistory])

  useEffect(() => {
    if (!weatherLocation) {
      return undefined
    }

    const controller = new AbortController()
    const params = new URLSearchParams({
      latitude: String(weatherLocation.latitude),
      longitude: String(weatherLocation.longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max',
      forecast_days: '3',
      timezone: 'auto',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
    })
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 429) throw new Error('Open-Meteo alcanzó el límite temporal de consultas. Inténtalo más tarde.')
          throw new Error(`Open-Meteo no pudo cargar el pronóstico (HTTP ${response.status}).`)
        }
        return response.json()
      }).then((data) => {
        if (!data.current || !data.daily?.time?.length) throw new Error('Open-Meteo respondió sin datos de pronóstico.')
        const current = {
          name: 'Tu ubicación',
          sys: { country: '' },
          weather: [getWeatherCondition(data.current.weather_code)],
          main: {
            temp: data.current.temperature_2m,
            feels_like: data.current.apparent_temperature,
            humidity: data.current.relative_humidity_2m,
          },
          wind: { speed: data.current.wind_speed_10m / 3.6 },
        }
        const days = data.daily.time.map((localDate, index) => ({
          localDate,
          weather: [getWeatherCondition(data.daily.weather_code[index])],
          main: {
            temp_max: data.daily.temperature_2m_max[index],
            temp_min: data.daily.temperature_2m_min[index],
            humidity: data.daily.relative_humidity_2m_mean[index],
          },
          wind: { speed: data.daily.wind_speed_10m_max[index] / 3.6 },
        }))
        setWeather({ current, days })
      setWeatherStatus('')
      }).catch((error) => {
      if (error.name !== 'AbortError') {
        setWeather(null)
        setWeatherStatus(error.message || 'No se pudo conectar con Open-Meteo.')
      }
    })

    return () => controller.abort()
  }, [weatherLocation])

  const displayedSpeed = speed ?? 0
  const speedValue = Math.round(displayedSpeed)
  const gaugeProgress = Math.min(displayedSpeed / 180, 1)
  const currentCondition = weather?.current.weather[0]
  const batteryPercent = battery && !battery.unsupported ? Math.round(battery.level * 100) : null
  const consumptionRate = getConsumptionRate(batteryHistory)
  const currentTrack = tracks[activeTrackIndex] || null
  const currentTrackName = currentTrack?.name
  const currentTrackUrl = currentTrack?.url
  const changeTrack = (offset, autoplay) => {
    if (!tracks.length) return
    const nextIndex = (activeTrackIndex + offset + tracks.length) % tracks.length
    setActiveTrackIndex(nextIndex)
    setIsMediaPlaying(autoplay ?? (audioRef.current ? !audioRef.current.paused : isMediaPlaying))
  }
  const addAudioFiles = (event) => {
    const files = [...event.target.files].filter((file) => file.type.startsWith('audio/'))
    if (!files.length) return
    const addedTracks = files.map((file) => {
      const url = URL.createObjectURL(file)
      trackUrlsRef.current.push(url)
      return { name: file.name, url }
    })
    if (tracks.length === 0) setActiveTrackIndex(0)
    setTracks((current) => [...current, ...addedTracks])
    event.target.value = ''
  }
  const toggleMediaPlayback = () => {
    if (!audioRef.current || !currentTrack) return
    if (audioRef.current.paused) audioRef.current.play().catch(() => setIsMediaPlaying(false))
    else audioRef.current.pause()
  }
  const requestAppInstall = async () => {
    if (!installPrompt) {
      setVoiceStatus(window.isSecureContext
        ? 'Abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.'
        : 'Publica esta app en un dominio HTTPS para poder instalarla.')
      return
    }
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
    } finally {
      setInstallPrompt(null)
    }
  }
  const clearBatteryHistory = () => {
    setBatteryHistory([])
    batterySampleRef.current = battery && !battery.unsupported
      ? { level: Math.round(battery.level * 100), charging: battery.charging }
      : null
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    const player = audioRef.current
    if (!player) return
    if (isMediaPlaying && currentTrackUrl) player.play().catch(() => setIsMediaPlaying(false))
    else player.pause()
  }, [isMediaPlaying, currentTrackUrl])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined
    if (currentTrackName && 'MediaMetadata' in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrackName,
        artist: 'Biblioteca local',
        album: 'Conecta tu música',
      })
    }
    const clickControl = (id) => document.getElementById(id)?.click()
    const handlers = {
      play: () => {
        if (document.getElementById('media-toggle')?.getAttribute('aria-label') === 'Reproducir') clickControl('media-toggle')
      },
      pause: () => {
        if (document.getElementById('media-toggle')?.getAttribute('aria-label') === 'Pausar') clickControl('media-toggle')
      },
      previoustrack: () => clickControl('media-previous'),
      nexttrack: () => clickControl('media-next'),
    }
    Object.entries(handlers).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* Acción no admitida por el navegador. */ }
    })
    return () => Object.keys(handlers).forEach((action) => {
      try { navigator.mediaSession.setActionHandler(action, null) } catch { /* Acción no admitida por el navegador. */ }
    })
  }, [currentTrackName])
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
    { id: 'navigation', label: 'Navegación', icon: '⌖' },
    { id: 'maintenance', label: 'Mantenimiento / Kanban', icon: '▦' },
    { id: 'multimedia', label: 'Multimedia', icon: '♫' },
  ]
  const selectTab = (tabId) => {
    if (activeTab === tabId) return
    setActiveTab(tabId)
    playTabSound()
  }
  const setReadingVoice = (utterance) => {
    utterance.lang = 'es-ES'
    const spanishVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('es'))
    if (spanishVoice) utterance.voice = spanishVoice
  }
  const speakWithReadingVoice = (text) => {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    setReadingVoice(utterance)
    window.speechSynthesis.speak(utterance)
  }
  const getActiveScreenSummary = () => {
    if (activeTab === 'dashboard') {
      const vehicleStatus = gpsActive
        ? `GPS activo, velocidad ${speedValue} kilómetros por hora`
        : 'GPS sin señal, velocidad 0 kilómetros por hora'
      const batteryStatus = battery?.unsupported
        ? 'batería no disponible'
        : batteryPercent == null
          ? 'estado de batería pendiente'
          : batteryPercent <= 20
            ? `atención, batería baja al ${batteryPercent} por ciento`
            : `batería al ${batteryPercent} por ciento${battery.charging ? ', cargando' : ''}`
      const weatherStatusText = weather
        ? `Clima en ${weather.current.name}: ${weatherDescriptions[currentCondition?.main?.toLowerCase()] || currentCondition?.description}, ${Math.round(weather.current.main.temp)} grados.`
        : 'No hay datos del clima disponibles.'
      return `${vehicleStatus}; ${batteryStatus}. ${weatherStatusText}`
    }

    if (activeTab === 'navigation') {
      return gpsActive
        ? `Ubicación GPS activa. Velocidad actual: ${speedValue} kilómetros por hora.`
        : 'No hay una ruta activa y la ubicación GPS no está disponible.'
    }

    if (activeTab === 'maintenance') {
      const pendingTasks = maintenanceTasks.filter((task) => task.lane === 0)
      const inProgressCount = maintenanceTasks.filter((task) => task.lane === 1).length
      const completedCount = maintenanceTasks.filter((task) => task.lane === 2).length
      const overview = `${pendingTasks.length} tareas pendientes, ${inProgressCount} en curso y ${completedCount} completadas.`
      return pendingTasks.length
        ? `${overview} Próxima tarea: ${pendingTasks[0].title.slice(0, 90)}.`
        : overview
    }

    if (!currentTrack) return 'No hay ningún audio cargado.'
    return isMediaPlaying ? `Reproduciendo ${currentTrack.name}.` : `${currentTrack.name} está pausado.`
  }
  const answerVoiceQuestion = (question) => {
    const asksForDate = /(^|\s)(que dia|que fecha|fecha de hoy|what day|what date|today is|weekday)(\s|$)/.test(question)
    if (asksForDate) {
      const today = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
      return `Hoy es ${today}.`
    }

    const asksForForecast = ['pronostico', 'forecast', 'prevision', 'tomorrow', 'manana', 'proximos dias'].some((term) => question.includes(term))
    if (['humedad', 'humidity', 'humidite', 'feuchtigkeit', 'umidita', 'umidade', '湿度', '습도', 'आर्द्रता', 'влажность', 'الرطوبة'].some((term) => question.includes(term))) {
      if (asksForForecast && weather?.days?.length) {
        const forecastDay = weather.days[0]
        const dayName = new Intl.DateTimeFormat('es', { weekday: 'long' }).format(new Date(`${forecastDay.localDate}T12:00:00`))
        return `El ${dayName}, la humedad prevista es del ${forecastDay.main.humidity} por ciento, con máxima de ${Math.round(forecastDay.main.temp_max)} y mínima de ${Math.round(forecastDay.main.temp_min)} grados Celsius.`
      }
      return weather
        ? `La humedad actual en ${weather.current.name} es del ${weather.current.main.humidity} por ciento.`
        : 'No tengo datos de humedad disponibles ahora mismo.'
    }

    if (['temperatura', 'temperature', 'temp', 'clima', 'tiempo', 'weather', 'wetter', 'meteo', 'lluvia', 'rain', 'viento', 'wind'].some((term) => question.includes(term))) {
      return weather
        ? `En ${weather.current.name} hay ${Math.round(weather.current.main.temp)} grados y está ${weatherDescriptions[currentCondition?.main?.toLowerCase()] || currentCondition?.description}.`
        : 'No tengo datos del clima disponibles ahora mismo.'
    }

    if (['velocidad', 'speed', 'kmh', 'kilometros por hora'].some((term) => question.includes(term))) {
      return displayedSpeed == null ? 'La velocidad no está disponible.' : `La velocidad actual es de ${speedValue} kilómetros por hora.`
    }

    if (['bateria', 'battery', 'akku', 'batterie'].some((term) => question.includes(term))) {
      return batteryPercent == null
        ? 'El nivel de batería no está disponible.'
        : `La batería está al ${batteryPercent} por ciento${battery.charging ? ' y está cargando' : ''}.`
    }

    if (asksForForecast) {
      if (!weather?.days?.length) return 'No hay pronóstico disponible ahora mismo.'
      const nextDay = weather.days[0]
      const dayName = new Intl.DateTimeFormat('es', { weekday: 'long' }).format(new Date(`${nextDay.localDate}T12:00:00`))
      return `El ${dayName}: ${weatherDescriptions[nextDay.weather[0].main.toLowerCase()] || nextDay.weather[0].description}, máxima de ${Math.round(nextDay.main.temp_max)} grados Celsius, mínima de ${Math.round(nextDay.main.temp_min)} grados y humedad del ${nextDay.main.humidity} por ciento.`
    }

    return null
  }
  const getRecognitionLanguage = () => {
    if (voiceLanguage !== 'auto') return voiceLanguage
    const browserLanguage = navigator.language || 'es-ES'
    if (browserLanguage.includes('-')) return browserLanguage
    const regionalDefaults = {
      ar: 'ar-SA', de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', hi: 'hi-IN',
      it: 'it-IT', ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-BR', ru: 'ru-RU', zh: 'zh-CN',
    }
    return regionalDefaults[browserLanguage.toLowerCase()] || browserLanguage
  }
  const togglePageReading = () => {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') {
      setVoiceStatus('La lectura en voz alta no está disponible en este navegador.')
      return
    }
    if (isReading) {
      window.speechSynthesis.cancel()
      setIsReading(false)
      setVoiceStatus('Lectura detenida.')
      return
    }

    const pageSummary = getActiveScreenSummary()
    if (!pageSummary) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(pageSummary)
    setReadingVoice(utterance)
    utterance.onend = () => setIsReading(false)
    utterance.onerror = () => setIsReading(false)
    setIsReading(true)
    setVoiceStatus('Leyendo la página en español.')
    window.speechSynthesis.speak(utterance)
  }
  const toggleVoiceHelp = () => {
    if (isListening) {
      voiceRecognitionRef.current?.stop()
      setIsListening(false)
      setVoiceStatus('Asistencia de voz detenida.')
      return
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setVoiceStatus('El reconocimiento de voz no está disponible en este navegador.')
      return
    }

    window.speechSynthesis?.cancel()
    setIsReading(false)
    pendingVoiceReplyRef.current = ''
    const recognition = new Recognition()
    recognition.lang = getRecognitionLanguage()
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus(`Escuchando comandos en ${recognition.lang}.`)
    }
    const finishWithReply = (reply) => {
      setVoiceStatus(reply)
      pendingVoiceReplyRef.current = reply
      recognition.stop()
    }
    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase()
      const normalizedCommand = command.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (normalizedCommand.includes(assistantName.toLowerCase())) {
        finishWithReply('si?, que necesitas?')
        return
      }
      const readScreenPhrases = [
        'que pone', 'que dice', 'leer', 'lee', 'pantalla', 'resumeme', 'resumen', 'notificacion', 'mensaje',
        'what is on', 'whats on', 'what does', 'read', 'screen', 'summarize', 'notification', 'message',
        'qu affiche', 'lis', 'ecran', 'message', 'bildschirm', 'lies', 'was steht', 'vorlesen',
        'leggi', 'schermo', 'cosa dice', 'leia', 'tela', 'o que diz', '画面', '读一下', '読み上げ',
        '화면', '읽어', 'स्क्रीन', 'पढ़कर', 'экран', 'прочитай', 'الشاشة', 'اقرأ',
      ]
      if (readScreenPhrases.some((phrase) => normalizedCommand.includes(phrase))) {
        const isNotificationRequest = ['notificacion', 'mensaje', 'notification', 'message', 'nachricht', 'message', 'messaggio', 'mensagem', '通知', 'メッセージ', '알림', 'संदेश', 'уведомление', 'رسالة'].some((phrase) => normalizedCommand.includes(phrase))
        const summary = isNotificationRequest
          ? 'No hay mensajes ni notificaciones disponibles en esta pantalla.'
          : getActiveScreenSummary()
        finishWithReply(summary)
        return
      }
      const answer = answerVoiceQuestion(normalizedCommand)
      if (answer) {
        finishWithReply(answer)
        return
      }
      const commandAliases = {
        dashboard: ['dashboard', 'home', 'inicio', 'principal', 'accueil', 'startseite', 'inizio', 'painel', '主页', 'ホーム', 'главная', 'لوحة التحكم', '대시보드', 'डैशबोर्ड'],
        navigation: ['navigation', 'navigate', 'navegacion', 'navegar', 'navegacao', 'navigazione', 'navigieren', 'naviguer', '导航', 'ナビ', 'навигация', 'الملاحة', '내비게이션', 'नेविगेशन'],
        maintenance: ['maintenance', 'mantenimiento', 'kanban', 'entretien', 'wartung', 'manutenzione', 'manutencao', '保养', 'メンテナンス', 'обслуживание', 'الصيانة', '정비', 'रखरखाव'],
        multimedia: ['multimedia', 'media', 'music', 'musica', 'musique', 'musik', 'multimidia', 'medien', '音乐', '音楽', 'медиа', 'الوسائط', '음악', 'संगीत'],
      }
      const destination = Object.entries(commandAliases).find(([, aliases]) => aliases.some((alias) => normalizedCommand.includes(alias)))?.[0]
      if (!destination) {
        finishWithReply('No tengo datos suficientes para responder eso. Puedo informar la fecha, el clima, la humedad, el GPS, la batería o las tareas.')
        return
      }
      selectTab(destination)
      const destinationLabel = tabs.find((tab) => tab.id === destination)?.label
      finishWithReply(`Abriendo ${destinationLabel}.`)
    }
    recognition.onerror = (event) => {
      setVoiceStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'El micrófono está bloqueado. Activa su permiso en la configuración del sitio y vuelve a intentarlo.'
        : event.error === 'network'
          ? 'El servicio de reconocimiento de voz no responde. Comprueba tu conexión a Internet e inténtalo de nuevo.'
        : event.error === 'language-not-supported'
          ? `Este navegador no admite el idioma ${recognition.lang}.`
          : 'No se pudo completar el reconocimiento de voz.')
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      const reply = pendingVoiceReplyRef.current
      pendingVoiceReplyRef.current = ''
      if (reply) speakWithReadingVoice(reply)
    }
    voiceRecognitionRef.current = recognition
    try {
      recognition.start()
    } catch (error) {
      setVoiceStatus(error.name === 'NotAllowedError'
        ? 'El micrófono está bloqueado. Activa su permiso en la configuración del sitio y vuelve a intentarlo.'
        : 'No se pudo iniciar el reconocimiento de voz.')
    }
  }
  const weatherMessage = !weatherLocation
    ? 'Activa el GPS y permite la ubicación para cargar el pronóstico.'
    : weatherStatus || 'Consultando Open-Meteo…'

  return (
    <div className="app-shell">
    <main className="dashboard">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label={`Inicio de ${assistantName}`}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>{assistantName.toLowerCase()}<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-actions">
          <span className="updated-label">PANEL PERSONAL</span>
          <span className="sr-only" aria-live="polite" aria-atomic="true">{voiceStatus}</span>
          <button className={`icon-button voice-button ${isReading ? 'is-active' : ''}`} type="button" onClick={togglePageReading} aria-label={isReading ? 'Detener lectura de la página' : 'Leer la página en voz alta'} aria-pressed={isReading} title={isReading ? 'Detener lectura' : 'Leer página en voz alta'}>
            <span aria-hidden="true">{isReading ? '■' : '◖))'}</span>
          </button>
          <button className={`icon-button voice-button ${isListening ? 'is-active' : ''}`} type="button" onClick={toggleVoiceHelp} aria-label={isListening ? 'Detener comandos de voz' : 'Iniciar comandos de voz'} aria-pressed={isListening} title="Comandos de voz en el idioma seleccionado">
            <span aria-hidden="true">{isListening ? '■' : '🎙'}</span>
          </button>
          <label className="sr-only" htmlFor="voice-command-language">Idioma para reconocer comandos, por ejemplo es-ES, en-US o fr-CA</label>
          <input id="voice-command-language" className="voice-language-select" list="voice-command-languages" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value.trim() || 'auto')} title="Idioma de reconocimiento: elige uno o escribe un código como fr-CA" />
          <datalist id="voice-command-languages">
            <option value="auto" label="Idioma del dispositivo" />
            <option value="es-ES" label="Español" />
            <option value="en-US" label="English" />
            <option value="fr-FR" label="Français" />
            <option value="de-DE" label="Deutsch" />
            <option value="it-IT" label="Italiano" />
            <option value="pt-BR" label="Português" />
            <option value="ja-JP" label="日本語" />
            <option value="zh-CN" label="中文" />
            <option value="ko-KR" label="한국어" />
            <option value="hi-IN" label="हिन्दी" />
            <option value="ru-RU" label="Русский" />
            <option value="ar-SA" label="العربية" />
          </datalist>
          <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`} title={`Cambiar a tema ${theme === 'light' ? 'oscuro' : 'claro'}`}>
            {theme === 'light' ? '☾' : '☼'}
          </button>
          <span className="updated-label">CLIMA · OPEN-METEO</span>
          <button className="settings-button install-button" type="button" onClick={requestAppInstall} title={installPrompt ? 'Instalar aplicación' : 'Publica la app en HTTPS para instalarla'}>
            <span aria-hidden="true">↓</span> Instalar
          </button>
        </div>
      </header>
      {voiceStatus && <div className="voice-feedback" aria-hidden="true">{voiceStatus}</div>}

      <div className="tab-content" key={activeTab}>{activeTab === 'dashboard' ? <>
      <section className="welcome-row" id="inicio">
        <div>
          <p className="eyebrow">TU DÍA, DE UN VISTAZO</p>
          <h1>Buenos días<span className="heading-period">.</span></h1>
        </div>
        <div className="date-stamp">
          <span className="date-dot" />
          {new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="weather-panel panel" aria-labelledby="weather-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EL TIEMPO AHORA</p>
              <h2 id="weather-heading">Pronóstico local</h2>
            </div>
            <span className={`live-tag ${weather ? 'is-live' : ''}`}><span />{weather ? 'EN VIVO' : 'SIN DATOS'}</span>
          </div>

          {weather ? (
            <div className="current-weather">
              <div className="current-main">
                <WeatherIcon code={currentCondition?.icon} description={currentCondition?.description} className="current-weather-icon" />
                <div>
                  <div className="temperature">{Math.round(weather.current.main.temp)}<span>°</span></div>
                  <div className="condition">{weatherDescriptions[currentCondition?.main?.toLowerCase()] || currentCondition?.description}</div>
                </div>
              </div>
              <div className="weather-place">
                <span className="pin-icon" aria-hidden="true">⌖</span>
                <div><strong>{weather.current.name}{weather.current.sys.country ? `, ${weather.current.sys.country}` : ''}</strong><span>S según tu ubicación GPS</span></div>
              </div>
              <div className="weather-metrics">
                <div className="weather-metric"><span className="metric-icon humidity-icon" aria-hidden="true">◌</span><span>Humedad</span><strong>{weather.current.main.humidity}<small>%</small></strong></div>
                <div className="weather-metric"><span className="metric-icon wind-icon" aria-hidden="true">↗</span><span>Viento</span><strong>{Math.round(weather.current.wind.speed * 3.6)}<small> km/h</small></strong></div>
                <div className="weather-metric"><span className="metric-icon feels-icon" aria-hidden="true">≈</span><span>Sensación</span><strong>{Math.round(weather.current.main.feels_like)}<small>°</small></strong></div>
              </div>
            </div>
          ) : (
            <div className="weather-empty">
              <div className="weather-empty-symbol" aria-hidden="true">☀</div>
              <div><strong>El cielo está por descubrirse</strong><p>{weatherMessage}</p></div>
            </div>
          )}
        </section>

        <section className="forecast-panel panel" aria-labelledby="forecast-heading">
          <div className="panel-heading forecast-heading">
            <div><p className="eyebrow">LOS PRÓXIMOS DÍAS</p><h2 id="forecast-heading">Pronóstico 3 días</h2></div>
            <span className="forecast-range">3 DÍAS</span>
          </div>
          {weather?.days?.length ? (
            <div className="forecast-list">
              {weather.days.map((day, index) => {
                const condition = day.weather[0]
                const date = new Date(`${day.localDate}T12:00:00`)
                const weekday = new Intl.DateTimeFormat('es', { weekday: 'long' }).format(date)
                return <article className="forecast-day" key={day.localDate}>
                  <div className="forecast-day-name"><strong>{index === 0 ? `Hoy · ${weekday}` : weekday}</strong><span>{new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(date)}</span></div>
                  <WeatherIcon code={condition.icon} description={condition.description} className="forecast-icon" />
                  <span className="forecast-condition">{weatherDescriptions[condition.main.toLowerCase()] || condition.description}</span>
                  <div className="forecast-temperature"><strong>{Math.round(day.main.temp_max)}°</strong><span>{Math.round(day.main.temp_min)}°</span></div>
                  <div className="forecast-humidity" title="Humedad"><span aria-hidden="true">◌</span> {day.main.humidity}%</div>
                </article>
              })}
            </div>
          ) : (
            <div className="forecast-placeholder">
              <span className="placeholder-sun" aria-hidden="true">☼</span>
              <span>El pronóstico aparecerá aquí cuando se conecte el clima.</span>
            </div>
          )}
        </section>

        <section className="gps-panel panel" aria-labelledby="gps-heading">
          <div className="panel-heading compact-heading">
            <div><p className="eyebrow">MOVIMIENTO</p><h2 id="gps-heading">Velocidad GPS</h2></div>
            <span className={`signal-indicator ${gpsActive ? 'active' : ''}`} title={locationStatus}><span /></span>
          </div>
          <div className="speedometer" aria-label={`Velocidad: ${speedValue} kilómetros por hora`}>
            <svg className="gauge-svg" viewBox="0 0 300 168" role="presentation" aria-hidden="true">
              <path className="gauge-track" d="M 35 145 A 115 115 0 0 1 265 145" />
              <path className="gauge-progress" d="M 35 145 A 115 115 0 0 1 265 145" style={{ strokeDasharray: 361.3, strokeDashoffset: 361.3 * (1 - gaugeProgress) }} />
              <text className="gauge-min" x="29" y="162">0</text><text className="gauge-max" x="258" y="162">180</text>
            </svg>
            <div className="speed-readout"><strong>{speedValue}</strong><span>km/h</span></div>
          </div>
          <div className="gps-data">
            <div className="gps-status"><span className={`status-dot ${gpsActive ? 'active' : ''}`} />{locationStatus}</div>
            {!gpsActive && <div className="gps-permission-help">
              <p>{!window.isSecureContext
                ? 'Abre el enlace HTTPS en el teléfono. Las direcciones HTTP de la red local no pueden solicitar ubicación.'
                : locationStatus.includes('bloqueado')
                  ? 'Permite la ubicación para este sitio en los ajustes del navegador y vuelve a intentarlo.'
                  : 'Pulsa para solicitar permiso de ubicación al navegador.'}</p>
              <button className="location-request-button" type="button" onClick={() => requestLocation(true)}>Solicitar ubicación</button>
            </div>}
            <div className="coordinates">
              <div><span>LATITUD</span><strong>{location ? location.latitude.toFixed(5) : '—'}</strong></div>
              <div><span>LONGITUD</span><strong>{location ? location.longitude.toFixed(5) : '—'}</strong></div>
            </div>
          </div>
        </section>

        <section className="battery-panel panel" aria-labelledby="battery-heading">
          <div className="panel-heading compact-heading">
            <div><p className="eyebrow">DISPOSITIVO</p><h2 id="battery-heading">Batería</h2></div>
            <span className={`charging-badge ${battery?.charging ? 'charging' : ''}`} aria-label={battery?.charging ? 'Cargando' : 'Sin cargar'}>{battery?.charging ? '↯' : '▰'}</span>
          </div>
          {battery?.unsupported ? (
            <div className="battery-unavailable">La información de batería no está disponible en este navegador.</div>
          ) : (
            <>
              <div className="battery-level-row"><strong>{batteryPercent == null ? '—' : `${batteryPercent}%`}</strong><span>{battery?.charging ? 'Conectado · Cargando' : battery ? 'En uso' : 'Consultando dispositivo'}</span></div>
              <div className="battery-track"><span style={{ width: `${batteryPercent ?? 0}%` }} /></div>
              <div className="battery-footer"><span>{battery ? (battery.charging ? 'Carga completa en' : 'Tiempo restante') : 'Estado de batería'}</span><strong>{battery ? formatDuration(battery.charging ? battery.chargingTime : battery.dischargingTime) : '—'}</strong></div>
            </>
          )}
        </section>

        <section className="consumption-panel panel" aria-labelledby="consumption-heading">
          <div className="panel-heading compact-heading">
            <div><p className="eyebrow">HISTORIAL LOCAL</p><h2 id="consumption-heading">Consumo</h2></div>
            <button className="text-button clear-history-button" type="button" onClick={clearBatteryHistory} disabled={!batteryHistory.length}>Borrar</button>
          </div>
          <div className="consumption-summary">
            <strong>{consumptionRate == null ? '—' : `${consumptionRate.toFixed(1)}%/h`}</strong>
            <span>Consumo medio estimado</span>
          </div>
          <p className="consumption-note">El historial se guarda solo en este dispositivo.</p>
          {battery?.unsupported ? (
            <p className="consumption-empty">Este navegador no ofrece datos de batería.</p>
          ) : batteryHistory.length ? (
            <ol className="consumption-history">
              {batteryHistory.slice(0, 6).map((sample) => <li key={sample.id}>
                <span className="consumption-event">{sample.event}</span>
                <span className="consumption-reading">{sample.level}% · {sample.charging ? 'Cargando' : 'En uso'}</span>
                <time dateTime={sample.timestamp}>{new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date(sample.timestamp))}</time>
              </li>)}
            </ol>
          ) : (
            <p className="consumption-empty">El registro aparecerá cuando cambie el nivel de batería.</p>
          )}
        </section>
      </div>

      <footer className="dashboard-footer"><span><span className="footer-mark" />{assistantName.toUpperCase()} · DATOS PARA TU DÍA</span><span>Clima de Open-Meteo <span className="footer-separator">/</span> GPS del dispositivo</span></footer>
      </> : activeTab === 'navigation' ? <NavigationView location={navigationLocation} speed={speed} locationStatus={locationStatus} requestLocation={requestLocation} /> : activeTab === 'maintenance' ? <section className="feature-view maintenance-view">
        <div className="feature-heading"><div><p className="eyebrow">CUIDADO DEL VEHÍCULO</p><h1>Mantenimiento</h1></div><span className="task-count">{maintenanceTasks.length} tareas</span></div>
        <form className="task-form" onSubmit={(event) => { event.preventDefault(); const title = newTask.trim(); if (title) { setMaintenanceTasks([...maintenanceTasks, { id: Date.now(), title, lane: 0 }]); setNewTask('') } }}>
          <input aria-label="Nueva tarea de mantenimiento" value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Añadir tarea de mantenimiento..." />
          <button type="submit" disabled={!newTask.trim()}>Añadir tarea <span aria-hidden="true">+</span></button>
        </form>
        <div className="kanban-board">{['Pendiente', 'En curso', 'Hecho'].map((lane, laneIndex) => <section className="kanban-lane" key={lane}>
          <div className="lane-heading"><h2>{lane}</h2><span>{maintenanceTasks.filter((task) => task.lane === laneIndex).length}</span></div>
          {maintenanceTasks.filter((task) => task.lane === laneIndex).map((task) => <article className="task-card" key={task.id}><p>{task.title}</p><button type="button" onClick={() => setMaintenanceTasks(maintenanceTasks.map((item) => item.id === task.id ? { ...item, lane: (item.lane + 1) % 3 } : item))}>{laneIndex === 2 ? 'Reabrir' : 'Avanzar'} <span aria-hidden="true">→</span></button></article>)}
          {maintenanceTasks.every((task) => task.lane !== laneIndex) && <p className="lane-empty">Sin tareas</p>}
        </section>)}</div>
      </section> : <section className="feature-view multimedia-view">
        <div className="feature-heading"><div><p className="eyebrow">A BORDO</p><h1>Multimedia</h1></div></div>
        <div className="media-player"><div className="media-art" aria-hidden="true"><span>♫</span><strong>{currentTrack ? 'LOCAL' : 'MÚSICA'}</strong></div><div className="media-content"><p className="eyebrow">MÚSICA A BORDO</p><h2>Conecta tu música</h2><p>Selecciona archivos de audio de este dispositivo. No se envían a ningún servicio externo.</p><label className="field-label" htmlFor="local-audio-files">Archivos de música</label><input id="local-audio-files" className="api-input media-file-input" type="file" accept="audio/*" multiple onChange={addAudioFiles} /><p className="track-name" title={currentTrack?.name || ''}>{currentTrack?.name || 'No hay pistas seleccionadas'}</p><audio ref={audioRef} className="audio-controls" src={currentTrack?.url} preload="metadata" onPlay={() => { setIsMediaPlaying(true); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing' }} onPause={() => { setIsMediaPlaying(false); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused' }} onEnded={() => changeTrack(1, true)}>Tu navegador no admite la reproducción de audio.</audio><div className="media-controls"><button id="media-previous" type="button" className="media-control-button" onClick={() => changeTrack(-1)} disabled={!tracks.length} aria-label="Pista anterior" title="Pista anterior">|‹</button><button id="media-toggle" type="button" className="media-control-button media-play-button" onClick={toggleMediaPlayback} disabled={!currentTrack} aria-label={isMediaPlaying ? 'Pausar' : 'Reproducir'} title={isMediaPlaying ? 'Pausar' : 'Reproducir'}>{isMediaPlaying ? 'Ⅱ' : '▶'}</button><button id="media-next" type="button" className="media-control-button" onClick={() => changeTrack(1)} disabled={!tracks.length} aria-label="Siguiente pista" title="Siguiente pista">›|</button><label className="volume-control"><span>Volumen</span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volumen" /></label></div>{tracks.length > 0 && <ol className="media-track-list" aria-label="Lista de pistas">{tracks.map((track, index) => <li key={track.url}><button type="button" onClick={() => { setActiveTrackIndex(index); setIsMediaPlaying(false) }} aria-current={activeTrackIndex === index ? 'true' : undefined}>{track.name}</button></li>)}</ol>}</div></div>
      </section>}</div>

    </main>
    <nav className="side-navigation" aria-label="Secciones principales">{tabs.map((tab) => <button className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`} type="button" key={tab.id} onClick={() => selectTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} title={tab.label}><span className="nav-icon" aria-hidden="true">{tab.icon}</span><span className="nav-label">{tab.label}</span></button>)}</nav>
    </div>
  )
}

export default App
