import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { getAnalytics, isSupported } from 'firebase/analytics'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCVpR6ZatvEi5GlkV612GJGryf_K-plJVw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'rabbit-hole-944d3.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'rabbit-hole-944d3',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'rabbit-hole-944d3.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '890535391600',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:890535391600:web:a8dffea6c0cabf70df1fb5',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BSHZJKM15F'
}

// Initialize Firebase App safely (singleton across HMR)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)

// Initialize Firebase Analytics safely
let analytics = null
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app)
    }
  }).catch(() => {})
}

// Providers
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

const appleProvider = new OAuthProvider('apple.com')
appleProvider.addScope('email')
appleProvider.addScope('name')

export const isFirebaseConfigured = Boolean(app && auth)
export const firebaseConfigError = !isFirebaseConfigured ? 'Firebase is not initialized' : ''

export {
  app,
  auth,
  analytics,
  googleProvider,
  appleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
}

export default app

