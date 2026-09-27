import { auth } from '../firebase.js'

const BASE_URL = '' // Same-origin relative path for Cloudflare Worker

async function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    } catch (err) {
      console.warn('Failed to retrieve Firebase ID token:', err)
    }
  }

  return headers
}

async function request(endpoint, options = {}) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  })

  if (!res.ok) {
    let errMessage = `HTTP error ${res.status}`
    try {
      const errJson = await res.json()
      errMessage = errJson.message || errJson.error || errMessage
    } catch {
      const errText = await res.text()
      if (errText) errMessage = errText
    }
    throw new Error(errMessage)
  }

  return res.json()
}

export const apiClient = {
  // ─── Auth & User State (Cloudflare D1) ───
  async syncAuth(profileData = {}) {
    return request('/api/v1/auth/sync', {
      method: 'POST',
      body: JSON.stringify(profileData)
    })
  },

  async getMe() {
    return request('/api/v1/user/me', {
      method: 'GET'
    })
  },

  async updateUser(updates) {
    return request('/api/v1/user/me', {
      method: 'PATCH',
      body: JSON.stringify(updates)
    })
  },

  async getInterests() {
    return request('/api/v1/interests', {
      method: 'GET'
    })
  },

  async setInterests(interests) {
    return request('/api/v1/interests', {
      method: 'PUT',
      body: JSON.stringify({ interests })
    })
  },

  async getSaved() {
    return request('/api/v1/saved', {
      method: 'GET'
    })
  },

  async toggleSaved(topicId) {
    return request('/api/v1/saved/toggle', {
      method: 'POST',
      body: JSON.stringify({ topicId })
    })
  },

  async getSessions() {
    return request('/api/v1/sessions', {
      method: 'GET'
    })
  },

  async recordSession(sessionData) {
    return request('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    })
  },

  async getTopics(category) {
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    return request(`/api/v1/topics${query}`, {
      method: 'GET'
    })
  },

  async saveTopics(topics) {
    return request('/api/v1/topics', {
      method: 'POST',
      body: JSON.stringify({ topics })
    })
  },

  // ─── Gemini AI (Cloudflare Worker) ───
  async generateStarter(topic) {
    return request('/api/v1/ai/topic-starter', {
      method: 'POST',
      body: JSON.stringify({ topic })
    })
  },

  async generateStep(topic, prompt, previousCards = []) {
    return request('/api/v1/ai/rabbit-hole-step', {
      method: 'POST',
      body: JSON.stringify({ topic, prompt, previousCards })
    })
  },

  async generateExploreTopics(interests = [], count = 8, existingTitles = []) {
    return request('/api/v1/ai/explore-topics', {
      method: 'POST',
      body: JSON.stringify({ interests, count, existingTitles })
    })
  },

  // ─── Cloudflare R2 Media & Audio ───
  async narrate(text, topicId, cardIndex = 0, voiceName, speed = 'fast') {
    return request('/api/v1/media/narrate', {
      method: 'POST',
      body: JSON.stringify({ text, topicId, cardIndex, voiceName, speed })
    })
  }
}
