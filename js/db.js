/**
 * db.js
 * Penyimpanan data: Firebase Firestore (mode sungguhan) atau IndexedDB (mode demo).
 * Struktur Firestore:
 *   confessions/{id}                 -> config, photoCount, musicCount, createdAt, expiresAt
 *   confessions/{id}/photos/{0..7}   -> data (dataURL jpeg), caption, expiresAt
 *   confessions/{id}/music/{0..3}    -> data (base64 potongan mp3), expiresAt
 */
import { FIREBASE_CONFIG, LIFETIME_HOURS } from "./firebase-config.js";

export const DEMO = !FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId;

const FB_BASE = "https://www.gstatic.com/firebasejs/10.12.2/";
let fbCache = null;

async function firebase() {
  if (fbCache) return fbCache;
  const [appMod, fs] = await Promise.all([
    import(FB_BASE + "firebase-app.js"),
    import(FB_BASE + "firebase-firestore.js"),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  fbCache = { fs, db: fs.getFirestore(app) };
  return fbCache;
}

export function newId() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

const err = (code, message) => Object.assign(new Error(message || code), { code });

/* ---------------- Mode demo: IndexedDB ---------------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("confession-demo", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("items");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key, value) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction("items", "readwrite");
    t.objectStore("items").put(value, key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction("items").objectStore("items").get(key);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

async function idbDelete(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction("items", "readwrite");
    t.objectStore("items").delete(key);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

/* ---------------- API ---------------- */
/**
 * payload: { config, photos: [{data, caption}], musicChunks: [base64...] }
 * onProgress(done, total)
 * return: id
 */
export async function saveConfession(payload, onProgress = () => {}) {
  const id = newId();
  const expiresMs = Date.now() + LIFETIME_HOURS * 3600 * 1000;
  const { config, photos, musicChunks } = payload;
  const total = 1 + photos.length + musicChunks.length;

  if (DEMO) {
    await idbPut(id, { config, photos, musicChunks, expiresAt: expiresMs });
    onProgress(total, total);
    return id;
  }

  const { fs, db } = await firebase();
  const expiresAt = fs.Timestamp.fromMillis(expiresMs);
  let done = 0;

  await fs.setDoc(fs.doc(db, "confessions", id), {
    createdAt: fs.serverTimestamp(),
    expiresAt,
    photoCount: photos.length,
    musicCount: musicChunks.length,
    config,
  });
  onProgress(++done, total);

  for (let i = 0; i < photos.length; i++) {
    await fs.setDoc(fs.doc(db, "confessions", id, "photos", String(i)), {
      data: photos[i].data,
      caption: photos[i].caption || "",
      expiresAt,
    });
    onProgress(++done, total);
  }
  for (let i = 0; i < musicChunks.length; i++) {
    await fs.setDoc(fs.doc(db, "confessions", id, "music", String(i)), {
      data: musicChunks[i],
      expiresAt,
    });
    onProgress(++done, total);
  }
  return id;
}

/**
 * Hapus data sebuah link yang sudah kedaluwarsa (dokumen utama + foto + musik).
 * Server hanya mengizinkan penghapusan jika memang sudah lewat masa berlaku,
 * jadi aman dipanggil kapan saja. Kegagalan diabaikan (best effort).
 */
export async function cleanupConfession(id) {
  try {
    if (DEMO) {
      await idbDelete(id);
      return;
    }
    const { fs, db } = await firebase();
    const batch = fs.writeBatch(db);
    batch.delete(fs.doc(db, "confessions", id));
    for (let i = 0; i < 8; i++) batch.delete(fs.doc(db, "confessions", id, "photos", String(i)));
    for (let i = 0; i < 4; i++) batch.delete(fs.doc(db, "confessions", id, "music", String(i)));
    await batch.commit();
  } catch (e) {
    console.warn("Pembersihan dilewati:", e && e.code);
  }
}

/** return: { config, photos:[{data,caption}], musicChunks:[...], expiresAt(ms) } */
export async function loadConfession(id) {
  if (DEMO) {
    const item = await idbGet(id);
    if (!item) throw err("not-found");
    if (item.expiresAt <= Date.now()) {
      await cleanupConfession(id);
      throw err("expired");
    }
    return item;
  }

  const { fs, db } = await firebase();
  let snap;
  try {
    snap = await fs.getDoc(fs.doc(db, "confessions", id));
  } catch (e) {
    // aturan menolak jika dokumen tidak ada ATAU sudah lewat masa berlaku.
    // Coba bersihkan (server hanya mengizinkan jika memang sudah kedaluwarsa).
    if (e && e.code === "permission-denied") {
      await cleanupConfession(id);
      throw err("not-found");
    }
    throw e;
  }
  if (!snap.exists()) throw err("not-found");
  const d = snap.data();
  const expiresAt = d.expiresAt.toMillis();
  if (expiresAt <= Date.now()) {
    await cleanupConfession(id);
    throw err("expired");
  }

  const getSub = async (name, n) => {
    const out = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        fs.getDoc(fs.doc(db, "confessions", id, name, String(i))).catch(() => null)
      )
    );
    return out.filter((s) => s && s.exists()).map((s) => s.data());
  };

  const photos = (await getSub("photos", d.photoCount || 0)).map((p) => ({
    data: p.data,
    caption: p.caption || "",
  }));
  const musicChunks = (await getSub("music", d.musicCount || 0)).map((m) => m.data);
  return { config: d.config, photos, musicChunks, expiresAt };
}

/** Gabungkan potongan base64 menjadi URL audio yang bisa diputar. */
export function chunksToBlobUrl(chunks, type = "audio/mpeg") {
  const parts = chunks.map((b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  });
  return URL.createObjectURL(new Blob(parts, { type }));
}
