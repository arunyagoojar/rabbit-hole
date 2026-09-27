import { Hono } from 'hono'
import { optionalAuth } from '../middleware/auth'
import { callGemini, starterResponseSchema, topicsResponseSchema } from '../services/gemini'
import { recordUsage } from '../services/usage'

export const aiRoutes = new Hono()

// Parsing helpers
function parseJSON(raw) {
  const trimmed = raw.trim()
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const text = match ? match[1] : trimmed
  return JSON.parse(text)
}

function cleanDashes(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/^[\s—–-]+/, '').trim()
}

// Helper to compute stable hash for branch questions
async function hashText(text) {
  const enc = new TextEncoder().encode(String(text || '').trim().toLowerCase())
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

/**
 * POST /api/v1/ai/topic-starter
 * Returns canonical rabbit hole starter content.
 * Reuses existing canonical content in D1 so 1,000 users do not generate 1,000 identical starters.
 */
aiRoutes.post('/topic-starter', optionalAuth(), async (c) => {
  const db = c.env.DB
  const { topic, forceRefresh = false } = await c.req.json()
  if (!topic || !topic.title) {
    return c.json({ error: 'Valid topic with title is required' }, 400)
  }

  const topicId = String(topic.id || '')

  // 1. Check Canonical Content Cache in D1
  if (db && topicId && !forceRefresh) {
    try {
      const canonical = await db.prepare(
        'SELECT * FROM topic_content WHERE topic_id = ?'
      ).bind(topicId).first()

      if (canonical && canonical.sections_data) {
        const pages = JSON.parse(canonical.sections_data || '[]')
        const prompts = JSON.parse(canonical.questions_data || '[]')
        const audioChunks = canonical.audio_chunks_data ? JSON.parse(canonical.audio_chunks_data) : []
        
        // Strict validation: Reject and purge dummy or corrupt test data
        const isCorrupt = !Array.isArray(pages) || pages.length === 0 ||
          pages.some(p => typeof p !== 'string' || p.trim() === 'Page 1' || p.trim().length < 40) ||
          canonical.overview === 'Test overview' ||
          prompts.some(q => q === 'Prompt 1' || (typeof q === 'string' && q.trim().length < 8))

        if (!isCorrupt) {
          const hook = canonical.overview || (pages[0] ? pages[0].split(/\n{2,}/)[0] : '')
          return c.json({
            hook,
            pages,
            prompts,
            audioChunks,
            cached: true
          })
        } else {
          console.warn(`Purged corrupt test data for topic ${topicId}`)
          await db.prepare('DELETE FROM topic_content WHERE topic_id = ?').bind(topicId).run().catch(() => {})
        }
      }

      // Check legacy topics table content_data fallback
      const topicRow = await db.prepare(
        'SELECT content_data FROM topics WHERE id = ?'
      ).bind(topicId).first()

      if (topicRow?.content_data) {
        const content = JSON.parse(topicRow.content_data)
        if (Array.isArray(content) && content.length > 0) {
          const firstCard = content[0]
          const pages = firstCard.pages || (firstCard.body ? firstCard.body.split(/\n{2,}/) : [])
          const prompts = firstCard.prompts || []
          if (pages.length > 0) {
            return c.json({ pages, prompts, cached: true })
          }
        }
      }
    } catch (e) {
      console.warn('Cache lookup failed, proceeding to generation:', e?.message)
    }
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

Topic: "${topic.title}" (${topic.category || 'General'})
Context: ${topic.description || topic.blurb || 'Explore the deep mechanism.'}`

  try {
    const raw = await callGemini(c.env, [{ role: 'user', content: prompt }], {
      temperature: 0.85,
      maxOutputTokens: 2048,
      responseSchema: starterResponseSchema()
    })

    const parsed = parseJSON(raw)
    const pages = (Array.isArray(parsed.pages) ? parsed.pages : []).map(cleanDashes).filter(Boolean)
    const prompts = (Array.isArray(parsed.prompts) ? parsed.prompts : []).slice(0, 3)

    // Store canonical content in D1 (topic_content) so all users reuse it
    if (db && topicId && pages.length > 0) {
      try {
        const now = Date.now()
        const contentId = `tc_${topicId}`
        await db.prepare(`
          INSERT OR REPLACE INTO topic_content (
            id, topic_id, overview, sections_data, questions_data, audio_chunks_data, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).bind(
          contentId,
          topicId,
          topic.description || topic.blurb || null,
          JSON.stringify(pages),
          JSON.stringify(prompts),
          null,
          now,
          now
        ).run()
      } catch (e) {
        console.warn('Failed to save canonical topic content:', e?.message)
      }
    }

    // Record backend usage for quota and tracking
    const user = c.get('user')
    await recordUsage(db, user, 'ai_starter', (raw || '').length)

    const hook = parsed.hook || (pages[0] ? pages[0].split(/\n{2,}/)[0] : '')
    return c.json({ hook, pages, prompts, cached: false })
  } catch (err) {
    console.error('Error generating topic starter:', err)
    return c.json({ error: 'Failed to generate topic starter', message: err?.message }, 500)
  }
})

