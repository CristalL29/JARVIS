export const YOUTUBE_API_KEY = 'AIzaSyDm3lorrhh4dmJ1P5DDWRsvxrbfKjxQV30'

export function getVehicleStateFromTelemetry(telemetry = {}) {
  const speedKmh = Number.isFinite(Number(telemetry.speedKmh)) ? Number(telemetry.speedKmh) : 0
  const isMoving = speedKmh > 5
  const gear = telemetry.gear || (isMoving ? 'D' : 'P')
  const parkBrakeEngaged = telemetry.parkBrakeEngaged ?? !isMoving

  return {
    speedKmh,
    isMoving,
    gear,
    parkBrakeEngaged,
    status: isMoving ? 'IN_MOTION' : 'STOPPED',
  }
}

export function canPlayYouTube(vehicleState = {}) {
  const telemetry = getVehicleStateFromTelemetry(vehicleState)
  return !telemetry.isMoving && telemetry.parkBrakeEngaged
}

export function buildYouTubeEmbedUrl(videoId, options = {}) {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
  const params = new URLSearchParams({
    autoplay: String(options.autoplay ? 1 : 0),
    rel: '0',
    modestbranding: '1',
    controls: '1',
    playsinline: '1',
    enablejsapi: '1',
    origin,
  })

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

export async function searchYoutubeVideos(searchTerm, maxResults = 6) {
  const term = String(searchTerm || '').trim()
  if (!term) return []

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q: term,
    order: 'relevance',
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    key: YOUTUBE_API_KEY,
  })

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`)
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || 'No se pudo buscar contenido en YouTube.')
  }

  const payload = await response.json()
  return (payload.items || []).map((item) => ({
    id: item.id?.videoId,
    title: item.snippet?.title || 'Sin título',
    description: item.snippet?.description || '',
    channelTitle: item.snippet?.channelTitle || 'YouTube',
    thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    publishedAt: item.snippet?.publishedAt || '',
  })).filter((item) => item.id)
}
