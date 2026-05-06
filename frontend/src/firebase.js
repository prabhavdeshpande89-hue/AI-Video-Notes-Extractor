import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA8djBjW-sSN0f8fK9QOxOp8P6SuQBVu6o",
  authDomain: "video-note-extractor.firebaseapp.com",
  projectId: "video-note-extractor",
  storageBucket: "video-note-extractor.firebasestorage.app",
  messagingSenderId: "673884824882",
  appId: "1:673884824882:web:f054b706e448b93717a32b",
  measurementId: "G-66ECWNDT1K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Authentication
export const auth = getAuth(app);

// Google Provider
export const provider = new GoogleAuthProvider();