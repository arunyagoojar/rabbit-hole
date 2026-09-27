import { INTERESTS } from '../data/interests.js'
import { apiClient } from './apiClient.js'

/**
 * aiService.js - AI provider client for Rabbit Hole.
 * Supports Azure AI Foundry, classic Azure OpenAI, and Gemini as a fallback.
 */

const MODEL_CANDIDATES = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest']
const GEMINI_API_BASE = '/api/gemini'
const AZURE_OPENAI_API_VERSION = import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-10-21'
const AZURE_OPENAI_BASE = '/api/azure-openai'
const AZURE_FOUNDRY_BASE = '/api/azure-foundry'
const AI_PROVIDER = normalizeProvider(
  import.meta.env.VITE_AI_PROVIDER || getDefaultProvider()
)
const APP_INTEREST_NAMES = INTERESTS.map(interest => interest.name)

function getGeminiApiKeys() {
  return [
    import.meta.env.VITE_GEMINI_API_KEY_PRIMARY,
    import.meta.env.VITE_GEMINI_API_KEY,
    import.meta.env.VITE_GEMINI_API_KEY_SECONDARY
  ].filter((key, idx, arr) => Boolean(key) && arr.indexOf(key) === idx)
}

function getGeminiApiKey() {
  return getGeminiApiKeys()[0] || ''
}

function getAzureApiKey() {
  return import.meta.env.VITE_AZURE_OPENAI_API_KEY || ''
}

function getAzureDeployment() {
  return import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || ''
}

function getAzureFoundryBaseUrl() {
  return import.meta.env.VITE_AZURE_FOUNDRY_BASE_URL || import.meta.env.VITE_AZURE_OPENAI_BASE_URL || import.meta.env.VITE_AZURE_FOUNDRY_PROJECT_ENDPOINT || ''
}

function getAzureFoundryApiKey() {
  return import.meta.env.VITE_AZURE_FOUNDRY_API_KEY || import.meta.env.VITE_AZURE_OPENAI_API_KEY || ''
}

function getAzureFoundryModel() {
  return import.meta.env.VITE_AZURE_FOUNDRY_MODEL || import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || ''
}

function hasAzureConfig() {
  if (!import.meta.env.DEV) return true

  return Boolean(
    import.meta.env.VITE_AZURE_OPENAI_ENDPOINT &&
    import.meta.env.VITE_AZURE_OPENAI_API_KEY &&
    import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT
  )
}

function hasAzureFoundryConfig() {
  if (!import.meta.env.DEV) return true

  return Boolean(
    getAzureFoundryBaseUrl() &&
    getAzureFoundryApiKey() &&
    getAzureFoundryModel()
  )
}

/**
 * Raw chat completion call through the configured AI provider.
 */
async function chatCompletion(messages, { temperature = 0.7, maxTokens, responseSchema } = {}) {
  if (AI_PROVIDER === 'azure-foundry') {
    if (!hasAzureFoundryConfig()) {
      throw new Error('Azure AI Foundry is selected but base URL, API key, or deployment is missing')
    }
    return azureFoundryChatCompletion(messages, { temperature, maxTokens, responseSchema })
  }

  if (AI_PROVIDER === 'azure') {
    if (!hasAzureConfig()) {
      throw new Error('Azure OpenAI is selected but its endpoint, API key, or deployment is missing')
    }
    return azureChatCompletion(messages, { temperature, maxTokens, responseSchema })
  }

  return geminiChatCompletion(messages, { temperature, maxTokens, responseSchema })
}

