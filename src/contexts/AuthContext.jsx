import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import {
  auth,
  googleProvider,
  appleProvider,
  isFirebaseConfigured,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { apiClient } from '../services/apiClient'
import { TOPICS } from '../data/topics'

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const getTodayStr = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getYesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readLocalStorage() {
  try {
    const local = {
      interests: JSON.parse(localStorage.getItem('rh-interests') || '[]'),
      savedIds: JSON.parse(localStorage.getItem('rh-saved') || '[]'),
      theme: localStorage.getItem('rh-theme') || 'dark',
      onboarded: localStorage.getItem('rh-onboarded') === '1',
      streak: Number(localStorage.getItem('rh-streak') || '0'),
      lastReadDate: localStorage.getItem('rh-last-read') || '',
      readHistory: JSON.parse(localStorage.getItem('rh-history') || '{}'),
      schemaVersion: Number(localStorage.getItem('rh-schema-version') || '0')
    }

    if (local.schemaVersion < 2) {
      local.interests = []
      local.onboarded = false
      local.schemaVersion = 2
      localStorage.setItem('rh-interests', '[]')
      localStorage.setItem('rh-onboarded', '0')
      localStorage.setItem('rh-schema-version', '2')
    }
    return local
  } catch {
    return {
      interests: [],
      savedIds: [],
      theme: 'dark',
      onboarded: false,
      streak: 0,
      lastReadDate: '',
      readHistory: {},
      schemaVersion: 2
    }
  }
}

function writeLocalStorage(data) {
  localStorage.setItem('rh-interests', JSON.stringify(data.interests || []))
  localStorage.setItem('rh-saved', JSON.stringify(data.savedIds || []))
  localStorage.setItem('rh-theme', data.theme || 'dark')
  localStorage.setItem('rh-streak', String(data.streak || 0))
  localStorage.setItem('rh-last-read', data.lastReadDate || '')
  localStorage.setItem('rh-history', JSON.stringify(data.readHistory || {}))
  localStorage.setItem('rh-schema-version', String(data.schemaVersion || 2))
  localStorage.setItem('rh-onboarded', data.onboarded ? '1' : '0')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localData, setLocalData] = useState(readLocalStorage)
  const onboardedRef = useRef(localData.onboarded)

  const updateLocalData = useCallback((updater) => {
    setLocalData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      writeLocalStorage(next)
      return next
    })
  }, [])

  // Sync state with Cloudflare D1 Backend when user logs in
  const syncWithBackend = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return

    try {
      const currentLocal = readLocalStorage()
      // Call Cloudflare Worker sync endpoint (verified with Firebase JWT)
      const { user: backendUser } = await apiClient.syncAuth({
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        theme: currentLocal.theme,
        streak: currentLocal.streak,
        lastReadDate: currentLocal.lastReadDate,
        interests: currentLocal.interests,
        savedIds: currentLocal.savedIds,
        onboarded: currentLocal.onboarded
      })

      // Fetch persistent sessions history from D1
      const { history: backendHistory, streak: d1Streak, lastReadDate: d1LastRead } = await apiClient.getSessions()

      // Merge backend state into local state
      updateLocalData(prev => {
        const mergedInterests = Array.from(new Set([...(backendUser?.interests || []), ...prev.interests]))
        const mergedSaved = Array.from(new Set([...(backendUser?.savedIds || []), ...prev.savedIds]))
        const mergedHistory = { ...(backendHistory || {}), ...(prev.readHistory || {}) }
        const mergedStreak = Math.max(d1Streak || 0, prev.streak || 0)

        const next = {
          ...prev,
          interests: mergedInterests,
          savedIds: mergedSaved,
          theme: backendUser?.theme || prev.theme,
          onboarded: backendUser?.onboarded === true || prev.onboarded,
          streak: mergedStreak,
          lastReadDate: d1LastRead || prev.lastReadDate,
          readHistory: mergedHistory
        }
        writeLocalStorage(next)
        return next
      })
    } catch (err) {
      console.warn('Backend sync warning (offline or initializing):', err?.message || err)
    }
  }, [updateLocalData])

  // Listen to Firebase Auth state & process potential redirect sign-in
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null)
      setLoading(false)
      return
    }

    // Check for pending redirect auth results first
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setUser(result.user)
          await syncWithBackend(result.user)
        }
      })
      .catch((err) => {
        console.warn('Firebase redirect sign-in notice:', err?.message || err)
      })

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        await syncWithBackend(currentUser)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [syncWithBackend])

  // ─── Authentication Helpers ───

  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Firebase authentication is not configured')
    }
    try {
      setLoading(true)
      const res = await signInWithPopup(auth, googleProvider)
      setUser(res.user)
      await syncWithBackend(res.user)
      setLoading(false)
      return res.user
    } catch (err) {
      setLoading(false)
      console.error('Google Sign-In Error:', err)
      throw err
    }
  }, [syncWithBackend])

  const loginWithGoogleRedirect = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Firebase authentication is not configured')
    }
    setLoading(true)
    await signInWithRedirect(auth, googleProvider)
  }, [])

  const loginWithApple = useCallback(async () => {
    if (!isFirebaseConfigured || !appleProvider) {
      throw new Error('Apple authentication is not configured')
    }
    try {
      setLoading(true)
      const res = await signInWithPopup(auth, appleProvider)
      setUser(res.user)
      await syncWithBackend(res.user)
      setLoading(false)
      return res.user
    } catch (err) {
      setLoading(false)
      console.error('Apple Sign-In Error:', err)
      throw err
    }
  }, [syncWithBackend])

  const loginWithEmail = useCallback(async (email, password) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase authentication is not configured')
    }
    try {
      setLoading(true)
      const res = await signInWithEmailAndPassword(auth, email, password)
      setUser(res.user)
      await syncWithBackend(res.user)
      setLoading(false)
      return res.user
    } catch (err) {
      setLoading(false)
      console.error('Email Sign-In Error:', err)
      throw err
    }
  }, [syncWithBackend])

  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase authentication is not configured')
    }
    try {
      setLoading(true)
      const res = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName })
      }
      setUser(res.user)
      await syncWithBackend(res.user)
      setLoading(false)
      return res.user
    } catch (err) {
      setLoading(false)
      console.error('Email Sign-Up Error:', err)
      throw err
    }
  }, [syncWithBackend])

  const resetPassword = useCallback(async (email) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase authentication is not configured')
    }
    return sendPasswordResetEmail(auth, email)
  }, [])

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setUser(null)
      return
    }
    try {
      setLoading(true)
      await signOut(auth)
      setUser(null)
      setLoading(false)
    } catch (err) {
      setLoading(false)
      console.error('Sign Out Error:', err)
    }
  }, [])

  // ─── State Modifiers (Backed by Cloudflare D1) ───

  const toggleSaveTopic = useCallback(async (topicId) => {
    const currentSaved = localData.savedIds || []
    const isCurrentlySaved = currentSaved.includes(topicId)
    const nextSaved = isCurrentlySaved
      ? currentSaved.filter(id => id !== topicId)
      : [...currentSaved, topicId]

    updateLocalData(prev => ({ ...prev, savedIds: nextSaved }))

    if (user) {
      try {
        await apiClient.toggleSaved(topicId)
      } catch (err) {
        console.error('Error toggling saved topic on D1:', err)
      }
    }
  }, [user, localData.savedIds, updateLocalData])

  const updateInterests = useCallback(async (interests) => {
    updateLocalData(prev => ({ ...prev, interests, onboarded: true }))
    onboardedRef.current = true

    if (user) {
      try {
        await apiClient.setInterests(interests)
      } catch (err) {
        console.error('Error updating interests on D1:', err)
      }
    }
  }, [user, updateLocalData])

  const markOnboarded = useCallback(async () => {
    onboardedRef.current = true
    updateLocalData(prev => ({ ...prev, onboarded: true }))

    if (user) {
      try {
        await apiClient.updateUser({ onboarded: true })
      } catch (err) {
        console.error('Error updating onboarded status on D1:', err)
      }
    }
  }, [user, updateLocalData])

  const toggleTheme = useCallback(async (newTheme) => {
    updateLocalData(prev => ({ ...prev, theme: newTheme }))

    if (user) {
      try {
        await apiClient.updateUser({ theme: newTheme })
      } catch (err) {
        console.error('Error toggling theme on D1:', err)
      }
    }
  }, [user, updateLocalData])

  const completeTopic = useCallback(async (topicId, topicTitle, category, cardsRead, totalCards, metadata = {}) => {
    const today = getTodayStr()
    const yesterday = getYesterdayStr()
    const topic = TOPICS.find(item => item.id === topicId)
    const topicCategory = category || topic?.category || topic?.tags?.[0] || 'Uncategorized'
    const now = Date.now()
    const sessionId = `${now}-${topicId}`

    const currentStreak = localData.streak || 0
    const lastRead = localData.lastReadDate || ''
    let newStreak = 1
    if (lastRead === today) newStreak = currentStreak || 1
    else if (lastRead === yesterday) newStreak = (currentStreak || 0) + 1
    else newStreak = 1

    const sessionRecord = {
      id: sessionId,
      topicId,
      title: topicTitle,
      category: topicCategory,
      cardsRead,
      totalCards,
      date: today,
      lastUpdated: now,
      selectedPrompt: metadata.selectedPrompt || null,
      cards: metadata.cards || [],
      topicSnapshot: metadata.topicSnapshot || null,
      audioUrl: metadata.audioUrl || null
    }

    // Immediate local update
    updateLocalData(prev => ({
      ...prev,
      streak: newStreak,
      lastReadDate: today,
      readHistory: {
        ...(prev.readHistory || {}),
        [sessionId]: sessionRecord
      }
    }))

    // Persist to Cloudflare D1
    if (user) {
      try {
        await apiClient.recordSession(sessionRecord)
      } catch (err) {
        console.error('Error saving reading session to D1:', err)
      }
    }
  }, [user, localData.streak, localData.lastReadDate, updateLocalData])

  const userData = localData
  const isOnboarded = onboardedRef.current || userData?.onboarded === true || (userData?.interests && userData.interests.length > 0)

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      isOnboarded,
      loginWithGoogle,
      loginWithGoogleRedirect,
      loginWithApple,
      loginWithEmail,
      signUpWithEmail,
      resetPassword,
      logout,
      toggleSaveTopic,
      updateInterests,
      markOnboarded,
      toggleTheme,
      completeTopic
    }}>
      {children}
    </AuthContext.Provider>
  )
}
