import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { auth, db, googleProvider, isFirebaseConfigured, signInWithPopup, signOut } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, onSnapshot, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { TOPICS } from '../data/topics'
import { getTopics } from '../services/db'

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

// Read localStorage once at module level so it's available immediately
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

    // Force Schema Reset to 2 for 35 categories and 20 topics migration
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

function cleanForStorage(value) {
  if (Array.isArray(value)) {
    return value.map(cleanForStorage).filter(item => item !== undefined)
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const cleaned = cleanForStorage(item)
      if (cleaned !== undefined) acc[key] = cleaned
      return acc
    }, {})
  }

  return value === undefined ? undefined : value
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [dbData, setDbData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localData, setLocalData] = useState(readLocalStorage)
  
  // Track whether onboarding has been completed this session to prevent resets
  const onboardedRef = useRef(localData.onboarded)

  // Synchronize local state with localStorage
  const updateLocalData = useCallback((updater) => {
    setLocalData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      writeLocalStorage(next)
      return next
    })
  }, [])

  // Listen to Auth State
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUser(null)
      setDbData(null)
      setLoading(false)
      return
    }

    let unsubscribeSnapshot = () => {}

    let unsubscribeAuth = () => {}

    try {
      unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid)

        // Asynchronously check and initialize the document without blocking snapshot listener or loading screen
        const initUserDoc = async () => {
          try {
            const docSnap = await getDoc(userRef)
            const currentLocal = readLocalStorage()

            if (!docSnap.exists()) {
              // First time user — create Firestore doc with whatever local data exists
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                interests: currentLocal.interests,
                savedIds: currentLocal.savedIds,
                theme: currentLocal.theme,
                onboarded: currentLocal.onboarded,
                streak: currentLocal.streak,
                lastReadDate: currentLocal.lastReadDate,
                readHistory: currentLocal.readHistory,
                schemaVersion: 2,
                createdAt: new Date().toISOString()
              })
            } else {
              // Existing user — merge any local anonymous progress
              let fireData = docSnap.data()

              // Force schema migration if version is old
              if (!fireData.schemaVersion || fireData.schemaVersion < 2) {
                await setDoc(userRef, {
                  interests: [],
                  onboarded: false,
                  schemaVersion: 2
                }, { merge: true })
                fireData.interests = []
                fireData.onboarded = false
                fireData.schemaVersion = 2
              }

              const mergedSaved = Array.from(new Set([...(fireData.savedIds || []), ...currentLocal.savedIds]))
              const mergedInterests = Array.from(new Set([...(fireData.interests || []), ...currentLocal.interests]))
              let mergedHistory = { ...(fireData.readHistory || {}), ...currentLocal.readHistory }
              const mergedStreak = Math.max(fireData.streak || 0, currentLocal.streak)
              const mergedOnboarded = (fireData.onboarded === true) || currentLocal.onboarded
              const mergedLastRead = mergedStreak === currentLocal.streak
                ? (currentLocal.lastReadDate || fireData.lastReadDate)
                : (fireData.lastReadDate || currentLocal.lastReadDate)

              // Clean up orphan history items (no topic snapshot, not in static TOPICS, not in IndexedDB)
              try {
                const dbTopics = await getTopics();
                const validIds = new Set(dbTopics.map(t => t.id));
                TOPICS.forEach(t => validIds.add(t.id));
                
                let cleanedHistory = { ...mergedHistory };
                let removedOrphans = false;
                
                for (const key of Object.keys(cleanedHistory)) {
                  const record = cleanedHistory[key];
                  if (!validIds.has(record.topicId) && !record.topicSnapshot) {
                    delete cleanedHistory[key];
                    removedOrphans = true;
                  }
                }
                
                if (removedOrphans) {
                  mergedHistory = cleanedHistory;
                }
              } catch (e) {
                console.error("Failed to clean up orphan history", e);
              }

              const hasChanges =
                mergedSaved.length !== (fireData.savedIds || []).length ||
                mergedInterests.length !== (fireData.interests || []).length ||
                Object.keys(mergedHistory).length !== Object.keys(fireData.readHistory || {}).length ||
                mergedStreak !== (fireData.streak || 0) ||
                mergedOnboarded !== (fireData.onboarded === true) ||
                fireData.schemaVersion !== 2

              if (hasChanges) {
                await setDoc(userRef, {
                  savedIds: mergedSaved,
                  interests: mergedInterests,
                  readHistory: mergedHistory,
                  streak: mergedStreak,
                  lastReadDate: mergedLastRead,
                  onboarded: mergedOnboarded,
                  schemaVersion: 2
                }, { merge: true })
              }
            }
          } catch (err) {
            console.error("Error initializing or migrating user doc in background:", err)
          }
        }

        // Run user doc setup in background
        initUserDoc()

        // Real-time snapshot listener — keeps dbData + localStorage in sync and unblocks loading instantly
        unsubscribeSnapshot = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            setDbData(data)

            // Keep localData in sync but protect against partial documents wiping state
            setLocalData(prev => {
              const next = {
                interests: data.interests !== undefined ? data.interests : prev.interests,
                savedIds: data.savedIds !== undefined ? data.savedIds : prev.savedIds,
                theme: data.theme !== undefined ? data.theme : prev.theme,
                onboarded: data.onboarded !== undefined ? data.onboarded : prev.onboarded,
                streak: data.streak !== undefined ? data.streak : prev.streak,
                lastReadDate: data.lastReadDate !== undefined ? data.lastReadDate : prev.lastReadDate,
                readHistory: data.readHistory !== undefined ? data.readHistory : prev.readHistory,
                schemaVersion: data.schemaVersion !== undefined ? data.schemaVersion : prev.schemaVersion
              }
              writeLocalStorage(next)
              return next
            })

            // Track onboarded state
            onboardedRef.current = data.onboarded === true
          } else {
            // Document doesn't exist yet (or is still creating).
            // Fall back to local data until it gets created, so the user is not blocked
            const local = readLocalStorage()
            setLocalData(local)
            onboardedRef.current = local.onboarded
          }
        }, (err) => {
          console.error("Firestore subscription error:", err)
        })
        
        // We do not wait for onSnapshot to finish before unblocking the UI.
        // We already have localData, so we can render immediately.
        setLoading(false)

      } else {
        // Signed out — keep localData as-is (it was already mirrored)
        setDbData(null)
        setLoading(false)
      }
      }, (err) => {
        console.error("Firebase auth listener failed:", err)
        setUser(null)
        setDbData(null)
        setLoading(false)
      })
    } catch (err) {
      console.error("Firebase auth listener failed:", err)
      setUser(null)
      setDbData(null)
      setLoading(false)
    }

    return () => {
      unsubscribeAuth()
      unsubscribeSnapshot()
    }
  }, [])

  // Google Login helper
  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase authentication is not configured')
    }

    try {
      setLoading(true)
      await signInWithPopup(auth, googleProvider)
      setLoading(false)
    } catch (err) {
      console.error("Google Sign-In Error:", err)
      setLoading(false)
      throw err
    }
  }, [])

  // Sign out helper
  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setUser(null)
      setDbData(null)
      return
    }

    try {
      setLoading(true)
      await signOut(auth)
      setLoading(false)
    } catch (err) {
      console.error("Sign Out Error:", err)
      setLoading(false)
    }
  }, [])

  // ─── State Modifiers ───

  const toggleSaveTopic = useCallback(async (topicId) => {
    const currentSaved = localData.savedIds || []
    const isCurrentlySaved = currentSaved.includes(topicId)
    const nextSaved = isCurrentlySaved
      ? currentSaved.filter(id => id !== topicId)
      : [...currentSaved, topicId]

    updateLocalData(prev => ({ ...prev, savedIds: nextSaved }))

    if (user && db) {
      const userRef = doc(db, 'users', user.uid)
      try {
        await setDoc(userRef, {
          savedIds: isCurrentlySaved ? arrayRemove(topicId) : arrayUnion(topicId)
        }, { merge: true })
      } catch (err) {
        console.error("Error saving topic:", err)
      }
    }
  }, [user, localData.savedIds, updateLocalData])

  const updateInterests = useCallback(async (interests) => {
    updateLocalData(prev => ({ ...prev, interests, onboarded: true }))
    onboardedRef.current = true

    if (user && db) {
      const userRef = doc(db, 'users', user.uid)
      try {
        await setDoc(userRef, { interests, onboarded: true }, { merge: true })
      } catch (err) {
        console.error("Error updating interests:", err)
      }
    }
  }, [user, updateLocalData])

  const markOnboarded = useCallback(async () => {
    onboardedRef.current = true
    updateLocalData(prev => ({ ...prev, onboarded: true }))

    if (user && db) {
      const userRef = doc(db, 'users', user.uid)
      try {
        await setDoc(userRef, { onboarded: true }, { merge: true })
      } catch (err) {
        console.error("Error marking onboarded:", err)
      }
    }
  }, [user, updateLocalData])

  const toggleTheme = useCallback(async (newTheme) => {
    updateLocalData(prev => ({ ...prev, theme: newTheme }))

    if (user && db) {
      const userRef = doc(db, 'users', user.uid)
      try {
        await setDoc(userRef, { theme: newTheme }, { merge: true })
      } catch (err) {
        console.error("Error toggling theme:", err)
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

    const processStreak = (currentStreak, lastRead) => {
      if (!lastRead) return 1
      if (lastRead === today) return currentStreak || 1
      if (lastRead === yesterday) return (currentStreak || 0) + 1
      return 1
    }

    const currentStreak = localData.streak || 0
    const lastRead = localData.lastReadDate || ''
    const newStreak = processStreak(currentStreak, lastRead)
    
    const sessionRecord = cleanForStorage({
      id: sessionId,
      topicId: topicId,
      title: topicTitle,
      category: topicCategory,
      cardsRead: cardsRead,
      totalCards: totalCards,
      date: today,
      lastUpdated: now,
      selectedPrompt: metadata.selectedPrompt,
      cards: metadata.cards || [],
      topicSnapshot: metadata.topicSnapshot
    })

    updateLocalData(prev => {
      return {
        ...prev,
        streak: newStreak,
        lastReadDate: today,
        readHistory: {
          ...(prev.readHistory || {}),
          [sessionId]: sessionRecord
        }
      }
    })

    if (user && db) {
      const userRef = doc(db, 'users', user.uid)
      try {
        await setDoc(userRef, {
          streak: newStreak,
          lastReadDate: today,
          readHistory: {
            [sessionId]: sessionRecord
          }
        }, { merge: true })
      } catch (err) {
        console.error("Error completing topic:", err)
      }
    }
  }, [user, localData.streak, localData.lastReadDate, updateLocalData])

  // Expose uniform user data interface
  // Always use localData as the source of truth for instant UI reactivity.
  // The onSnapshot listener continuously syncs Firestore changes back into localData.
  const userData = localData

  // Determine if onboarding is complete — from any source
  const isOnboarded = onboardedRef.current ||
    userData?.onboarded === true ||
    (userData?.interests && userData.interests.length > 0)

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      isOnboarded,
      loginWithGoogle,
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