async function geminiChatCompletion(messages, { temperature = 0.7, maxTokens, responseSchema } = {}) {
  const keys = getGeminiApiKeys()
  if (keys.length === 0 && import.meta.env.DEV) {
    throw new Error('VITE_GEMINI_API_KEY is not set')
  }

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))

  const body = {
    contents,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json'
    }
  }
  if (maxTokens) body.generationConfig.maxOutputTokens = maxTokens
  if (responseSchema) body.generationConfig.responseSchema = responseSchema

  let lastError = null

  for (const key of keys) {
    for (const model of MODEL_CANDIDATES) {
      const keyParam = key ? `?key=${encodeURIComponent(key)}` : ''
      const targetUrl = `${GEMINI_API_BASE}/v1beta/models/${model}:generateContent${keyParam}`
      let res
      try {
        res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        })
      } catch (err) {
        lastError = err
        continue
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        lastError = new Error(`Gemini API error ${res.status}: ${errText}`)
        continue
      }

      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }
  }

  throw lastError || new Error('Gemini API request failed')
}

async function azureChatCompletion(messages, { temperature = 0.7, maxTokens, responseSchema } = {}) {
  const key = getAzureApiKey()
  const deployment = getAzureDeployment()
  const targetUrl = `${AZURE_OPENAI_BASE}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(AZURE_OPENAI_API_VERSION)}`
  const body = {
    messages: messages.map(msg => ({
      role: normalizeAzureRole(msg.role),
      content: msg.content
    })),
    temperature,
    response_format: responseSchema
      ? { type: 'json_object' }
      : undefined
  }

  if (maxTokens) body.max_tokens = maxTokens

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rh-azure-openai-endpoint': import.meta.env.VITE_AZURE_OPENAI_ENDPOINT || '',
      'api-key': key
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Azure OpenAI API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function azureFoundryChatCompletion(messages, { temperature = 0.7, maxTokens, responseSchema } = {}) {
  const key = getAzureFoundryApiKey()
  const model = getAzureFoundryModel()
  const targetUrl = `${AZURE_FOUNDRY_BASE}/chat/completions`
  const body = {
    messages: messages.map(msg => ({
      role: normalizeAzureRole(msg.role),
      content: msg.content
    })),
    model,
    temperature,
    response_format: responseSchema
      ? { type: 'json_object' }
      : undefined
  }

  if (maxTokens) body.max_tokens = maxTokens

  const first = await requestAzureFoundry(targetUrl, key, body, 'api-key')
  if (first.ok) {
    const data = await first.json()
    return data.choices?.[0]?.message?.content || ''
  }

  const firstText = await first.text().catch(() => first.statusText)
  const shouldRetryWithBearer = first.status === 401 || first.status === 403
  const shouldRetryWithoutJsonMode = first.status === 400 && responseSchema

  if (shouldRetryWithBearer) {
    const bearer = await requestAzureFoundry(targetUrl, key, body, 'bearer')
    if (bearer.ok) {
      const data = await bearer.json()
      return data.choices?.[0]?.message?.content || ''
    }
    const bearerText = await bearer.text().catch(() => bearer.statusText)
    throw new Error(`Azure AI Foundry API error ${bearer.status}: ${bearerText}`)
  }

  if (shouldRetryWithoutJsonMode) {
    const fallbackBody = { ...body }
    delete fallbackBody.response_format
    const fallback = await requestAzureFoundry(targetUrl, key, fallbackBody, 'api-key')
    if (fallback.ok) {
      const data = await fallback.json()
      return data.choices?.[0]?.message?.content || ''
    }
    const fallbackText = await fallback.text().catch(() => fallback.statusText)
    throw new Error(`Azure AI Foundry API error ${fallback.status}: ${fallbackText}`)
  }

  throw new Error(`Azure AI Foundry API error ${first.status}: ${firstText}`)
}

function requestAzureFoundry(targetUrl, key, body, authMode) {
  const headers = {
    'Content-Type': 'application/json',
    'x-rh-azure-foundry-base-url': getAzureFoundryBaseUrl(),
    'x-rh-azure-foundry-model': getAzureFoundryModel()
  }

  if (authMode === 'bearer') {
    headers.Authorization = `Bearer ${key}`
  } else {
    headers['api-key'] = key
  }

  return fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
}

function normalizeAzureRole(role) {
  if (role === 'model' || role === 'assistant') return 'assistant'
  if (role === 'system') return 'system'
  return 'user'
}

function normalizeProvider(provider) {
  const value = String(provider || '').toLowerCase().replace(/_/g, '-')
  if (value === 'azure-foundry' || value === 'foundry') return 'azure-foundry'
  if (value === 'azure-openai' || value === 'azure') return 'azure'
  return 'gemini'
}

function getDefaultProvider() {
  if (!import.meta.env.DEV) return 'azure-foundry'
  if (hasAzureFoundryConfig()) return 'azure-foundry'
  if (hasAzureConfig()) return 'azure'
  return 'gemini'
}

function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '')
}

