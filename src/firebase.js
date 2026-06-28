import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyCVpR6ZatvEi5GlkV612GJGryf_K-plJVw',
  authDomain: 'rabbit-hole-944d3.firebaseapp.com',
  projectId: 'rabbit-hole-944d3',
  storageBucket: 'rabbit-hole-944d3.firebasestorage.app',
  messagingSenderId: '890535391600',
  appId: '1:890535391600:web:a8dffea6c0cabf70df1fb5',
  measurementId: 'G-BSHZJKM15F'
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId
}

function hasUsableFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.appId &&
    String(config.apiKey).startsWith('AIza')
  )
}

let app = null
let auth = null
let db = null
let googleProvider = null
let firebaseUnavailableReason = ''

if (hasUsableFirebaseConfig(firebaseConfig)) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({ prompt: 'select_account' })
  } catch (err) {
    firebaseUnavailableReason = err?.message || 'Firebase initialization failed'
    console.error('Firebase is unavailable:', err)
  }
} else {
  firebaseUnavailableReason = 'Firebase environment variables are missing or invalid'
  console.warn(firebaseUnavailableReason)
}

export const isFirebaseConfigured = Boolean(app && auth && db && googleProvider)
export const firebaseConfigError = firebaseUnavailableReason
export { auth, db, googleProvider }

export { signInWithPopup, signOut }
export default app
