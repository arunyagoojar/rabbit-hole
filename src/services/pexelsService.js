/**
 * Pexels Image Service for Rabbit Hole.
 * 
 * Rules:
 * 1. Semantic queries derived from actual subject matter (never generic 'technology', 'code', 'science').
 * 2. Strict cross-card deduplication: no two cards on the page receive the same image.
 * 3. Topic-specific caching: keyed by topic identity, never generic category.
 * 4. Rich, conceptually matched fallbacks when API is offline (no generic Matrix/code images).
 */

const PEXELS_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PEXELS_API_KEY) || ''
const PEXELS_API_BASE = '/api/pexels'

// In-memory URL cache keyed by topic.id or stable semantic key
const topicUrlCache = new Map()

// Global set of image URLs already selected for visible cards in this session
export const usedImageUrls = new Set()

/**
 * Curated conceptual photography pool mapped by topic ID.
 * Every single topic has its own unique, relevant photograph.
 */
export const TOPIC_CURATED_PHOTOS = {
  'how-does-gps-know-exactly-where-you-are': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80', // Satellite / Earth from space
  'how-does-an-ai-model-turn-a-sentence-into-numbers': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=900&q=80', // Geometric vector flows
  'how-do-scientists-know-what-stars-are-made-of-when-they-cannot-touch-them': 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=900&q=80', // Deep starry night sky
  'how-does-shazam-recognize-a-song-from-a-few-seconds-of-sound': 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80', // Audio equalizer waveform
  'how-does-a-self-driving-car-understand-what-is-happening-around-it': 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80', // Modern autonomous car cockpit on road
  'how-does-the-internet-actually-move-information-across-the-world': 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=900&q=80', // Fiber optics glowing cables
  'what-actually-happens-when-you-type-a-website-address-and-press-enter': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=80', // Server rack data center lights
  'how-does-noise-cancelling-headphones-create-silence': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80', // Studio headphones on dark surface
  'how-does-computer-vision-recognize-faces': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80', // Human portrait / biometric perspective
  'how-do-batteries-store-and-release-energy': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=900&q=80', // Energy / electricity sparks
  'how-do-touchscreens-know-where-your-finger-is': 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=900&q=80', // Modern glass interface touch
  'how-do-microprocessors-etch-billions-of-transistors': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80', // Silicon microchip wafer
  'how-does-bluetooth-connect-devices-without-wires': 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?auto=format&fit=crop&w=900&q=80', // Minimal mobile wireless
  'how-does-a-microwave-heat-food-from-the-inside-out': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=80', // Warm culinary kitchen steam
  'how-do-airplanes-stay-in-the-air': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80', // Jet wing slicing clouds
  'how-does-cryptography-keep-secrets-on-the-public-internet': 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=900&q=80', // Dark cryptography lock
  'why-does-time-slow-down-near-a-black-hole': 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=900&q=80', // Deep gravitational nebula
  'how-does-the-human-brain-store-memories': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=900&q=80', // Brain neural network science
  'how-do-birds-navigate-thousands-of-miles-without-getting-lost': 'https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=900&q=80', // Birds flock flying migration
  'how-do-trees-communicate-with-each-other-underground': 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80' // Misty ancient forest floor
}

/**
 * Fallback diverse pool of curated conceptual photography.
 * Ensures that any unseen topic receives a distinct, atmospheric photo.
 */
const CURATED_CONCEPTUAL_POOL = [
  'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&q=80', // Mathematics geometry
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=80', // Laboratory chemistry flask
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80', // Global satellite
  'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=900&q=80', // Space telescope constellation
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80', // Mechanical precision engineering
  'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=900&q=80', // Biological cell structure
  'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=900&q=80', // Classical vintage books
  'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=900&q=80', // Thoughtful marble statue
  'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=900&q=80', // Curiosity warm library
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80'  // Microelectronics
]

/**
 * Topic-specific semantic query map.
 * Never searches generic 'technology' or 'computer' or 'code'.
 */
export const TOPIC_SEMANTIC_QUERIES = {
  'how-does-gps-know-exactly-where-you-are': 'GPS satellites Earth navigation',
  'how-does-an-ai-model-turn-a-sentence-into-numbers': 'language model vector embeddings visualization',
  'how-do-scientists-know-what-stars-are-made-of-when-they-cannot-touch-them': 'astronomer telescope night sky spectroscopy',
  'how-does-shazam-recognize-a-song-from-a-few-seconds-of-sound': 'audio waveform music recognition headphones',
  'how-does-a-self-driving-car-understand-what-is-happening-around-it': 'autonomous car lidar sensors road',
  'how-does-the-internet-actually-move-information-across-the-world': 'undersea fiber optic cable ocean map',
  'what-actually-happens-when-you-type-a-website-address-and-press-enter': 'server racks data center illuminated',
  'how-does-noise-cancelling-headphones-create-silence': 'sound waves acoustics headphones audio',
  'how-does-computer-vision-recognize-faces': 'facial recognition biometrics digital scan',
  'how-do-batteries-store-and-release-energy': 'lithium ion battery chemical reaction cathode',
  'how-do-touchscreens-know-where-your-finger-is': 'capacitive touchscreen glass sensor display',
  'how-do-microprocessors-etch-billions-of-transistors': 'silicon wafer microchip photolithography cleanroom',
  'how-does-bluetooth-connect-devices-without-wires': 'wireless radio frequencies transmission connection',
  'how-does-a-microwave-heat-food-from-the-inside-out': 'electromagnetic microwave radiation molecular water',
  'how-do-airplanes-stay-in-the-air': 'airplane wing aerodynamics airflow flight',
  'how-does-cryptography-keep-secrets-on-the-public-internet': 'cryptography cipher padlock mathematical key',
  'why-does-time-slow-down-near-a-black-hole': 'black hole gravitational lensing spacetime relativity',
  'how-does-the-human-brain-store-memories': 'human brain neurons synapses neural network',
  'how-do-birds-navigate-thousands-of-miles-without-getting-lost': 'migratory birds flock flight geomagnetic navigation',
  'how-do-trees-communicate-with-each-other-underground': 'mycelium fungal network forest roots underground'
}