function parseJSONArray(raw) {
  const cleaned = extractJSON(raw, '[', ']')
  return JSON.parse(cleaned)
}

function parseJSONObject(raw) {
  const cleaned = extractJSON(raw, '{', '}')
  return JSON.parse(cleaned)
}

function extractJSON(raw, startChar, endChar) {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const start = cleaned.indexOf(startChar)
  const end = cleaned.lastIndexOf(endChar)
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not include valid JSON')
  }

  return cleaned.slice(start, end + 1)
}

function normalizeTags(tags, fallbackCategory) {
  const values = Array.isArray(tags) ? tags : [fallbackCategory]
  return values
    .filter(Boolean)
    .map(tag => String(tag).trim())
    .filter(Boolean)
    .slice(0, 4)
}

/**
 * Generate the first article card and three branching question choices.
 * Returns { pages: string[], prompts: string[] } where pages is an array
 * of paragraph groups that each fit comfortably on one card screen.
 */
export async function generateTopicStarter(topic) {
  try {
    const res = await apiClient.generateStarter(topic)
    if (res && Array.isArray(res.pages) && res.pages.length > 0) {
      return res
    }
  } catch (backendErr) {
    console.warn('Worker AI starter failed, trying fallback:', backendErr?.message)
  }

  const prompt = `You are the chief editorial writer for Rabbit Hole, an editorial curiosity application designed for intelligent, curious minds.

Your writing is NOT an encyclopedia, NOT a textbook, and NOT a generic summary.
The reader should feel like they just discovered something fascinating and are being taken deeper into the rabbit hole.

STRUCTURE YOUR CONTENT IN THIS EXACT PROGRESSION:

1. THE HOOK (Page 1, Paragraph 1):
Begin with something immediately relatable, visual, surprising, or intellectually provocative. Create an instant spark.
Example style:
"You are sitting in a car. A pedestrian suddenly steps onto the road. You know what is happening almost instantly — you see where they are looking, judge their speed, and predict whether they'll cross. A machine has to do something similar, except it has to turn the entire living street into mathematics."
Never start with a definition ("X is a technology that..."), never repeat the title, and never start with abstract history.

2. SIMPLE EXPLANATION (Page 1, Paragraph 2):
Explain the core intuitive concept using a clear analogy or concrete physical situation that an intelligent non-expert grasps effortlessly.

3. DEEPER EXPLANATION (Page 2, Paragraph 1):
Gradually introduce the actual mechanism — how it actually functions underneath.

4. THE "WAIT, HOW?" MOMENT (Page 2, Paragraph 2):
Introduce the counter-intuitive twist or problem that naturally makes the reader stop and wonder: "Wait, how does that actually work?"

5. DEEPER DETAIL (Page 3):
Explain that layer with vivid clarity without becoming academic or dense. End with a sense that they are standing at the edge of an even deeper mystery.

WRITING RULES (CRITICAL FOR BOTH READING & AUDIO NARRATION):
- Write for BOTH the eye and the ear. Sentences must sound effortless and natural when spoken aloud.
- Paragraphs must be short and crisp (2 to 4 sentences each).
- Absolutely NO bullet points, NO numbered lists, NO asterisks, NO markdown headers.
- Absolutely NO dashes or hyphens at the start of sentences.
- NEVER repeat or recite the topic title, subtitle, category, reading time, or metadata.
- NEVER use generic filler words: "fascinating", "intriguing", "remarkable", "delve into", "dive into", "in conclusion", "it's worth noting", "unpacking", "testament to", "realm of".
- Total length: 240 to 340 words across 3 natural pages/sections.

RABBIT-HOLE QUESTIONS RULES:
- Exactly 3 clickable follow-up questions (under 12 words each).
- They must emerge naturally from what the reader just learned.
- They must provoke intense curiosity (e.g. "What happens when two sensors completely disagree?").

Return a JSON object with:
- "hook": the crisp opening hook paragraph (50-80 words).
- "pages": an array of 3 strings (each string is 1 reading section of 1-2 paragraphs separated by a blank line).
- "prompts": array of 3 distinct rabbit-hole questions.

Topic: "${topic?.title}" (${topic?.category || topic?.tags?.[0] || 'General'})
Context: ${topic?.description || 'No description provided.'}`

  let raw
  try {
    raw = await chatCompletion([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.85,
      maxTokens: 1800,
      responseSchema: starterSchema()
    })
  } catch (apiError) {
    throw new Error(`Failed to generate starter: ${apiError.message}`)
  }

  try {
    const parsed = parseJSONObject(raw)
    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts : []
    const pages = extractPages(parsed)
    if (pages.length === 0 || prompts.length < 3) {
      throw new Error('Starter response was missing content or prompts')
    }
    const cleanPages = pages.map(cleanDashes)
    const hook = parsed.hook || (cleanPages[0] ? cleanPages[0].split(/\n{2,}/)[0] : '')
    return {
      hook,
      pages: cleanPages,
      prompts: prompts.filter(Boolean).slice(0, 3)
    }
  } catch (err) {
    console.error('Failed to parse starter response:', raw)
    throw err
  }
}

