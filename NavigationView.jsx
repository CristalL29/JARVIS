import { useEffect, useRef, useState } from 'react'
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

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
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
  const direction = modifier ? ` ${modifier.replace('-', ' ')}` : ''
  const road = step.name ? ` por ${step.name}` : ''
  return `${label}${direction}${road}`
}

async function findRoute(start, destination, signal) {
  const coordinates = `${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}`
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`, { signal })
  if (!response.ok) throw new Error('No se pudo calcular la ruta. Comprueba tu conexión e inténtalo de nuevo.')
  const data = await response.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('No se encontró una ruta en coche para este destino.')
  return {
    coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distance: route.distance,
    duration: route.duration,
    steps: route.legs?.[0]?.steps || [],
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

function NavigationView({ location, speed, locationStatus, requestLocation }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [destination, setDestination] = useState(null)
  const [route, setRoute] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [status, setStatus] = useState('')
  const routeRequestRef = useRef(null)
  const attemptedDestinationRef = useRef(null)

  useEffect(() => () => routeRequestRef.current?.abort(), [])

  useEffect(() => {
    if (!destination || !location || attemptedDestinationRef.current === destination.place_id) return
    attemptedDestinationRef.current = destination.place_id
    const controller = new AbortController()
    routeRequestRef.current?.abort()
    routeRequestRef.current = controller
    setStatus('Calculando ruta…')
    findRoute(location, destination, controller.signal)
      .then((result) => { setRoute(result); setStatus('Ruta calculada') })
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
    setDestination(place)
    setRoute(null)
    setResults([])
    setQuery(place.name)
    setStatus(location ? 'Calculando ruta…' : 'Activa el GPS para calcular la ruta.')
  }

  const clearDestination = () => {
    routeRequestRef.current?.abort()
    attemptedDestinationRef.current = null
    setDestination(null)
    setRoute(null)
    setResults([])
    setQuery('')
    setStatus('')
  }

  const center = location ? [location.latitude, location.longitude] : DEFAULT_CENTER
  const routeCoordinates = route?.coordinates || []
  const nextStep = route?.steps.find((step) => step.maneuver?.type !== 'depart') || route?.steps[0]

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
          <div className="navigation-route-stats"><strong>{formatDistance(route.distance)}</strong><span>{formatDuration(route.duration)}</span></div>
          <div className="navigation-next-turn"><p className="eyebrow">SIGUIENTE INDICACIÓN</p><strong>{formatManeuver(nextStep)}</strong><span className="navigation-loading">{nextStep ? `En ${formatDistance(nextStep.distance)}` : ''}</span></div>
        </>}
        <div className="navigation-speed">Velocidad actual <strong>{Number.isFinite(speed) ? `${Math.round(speed)} km/h` : '—'}</strong></div>
        <div className="navigation-gps-status"><span className={`status-dot ${location ? 'active' : ''}`} />{locationStatus}</div>
        {destination && <button className="navigation-cancel" type="button" onClick={clearDestination}>Cancelar destino</button>}
      </aside>
    </div>
  </section>
}

export default NavigationView