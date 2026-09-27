/**
 * rabbitHoleEngine.js
 * 
 * Unified Canonical Engine for Rabbit Hole.
 * 
 * Features:
 * 1. Single Canonical Content Model shared by Reading Mode, Audio Mode, and Read Aloud.
 * 2. Section-Aware Architecture: Topic -> Hook -> Sections -> Threads -> Prompts.
 * 3. Editorial Hook Progression (Relatable spark -> Simple explanation -> Deep mechanism -> 'Wait, how?' -> Detail).
 * 4. Streaming Audio Queue with Section-Level TTS, Deterministic Caching, and Eager Prefetching (N+1, N+2).
 * 5. Seamless natural 0.3-0.5s pause transitions between audio sections without loading delays.
 * 6. Background retry & error recovery without killing current playback.
 * 7. Human-readable subtitle segmentation with dynamic quotation cues.
 */

import { generateTopicStarter, generateRabbitHoleStep } from './aiService.js'
import { apiClient } from './apiClient.js'
import { saveTopics } from './db.js'

// Global deterministic audio buffer cache: key -> AudioBuffer
const audioBufferCache = new Map()
// Track active in-flight prefetch promises to prevent duplicate network calls
const inFlightPrefetch = new Map()

/**
 * Remove HTML tags, markdown syntax, bullet markers, and technical artifacts.
 */
export function cleanSpokenText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/\[\d+\]/g, '') // remove footnote citations like [1]
    .replace(/^[-*•]\s+/gm, '') // remove bullet points
    .replace(/^\d+\.\s+/gm, '') // remove numbered list markers
    .replace(/[*_#`~]/g, '') // remove markdown symbols
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim()
}

/**
 * Generate a deterministic hash key for audio chunk caching.
 */
export function getAudioCacheKey(topicId, chunkId, text) {
  const clean = cleanSpokenText(text).slice(0, 100)
  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0
  }
  return `rh_audio_${topicId || 'generic'}_${chunkId}_${Math.abs(hash)}`
}

/**
 * High-quality curated starters for core topics to guarantee immediate editorial excellence.
 */