/**
 * Generate one new branch card from the user's selected question.
 * Returns { pages: string[], prompts: string[] }.
 */
export async function generateRabbitHoleStep(topic, prompt, previousCards = []) {
  try {
    const res = await apiClient.generateStep(topic, prompt, previousCards)
    if (res && Array.isArray(res.pages) && res.pages.length > 0) {
      return res
    }
  } catch (backendErr) {
    console.warn('Worker AI step failed, trying fallback:', backendErr?.message)
  }

  const category = topic?.category || topic?.tags?.[0] || 'General'
  const depth = previousCards.length + 1
  const context = previousCards
    .slice(-4)
    .map((card, index) => {
      const body = card.body || (card.pages || []).join(' ')
      return `${index + 1}. ${card.heading || 'Intro card'}: ${String(body).slice(0, 700)}`
    })
    .join('\n\n')

  const fullPrompt = `You are the content engine for Rabbit Hole, a learning app where users read through cards on a topic and go progressively deeper with every card.

You are writing a follow-up card.

Main topic: "${topic?.title}" (${category})
User chose this direction: "${prompt}"
How many cards deep the user already is: ${Math.max(depth - 1, 1)}

Previous card context:
${context || 'No previous context available.'}

Return a JSON object with:
- "pages": an array of strings. Each string is one page of content (1-2 paragraphs per page, roughly 80-120 words per page). Split the content so each page is comfortable to read on a single mobile screen without scrolling. Use 2-4 pages total.
- "prompts": exactly 3 new clickable follow-up questions.

IMPORTANT: Separate paragraphs within each page using a blank line (two newlines). Do NOT use any special separator between pages — the array structure handles that.

FOLLOW-UP CARD RULES:
The user has chosen a specific direction to go deeper. Write only about that direction. Do not summarise what came before. Do not repeat anything. Pick up exactly where the curiosity leads and go deeper into it.

Build on what the user already knows from previous cards. Never introduce a term or concept that hasn't appeared in a previous card without immediately defining it in the same sentence.

Start directly with the answer. Do not begin with phrases like "The question...", "This question...", "To answer...", "You asked...", or repeat the selected question.

End with something unresolved, a tension, a name dropped without explanation, or a question that makes the next choice feel urgent.

RULES FOR THE CONTENT:
- Total length across all pages: 250 to 350 words.
- ONLY flowing prose paragraphs. Absolutely NO bullet points, NO numbered lists, NO dashes at the start of lines, NO em-dashes used as list markers, NO hyphens used to introduce items.
- Do not write a title or heading. The title is handled separately.
- Do not use section breaks, dividers, or horizontal rules of any kind.
- Do not start any sentence with a dash, hyphen, or bullet character.
- Write in second person where natural.
- Vary sentence length deliberately. Mix short punchy sentences with longer flowing ones.
- Every fact must be accurate. If uncertain, write around it or omit it.
- Never use these words or phrases: "fascinating", "intriguing", "remarkable", "delve into", "dive into", "it's worth noting", "in conclusion", "let's explore", "unpacking", "demystifying", "captivating", "in the realm of".
- Write like a longform journalist who loves this topic deeply.

RULES FOR PROMPTS:
- Each prompt should be a natural question, max 13 words.
- The prompts should go deeper, sideways, or into consequences.`

  let raw
  try {
    raw = await chatCompletion([
      { role: 'user', content: fullPrompt }
    ], {
      temperature: 0.82,
      maxTokens: 1800,
      responseSchema: starterSchema()
    })
  } catch (apiError) {
    throw new Error(`Failed to generate branch card: ${apiError.message}`)
  }

  try {
    const parsed = parseJSONObject(raw)
    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts : []
    const pages = extractPages(parsed)
    if (pages.length === 0 || prompts.length < 3) {
      throw new Error('Branch response was missing content or prompts')
    }
    return {
      pages: pages.map(cleanDashes),
      prompts: prompts.filter(Boolean).slice(0, 3)
    }
  } catch (err) {
    console.error('Failed to parse branch card response:', raw)
    throw err
  }
}

