import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'

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
let googleProvider = null
let appleProvider = null
let firebaseUnavailableReason = ''

if (hasUsableFirebaseConfig(firebaseConfig)) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)

    googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({ prompt: 'select_account' })

    appleProvider = new OAuthProvider('apple.com')
    appleProvider.addScope('email')
    appleProvider.addScope('name')
  } catch (err) {
    firebaseUnavailableReason = err?.message || 'Firebase initialization failed'
    console.error('Firebase is unavailable:', err)
  }
} else {
  firebaseUnavailableReason = 'Firebase environment variables are missing or invalid'
  console.warn(firebaseUnavailableReason)
}

export const isFirebaseConfigured = Boolean(app && auth && googleProvider)
export const firebaseConfigError = firebaseUnavailableReason
export {
  auth,
  googleProvider,
  appleProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
}
export default app
