import { useState, useEffect, useRef } from 'react'
import { getImage, saveImage } from '../services/db'
import { fetchPexelsImage, isPexelsConfigured } from '../services/pexelsService'

// In-memory map of imageQuery → resolved URL to avoid repeated DB/API calls
const resolvedCache = new Map()

export function useCachedImage(imageUrl, imageQuery) {
  const [resolvedUrl, setResolvedUrl] = useState(() => {
    if (imageQuery && resolvedCache.has(imageQuery)) {
      return resolvedCache.get(imageQuery)
    }
    return imageUrl || null
  })

  const imageUrlRef = useRef(imageUrl)
  imageUrlRef.current = imageUrl

  useEffect(() => {
    if (!imageQuery) return
    let isActive = true

    // Already resolved in this session
    if (resolvedCache.has(imageQuery)) {
      const cached = resolvedCache.get(imageQuery)
      setResolvedUrl(cached)
      return
    }

    async function resolve() {
      // 1. Try IndexedDB cache first (instant, offline-capable)
      try {
        const cachedBlob = await getImage(imageQuery)
        if (cachedBlob && isActive) {
          const blobUrl = URL.createObjectURL(cachedBlob)
          resolvedCache.set(imageQuery, blobUrl)
          setResolvedUrl(blobUrl)
          return
        }
      } catch {
        // IndexedDB failed, continue to API
      }

      // 2. Fetch from Pexels API
      if (isPexelsConfigured()) {
        try {
          const pexelsUrl = await fetchPexelsImage(imageQuery)
          if (pexelsUrl && isActive) {
            resolvedCache.set(imageQuery, pexelsUrl)
            setResolvedUrl(pexelsUrl)

            // Cache the image blob in IndexedDB in the background
            cacheImageBlob(pexelsUrl, imageQuery)
            return
          }
        } catch {
          // Pexels failed, fall through
        }
      }

      // 3. Fallback to the original URL (could be LoremFlickr or anything)
      if (isActive && imageUrlRef.current) {
        resolvedCache.set(imageQuery, imageUrlRef.current)
        setResolvedUrl(imageUrlRef.current)
      }
    }

    resolve()

    return () => { isActive = false }
  }, [imageQuery])

  // If imageUrl changes (topic swap) and we don't have a cached version, update
  useEffect(() => {
    if (!imageQuery || resolvedCache.has(imageQuery)) return
    setResolvedUrl(imageUrl)
  }, [imageUrl, imageQuery])

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