/**
 * Generate a lightweight topic list from selected interests.
 * Keep this intentionally small: the long intro card is generated when
 * the user opens a topic, which avoids fragile oversized Gemini responses.
 */
export async function generateInterestTopics(interests = [], count = 20, options = {}) {
  try {
    const res = await apiClient.generateExploreTopics(interests, count)
    if (res && Array.isArray(res.topics) && res.topics.length > 0) {
      apiClient.saveTopics(res.topics).catch(console.error)
      return res.topics
    }
  } catch (backendErr) {
    console.warn('Worker AI explore topics failed, trying fallback:', backendErr?.message)
  }

  const topics = []
  const seenTitles = new Set()
  const batchSize = 5
  let attempts = 0
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null

  while (topics.length < count && attempts < 8) {
    attempts += 1
    const needed = Math.min(batchSize, count - topics.length)
    const batch = await generateInterestTopicBatch(interests, needed, topics.map(topic => topic.title))
    const previousCount = topics.length

    batch.forEach(topic => {
      const key = topic.title.toLowerCase()
      if (!seenTitles.has(key)) {
        seenTitles.add(key)
        topics.push(topic)
      }
    })

    if (onProgress && topics.length > previousCount) {
      onProgress(topics.slice(0, count), { count, attempts })
    }
  }

  if (topics.length === 0) {
    throw new Error('Gemini returned no usable topics')
  }

  return topics.slice(0, count)
}

