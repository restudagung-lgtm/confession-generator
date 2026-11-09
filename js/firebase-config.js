/**
 * firebase-config.js
 * Isi dengan config Firebase project kamu (Project settings -> General -> Your apps -> Web app).
 * Kalau apiKey/projectId dikosongkan, web berjalan di MODE DEMO:
 * data disimpan di browser sendiri (link hanya berfungsi di browser yang sama).
 *
 * Catatan: apiKey Firebase untuk web memang bersifat publik. Keamanan data
 * diatur oleh firestore.rules, bukan oleh kerahasiaan apiKey.
 */
export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};

// Masa berlaku link (jam). Aturan di firestore.rules mengizinkan maksimal 30 jam.
export const LIFETIME_HOURS = 24;