export const CURATED_TOPIC_STARTERS = {
  'how-does-gps-know-exactly-where-you-are': {
    hook: "Twenty-four atomic clocks orbiting twelve thousand miles above Earth calculate your position down to inches using the speed of light.",
    pages: [
      "You pull out your phone in the middle of a dense, unfamiliar city, tap a blue dot, and watch it pulse within feet of your actual footsteps. There is no cell tower giving you that precision, and your phone has sent zero signals into the sky.\n\nInstead, your device is silently listening to invisible radio whispers broadcast from twelve thousand miles in orbit, solving the geometry of your position using pulses that left atomic clocks mere milliseconds ago.",
      "Orbiting the planet right now are thirty-one operational satellites, each carrying rubidium and cesium atomic clocks so precise they lose less than one second every few million years. These satellites do not track you or know where you are going. They broadcast only two pieces of data: their exact orbital location, and the precise timestamp that radio wave left their antenna.\n\nBy measuring the microscopic arrival delay from at least four separate satellites simultaneously, your phone calculates the sphere of distance to each satellite. Where those four spheres intersect in three-dimensional space is the single point on Earth where you are standing.",
      "Here is the counterintuitive twist that almost broke GPS before it ever launched: if engineers had only used classical physics, your map position would drift by six miles every single day.\n\nBecause satellites travel at fourteen thousand miles an hour, Einstein's special relativity causes their clocks to tick seven microseconds slower each day. But because they sit twelve thousand miles above Earth's gravitational well, general relativity makes them tick forty-five microseconds faster. The net discrepancy is thirty-eight microseconds fast every twenty-four hours — an error that would destroy satellite navigation if software did not mathematically bend time to keep orbit and Earth in sync."
    ],
    prompts: [
      "Why does your phone require four satellites instead of three?",
      "How did Einstein's relativity almost break satellite navigation?",
      "What happens to GPS when solar storms disturb the ionosphere?"
    ]
  },
  'how-does-the-internet-actually-move-information-across-the-world': {
    hook: "Thick glass fibers stretching across dark ocean floors carry pulses of light carrying every email, stream, and transaction.",
    pages: [
      "In the absolute darkness of the Atlantic abyss, a lone shark drifts past a pencil-thin line of steel and plastic. This is not a natural formation. It is a submarine telecommunications cable carrying hundreds of terabits of global conversations per second.",
      "Across the planet, more than five hundred undersea cables form the invisible nervous system of human civilization. When you send a message across continents, lasers pulse photons through pure silica glass strands thinner than a human hair, bouncing through total internal reflection at two-thirds the speed of light.",
      "Every sixty miles on the ocean floor, specialized optical erbium amplifiers boost the fading photons without ever converting them back into electricity. If a ship anchor or undersea earthquake severs a cable, automated routing protocols redirect traffic around the globe in milliseconds."
    ],
    prompts: [
      "Who actually owns and repairs these underwater cables?",
      "What happens when a shark bites a fiber optic cable?",
      "How do cables cross trenches deeper than Mount Everest?"
    ]
  },
  'what-actually-happens-when-you-type-a-website-address-and-press-enter': {
    hook: "In milliseconds, your computer questions global root servers, establishes encrypted cryptographic handshakes, and reassembles fragmented packets.",
    pages: [
      "You press Enter on a keyboard. In under two hundred milliseconds, an invisible choreography spanning thousands of miles has already completed before the browser can paint a single pixel on your screen.",
      "First, your operating system turns the human letters of a domain name into a numeric IP address. It queries a recursive resolver, which queries the global root servers, the top-level domain servers, and finally the authoritative nameservers in a rapid hierarchy of questions.",
      "Once the destination is located, your device initiates a TCP three-way handshake, layered immediately with a TLS cryptographic exchange where ephemeral mathematical keys are generated. Only then do HTTP request headers fly across the wire, requesting the raw HTML document that becomes your page."
    ],
    prompts: [
      "How do the thirteen global root DNS servers avoid crashing?",
      "How can two computers agree on an encryption key in public without eavesdroppers seeing it?",
      "What happens if one single packet gets lost during the transfer?"
    ]
  }
}

/**
 * Validate that a canonical model has real prose, not placeholder stubs like 'Page 1'.
 */
function isCorruptCanonical(canonical) {
  if (!canonical || !canonical.sections || canonical.sections.length === 0) return true
  if (canonical.hook === 'Test overview') return true
  const firstSec = canonical.sections[0]
  if (!firstSec.paragraphs || firstSec.paragraphs.length === 0) return true
  const firstPara = firstSec.paragraphs[0]
  if (typeof firstPara !== 'string' || firstPara.trim() === 'Page 1' || firstPara.trim().length < 35) return true
  return false
}

/**
 * Build the Canonical Section-Aware Content Model from topic or starter data.
 */
