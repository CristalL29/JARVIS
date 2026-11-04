import { useEffect, useRef, useState } from 'react'
import {
  beginSpotifyAuthorization,
  clearSpotifySession,
  completeSpotifyAuthorization,
  getSpotifyAccessToken,
} from './spotifyAuth.js'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || ''
const TOKEN_STORAGE_KEY = 'jarvis-spotify-session'
const CONFIGURED_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim() || ''

function resolveSpotifyRedirectUri() {
  const uri = new URL(CONFIGURED_REDIRECT_URI || `${window.location.origin}${window.location.pathname}`)
  if (uri.hostname.toLowerCase() === 'localhost') uri.hostname = '127.0.0.1'
  return uri.toString()
}

async function spotifyRequest(path, options = {}) {
  const token = await getSpotifyAccessToken(CLIENT_ID)
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    let message = `Spotify respondió con el estado ${response.status}.`
    try {
      const body = await response.json()
      message = body.error?.message || message
    } catch {
      // Some successful and error responses do not include a JSON body.
    }
    throw new Error(message)
  }
  return response.status === 204 ? null : response.json()
}

function getRedirectUri() {
  return resolveSpotifyRedirectUri()
}

function formatSpotifyDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '--'
  const totalSeconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function SpotifyPlayer({ hidden, ducked = false }) {
  const [isConnected, setIsConnected] = useState(() => Boolean(sessionStorage.getItem(TOKEN_STORAGE_KEY)))
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const volumeRef = useRef(volume)
  const duckedRef = useRef(ducked)
  const playerRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    if (window.location.hostname.toLowerCase() === 'localhost') {
      const loopbackUrl = new URL(window.location.href)
      loopbackUrl.hostname = '127.0.0.1'
      window.location.replace(loopbackUrl)
      return
    }

    const parameters = new URLSearchParams(window.location.search)
    if (!parameters.has('code') && !parameters.has('error')) return

    let isActive = true
    window.history.replaceState({}, document.title, getRedirectUri())
    if (!CLIENT_ID) return
    completeSpotifyAuthorization(parameters, CLIENT_ID, getRedirectUri())
      .then((session) => {
        if (isActive && session) {
          setIsConnected(true)
          setError('')
          setStatus('Cuenta de Spotify conectada.')
        }
      })
      .catch((authorizationError) => {
        if (isActive) setError(authorizationError.message || 'No se pudo conectar con Spotify.')
      })
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    duckedRef.current = ducked
    if (!playerRef.current) return
    playerRef.current.setVolume(volumeRef.current * (ducked ? 0.2 : 1))
      .catch((playerError) => setError(playerError.message || 'No se pudo ajustar el volumen de Spotify.'))
  }, [ducked])

  useEffect(() => {
    if (!isConnected || !CLIENT_ID) return undefined

    let isActive = true
    let player
    const initializePlayer = () => {
      if (!isActive || !window.Spotify?.Player || playerRef.current) return

      player = new window.Spotify.Player({
        name: 'JARVIS',
        volume: volumeRef.current * (duckedRef.current ? 0.2 : 1),
        getOAuthToken: (callback) => {
          getSpotifyAccessToken(CLIENT_ID)
            .then(callback)
            .catch((tokenError) => { if (isActive) setError(tokenError.message) })
        },
      })
      playerRef.current = player
      player.addListener('ready', async ({ device_id: readyDeviceId }) => {
        if (!isActive) return
        setDeviceId(readyDeviceId)
        try {
          await spotifyRequest('/me/player', {
            method: 'PUT',
            body: JSON.stringify({ device_ids: [readyDeviceId], play: false }),
          })
          if (isActive) setStatus('Spotify listo para reproducir.')
        } catch (playerError) {
          if (isActive) setError(playerError.message)
        }
      })
      player.addListener('not_ready', () => {
        if (isActive) setStatus('El reproductor de Spotify se desconectó.')
      })
      player.addListener('player_state_changed', (state) => {
        if (!isActive || !state) return
        setCurrentTrack(state.track_window.current_track)
        setIsPlaying(!state.paused)
      })
      for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
        player.addListener(event, ({ message }) => {
          if (isActive) setError(message || 'No se pudo iniciar el reproductor de Spotify.')
        })
      }

      player.connect().then((connected) => {
        if (!connected && isActive) setError('No se pudo iniciar el reproductor web de Spotify.')
      }).catch((playerError) => {
        if (isActive) setError(playerError.message || 'No se pudo iniciar el reproductor web de Spotify.')
      })
    }

    if (window.Spotify?.Player) {
      initializePlayer()
    } else {
      const existingScript = document.querySelector('script[data-jarvis-spotify-sdk]')
      const script = existingScript || document.createElement('script')
      if (!existingScript) {
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        script.dataset.jarvisSpotifySdk = 'true'
        document.body.appendChild(script)
      }
      window.onSpotifyWebPlaybackSDKReady = initializePlayer
      script.onerror = () => {
        if (isActive) setError('No se pudo cargar el reproductor web de Spotify.')
      }
    }

    return () => {
      isActive = false
      if (playerRef.current === player) {
        playerRef.current.disconnect()
        playerRef.current = null
      }
    }
  }, [isConnected])

  const connectSpotify = async () => {
    setError('')
    setStatus('')
    try {
      await beginSpotifyAuthorization(CLIENT_ID, getRedirectUri())
    } catch (authorizationError) {
      setError(authorizationError.message || 'No se pudo iniciar la autorización de Spotify.')
    }
  }

  const disconnectSpotify = () => {
    playerRef.current?.disconnect()
    playerRef.current = null
    clearSpotifySession()
    setIsConnected(false)
    setDeviceId('')
    setCurrentTrack(null)
    setIsPlaying(false)
    setResults([])
    setStatus('Sesión de Spotify cerrada en este dispositivo.')
    setError('')
  }

  const searchTracks = async (event) => {
    event.preventDefault()
    if (!search.trim()) return
    setError('')
    setStatus('')
    try {
      const response = await spotifyRequest(`/search?${new URLSearchParams({ q: search.trim(), type: 'track', limit: '10' })}`)
      setResults(response.tracks.items)
      if (!response.tracks.items.length) setStatus('No se encontraron canciones.')
    } catch (searchError) {
      setError(searchError.message || 'No se pudo buscar en Spotify.')
    }
  }

  const playTrack = async (track) => {
    if (!deviceId) {
      setError('Espera a que el reproductor de Spotify esté listo.')
      return
    }
    setError('')
    try {
      await spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [track.uri] }),
      })
      setCurrentTrack(track)
      setIsPlaying(true)
    } catch (playError) {
      setError(playError.message || 'No se pudo reproducir esta canción.')
    }
  }

  const runPlayerAction = async (action) => {
    if (!playerRef.current) return
    setError('')
    try {
      await playerRef.current[action]()
    } catch (playerError) {
      setError(playerError.message || 'No se pudo controlar la reproducción.')
    }
  }

  return <section className="media-player spotify-player media-source-panel" aria-label="Reproductor de Spotify" hidden={hidden}>
    <div className="media-art spotify-art" aria-hidden="true"><span>♫</span><strong>SPOTIFY</strong></div>
    <div className="media-content">
      <p className="eyebrow">REPRODUCCIÓN EN LÍNEA</p>
      <h2>Spotify</h2>
      {!CLIENT_ID ? <>
        <p>Para conectar Spotify, define el Client ID en <code>.env</code> y registra esta URL en la configuración de tu aplicación de Spotify for Developers.</p>
        <p className="spotify-setup-hint">Variable requerida: <code>VITE_SPOTIFY_CLIENT_ID</code>. No uses ni publiques un Client Secret en esta aplicación web.</p>
      </> : !isConnected ? <>
        <p>Conecta tu cuenta mediante la autorización oficial de Spotify. JARVIS no recibe ni almacena tu contraseña.</p>
        <button className="spotify-button" type="button" onClick={connectSpotify}>Conectar con Spotify</button>
        <p className="spotify-setup-hint">Registra esta Redirect URI exactamente en Spotify for Developers: <code>{getRedirectUri()}</code></p>
      </> : <>
        <div className="spotify-connected-row">
          <span className="spotify-connection-indicator">Cuenta conectada</span>
          <button className="text-button" type="button" onClick={disconnectSpotify}>Desconectar</button>
        </div>
        <form className="spotify-search" onSubmit={searchTracks}>
          <input ref={searchInputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar canción o artista" aria-label="Buscar en Spotify" />
          <button className="spotify-button" type="submit">Buscar</button>
        </form>
        {currentTrack && <div className="spotify-current-track">
          <strong title={currentTrack.name}>{currentTrack.name}</strong>
          <span title={currentTrack.artists.map((artist) => artist.name).join(', ')}>{currentTrack.artists.map((artist) => artist.name).join(', ')}</span>
          <small>{formatSpotifyDuration(currentTrack.duration_ms)}</small>
        </div>}
        <div className="media-controls spotify-controls">
          <button className="media-control-button" type="button" onClick={() => runPlayerAction('previousTrack')} disabled={!deviceId} aria-label="Canción anterior" title="Canción anterior">|‹</button>
          <button className="media-control-button media-play-button" type="button" onClick={() => runPlayerAction('togglePlay')} disabled={!deviceId} aria-label={isPlaying ? 'Pausar Spotify' : 'Reproducir Spotify'} title={isPlaying ? 'Pausar' : 'Reproducir'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
          <button className="media-control-button" type="button" onClick={() => runPlayerAction('nextTrack')} disabled={!deviceId} aria-label="Siguiente canción" title="Siguiente canción">›|</button>
          <label className="volume-control"><span>Volumen</span><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => {
            const nextVolume = Number(event.target.value)
            volumeRef.current = nextVolume
            setVolume(nextVolume)
            playerRef.current?.setVolume(nextVolume * (ducked ? 0.2 : 1))
              .catch((playerError) => setError(playerError.message || 'No se pudo ajustar el volumen de Spotify.'))
          }} aria-label="Volumen de Spotify" /></label>
        </div>
        {results.length > 0 && <ol className="media-track-list spotify-track-list" aria-label="Resultados de búsqueda de Spotify">{results.map((track) => <li key={track.id}>
          <button type="button" onClick={() => playTrack(track)} title={`${track.name} — ${track.artists.map((artist) => artist.name).join(', ')}`}>
            <span>{track.name} <small>{track.artists.map((artist) => artist.name).join(', ')} · {formatSpotifyDuration(track.duration_ms)}</small></span>
            <span aria-hidden="true">▶</span>
          </button>
        </li>)}</ol>}
        <p className="spotify-note">La reproducción web requiere Spotify Premium y conexión a Internet.</p>
      </>}
      {status && <p className="spotify-status" role="status">{status}</p>}
      {error && <p className="storage-error spotify-error" role="alert">{error}</p>}
    </div>
  </section>
}

export default SpotifyPlayer
