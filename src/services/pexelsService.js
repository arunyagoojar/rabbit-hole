/**
 * Pexels Image Service for Rabbit Hole.
 * Fetches high-quality images from Pexels API and caches them in IndexedDB.
 */

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || ''
const PEXELS_API_BASE = '/api/pexels'

// In-memory URL cache to avoid redundant API calls within the same session
const urlCache = new Map()

/**
 * Extract meaningful search keywords from a topic title.
 */
function extractKeyword(title) {
  const stopwords = new Set([
    'how', 'does', 'the', 'a', 'an', 'work', 'what', 'is', 'why', 'are',
    'of', 'in', 'do', 'to', 'and', 'or', 'on', 'with', 'about', 'can',
    'your', 'you', 'it', 'its', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'not', 'but', 'if', 'than', 'that', 'this',
    'from', 'for', 'at', 'by', 'we', 'our', 'us', 'them', 'they', 'their',
    'so', 'no', 'yes', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'own', 'same', 'too', 'very',
    'just', 'because', 'as', 'until', 'while', 'during', 'before', 'after',
    'above', 'below', 'between', 'through', 'into', 'out', 'up', 'down',
    'really', 'actually', 'when', 'where', 'which', 'who', 'whom'
  ])

  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w && !stopwords.has(w.toLowerCase()))
    .slice(0, 4) // Limit to 4 keywords for better results

  return words.join(' ') || title
}

/**
 * Fetch a Pexels image URL for a given topic title / query.
 * Returns the URL string or null if unavailable.
 */
export async function fetchPexelsImage(query) {
  if (!isPexelsConfigured()) return null

  // Check in-memory cache
  const cacheKey = query.toLowerCase().trim()
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey)
  }

  const keyword = extractKeyword(query)

  try {
    const res = await fetch(
      `${PEXELS_API_BASE}/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`,
      PEXELS_API_KEY ? { headers: { Authorization: PEXELS_API_KEY } } : undefined
    )

    if (!res.ok) {
      console.warn(`Pexels API error for "${keyword}":`, res.status)
      return null
    }

    const data = await res.json()

    if (data.photos && data.photos.length > 0) {
      // Use the "large" size — good quality without being massive
      const url = data.photos[0].src.large || data.photos[0].src.landscape
      urlCache.set(cacheKey, url)
      return url
    }

    return null
  } catch (err) {
    console.warn('Pexels fetch failed:', err)
    return null
  }
}

/**
 * Check if Pexels API is configured.
 */
export function isPexelsConfigured() {
  if (!import.meta.env.DEV) return true
  return Boolean(PEXELS_API_KEY)
}