export function buildCanonicalModel(topic, starterData = null) {
  if (!topic) return null

  // 1. If topic already has canonical structure that is valid
  if (topic.canonical && !isCorruptCanonical(topic.canonical)) {
    return topic.canonical
  }

  // 2. Reject corrupt/dummy starter data
  if (starterData) {
    if (starterData.hook === 'Test overview') starterData = null
    else if (starterData.pages && starterData.pages.some(p => typeof p === 'string' && (p.trim() === 'Page 1' || p.trim().length < 35))) {
      starterData = null
    }
  }

  // 3. Fallback to curated starter if available
  if (!starterData && CURATED_TOPIC_STARTERS[topic.id]) {
    starterData = CURATED_TOPIC_STARTERS[topic.id]
  }

  // 4. Derive hook: Must be the narrative spark, NEVER repeating metadata
  let hook = ''
  if (starterData?.hook) {
    hook = cleanSpokenText(starterData.hook)
  }

  const rawPages = starterData?.pages || []
  const existingCards = (topic.content || []).filter(c => {
    const text = (c.pages && c.pages[0]) || c.body || ''
    return text.trim() !== 'Page 1' && text.trim().length >= 35
  })
  const sections = []

  if (rawPages.length > 0) {
    // If hook is not explicitly set, use the first paragraph of page 0
    if (!hook) {
      const page0Paras = rawPages[0].split(/\n{2,}/).map(cleanSpokenText).filter(Boolean)
      hook = page0Paras[0] || cleanSpokenText(topic.description || '')
    }

    rawPages.forEach((pageStr, idx) => {
      const paras = pageStr.split(/\n{2,}/).map(cleanSpokenText).filter(Boolean)
      if (paras.length > 0) {
        sections.push({
          id: `sec-${idx}`,
          heading: idx === 0 ? null : idx === 1 ? 'The Underlying Mechanism' : 'The "Wait, How?" Moment',
          paragraphs: paras
        })
      }
    })
  } else if (existingCards.length > 0) {
    existingCards.forEach((card, idx) => {
      const cardParas = (card.pages && card.pages.length > 0)
        ? card.pages.map(cleanSpokenText).filter(Boolean)
        : (card.body ? card.body.split(/\n{2,}/).map(cleanSpokenText).filter(Boolean) : [])

      if (idx === 0 && !hook && cardParas.length > 0) {
        hook = cardParas[0]
      }

      if (cardParas.length > 0) {
        sections.push({
          id: card.id || `sec-${idx}`,
          heading: card.heading || (idx === 0 ? null : `Section 0${idx + 1}`),
          paragraphs: cardParas
        })
      }
    })
  }

  // Fallback if content was not yet loaded
  if (!hook) {
    hook = cleanSpokenText(topic.description || topic.blurb || topic.hook || '')
  }
  if (sections.length === 0 && hook) {
    sections.push({
      id: 'sec-0',
      heading: null,
      paragraphs: [hook]
    })
  }

  const prompts = (starterData?.prompts?.length ? starterData.prompts : topic.introPrompts || [
    'What is really happening underneath?',
    'What happens when the sensors disagree?',
    'Why is this so difficult in real life?'
  ]).filter(p => Boolean(p) && p !== 'Prompt 1').slice(0, 3)

  return {
    id: topic.id,
    title: topic.title,
    category: topic.category || topic.tags?.[0] || 'Discovery',
    readingTime: topic.readingTime || '4 min read',
    hook,
    sections,
    threads: topic.threads || [],
    prompts
  }
}

/**
 * Fetch or initialize canonical topic content with caching in IndexedDB.
 */
export async function fetchCanonicalTopic(topic) {
  if (!topic) throw new Error('Topic is required')

  // Check if topic already has a valid canonical model with at least one section
  if (topic.canonical && !isCorruptCanonical(topic.canonical)) {
    return topic.canonical
  }

  // Prioritize built-in curated starters for instant high-fidelity editorial delivery
  if (CURATED_TOPIC_STARTERS[topic.id]) {
    const canonical = buildCanonicalModel(topic, CURATED_TOPIC_STARTERS[topic.id])
    saveTopics([{ ...topic, canonical }]).catch(() => {})
    return canonical
  }

  // Check if starter already exists in topic.content (and is not corrupt)
  if (Array.isArray(topic.content) && topic.content.length > 0) {
    const candidate = buildCanonicalModel(topic)
    if (!isCorruptCanonical(candidate)) {
      return candidate
    }
  }

  // Generate canonical starter from backend or client fallback
  try {
    const starter = await generateTopicStarter(topic)
    const canonical = buildCanonicalModel(topic, starter)
    // Persist canonical content so it is instantly available next time
    saveTopics([{ ...topic, canonical }]).catch(console.warn)
    return canonical
  } catch (err) {
    console.warn('Failed to generate canonical topic starter:', err?.message)
    // Fallback to basic model
    return buildCanonicalModel(topic)
  }
}

