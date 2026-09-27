import { useState, useEffect, useRef } from 'react'
import { getImage, saveImage } from '../services/db'
import { fetchPexelsImage, isPexelsConfigured } from '../services/pexelsService'

// In-memory map of topicKey → resolved URL to avoid repeated DB/API calls
const resolvedCache = new Map()

export function useCachedImage(topicOrUrl, optionalQuery) {
  const isObject = topicOrUrl && typeof topicOrUrl === 'object'
  const imageUrl = isObject ? (topicOrUrl.imageUrl || topicOrUrl.coverImage || null) : (topicOrUrl || null)
  const topicKey = isObject ? (topicOrUrl.id || topicOrUrl.title) : (optionalQuery || topicOrUrl || '')

  const [resolvedUrl, setResolvedUrl] = useState(() => {
    if (imageUrl) return imageUrl
    if (topicKey && resolvedCache.has(topicKey)) {
      return resolvedCache.get(topicKey)
    }
    return null
  })

  const imageUrlRef = useRef(imageUrl)
  imageUrlRef.current = imageUrl

  useEffect(() => {
    if (imageUrl) {
      setResolvedUrl(imageUrl)
      return
    }

    if (!topicKey) return
    let isActive = true

    // Already resolved in this session
    if (resolvedCache.has(topicKey)) {
      const cached = resolvedCache.get(topicKey)
      setResolvedUrl(cached)
      return
    }

    async function resolve() {
      // 1. Try IndexedDB cache first (instant, offline-capable)
      try {
        const cachedBlob = await getImage(topicKey)
        if (cachedBlob && isActive) {
          const blobUrl = URL.createObjectURL(cachedBlob)
          resolvedCache.set(topicKey, blobUrl)
          setResolvedUrl(blobUrl)
          return
        }
      } catch {
        // IndexedDB failed, continue to API
      }

      // 2. Fetch from Pexels API / Photography service
      try {
        const pexelsUrl = await fetchPexelsImage(isObject ? topicOrUrl : topicKey)
        if (pexelsUrl && isActive) {
          resolvedCache.set(topicKey, pexelsUrl)
          setResolvedUrl(pexelsUrl)

          // Cache the image blob in IndexedDB in the background
          cacheImageBlob(pexelsUrl, topicKey)
          return
        }
      } catch {
        // Pexels failed, fall through
      }

      // 3. Fallback to original URL
      if (isActive && imageUrlRef.current) {
        resolvedCache.set(topicKey, imageUrlRef.current)
        setResolvedUrl(imageUrlRef.current)
      }
    }

    resolve()

    return () => { isActive = false }
  }, [topicKey, imageUrl, isObject, topicOrUrl])

  return resolvedUrl || imageUrl
}

/**
 * Downloads an image as a blob and saves it to IndexedDB.
 * Runs silently in the background — failures are ignored.
 */
async function cacheImageBlob(url, query) {
  if (!url || !query) return

  try {
    const res = await fetch(url)
    if (!res.ok) return
    const blob = await res.blob()
    await saveImage(query, blob)
  } catch {
    // Silently fail — caching is best-effort
  }
}
