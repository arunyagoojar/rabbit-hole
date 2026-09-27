import { Hono } from 'hono'
import { optionalAuth } from '../middleware/auth'
import { recordUsage } from '../services/usage'

export const mediaRoutes = new Hono()

// Gemini 3.8 Text-to-Speech models with gemini-3.8-flash-lite-tts prioritized
const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts'
]

// Convert 16-bit 24kHz Mono Linear PCM to standard RIFF WAV format
function pcmToWav(pcmData, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmData.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')

  // fmt subchunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM = 1
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data subchunk
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const uint8 = new Uint8Array(buffer)
  uint8.set(pcmData, 44)
  return uint8
}

function base64ToUint8Array(base64) {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function uint8ArrayToBase64(bytes) {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

/**
 * Handler for GET /api/v1/media/audio
 * Supports query parameter (?key=...), wildcard paths (/audio/...), and HTTP Range requests (206)
 */
async function handleAudioRequest(c) {
  let key = c.req.query('key')
  if (!key) {
    const rawPath = c.req.path
    key = rawPath.replace(/^.*\/media\/audio\/?/, '')
    if (key) {
      key = decodeURIComponent(key)
    }
  }

  if (!key) {
    return c.json({ error: 'Audio key is required' }, 400)
  }

  const bucket = c.env.MEDIA_BUCKET
  if (!bucket) {
    return c.json({ error: 'R2 MEDIA_BUCKET binding is not configured' }, 500)
  }

  const rangeHeader = c.req.header('range')
  let object = null
  try {
    if (rangeHeader) {
      object = await bucket.get(key, {
        range: c.req.raw.headers,
        onlyIf: c.req.raw.headers,
      })
    } else {
      object = await bucket.get(key)
    }
  } catch (err) {
    console.warn('Range fetch fallback:', err?.message)
    object = await bucket.get(key).catch(() => null)
  }

  if (!object) {
    return c.json({ error: 'Audio file not found' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('Accept-Ranges', 'bytes')

  const contentType = headers.get('Content-Type') || (key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg')
  headers.set('Content-Type', contentType)

  const status = object.range ? 206 : 200
  return new Response(object.body, { headers, status })
}

mediaRoutes.get('/audio/*', handleAudioRequest)
mediaRoutes.get('/audio', handleAudioRequest)

/**
 * POST /api/v1/media/narrate
 * Generate TTS audio using Gemini 3.8 Fast & Ultra Fast TTS models and cache in Cloudflare R2
 */
mediaRoutes.post('/narrate', optionalAuth(), async (c) => {
  const { text, topicId, cardIndex = 0, voiceName = 'Aoede', speed = 'fast' } = await c.req.json()

  if (!text || typeof text !== 'string') {
    return c.json({ error: 'text is required for narration' }, 400)
  }

  const user = c.get('user')
  const bucket = c.env.MEDIA_BUCKET
  const db = c.env.DB

  const incomingUserKey = c.req.header('x-gemini-api-key')
  let userApiKey = incomingUserKey && incomingUserKey.trim().length > 10 ? incomingUserKey.trim() : null
  if (!userApiKey && user?.uid && db) {
    try {
      const userRow = await db.prepare('SELECT gemini_api_key FROM users WHERE id = ?').bind(user.uid).first()
      if (userRow?.gemini_api_key) userApiKey = userRow.gemini_api_key
    } catch {}
  }

  const keysToTry = [
    userApiKey,
    c.env.GEMINI_API_KEY_PRIMARY,
    c.env.GEMINI_API_KEY,
    c.env.VITE_GEMINI_API_KEY,
    c.env.GEMINI_API_KEY_SECONDARY
  ].filter((key, idx, arr) => Boolean(key) && arr.indexOf(key) === idx)

  if (keysToTry.length === 0) {
    return c.json({ error: 'Gemini API key is required for voice narration. Please add your key in onboarding or settings.' }, 400)
  }

  const cleanText = text.replace(/<[^>]*>/g, '').trim().slice(0, 3000)
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanText))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20)
  const isUltraFast = speed === 'ultra-fast' || speed === 'ultrafast'
  const speedTag = isUltraFast ? 'ultrafast' : 'fast'
  const r2Key = `narration/${topicId || 'generic'}/${cardIndex}-${speedTag}-${hashHex}.wav`
  const audioEndpoint = `/api/v1/media/audio?key=${encodeURIComponent(r2Key)}`

  // 1. Check if already cached in Cloudflare R2
  if (bucket) {
    try {
      const existing = await bucket.get(r2Key)
      if (existing) {
        const arrayBuf = await existing.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuf)
        return c.json({
          audioUrl: audioEndpoint,
          audioBase64: uint8ArrayToBase64(uint8),
          cached: true
        })
      }
    } catch (e) {
      console.warn('R2 bucket check warning:', e?.message)
    }
  }

  // 2. Synthesize audio via Gemini TTS models (Fast & reliable models)
  let audioBase64 = null
  let audioMime = null
  let lastError = null

  const modelsToTry = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-flash'
  ]

  // Ensure voice is one of Gemini's prebuilt voices: Aoede, Puck, Charon, Kore, Fenrir
  const validVoices = ['Aoede', 'Puck', 'Charon', 'Kore', 'Fenrir']
  const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Aoede'

  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: cleanText }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: selectedVoice
          }
        }
      }
    }
  }

  for (const apiKey of keysToTry) {
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(geminiPayload)
        })

        if (!response.ok) {
          const errText = await response.text()
          console.warn(`Gemini TTS model ${model} returned ${response.status}:`, errText)
          lastError = new Error(`Gemini TTS ${model} error (${response.status}): ${errText}`)
          continue
        }

        const data = await response.json()
        const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData
        if (inlineData?.data) {
          audioBase64 = inlineData.data
          audioMime = inlineData.mimeType || 'audio/wav'
          break
        }
      } catch (err) {
        console.warn(`Gemini TTS attempt with ${model} failed:`, err?.message || err)
        lastError = err
      }
    }
    if (audioBase64) break
  }

  if (!audioBase64) {
    const isQuota = Boolean(
      lastError?.message && (
        lastError.message.includes('429') ||
        lastError.message.includes('RESOURCE_EXHAUSTED') ||
        lastError.message.includes('quota') ||
        lastError.message.includes('rate-limit')
      )
    )
    return c.json({
      error: isQuota ? 'quota_exceeded' : 'Narration generation failed',
      detail: lastError?.message || 'TTS generation unavailable',
      isQuota
    }, isQuota ? 429 : 502)
  }

  try {
    // 3. Format audio (use direct WAV from Gemini 3.8 or wrap PCM in WAV)
    const rawBytes = base64ToUint8Array(audioBase64)
    const wavBytes = (audioMime && audioMime.toLowerCase().includes('wav'))
      ? rawBytes
      : pcmToWav(rawBytes, 24000, 1, 16)

    const finalBase64 = uint8ArrayToBase64(wavBytes)

    // 4. Save into Cloudflare R2
    if (bucket) {
      await bucket.put(r2Key, wavBytes, {
        httpMetadata: { contentType: 'audio/wav' }
      })
    }

    // 5. Cache entry in D1 if available
    if (db) {
      await db.prepare(`
        INSERT OR REPLACE INTO media_cache (id, type, r2_key, source_url, content_type, created_at)
        VALUES (?, 'audio', ?, ?, 'audio/wav', ?)
      `).bind(r2Key, r2Key, null, Date.now()).run().catch(console.error)
    }

    // Record usage for TTS characters
    const user = c.get('user')
    await recordUsage(db, user, 'tts_narrate', cleanText.length)

    return c.json({
      audioUrl: audioEndpoint,
      audioBase64: finalBase64,
      cached: false
    })
  } catch (err) {
    console.error('Audio processing or R2 save error:', err)
    return c.json({ error: 'Failed to process audio', message: err?.message, fallbackToClientSpeech: true }, 500)
  }
})

