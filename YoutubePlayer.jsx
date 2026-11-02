import { useEffect, useRef, useState } from 'react'
import { buildYouTubeEmbedUrl, canPlayYouTube, searchYoutubeVideos } from './youtubeService.js'

const STORAGE_KEY = 'jarvis-youtube-account'

function YoutubePlayer({ vehicleState = {}, hidden }) {
  const [account, setAccount] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [query, setQuery] = useState('documentales de coches')
  const [results, setResults] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const playerRef = useRef(null)

  const vehicleStatus = {
    speedKmh: Number(vehicleState.speedKmh) || 0,
    isMoving: Boolean(vehicleState.isMoving),
    parkBrakeEngaged: vehicleState.parkBrakeEngaged ?? true,
  }
  const isPlaybackAllowed = canPlayYouTube(vehicleStatus)

  useEffect(() => {
    if (!selectedVideo || !playerRef.current || isPlaybackAllowed) return

    try {
      playerRef.current.contentWindow?.postMessage(
        '{"event":"command","func":"pauseVideo","args":[]}',
        '*',
      )
    } catch {
      // no-op: the embedded player is blocked in the browser when the vehicle is moving.
    }
  }, [isPlaybackAllowed, selectedVideo])

  useEffect(() => {
    if (!hidden && !results.length) {
      handleSearch({ preventDefault: () => {}, queryOverride: 'carros y entretenimiento' })
    }
  }, [hidden])

  const handleLogin = () => {
    setIsAuthenticating(true)
    setError('')

    const demoUser = {
      name: 'Usuario YouTube',
      email: 'usuario@youtube-demo.local',
      picture: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=120&q=80',
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(demoUser))
    setAccount(demoUser)
    setIsAuthenticating(false)
  }

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setAccount(null)
    setSelectedVideo(null)
    setResults([])
    setQuery('documentales de coches')
    setError('')
  }

  async function handleSearch(event) {
    const nextQuery = event?.queryOverride || query
    if (!account) {
      setError('Inicia sesión para buscar y reproducir contenido personalizado de YouTube.')
      return
    }

    const trimmed = String(nextQuery || '').trim()
    if (!trimmed) {
      setError('Escribe un término de búsqueda antes de buscar contenido.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const items = await searchYoutubeVideos(trimmed, 6)
      setResults(items)

      if (!selectedVideo && items[0]) {
        setSelectedVideo(items[0])
      }

      if (selectedVideo && !items.some((item) => item.id === selectedVideo.id)) {
        setSelectedVideo(selectedVideo)
      }
    } catch (searchError) {
      setError(searchError.message || 'No se pudo consultar YouTube en este momento.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`youtube-shell ${hidden ? 'is-hidden' : 'is-visible'}`}>
      <div className="youtube-topbar">
        <div>
          <p className="eyebrow">ENTRETENIMIENTO SEGURo</p>
          <h3>YouTube</h3>
        </div>
        <div className="youtube-auth-actions">
          {account ? (
            <>
              <img className="youtube-user-avatar" src={account.picture} alt={account.name} />
              <span className="youtube-user-name">{account.name}</span>
              <button type="button" className="youtube-logout-button" onClick={handleLogout}>Cerrar sesión</button>
            </>
          ) : (
            <button type="button" className="youtube-login-button" onClick={handleLogin} disabled={isAuthenticating}>
              {isAuthenticating ? 'Conectando…' : 'Iniciar sesión'}
            </button>
          )}
        </div>
      </div>

      {!account ? (
        <div className="youtube-login-panel">
          <div className="youtube-login-icon" aria-hidden="true">▶</div>
          <div>
            <h4>Inicia sesión para disfrutar de contenido personalizado</h4>
            <p>Tu historial, recomendaciones y suscripciones se gestionan con tu cuenta de YouTube.</p>
          </div>
          <button type="button" className="youtube-login-button" onClick={handleLogin}>Entrar con YouTube</button>
        </div>
      ) : (
        <>
          <form className="youtube-search" onSubmit={(event) => { event.preventDefault(); handleSearch(event) }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca videos, música o documentales"
              aria-label="Buscar contenido en YouTube"
            />
            <button type="submit" disabled={isLoading}>{isLoading ? 'Buscando…' : 'Buscar'}</button>
          </form>

          <div className="youtube-security-alert">
            <span className={`vehicle-state-dot ${isPlaybackAllowed ? 'is-safe' : 'is-blocked'}`} aria-hidden="true" />
            {isPlaybackAllowed
              ? 'El vehículo está detenido. Puedes reproducir contenido de video.'
              : 'El vehículo está en movimiento. La reproducción de video está bloqueada por seguridad.'}
          </div>

          {error && <div className="youtube-error" role="alert">{error}</div>}

          {selectedVideo ? (
            <div className={`youtube-player-layout ${isPlaybackAllowed ? 'is-unlocked' : 'is-locked'}`}>
              <div className="youtube-player-column">
                <div className="youtube-video-frame-wrap">
                  <iframe
                    ref={playerRef}
                    className="youtube-video-frame"
                    src={buildYouTubeEmbedUrl(selectedVideo.id, { autoplay: true })}
                    title={selectedVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                  {!isPlaybackAllowed && (
                    <div className="youtube-drive-lock" aria-live="polite">
                      <div className="youtube-lock-icon">⛔</div>
                      <strong>Modo conducción activo</strong>
                      <span>La reproducción se bloquea por seguridad mientras el coche está en movimiento.</span>
                    </div>
                  )}
                </div>
                <div className="youtube-player-meta">
                  <h4>{selectedVideo.title}</h4>
                  <p>{selectedVideo.channelTitle}</p>
                </div>
              </div>

              <aside className="youtube-recommendations" aria-label="Videos recomendados">
                {results.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    className={`youtube-recommendation ${selectedVideo.id === video.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    <img src={video.thumbnail} alt={video.title} />
                    <div>
                      <strong>{video.title}</strong>
                      <span>{video.channelTitle}</span>
                    </div>
                  </button>
                ))}
              </aside>
            </div>
          ) : (
            <div className="youtube-empty-state">No hay resultados todavía. Busca un video para empezar.</div>
          )}
        </>
      )}
    </div>
  )
}

export default YoutubePlayer
