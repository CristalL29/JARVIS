const TOKEN_STORAGE_KEY = 'jarvis-spotify-session'
const VERIFIER_STORAGE_KEY = 'jarvis-spotify-verifier'
const STATE_STORAGE_KEY = 'jarvis-spotify-state'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

function createRandomString(length) {
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function readResponse(response) {
  if (response.ok) return response.json()
  let detail = ''
  try {
    const body = await response.json()
    detail = body.error_description || body.error?.message || body.error || ''
  } catch {
    detail = ''
  }
  throw new Error(typeof detail === 'string' && detail ? detail : `Spotify respondió con el estado ${response.status}.`)
}

function saveToken(token) {
  const session = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session))
  return session
}

export async function beginSpotifyAuthorization(clientId, redirectUri) {
  const verifier = createRandomString(64)
  const state = createRandomString(24)
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier)
  sessionStorage.setItem(STATE_STORAGE_KEY, state)

  const authorizeUrl = new URL('https://accounts.spotify.com/authorize')
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: await createCodeChallenge(verifier),
    state,
    scope: [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-modify-playback-state',
      'user-read-playback-state',
      'user-read-currently-playing',
    ].join(' '),
  }).toString()
  window.location.assign(authorizeUrl)
}

export async function completeSpotifyAuthorization(searchParams, clientId, redirectUri) {
  const authorizationError = searchParams.get('error')
  if (authorizationError) {
    const state = searchParams.get('state')
    const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY)
    sessionStorage.removeItem(STATE_STORAGE_KEY)
    sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
    if (!state || !expectedState || state !== expectedState) {
      throw new Error('No se pudo validar la respuesta de Spotify. Vuelve a conectar tu cuenta.')
    }
    throw new Error(authorizationError === 'access_denied'
      ? 'Se canceló la autorización de Spotify.'
      : `Spotify no autorizó la conexión: ${authorizationError}`)
  }

  const code = searchParams.get('code')
  if (!code) return null

  const state = searchParams.get('state')
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY)
  sessionStorage.removeItem(STATE_STORAGE_KEY)
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
  if (!state || !expectedState || state !== expectedState || !verifier) {
    throw new Error('No se pudo validar la respuesta de Spotify. Vuelve a conectar tu cuenta.')
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })
  return saveToken(await readResponse(response))
}

export async function getSpotifyAccessToken(clientId) {
  const storedSession = sessionStorage.getItem(TOKEN_STORAGE_KEY)
  if (!storedSession) throw new Error('Conecta tu cuenta de Spotify para continuar.')

  let session
  try {
    session = JSON.parse(storedSession)
  } catch {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    throw new Error('La sesión de Spotify no es válida. Vuelve a conectar tu cuenta.')
  }
  if (session.accessToken && session.expiresAt > Date.now() + 60_000) return session.accessToken
  if (!session.refreshToken) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    throw new Error('La sesión de Spotify venció. Vuelve a conectar tu cuenta.')
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  })
  const token = await readResponse(response)
  return saveToken({ ...token, refresh_token: token.refresh_token || session.refreshToken }).accessToken
}

export function clearSpotifySession() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
  sessionStorage.removeItem(STATE_STORAGE_KEY)
}
