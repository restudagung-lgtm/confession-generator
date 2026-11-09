/**
 * generator.js
 * Halaman setting (link 1): pilih foto, atur teks, buat link (link 2).
 */
import { DEMO, saveConfession } from "./db.js";
import { compressImage } from "./image-utils.js";
import { randomLetter } from "./letters.js";
import { LIFETIME_HOURS } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const MAX_PHOTOS = 8;
const MAX_MUSIC_BYTES = 2 * 1024 * 1024;
const CHUNK_BYTES = 512 * 1024;

let photos = []; // { id, data, caption }
let music = null; // { name, chunks: [base64] }
let uid = 0;

if (DEMO) $("demo-banner").hidden = false;

/* ---------------- Foto ---------------- */
function renderPhotos() {
  const ul = $("photo-list");
  ul.textContent = "";
  $("photo-count").textContent = photos.length + "/" + MAX_PHOTOS;

  photos.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = "photo-item";

    const img = document.createElement("img");
    img.src = p.data;
    img.alt = "Foto " + (i + 1);
    li.appendChild(img);

    if (i === 0) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = "Foto utama";
      li.appendChild(b);
    }

    const cap = document.createElement("input");
    cap.type = "text";
    cap.maxLength = 60;
    cap.placeholder = "Keterangan";
    cap.value = p.caption;
    cap.addEventListener("input", () => (p.caption = cap.value));
    li.appendChild(cap);

    const act = document.createElement("div");
    act.className = "photo-actions";
    const mk = (label, title, fn, disabled) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.disabled = !!disabled;
      b.addEventListener("click", fn);
      act.appendChild(b);
    };
    mk("◀", "Geser ke depan", () => move(i, -1), i === 0);
    mk("▶", "Geser ke belakang", () => move(i, 1), i === photos.length - 1);
    mk("★", "Jadikan foto utama", () => makeMain(i), i === 0);
    mk("✕", "Hapus foto", () => {
      photos.splice(i, 1);
      renderPhotos();
    });
    li.appendChild(act);
    ul.appendChild(li);
  });
}

function move(i, d) {
  const j = i + d;
  if (j < 0 || j >= photos.length) return;
  [photos[i], photos[j]] = [photos[j], photos[i]];
  renderPhotos();
}
function makeMain(i) {
  photos.unshift(photos.splice(i, 1)[0]);
  renderPhotos();
}

$("photo-input").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  const status = $("photo-status");
  const room = MAX_PHOTOS - photos.length;
  if (!files.length) return;
  if (room <= 0) {
    status.textContent = "Sudah 8 foto (maksimal). Hapus satu dulu untuk menambah.";
    return;
  }
  const use = files.slice(0, room);
  const skippedLimit = files.length - use.length;
  const failed = [];

  status.textContent = "Memproses foto…";
  for (const f of use) {
    try {
      photos.push({ id: ++uid, data: await compressImage(f), caption: "" });
      renderPhotos();
    } catch (err) {
      failed.push(f.name);
    }
  }
  const notes = [];
  if (skippedLimit > 0) notes.push(skippedLimit + " foto dilewati karena melebihi batas 8.");
  if (failed.length) notes.push("Gagal diproses: " + failed.join(", ") + ". Coba JPG atau PNG.");
  status.textContent = notes.join(" ");
});

/* ---------------- Surat ---------------- */
$("btn-random").addEventListener("click", () => {
  $("f-letter").value = randomLetter();
});
$("btn-clear-letter").addEventListener("click", () => {
  $("f-letter").value = "";
});

/* ---------------- Musik ---------------- */
function bytesToB64(bytes) {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(s);
}

$("music-input").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  const status = $("music-status");
  if (!f) return;
  if (!/audio|mpeg|mp3/i.test(f.type) && !/\.mp3$/i.test(f.name)) {
    status.textContent = "File harus berformat mp3.";
    return;
  }
  if (f.size > MAX_MUSIC_BYTES) {
    status.textContent =
      "File terlalu besar (" + (f.size / 1048576).toFixed(1) + " MB). Maksimal 2 MB. Kecilkan/potong dulu.";
    return;
  }
  const bytes = new Uint8Array(await f.arrayBuffer());
  const chunks = [];
  for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
    chunks.push(bytesToB64(bytes.subarray(i, i + CHUNK_BYTES)));
  }
  music = { name: f.name, chunks };
  status.textContent = "Dipakai: " + f.name + " (" + (f.size / 1048576).toFixed(1) + " MB)";
  $("btn-music-remove").hidden = false;
});

