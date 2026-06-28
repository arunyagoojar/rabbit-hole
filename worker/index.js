const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8'
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, url)
    }

    return env.ASSETS.fetch(request)
  }
}

async function handleApiRequest(request, env, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  try {
    if (url.pathname.startsWith('/api/azure-foundry')) {
      return proxyAzureFoundry(request, env, url)
    }

    if (url.pathname.startsWith('/api/azure-openai')) {
      return proxyAzureOpenAI(request, env, url)
    }

    if (url.pathname.startsWith('/api/gemini')) {
      return proxyGemini(request, env, url)
    }

    if (url.pathname.startsWith('/api/pexels')) {
      return proxyPexels(request, env, url)
    }

    return jsonError('Unknown API route', 404)
  } catch (err) {
    console.error('API proxy error:', err)
    return jsonError(err?.message || 'API proxy failed', 500)
  }
}

async function proxyAzureFoundry(request, env, url) {
  const baseUrl = firstEnv(env, [
    'AZURE_FOUNDRY_BASE_URL',
    'VITE_AZURE_FOUNDRY_BASE_URL',
    'AZURE_OPENAI_BASE_URL',
    'VITE_AZURE_OPENAI_BASE_URL',
    'AZURE_FOUNDRY_PROJECT_ENDPOINT',
    'VITE_AZURE_FOUNDRY_PROJECT_ENDPOINT'
  ]) || request.headers.get('x-rh-azure-foundry-base-url') || request.headers.get('x-rh-azure-openai-base-url')
  const apiKey = firstEnv(env, ['AZURE_FOUNDRY_API_KEY', 'VITE_AZURE_FOUNDRY_API_KEY', 'AZURE_OPENAI_API_KEY', 'VITE_AZURE_OPENAI_API_KEY']) || getIncomingApiKey(request)
  const model = firstEnv(env, ['AZURE_FOUNDRY_MODEL', 'VITE_AZURE_FOUNDRY_MODEL', 'AZURE_OPENAI_DEPLOYMENT', 'VITE_AZURE_OPENAI_DEPLOYMENT']) || request.headers.get('x-rh-azure-foundry-model')

  if (!baseUrl || !apiKey) {
    return jsonError('Azure AI Foundry is not configured', 500)
  }

  const path = stripPrefix(url.pathname, '/api/azure-foundry') || '/chat/completions'
  const targetUrl = `${trimTrailingSlash(baseUrl)}${path}${url.search}`
  const headers = copyHeaders(request.headers)
  headers.delete('host')
  headers.delete('authorization')
  headers.delete('api-key')
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json')

  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.toLowerCase().startsWith('bearer')) {
    headers.set('Authorization', `Bearer ${apiKey}`)
  } else {
    headers.set('api-key', apiKey)
  }

  const init = {
    method: request.method,
    headers
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await buildJsonBodyWithModel(request, model)
  }

  return fetch(targetUrl, init)
}

async function proxyAzureOpenAI(request, env, url) {
  const baseUrl = firstEnv(env, ['AZURE_OPENAI_ENDPOINT', 'VITE_AZURE_OPENAI_ENDPOINT']) || request.headers.get('x-rh-azure-openai-endpoint')
  const apiKey = firstEnv(env, ['AZURE_OPENAI_API_KEY', 'VITE_AZURE_OPENAI_API_KEY']) || getIncomingApiKey(request)

  if (!baseUrl || !apiKey) {
    return jsonError('Azure OpenAI is not configured', 500)
  }

  const path = stripPrefix(url.pathname, '/api/azure-openai')
  const targetUrl = `${trimTrailingSlash(baseUrl)}${path}${url.search}`
  const headers = copyHeaders(request.headers)
  headers.delete('host')
  headers.delete('authorization')
  headers.delete('api-key')
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json')
  headers.set('api-key', apiKey)

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  })
}

async function proxyGemini(request, env, url) {
  const apiKey = firstEnv(env, ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'])
  if (!apiKey) {
    return jsonError('Gemini is not configured', 500)
  }

  const path = stripPrefix(url.pathname, '/api/gemini')
  const targetUrl = new URL(`https://generativelanguage.googleapis.com${path}`)
  url.searchParams.forEach((value, key) => {
    if (key !== 'key') targetUrl.searchParams.append(key, value)
  })
  targetUrl.searchParams.set('key', apiKey)

  const headers = copyHeaders(request.headers)
  headers.delete('host')

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  })
}

async function proxyPexels(request, env, url) {
  const apiKey = firstEnv(env, ['PEXELS_API_KEY', 'VITE_PEXELS_API_KEY']) || request.headers.get('authorization')
  if (!apiKey) {
    return jsonError('Pexels is not configured', 500)
  }

  const path = stripPrefix(url.pathname, '/api/pexels')
  const targetUrl = `https://api.pexels.com${path}${url.search}`
  const headers = copyHeaders(request.headers)
  headers.delete('host')
  headers.delete('authorization')
  headers.set('Authorization', apiKey)

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body
  })
}

async function buildJsonBodyWithModel(request, model) {
  const text = await request.text()
  if (!text) return text

  try {
    const body = JSON.parse(text)
    if (model && !body.model) {
      body.model = model
    }
    return JSON.stringify(body)
  } catch {
    return text
  }
}

function firstEnv(env, keys) {
  for (const key of keys) {
    const value = env[key]
    if (value) return value
  }
  return ''
}

function stripPrefix(pathname, prefix) {
  const stripped = pathname.slice(prefix.length)
  if (!stripped) return ''
  return stripped.startsWith('/') ? stripped : `/${stripped}`
}

function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '')
}

function copyHeaders(headers) {
  const copied = new Headers(headers)
  copied.delete('content-length')
  copied.delete('host')
  copied.delete('x-rh-azure-foundry-base-url')
  copied.delete('x-rh-azure-foundry-model')
  copied.delete('x-rh-azure-openai-base-url')
  copied.delete('x-rh-azure-openai-endpoint')
  return copied
}

function getIncomingApiKey(request) {
  const apiKey = request.headers.get('api-key')
  if (apiKey) return apiKey

  const authorization = request.headers.get('authorization') || ''
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return ''
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS
  })
}