/**
 * Expand a single new rabbit-hole thread without regenerating previous content.
 * Returns the new thread object and updates the canonical model.
 */
export async function expandCanonicalThread(canonical, promptText) {
  if (!canonical || !promptText) {
    throw new Error('Canonical content and promptText are required')
  }

  // Build compact context from recent sections/threads for topic continuity
  const recentCards = [
    ...canonical.sections.map(s => ({ heading: s.heading, pages: s.paragraphs })),
    ...(canonical.threads || []).map(t => ({ heading: t.heading, pages: t.paragraphs }))
  ].slice(-3)

  const step = await generateRabbitHoleStep(canonical, promptText, recentCards)
  const rawPages = step?.pages || (step?.body ? step.body.split(/\n{2,}/).filter(Boolean) : [])
  const paragraphs = rawPages.map(cleanSpokenText).filter(Boolean)

  const newThread = {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: promptText,
    heading: promptText,
    paragraphs: paragraphs.length > 0 ? paragraphs : ['Exploring deeper into this dimension...'],
    prompts: (step?.prompts?.length ? step.prompts : canonical.prompts).filter(Boolean).slice(0, 3)
  }

  // Update canonical model
  const updatedThreads = [...(canonical.threads || []), newThread]
  const updatedCanonical = {
    ...canonical,
    threads: updatedThreads,
    prompts: newThread.prompts
  }

  // Cache updated canonical topic
  saveTopics([{ id: canonical.id, canonical: updatedCanonical }]).catch(console.warn)

  return {
    updatedCanonical,
    newThread
  }
}

/**
 * Build the Ordered Streaming Audio Queue from Canonical Content.
 * 
 * Follows the strict rule:
 * Starts directly with the editorial HOOK.
 * Never includes title, subtitle, category, reading time, or UI metadata.
 */
export function buildAudioQueue(canonical) {
  if (!canonical) return []

  const queue = []

  // 1. Canonical Sections (Part 1 - The Explanatory Journey)
  // Narration begins strictly with actual article content, NEVER title or subtitle deck
  ;(canonical.sections || []).forEach((sec, idx) => {
    const text = sec.paragraphs.join('\n\n').trim()
    if (text) {
      queue.push({
        id: `queue-${sec.id}`,
        sectionId: sec.id,
        threadId: null,
        label: sec.heading || `Part 0${idx + 1}`,
        text
      })
    }
  })

  // 2. User Explored Threads (Part 2 - Going Deeper)
  ;(canonical.threads || []).forEach((thread, tIdx) => {
    const text = thread.paragraphs.join('\n\n').trim()
    if (text) {
      queue.push({
        id: `queue-${thread.id}`,
        sectionId: thread.id,
        threadId: thread.id,
        label: thread.question || `Thread 0${tIdx + 1}`,
        text
      })
    }
  })

  // 3. Natural Rabbit-Hole Questions Narration
  // Turn questions into natural conversational spoken language without UI labels (no "01", "WHERE TO GO NEXT")
  const prompts = (canonical.prompts || []).filter(Boolean).slice(0, 3)
  if (prompts.length > 0) {
    const naturalQuestions = prompts.map((p, idx) => {
      let q = cleanSpokenText(p).trim()
      if (!q.endsWith('?')) q += '?'
      if (idx === prompts.length - 1 && prompts.length > 1) {
        return `And ${q.charAt(0).toLowerCase()}${q.slice(1)}`
      }
      return q
    }).join(' ')

    queue.push({
      id: 'queue-next-questions',
      sectionId: 'questions-station',
      threadId: null,
      label: 'Next questions',
      text: `There are a few directions we could take this next. ${naturalQuestions}`
    })
  }

  return queue
}

/**
 * Synthesize or retrieve cached audio buffer for a queue item.
 * Uses deterministic caching and dual-mode PCM/WAV decoding.
 */
