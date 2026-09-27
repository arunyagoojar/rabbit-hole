import { createRemoteJWKSet, jwtVerify } from 'jose'

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const JWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))

const DEFAULT_PROJECT_ID = 'rabbit-hole-944d3'

export async function verifyFirebaseToken(token, projectId = DEFAULT_PROJECT_ID) {
  const issuer = `https://securetoken.google.com/${projectId}`
  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience: projectId
  })
  return payload
}

/**
 * Hono auth middleware: Requires a valid Firebase JWT in Authorization header
 */
export function requireAuth() {
  return async (c, next) => {
    const authHeader = c.req.header('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7).trim()
    if (!token) {
      return c.json({ error: 'Unauthorized: Token is empty' }, 401)
    }

    const projectId = c.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID

    try {
      const payload = await verifyFirebaseToken(token, projectId)
      c.set('user', {
        uid: payload.sub,
        email: payload.email || '',
        name: payload.name || '',
        picture: payload.picture || ''
      })
      await next()
    } catch (err) {
      console.error('Firebase token verification error:', err?.message || err)
      return c.json({ error: 'Unauthorized: Invalid token', detail: err?.message }, 401)
    }
  }
}

/**
 * Hono optional auth middleware: Parses Firebase JWT if present, otherwise continues as guest
 */
export function optionalAuth() {
  return async (c, next) => {
    const authHeader = c.req.header('authorization') || ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim()
      if (token) {
        const projectId = c.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID
        try {
          const payload = await verifyFirebaseToken(token, projectId)
          c.set('user', {
            uid: payload.sub,
            email: payload.email || '',
            name: payload.name || '',
            picture: payload.picture || ''
          })
        } catch {
          c.set('user', null)
        }
      } else {
        c.set('user', null)
      }
    } else {
      c.set('user', null)
    }
    await next()
  }
}
