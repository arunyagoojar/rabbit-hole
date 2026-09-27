/**
 * Cloudflare Worker Gemini AI Service
 * Handles direct integration with Google Gemini 2.5 / 2.0 Flash with JSON schemas.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash'
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite']

export async function callGemini(env, messages, {
  temperature = 0.8,
  maxOutputTokens = 2048,
  responseSchema = null,
  userApiKey = null
} = {}) {
  const keysToTry = [
    userApiKey,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY,
    env.VITE_GEMINI_API_KEY,
    env.GEMINI_API_KEY_SECONDARY
  ].filter((key, idx, arr) => Boolean(key) && arr.indexOf(key) === idx)

  if (keysToTry.length === 0) {
    throw new Error('Gemini API key is not configured. Please add your Google AI Studio API key.')
  }

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))

  const generationConfig = {
    temperature,
    maxOutputTokens
  }

  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseSchema = responseSchema
  }

  const body = {
    contents,
    generationConfig
  }

  const modelsToTry = [DEFAULT_MODEL, ...FALLBACK_MODELS]
  let lastError = null

  for (const apiKey of keysToTry) {
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.warn(`Gemini model ${model} failed (${response.status}):`, errorText)
          lastError = new Error(`Gemini ${model} error (${response.status}): ${errorText}`)
          continue
        }

        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) {
          throw new Error(`Empty content returned from Gemini model ${model}`)
        }
        return text
      } catch (err) {
        console.warn(`Attempt with ${model} failed:`, err?.message || err)
        lastError = err
      }
    }
  }

  throw lastError || new Error('All Gemini candidate models failed')
}

export function starterResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      hook: {
        type: 'STRING'
      },
      pages: {
        type: 'ARRAY',
        items: { type: 'STRING' }
      },
      prompts: {
        type: 'ARRAY',
        items: { type: 'STRING' }
      }
    },
    required: ['pages', 'prompts']
  }
}

export function topicsResponseSchema() {
  return {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        category: { type: 'STRING' },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        imageTags: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        }
      },
      required: ['title', 'description', 'category', 'tags']
    }
  }
}