/**
 * POST /api/v1/ai/rabbit-hole-step
 * Generates deeper branch card based on user's selected prompt and path context.
 * Caches branches in topic_branches so repeated branch questions are reused!
 */
aiRoutes.post('/rabbit-hole-step', optionalAuth(), async (c) => {
  const db = c.env.DB
  const { topic, prompt: selectedPrompt, previousCards = [], forceRefresh = false } = await c.req.json()
  if (!topic || !selectedPrompt) {
    return c.json({ error: 'topic and prompt are required' }, 400)
  }

  const topicId = String(topic.id || '')
  const promptHash = await hashText(selectedPrompt)

  // 1. Check if this branch question has already been explored & cached for this topic
  if (db && topicId && !forceRefresh) {
    try {
      const existingBranch = await db.prepare(
        'SELECT * FROM topic_branches WHERE topic_id = ? AND prompt_hash = ?'
      ).bind(topicId, promptHash).first()

      if (existingBranch && existingBranch.content_data) {
        const pages = JSON.parse(existingBranch.content_data || '[]')
        const prompts = JSON.parse(existingBranch.questions_data || '[]')
        const audioChunks = existingBranch.audio_chunks_data ? JSON.parse(existingBranch.audio_chunks_data) : []

        // Bump branch usage count
        db.prepare('UPDATE topic_branches SET times_used = times_used + 1 WHERE id = ?')
          .bind(existingBranch.id).run().catch(() => {})

        return c.json({
          pages,
          prompts,
          audioChunks,
          cached: true
        })
      }
    } catch (e) {
      console.warn('Branch cache lookup warning:', e?.message)
    }
  }

  const depth = previousCards.length + 1
  const context = previousCards
    .slice(-4)
    .map((card, index) => {
      const body = card.body || (card.pages || []).join(' ')
      return `${index + 1}. ${card.heading || 'Opening'}: ${String(body).slice(0, 600)}`
    })
    .join('\n\n')

  const fullPrompt = `You are the editorial content engine for Rabbit Hole, a learning app where users explore intriguing questions and dive progressively deeper.

You are writing a follow-up inquiry.

Main topic: "${topic.title}" (${topic.category || 'General'})
User chose this curiosity direction: "${selectedPrompt}"
Current depth: ${Math.max(depth - 1, 1)}

Previous context:
${context || 'No previous context available.'}

Return a JSON object with:
- "pages": an array of strings. Each string is one natural reading section (1-2 prose paragraphs per page, roughly 80-120 words). Use 2-3 sections total.
- "prompts": exactly 3 new clickable follow-up questions.

IMPORTANT: Separate paragraphs within each page using a blank line (two newlines). Do NOT use any special separator between pages — the array structure handles that.

FOLLOW-UP RULES:
The reader chose a specific branch to explore. Write directly about that branch. Do not summarize what came before. Pick up where curiosity leads and unpack what is actually happening underneath.

Start directly with the core mechanism or story. Do not begin with phrases like "The question...", "To answer this...", "You asked...", or repeat the question.

End with something unresolved, a deeper tension, or an unexplored edge that makes the next questions compelling.

RULES FOR THE CONTENT:
- Total length across all pages: 220 to 320 words.
- ONLY flowing prose paragraphs. Absolutely NO bullet points, NO numbered lists, NO dashes at the start of lines, NO em-dashes used as list markers.
- Do not write a title or heading.
- Write like a thoughtful essayist who understands the mechanics intimately.
- Never use filler phrases like "fascinating", "intriguing", "delve into", "in conclusion", "it is worth noting".

RULES FOR PROMPTS:
- Each prompt should be a natural question, max 13 words.
- Prompts should point in meaningfully different directions.`

  try {
    const raw = await callGemini(c.env, [{ role: 'user', content: fullPrompt }], {
      temperature: 0.85,
      maxOutputTokens: 2048,
      responseSchema: starterResponseSchema()
    })

    const parsed = parseJSON(raw)
    const pages = (Array.isArray(parsed.pages) ? parsed.pages : []).map(cleanDashes).filter(Boolean)
    const prompts = (Array.isArray(parsed.prompts) ? parsed.prompts : []).slice(0, 3)

    // Store reusable branch in topic_branches so anyone choosing this branch gets it instantly
    if (db && topicId && pages.length > 0) {
      try {
        const branchId = `tb_${topicId}_${promptHash}`
        await db.prepare(`
          INSERT OR REPLACE INTO topic_branches (
            id, topic_id, prompt_hash, prompt_text, content_data, questions_data, audio_chunks_data, times_used, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(
          branchId,
          topicId,
          promptHash,
          selectedPrompt,
          JSON.stringify(pages),
          JSON.stringify(prompts),
          null,
          Date.now()
        ).run()
      } catch (e) {
        console.warn('Failed to cache topic branch:', e?.message)
      }
    }

    // Record backend usage for quota and tracking
    const user = c.get('user')
    await recordUsage(db, user, 'ai_branch', (raw || '').length)

    return c.json({ pages, prompts, cached: false })
  } catch (err) {
    console.error('Error generating rabbit hole step:', err)
    return c.json({ error: 'Failed to generate branch step', message: err?.message }, 500)
  }
})

/**
 * POST /api/v1/ai/explore-topics
 * Generates fresh topic ideas from user interests and caches in D1
 */
aiRoutes.post('/explore-topics', optionalAuth(), async (c) => {
  const { interests = [], count = 8, existingTitles = [] } = await c.req.json()

  const selectedList = interests.length > 0 ? interests.join(', ') : 'Science, History, Technology, Philosophy'
  const prompt = `You are the topic engine for Rabbit Hole, a learning app where users open curiosity questions and then read deeper AI-generated cards.

Generate exactly ${count} unique topic ideas that make someone stop scrolling and think "I need to know this."

Rules:
- Each topic needs: title, description, category, tags, imageTags
- title: a crisp clickable question, max 12 words
- description: a rich 55-90 word hook that explains why this is interesting without giving away the whole answer
- category: choose the most relevant category label
- tags: 2-4 category tags
- imageTags: 3-5 specific visual search phrases for a background image; include concrete objects, scenes, or environments
- Titles should sound like: "How Does a Car Engine Work?", "What If Earth Lost Oxygen for One Second?", "Why Do We Dream?"
- Prefer topics that connect multiple interests at once: engineering + everyday life, space + body, history + money
- Avoid vague titles like "The hidden side of...", "Introduction to...", "The mystery of...", or "Exploring..."
- Avoid repeating these existing titles: ${existingTitles.join(' | ') || 'none'}
- Never use these words or phrases: "fascinating", "intriguing", "remarkable", "delve into", "dive into", "it's worth noting", "in conclusion", "let's explore", "unpacking", "demystifying", "captivating", "in the realm of".

User selected interests to prioritize: ${selectedList}

Return ONLY a raw JSON array of objects.`

  try {
    const raw = await callGemini(c.env, [{ role: 'user', content: prompt }], {
      temperature: 0.9,
      maxOutputTokens: 4096,
      responseSchema: topicsResponseSchema()
    })

    const parsed = parseJSON(raw)
    const topics = (Array.isArray(parsed) ? parsed : []).slice(0, count).map(t => ({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: String(t.title || '').trim(),
      description: String(t.description || '').trim(),
      category: String(t.category || interests[0] || 'General').trim(),
      tags: Array.isArray(t.tags) ? t.tags : [t.category || 'General'],
      imageTags: Array.isArray(t.imageTags) ? t.imageTags : [],
      readingTime: '3 min',
      coverImage: ''
    }))

    return c.json({ topics })
  } catch (err) {
    console.error('Error generating explore topics:', err)
    return c.json({ error: 'Failed to generate explore topics', message: err?.message }, 500)
  }
})