/**
 * GET /api/v1/media/image-proxy
 * Caches and serves images via R2 edge storage
 */
mediaRoutes.get('/image-proxy', async (c) => {
  const imageUrl = c.req.query('url')
  if (!imageUrl) {
    return c.json({ error: 'url parameter is required' }, 400)
  }

  const bucket = c.env.MEDIA_BUCKET

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(imageUrl))
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
  const r2Key = `images/${hashHex}.jpg`

  if (bucket) {
    const existing = await bucket.get(r2Key)
    if (existing) {
      const headers = new Headers()
      existing.writeHttpMetadata(headers)
      headers.set('Cache-Control', 'public, max-age=604800, immutable')
      headers.set('Content-Type', headers.get('Content-Type') || 'image/jpeg')
      return new Response(existing.body, { headers })
    }
  }

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'RabbitHole/1.0' }
    })

    if (!upstreamRes.ok) {
      return new Response('Failed to fetch image', { status: upstreamRes.status })
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await upstreamRes.arrayBuffer()

    if (bucket) {
      await bucket.put(r2Key, arrayBuffer, {
        httpMetadata: { contentType }
      }).catch(console.error)
    }

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable'
      }
    })
  } catch (err) {
    return c.json({ error: 'Proxy fetch failed', message: err?.message }, 500)
  }
})

