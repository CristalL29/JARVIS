import { useCallback, useEffect, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [19.4326, -99.1332]
const vehicleIcon = divIcon({ className: 'navigation-marker vehicle-marker', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 15] })
const destinationIcon = divIcon({ className: 'navigation-marker destination-marker', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 15] })

const maneuverLabels = {
  depart: 'Continúa', turn: 'Gira', 'new name': 'Continúa', 'end of road': 'Gira',
  'merge': 'Incorpórate', 'on ramp': 'Toma la incorporación', 'off ramp': 'Toma la salida',
  fork: 'Mantente', 'roundabout': 'Entra en la glorieta', 'rotary': 'Entra en la glorieta',
  'roundabout turn': 'Sal de la glorieta', 'exit roundabout': 'Sal de la glorieta',
  arrive: 'Has llegado', continue: 'Continúa', notification: 'Continúa',
}

const maneuverDirections = {
  'sharp left': 'cerrada a la izquierda', left: 'a la izquierda', 'slight left': 'ligeramente a la izquierda',
  straight: 'recto', 'slight right': 'ligeramente a la derecha', right: 'a la derecha',
  'sharp right': 'cerrada a la derecha', uturn: 'en U',
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
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

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

function formatManeuver(step) {
  if (!step) return 'Sigue la ruta indicada'
  const type = step.maneuver?.type || 'continue'
  const label = maneuverLabels[type] || 'Continúa'
  const modifier = step.maneuver?.modifier
  const direction = modifier ? ` ${maneuverDirections[modifier] || modifier.replace('-', ' ')}` : ''
  const road = step.name ? ` por ${step.name}` : ''
  return `${label}${direction}${road}`
}

function getRouteProgress(location, route) {
  if (!location || !route?.coordinates?.length) return 0

  let closestDistance = Infinity
  let progress = 0
  route.coordinates.forEach((coordinate, index) => {
    const distance = distanceBetween(location, { latitude: coordinate[0], longitude: coordinate[1] })
    if (distance < closestDistance) {
      closestDistance = distance
      progress = route.coordinateDistances[index]
    }
  })
  return progress
}

async function findRoute(start, destination, signal) {
  const coordinates = `${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}`
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`, { signal })
  if (!response.ok) throw new Error('No se pudo calcular la ruta. Comprueba tu conexión e inténtalo de nuevo.')
  const data = await response.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('No se encontró una ruta en coche para este destino.')
  const routeCoordinates = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])
  const coordinateDistances = [0]
  for (let index = 1; index < routeCoordinates.length; index += 1) {
    coordinateDistances.push(coordinateDistances[index - 1] + distanceBetween(
      { latitude: routeCoordinates[index - 1][0], longitude: routeCoordinates[index - 1][1] },
      { latitude: routeCoordinates[index][0], longitude: routeCoordinates[index][1] },
    ))
  }
  let cumulativeDistance = 0
  const steps = (route.legs?.[0]?.steps || []).map((step) => {
    const result = { ...step, cumulativeDistance }
    cumulativeDistance += Number(step.distance) || 0
    return result
  })
  return {
    coordinates: routeCoordinates,
    coordinateDistances,
    distance: route.distance,
    duration: route.duration,
    steps,
  }
}

function MapViewport({ location, route }) {
  const map = useMap()
  const latitude = location?.latitude
  const longitude = location?.longitude

  useEffect(() => {
    if (route?.coordinates?.length > 1) {
      map.fitBounds(route.coordinates, { padding: [35, 35] })
    } else if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.setView([latitude, longitude], 15)
    }
  }, [map, latitude, longitude, route])

  return null
}

function MapControls({ location, route }) {
  const map = useMap()
  return <div className="navigation-map-controls">
    <button type="button" disabled={!location} onClick={() => location && map.setView([location.latitude, location.longitude], 16)}>Centrar GPS</button>
    <button type="button" className={route ? 'is-selected' : ''} disabled={!route} onClick={() => route && map.fitBounds(route.coordinates, { padding: [35, 35] })}>Ver ruta</button>
  </div>
}

function NavigationView({ location, speed, locationStatus, requestLocation, onSpeechActivity }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [destination, setDestination] = useState(null)
  const [route, setRoute] = useState(null)
  const [isNavigating, setIsNavigating] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [progress, setProgress] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [status, setStatus] = useState('')
  const routeRequestRef = useRef(null)
  const attemptedDestinationRef = useRef(null)
  const spokenMilestonesRef = useRef(new Set())
  const arrivalAnnouncedRef = useRef(false)
  const speechUtteranceRef = useRef(null)

  useEffect(() => () => {
    routeRequestRef.current?.abort()
    window.speechSynthesis?.cancel()
    speechUtteranceRef.current = null
    onSpeechActivity(false)
  }, [onSpeechActivity])

  useEffect(() => {
    spokenMilestonesRef.current.clear()
    arrivalAnnouncedRef.current = false
  }, [route])

  useEffect(() => {
    if (!isNavigating || !route || !location) return
    setProgress((current) => Math.max(current, getRouteProgress(location, route)))
  }, [isNavigating, location, route])

  useEffect(() => {
    if (!destination || !location || attemptedDestinationRef.current === destination.place_id) return
    attemptedDestinationRef.current = destination.place_id
    const controller = new AbortController()
    routeRequestRef.current?.abort()
    routeRequestRef.current = controller
    setStatus('Calculando ruta…')
    findRoute(location, destination, controller.signal)
      .then((result) => { setProgress(0); setRoute(result); setStatus('Ruta calculada') })
      .catch((error) => { if (error.name !== 'AbortError') setStatus(error.message) })
  }, [destination, location])

  const searchPlaces = async (event) => {
    event.preventDefault()
    const search = query.trim()
    if (!search) return
    setIsSearching(true)
    setStatus('Buscando destinos…')
    setResults([])
    try {
      const params = new URLSearchParams({ q: search, format: 'jsonv2', limit: '5' })
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      if (!response.ok) throw new Error('No se pudo buscar el destino. Inténtalo de nuevo.')
      const places = await response.json()
      setResults(places.map((place) => ({
        place_id: place.place_id,
        name: place.name || place.display_name.split(',')[0],
        address: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon),
      })))
      setStatus(places.length ? '' : 'No se encontraron destinos para esa búsqueda.')
    } catch (error) {
      setStatus(error.message || 'No se pudo conectar con el buscador de lugares.')
    } finally {
      setIsSearching(false)
    }
  }

  const chooseDestination = (place) => {
    routeRequestRef.current?.abort()
    attemptedDestinationRef.current = null
    setIsNavigating(false)
    setProgress(0)
    setDestination(place)
    setRoute(null)
    setResults([])
    setQuery(place.name)
    setStatus(location ? 'Calculando ruta…' : 'Activa el GPS para calcular la ruta.')
  }

  const clearDestination = () => {
    routeRequestRef.current?.abort()
    attemptedDestinationRef.current = null
    setIsNavigating(false)
    setProgress(0)
    setDestination(null)
    setRoute(null)
    setResults([])
    setQuery('')
    setStatus('')
  }

  const center = location ? [location.latitude, location.longitude] : DEFAULT_CENTER
  const routeCoordinates = route?.coordinates || []
  const nextStepIndex = route?.steps.findIndex((step) => step.maneuver?.type !== 'depart'
    && step.cumulativeDistance >= progress - 20) ?? -1
  const nextStep = nextStepIndex >= 0 ? route.steps[nextStepIndex] : null
  const distanceToNextStep = nextStep ? Math.max(0, nextStep.cumulativeDistance - progress) : 0
  const remainingDistance = route ? Math.max(0, route.distance - progress) : 0
  const remainingDuration = route && route.distance > 0 ? route.duration * remainingDistance / route.distance : 0

  const announce = useCallback((message, onFinished) => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus('Este navegador no permite indicaciones por voz.')
      onFinished?.()
      return
    }

    window.speechSynthesis.cancel()
    onSpeechActivity(false)
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-MX'
    const finish = () => {
      if (speechUtteranceRef.current !== utterance) return
      speechUtteranceRef.current = null
      onSpeechActivity(false)
      onFinished?.()
    }
    utterance.onend = finish
    utterance.onerror = finish
    speechUtteranceRef.current = utterance
    onSpeechActivity(true)
    try {
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      finish()
      setStatus(error.message || 'No se pudo reproducir la indicación de voz.')
    }
  }, [onSpeechActivity])

  useEffect(() => {
    if (isNavigating && voiceEnabled) return
    window.speechSynthesis?.cancel()
    speechUtteranceRef.current = null
    onSpeechActivity(false)
  }, [isNavigating, onSpeechActivity, voiceEnabled])

  useEffect(() => {
    if (!isNavigating || !voiceEnabled || !route) return
    if (remainingDistance <= 25) {
      if (!arrivalAnnouncedRef.current) {
        arrivalAnnouncedRef.current = true
        announce('Has llegado a tu destino.', () => setIsNavigating(false))
        setStatus('Has llegado a tu destino.')
      }
      return
    }
    if (!nextStep) return

    const stepKey = String(nextStepIndex)
    if (distanceToNextStep <= 160 && !spokenMilestonesRef.current.has(`${stepKey}:near`)) {
      spokenMilestonesRef.current.add(`${stepKey}:near`)
      spokenMilestonesRef.current.add(`${stepKey}:early`)
      announce(`En ${formatDistance(distanceToNextStep)}, ${formatManeuver(nextStep)}.`)
    } else if (distanceToNextStep <= 700 && !spokenMilestonesRef.current.has(`${stepKey}:early`)) {
      spokenMilestonesRef.current.add(`${stepKey}:early`)
      announce(`En ${formatDistance(distanceToNextStep)}, ${formatManeuver(nextStep)}.`)
    }
  }, [announce, distanceToNextStep, isNavigating, nextStep, nextStepIndex, remainingDistance, route, voiceEnabled])

  return <section className="feature-view navigation-view" aria-labelledby="navigation-heading">
    <div className="feature-heading"><div><p className="eyebrow">MAPA Y RUTAS</p><h1 id="navigation-heading">Navegación</h1></div></div>

    <form className="navigation-search" onSubmit={searchPlaces}>
      <label className="sr-only" htmlFor="navigation-destination">Buscar destino</label>
      <input id="navigation-destination" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ciudad, dirección o lugar…" />
      <button type="submit" disabled={isSearching || !query.trim()}>{isSearching ? 'Buscando…' : 'Buscar'}</button>
    </form>
    {status && <p className={`navigation-message ${status.includes('No se pudo') || status.includes('No se encontró') ? 'is-error' : ''}`} role="status">{status}</p>}
    {results.length > 0 && <ul className="navigation-results">{results.map((place) => <li key={place.place_id}>
      <button type="button" onClick={() => chooseDestination(place)}><strong>{place.name}</strong><span>{place.address}</span></button>
    </li>)}</ul>}

    <div className="navigation-map-layout">
      <div className="map-frame navigation-map">
        <MapContainer center={center} zoom={location ? 15 : 5} zoomControl={false} className="leaflet-navigation-map">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {location && <Marker position={[location.latitude, location.longitude]} icon={vehicleIcon} />}
          {destination && <Marker position={[destination.latitude, destination.longitude]} icon={destinationIcon} />}
          {routeCoordinates.length > 0 && <Polyline positions={routeCoordinates} pathOptions={{ color: '#327b72', weight: 5, opacity: 0.85 }} />}
          <MapViewport location={location} route={route} />
          <MapControls location={location} route={route} />
        </MapContainer>
        {!location && <div className="navigation-map-overlay"><strong>Activa la ubicación para empezar</strong><span className="navigation-loading">{locationStatus}</span><button className="location-request-button" type="button" onClick={() => requestLocation(true)}>Solicitar ubicación</button></div>}
      </div>

      <aside className="navigation-info" aria-label="Información de ruta">
        <div className="navigation-destination"><p className="eyebrow">DESTINO</p><strong>{destination?.name || 'Busca un lugar para comenzar'}</strong>{destination && <span className="navigation-loading">{destination.address}</span>}</div>
        {route && <>
          <div className="navigation-route-stats"><strong>{formatDistance(isNavigating ? remainingDistance : route.distance)}</strong><span>{formatDuration(isNavigating ? remainingDuration : route.duration)}</span></div>
          <div className="navigation-next-turn"><p className="eyebrow">{isNavigating ? 'SIGUIENTE INDICACIÓN' : 'INICIO DE RUTA'}</p><strong>{formatManeuver(nextStep)}</strong><span className="navigation-loading">{nextStep ? `En ${formatDistance(distanceToNextStep)}` : ''}</span></div>
          <div className="navigation-guidance-controls">
            <button type="button" className="navigation-start" onClick={() => {
              if (!isNavigating) {
                setProgress(getRouteProgress(location, route))
                spokenMilestonesRef.current.clear()
                arrivalAnnouncedRef.current = false
              }
              setIsNavigating((active) => !active)
              setStatus(isNavigating ? 'Navegación finalizada.' : 'Navegación iniciada. Sigue las indicaciones de la ruta.')
            }}>{isNavigating ? 'Finalizar navegación' : 'Iniciar navegación'}</button>
            <button
              type="button"
              className={`navigation-voice-toggle ${voiceEnabled ? 'is-enabled' : ''}`}
              onClick={() => setVoiceEnabled((enabled) => !enabled)}
              disabled={!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined'}
              aria-pressed={voiceEnabled}
              title={!('speechSynthesis' in window) ? 'Este navegador no admite voz' : undefined}
            >{voiceEnabled ? 'Voz activada' : 'Voz desactivada'}</button>
          </div>
        </>}
        <div className="navigation-speed">Velocidad actual <strong>{Number.isFinite(speed) ? `${Math.round(speed)} km/h` : '—'}</strong></div>
        <div className="navigation-gps-status"><span className={`status-dot ${location ? 'active' : ''}`} />{locationStatus}</div>
        {destination && <button className="navigation-cancel" type="button" onClick={clearDestination}>Cancelar destino</button>}
      </aside>
    </div>
  </section>
}

export default NavigationView