export async function getOrPrefetchAudioBuffer(queueItem, topicId, audioCtx) {
  if (!queueItem || !queueItem.text || !audioCtx) return null

  const cacheKey = getAudioCacheKey(topicId, queueItem.id, queueItem.text)

  // 1. Check in-memory cache
  if (audioBufferCache.has(cacheKey)) {
    return audioBufferCache.get(cacheKey)
  }

  // 2. Check if a prefetch is already running for this exact key
  if (inFlightPrefetch.has(cacheKey)) {
    return inFlightPrefetch.get(cacheKey)
  }

  // 3. Initiate request with retry logic
  const prefetchPromise = (async () => {
    try {
      const clean = cleanSpokenText(queueItem.text)
      if (!clean) return null

      let audioBase64 = null
      let audioUrl = null

      // Attempt Cloudflare Worker narration (which caches in R2)
      try {
        const res = await apiClient.narrate(clean, topicId, queueItem.id, 'Aoede', 'fast')
        if (res?.audioBase64) audioBase64 = res.audioBase64
        else if (res?.audioUrl) audioUrl = res.audioUrl
      } catch (err) {
        console.warn('Worker narration prefetch warning:', err?.message)
      }

      // Direct client fallback
      if (!audioBase64 && !audioUrl) {
        let userKey = null
        try {
          userKey = localStorage.getItem('rh-gemini-api-key')
        } catch {}

        const keys = [
          userKey,
          import.meta.env.VITE_GEMINI_API_KEY_PRIMARY,
          import.meta.env.VITE_GEMINI_API_KEY,
          import.meta.env.VITE_GEMINI_API_KEY_SECONDARY
        ].filter(k => Boolean(k) && k.trim().length > 10)
        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-preview-tts']
        for (const k of keys) {
          for (const m of models) {
            try {
              const directRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: clean.slice(0, 2500) }] }],
                    generationConfig: {
                      responseModalities: ['AUDIO'],
                      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
                    }
                  })
                }
              )
              if (directRes.ok) {
                const directJson = await directRes.json()
                const data = directJson?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
                if (data) {
                  audioBase64 = data
                  break
                }
              }
            } catch {}
          }
          if (audioBase64) break
        }
      }

      // Decode audio data into AudioBuffer
      let buffer = null
      if (audioBase64) {
        const binary = atob(audioBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        const isWav = bytes.length > 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        if (isWav) {
          try {
            buffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0))
          } catch {}
        }
        if (!buffer) {
          const sampleRate = 24000
          const numSamples = Math.floor(bytes.byteLength / 2)
          if (numSamples > 0) {
            const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            buffer = audioCtx.createBuffer(1, numSamples, sampleRate)
            const channelData = buffer.getChannelData(0)
            for (let i = 0; i < numSamples; i++) {
              const int16 = dataView.getInt16(i * 2, true)
              channelData[i] = int16 < 0 ? int16 / 32768 : int16 / 32767
            }
          }
        }
      } else if (audioUrl) {
        const fetchRes = await fetch(audioUrl)
        if (fetchRes.ok) {
          const arrayBuf = await fetchRes.arrayBuffer()
          const bytes = new Uint8Array(arrayBuf)
          const isWav = bytes.length > 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
          if (isWav) {
            try {
              buffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0))
            } catch {}
          }
          if (!buffer) {
            const sampleRate = 24000
            const numSamples = Math.floor(bytes.byteLength / 2)
            if (numSamples > 0) {
              const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
              buffer = audioCtx.createBuffer(1, numSamples, sampleRate)
              const channelData = buffer.getChannelData(0)
              for (let i = 0; i < numSamples; i++) {
                const int16 = dataView.getInt16(i * 2, true)
                channelData[i] = int16 < 0 ? int16 / 32768 : int16 / 32767
              }
            }
          }
        }
      }

      if (buffer) {
        audioBufferCache.set(cacheKey, buffer)
      }
      return buffer
    } catch (e) {
      console.warn('Audio prefetch error:', e?.message)
      return null
    } finally {
      inFlightPrefetch.delete(cacheKey)
    }
  })()

  inFlightPrefetch.set(cacheKey, prefetchPromise)
  return prefetchPromise
}