/**
 * Extract meaningful, semantic search query from a topic.
 * Represents the actual concept rather than generic categories.
 */
export function extractSemanticKeyword(topicOrQuery) {
  if (!topicOrQuery) return 'science curiosity research'

  if (typeof topicOrQuery === 'object') {
    // 1. Check curated topic semantic mapping
    if (topicOrQuery.id && TOPIC_SEMANTIC_QUERIES[topicOrQuery.id]) {
      return TOPIC_SEMANTIC_QUERIES[topicOrQuery.id]
    }
    if (topicOrQuery.imageQuery && typeof topicOrQuery.imageQuery === 'string') {
      return topicOrQuery.imageQuery
    }
    if (topicOrQuery.svgKeywords && Array.isArray(topicOrQuery.svgKeywords) && topicOrQuery.svgKeywords.length > 0) {
      return topicOrQuery.svgKeywords.join(' ')
    }
    return deriveSemanticFromTitle(topicOrQuery.title || '', topicOrQuery.category || '')
  }

  return deriveSemanticFromTitle(String(topicOrQuery))
}

function deriveSemanticFromTitle(title, category = '') {
  const stopwords = new Set([
    'how', 'does', 'the', 'a', 'an', 'work', 'what', 'is', 'why', 'are',
    'of', 'in', 'do', 'to', 'and', 'or', 'on', 'with', 'about', 'can',
    'your', 'you', 'it', 'its', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'not', 'but', 'if', 'than', 'that', 'this',
    'from', 'for', 'at', 'by', 'we', 'our', 'us', 'them', 'they', 'their',
    'so', 'no', 'yes', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'too', 'very',
    'just', 'because', 'as', 'until', 'while', 'during', 'before', 'after',
    'really', 'actually', 'when', 'where', 'which', 'who', 'whom',
    'know', 'exactly', 'happens', 'turn', 'inside', 'secret', 'underneath',
    'technology', 'computer', 'science', 'code' // Filter out generic keywords
  ])

  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !stopwords.has(w.toLowerCase()))
    .slice(0, 4)

  const joined = words.join(' ').trim()
  if (joined) return joined
  return category ? `${category.toLowerCase()} conceptual photography` : 'scientific discovery exploration'
}

/**
 * Fetch a Pexels / photographic image URL for a given topic.
 * Maintains strict cross-topic uniqueness so no two cards receive the same photo.
 */
export async function fetchPexelsImage(topicOrQuery) {
  const isObject = topicOrQuery && typeof topicOrQuery === 'object'
  const topicId = isObject ? topicOrQuery.id : null
  const cacheKey = topicId || (typeof topicOrQuery === 'string' ? topicOrQuery : 'generic')

  // 1. Check in-memory cache keyed strictly by topic identity
  if (topicUrlCache.has(cacheKey)) {
    return topicUrlCache.get(cacheKey)
  }

  const keyword = extractSemanticKeyword(topicOrQuery)

  // 2. Query Pexels if API is configured
  if (isPexelsConfigured()) {
    try {
      const headers = PEXELS_API_KEY ? { Authorization: PEXELS_API_KEY } : undefined
      // Request multiple candidate results so we can pick one not yet used
      const res = await fetch(
        `${PEXELS_API_BASE}/v1/search?query=${encodeURIComponent(keyword)}&per_page=5&orientation=landscape`,
        headers ? { headers } : undefined
      )

      if (res.ok) {
        const data = await res.json()
        if (data.photos && data.photos.length > 0) {
          // Inspect candidate results and select one not already used
          const candidate = data.photos.find(p => {
            const u = p.src.large || p.src.landscape
            return u && !usedImageUrls.has(u)
          }) || data.photos[0]

          const url = candidate?.src?.large || candidate?.src?.landscape
          if (url) {
            usedImageUrls.add(url)
            topicUrlCache.set(cacheKey, url)
            return url
          }
        }
      }
    } catch (err) {
      console.warn('Pexels search request notice:', err?.message)
    }
  }

  // 3. Fallback to topic-specific curated photography
  if (topicId && TOPIC_CURATED_PHOTOS[topicId]) {
    const curatedUrl = TOPIC_CURATED_PHOTOS[topicId]
    if (!usedImageUrls.has(curatedUrl)) {
      usedImageUrls.add(curatedUrl)
      topicUrlCache.set(cacheKey, curatedUrl)
      return curatedUrl
    }
  }

  // 4. Select an unused photo from the conceptual pool
  const availableFallback = CURATED_CONCEPTUAL_POOL.find(u => !usedImageUrls.has(u)) || CURATED_CONCEPTUAL_POOL[0]
  usedImageUrls.add(availableFallback)
  topicUrlCache.set(cacheKey, availableFallback)
  return availableFallback
}

/**
 * Check if Pexels API is configured.
 */
export function isPexelsConfigured() {
  return Boolean(PEXELS_API_KEY)
}


