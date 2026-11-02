import test from 'node:test'
import assert from 'node:assert/strict'

import { buildYouTubeEmbedUrl, canPlayYouTube, getVehicleStateFromTelemetry, searchYoutubeVideos } from './youtubeService.js'

test('getVehicleStateFromTelemetry marks a stopped vehicle as safe to play', () => {
  const state = getVehicleStateFromTelemetry({ speedKmh: 0, parkBrakeEngaged: true })

  assert.equal(state.isMoving, false)
  assert.equal(state.status, 'STOPPED')
})

test('canPlayYouTube blocks playback when the vehicle is moving', () => {
  const allowed = canPlayYouTube({ speedKmh: 65, parkBrakeEngaged: false })

  assert.equal(allowed, false)
})

test('buildYouTubeEmbedUrl includes the required embed configuration', () => {
  const url = buildYouTubeEmbedUrl('abc123', { autoplay: true })

  assert.match(url, /youtube-nocookie.com\/embed\/abc123/)
  assert.match(url, /autoplay=1/)
  assert.match(url, /modestbranding=1/)
})

test('searchYoutubeVideos uses the provided API key and query parameters', async () => {
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        items: [
          { id: { videoId: 'video-1' }, snippet: { title: 'Demo', channelTitle: 'Channel', thumbnails: { medium: { url: 'https://example.com/thumb.jpg' } }, description: 'Demo description' } },
        ],
      }
    },
  })

  try {
    const results = await searchYoutubeVideos('car audio', 1)
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 'video-1')
  } finally {
    global.fetch = originalFetch
  }
})