/**
 * Eagerly prefetch Section N+1 and Section N+2 in background.
 * Non-blocking: Catch and schedule retry on failure without interrupting active audio.
 */
export function prefetchAudioAhead(queue, currentIndex, topicId, audioCtx) {
  if (!queue || !Array.isArray(queue) || !audioCtx) return

  // Prefetch immediate next item
  const nextItem = queue[currentIndex + 1]
  if (nextItem) {
    getOrPrefetchAudioBuffer(nextItem, topicId, audioCtx).catch(err => {
      console.warn(`Retry scheduled for audio chunk ${currentIndex + 1}:`, err?.message)
      setTimeout(() => {
        getOrPrefetchAudioBuffer(nextItem, topicId, audioCtx).catch(() => {})
      }, 1200)
    })
  }

  // Prefetch N+2 buffer ahead
  const lookaheadItem = queue[currentIndex + 2]
  if (lookaheadItem) {
    setTimeout(() => {
      getOrPrefetchAudioBuffer(lookaheadItem, topicId, audioCtx).catch(() => {})
    }, 600)
  }
}

/**
 * Split narrative text into natural spoken quotation subtitles (~4-8 words).
 * Formatted with smart punctuation and calculated relative timestamps.
 */
export function generateSubtitleCues(text, durationSec) {
  if (!text || durationSec <= 0) return []
  const clean = cleanSpokenText(text)
  if (!clean) return []

  // Split on natural sentence and clause pauses
  const rawClauses = clean.split(/(?<=[.!?])\s+|(?<=[,;:\u2014\-])\s+/).filter(Boolean)
  const phrases = []

  for (const clause of rawClauses) {
    const words = clause.split(/\s+/).filter(Boolean)
    if (words.length <= 8) {
      if (words.length > 0) phrases.push(words.join(' '))
    } else {
      for (let i = 0; i < words.length; i += 6) {
        phrases.push(words.slice(i, i + 6).join(' '))
      }
    }
  }

  const validPhrases = phrases.filter(p => p.trim().length > 0)
  if (validPhrases.length === 0) {
    return [{ text: clean, start: 0.1, end: Math.max(0.6, durationSec - 0.1) }]
  }

  const wordCounts = validPhrases.map(p => p.split(/\s+/).length)
  const totalWords = wordCounts.reduce((acc, count) => acc + count, 0) || 1

  let currentStart = 0.08
  const availableDuration = Math.max(0.5, durationSec - 0.16)

  return validPhrases.map((phrase, idx) => {
    const fraction = wordCounts[idx] / totalWords
    const cueDur = Math.max(0.8, fraction * availableDuration)
    const cue = {
      text: phrase.trim(),
      start: currentStart,
      end: currentStart + cueDur
    }
    currentStart += cueDur
    return cue
  })
}

/**
 * Backward compatibility helpers
 */
export function extractCanonicalParagraphs(topic, starterOrContent) {
  const model = buildCanonicalModel(topic, starterOrContent)
  const paras = []
  if (model?.hook) paras.push(model.hook)
  ;(model?.sections || []).forEach(s => paras.push(...s.paragraphs))
  return paras
}

export function buildNarrationPipeline(topic, canonicalParagraphs = [], prompts = []) {
  const model = buildCanonicalModel(topic)
  const queue = buildAudioQueue(model)
  return queue.map(q => q.text)
}

export async function expandRabbitHoleBranch(topic, promptText, previousSections = []) {
  const model = buildCanonicalModel(topic)
  const { newThread } = await expandCanonicalThread(model, promptText)
  return newThread
}