$("btn-music-remove").addEventListener("click", () => {
  music = null;
  $("music-status").textContent = "Musik dihapus.";
  $("btn-music-remove").hidden = true;
});

/* ---------------- Kumpulkan config ---------------- */
function normalizePhone(raw) {
  let n = String(raw || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("0")) n = "62" + n.slice(1);
  return n;
}

function collectConfig() {
  const v = (id, max) => $(id).value.trim().slice(0, max);

  const paragraphs = $("f-letter")
    .value.split(/\n\s*\n/)
    .map((s) => s.trim().slice(0, 900))
    .filter(Boolean)
    .slice(0, 12);

  const noTexts = $("f-notexts")
    .value.split("\n")
    .map((s) => s.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 10);

  const sender = v("f-sender", 30);
  const phone = normalizePhone($("f-wa").value);

  return {
    recipient: v("f-recipient", 30),
    sender,
    welcome: {
      title: v("f-welcome-title", 60),
      text: v("f-welcome-text", 160),
      hint: v("f-welcome-hint", 60),
    },
    name: { title: v("f-name-title", 80) },
    question: {
      text: v("f-question", 120),
      yes: v("f-yes", 20) || "Mau",
      no: v("f-no", 20) || "Nggak",
    },
    noTexts,
    success: { title: v("f-success-title", 80), text: v("f-success-text", 200) },
    galleryTitle: v("f-gallery-title", 60),
    letter: paragraphs.length
      ? {
          title: v("f-letter-title", 80),
          paragraphs,
          signature: sender ? "— " + sender : "— dari aku",
        }
      : null,
    whatsapp: phone
      ? {
          number: phone,
          message: v("f-wa-msg", 200),
          button: "Kabari aku lewat WhatsApp 💬",
        }
      : null,
  };
}

/* ---------------- Buat link ---------------- */
function setStatus(msg, isError) {
  const el = $("gen-status");
  el.textContent = msg;
  el.classList.toggle("error", !!isError);
}

function friendlyError(e) {
  const code = e && e.code;
  if (code === "permission-denied")
    return "Ditolak server. Periksa aturan Firestore dan pastikan jam di perangkatmu akurat.";
  if (code === "unavailable") return "Tidak bisa terhubung ke server. Cek koneksi internet.";
  return (e && e.message) || "Terjadi kesalahan.";
}

$("gen-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!photos.length) {
    setStatus("Pilih minimal 1 foto dulu ya.", true);
    $("photo-input").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const phoneRaw = $("f-wa").value.trim();
  const phone = normalizePhone(phoneRaw);
  if (phoneRaw && (phone.length < 9 || phone.length > 15)) {
    setStatus("Nomor WhatsApp sepertinya belum benar.", true);
    return;
  }

  const btn = $("btn-generate");
  btn.disabled = true;
  setStatus("Menyiapkan…");

  try {
    const id = await saveConfession(
      {
        config: collectConfig(),
        photos: photos.map((p) => ({ data: p.data, caption: p.caption.trim().slice(0, 60) })),
        musicChunks: music ? music.chunks : [],
      },
      (done, total) => setStatus("Mengunggah " + done + "/" + total + "…")
    );

    const url = new URL("lihat.html?id=" + encodeURIComponent(id), location.href).href;
    const expiry = new Date(Date.now() + LIFETIME_HOURS * 3600 * 1000).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    $("result-link").value = url;
    $("btn-open").href = url;
    $("result-expiry").textContent = expiry;
    $("btn-share").hidden = !navigator.share;
    $("result").hidden = false;
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Gagal membuat link: " + friendlyError(err), true);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- Hasil ---------------- */
$("btn-copy").addEventListener("click", async () => {
  const input = $("result-link");
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (_) {
    input.select();
    document.execCommand("copy");
  }
  $("btn-copy").textContent = "Tersalin ✓";
  setTimeout(() => ($("btn-copy").textContent = "Salin link"), 1800);
});

$("btn-share").addEventListener("click", () => {
  navigator
    .share({ title: "Ada yang mau aku bilang…", text: "Ada sesuatu untukmu 💌", url: $("result-link").value })
    .catch(() => {});
});

$("btn-again").addEventListener("click", () => {
  $("result").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderPhotos();