/**
 * GET /api/v1/media/svg-icon
 * Resolves, caches to R2, and serves vector SVGs from Iconify
 * Pipeline: Topic/Category -> Mapping -> Iconify fetch -> R2 Cache -> Client SVG
 */
mediaRoutes.get('/svg-icon', async (c) => {
  const term = c.req.query('term') || 'abstract'
  const icon = c.req.query('icon')
  const prefix = c.req.query('prefix') || 'tabler'
  const color = c.req.query('color') || 'currentColor'

  const safeKey = `${prefix}-${(icon || term).toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
  const r2Key = `svgs/${safeKey}.svg`
  const bucket = c.env.MEDIA_BUCKET

  // 1. Check R2 cache
  if (bucket) {
    try {
      const cached = await bucket.get(r2Key)
      if (cached) {
        const headers = new Headers()
        headers.set('Content-Type', 'image/svg+xml; charset=utf-8')
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')
        headers.set('Access-Control-Allow-Origin', '*')
        return new Response(cached.body, { headers })
      }
    } catch (e) {
      console.warn('R2 SVG cache lookup warning:', e?.message)
    }
  }

  // 2. Fetch from Iconify
  let svgText = null

  if (icon) {
    try {
      const iconUrl = `https://api.iconify.design/${prefix}/${icon}.svg?color=${encodeURIComponent(color)}`
      const iconRes = await fetch(iconUrl)
      if (iconRes.ok) {
        svgText = await iconRes.text()
      }
    } catch {}
  }

  if (!svgText && term) {
    try {
      const searchUrl = `https://api.iconify.design/search?query=${encodeURIComponent(term)}&limit=1`
      const searchRes = await fetch(searchUrl)
      if (searchRes.ok) {
        const data = await searchRes.json()
        const iconName = data?.icons?.[0]
        if (iconName) {
          const parts = iconName.split(':')
          const p = parts.length > 1 ? parts[0] : prefix
          const n = parts.length > 1 ? parts[1] : parts[0]
          const directRes = await fetch(`https://api.iconify.design/${p}/${n}.svg?color=${encodeURIComponent(color)}`)
          if (directRes.ok) {
            svgText = await directRes.text()
          }
        }
      }
    } catch {}
  }

  if (!svgText) {
    // Fallback architectural geometry SVG
    svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="36" stroke-dasharray="3 3"/><line x1="50" y1="10" x2="50" y2="90"/><line x1="10" y1="50" x2="90" y2="50"/><circle cx="50" cy="50" r="14"/></svg>`
  }

  // 3. Cache to R2
  if (bucket && svgText) {
    try {
      await bucket.put(r2Key, svgText, {
        httpMetadata: { contentType: 'image/svg+xml; charset=utf-8' }
      })
    } catch (e) {
      console.warn('R2 SVG cache save warning:', e?.message)
    }
  }

  const headers = new Headers()
  headers.set('Content-Type', 'image/svg+xml; charset=utf-8')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(svgText, { headers })
})