async function generateInterestTopicBatch(interests, count, existingTitles) {
  const selectedList = interests.length > 0 ? interests.join(', ') : 'none selected yet'
  const categoryList = APP_INTEREST_NAMES.join(', ')
  const prompt = `You are the topic engine for Rabbit Hole, a learning app where users open curiosity questions and then read deeper AI-generated cards.

Generate exactly ${count} unique topic ideas that make someone stop scrolling and think "I need to know this."

Rules:
- Each topic needs: title, description, category, tags, imageTags
- title: a crisp clickable question, max 12 words
- description: a rich 55-90 word hook that explains why this is interesting without giving away the whole answer
- category: choose exactly one label from the provided interest list
- tags: 2-4 labels chosen exactly from the provided interest list
- imageTags: 3-5 specific visual search phrases for a background image; include concrete objects, scenes, or environments
- Titles should sound like: "How Does a Car Engine Work?", "What If Earth Lost Oxygen for One Second?", "Why Do We Dream?"
- Prefer topics that connect multiple interests at once: engineering + everyday life, space + body, history + money
- Avoid vague titles like "The hidden side of...", "Introduction to...", "The mystery of...", or "Exploring..."
- Avoid repeating these existing titles: ${existingTitles.join(' | ') || 'none'}
- Never use these words or phrases: "fascinating", "intriguing", "remarkable", "delve into", "dive into", "it's worth noting", "in conclusion", "let's explore", "unpacking", "demystifying", "captivating", "in the realm of".

Available app interests: ${categoryList}
User selected interests to prioritize: ${selectedList}

Return ONLY a raw JSON array of objects.`

  let lastError = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let raw
    try {
      raw = await chatCompletion([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.9,
        maxTokens: 6000,
        responseSchema: topicsSchema()
      })
    } catch (apiError) {
      throw new Error(`Failed to generate topics: ${apiError.message}`)
    }

    try {
      const topics = parseJSONArray(raw)
      return topics.slice(0, count).map(topic => {
        const category = topic.category || interests[0] || 'Science'
        const tags = normalizeTags(topic.tags, category)
        const imageTags = normalizeTags(topic.imageTags || topic.image_tags, category)

        return {
          title: String(topic.title || 'Untitled rabbit hole').trim(),
          description: String(topic.description || '').trim(),
          category,
          tags,
          imageTags: imageTags.length ? imageTags : tags,
          imageQuery: (imageTags.length ? imageTags : tags).join(',')
        }
      }).filter(topic =>
        topic.title &&
        topic.description &&
        topic.tags.length > 0
      )
    } catch (err) {
      lastError = err
      console.error('Failed to parse topic ideas:', raw)
    }
  }

  throw lastError || new Error('Failed to parse topic ideas')
}

export async function generateTopicIdeas(existingTitles, interests, count = 2) {
  return generateInterestTopics(interests, count)
}

function starterSchema() {
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

/**
 * Extract pages from parsed AI response, with fallback to single body string.
 */
function extractPages(parsed) {
  if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
    return parsed.pages.filter(p => typeof p === 'string' && p.trim())
  }
  // Fallback: split a single body into pages by paragraph groups
  const body = parsed.body || parsed.intro || ''
  if (!body) return []
  return splitIntoPages(body)
}

/**
 * Split a long body string into page-sized chunks (~80-130 words each).
 */
function splitIntoPages(body) {
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  if (paragraphs.length <= 2) return [body.trim()]

  const pages = []
  let current = []
  let wordCount = 0

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length
    if (wordCount > 0 && wordCount + words > 130) {
      pages.push(current.join('\n\n'))
      current = [para]
      wordCount = words
    } else {
      current.push(para)
      wordCount += words
    }
  }
  if (current.length > 0) {
    pages.push(current.join('\n\n'))
  }
  return pages
}

/**
 * Remove dashes, bullets, and list-like formatting from AI text.
 */
function cleanDashes(text) {
  if (typeof text !== 'string') return text
  return text
    // Remove lines that start with bullet-like markers: -, *, •, ‣, ▪
    .replace(/^\s*[\-\*•‣▪]\s+/gm, '')
    // Remove em-dashes used as list starters at the beginning of lines
    .replace(/^\s*[—–]\s+/gm, '')
    // Remove numbered list markers (1. 2. 3. etc.) at the start of lines
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

function topicsSchema() {
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
      required: ['title', 'description', 'category', 'tags', 'imageTags']
    }
  }
}

/**
 * Check if the API key is configured
 */
export function isAIConfigured() {
  if (!import.meta.env.DEV) return true
  if (AI_PROVIDER === 'azure-foundry') return hasAzureFoundryConfig()
  if (AI_PROVIDER === 'azure') return hasAzureConfig()
  return !!getGeminiApiKey()
}
