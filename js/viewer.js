/**
 * viewer.js
 * Halaman tampil (link 2): memuat data dari ?id=..., lalu menjalankan alur
 * Welcome -> (Nama) -> Pertanyaan -> Ucapan + foto utama + surat + galeri.
 */
import { loadConfession, chunksToBlobUrl } from "./db.js";
import { startGame, GAME_INFO } from "./games.js";

const $ = (id) => document.getElementById(id);

const screens = {
  loading: $("screen-loading"),
  error: $("screen-error"),
  welcome: $("screen-welcome"),
  name: $("screen-name"),
  intro: $("screen-intro"),
  game: $("screen-game"),
  question: $("screen-question"),
  success: $("screen-success"),
};

const nameInput = $("name-input");
const btnYes = $("btn-yes");
const btnNo = $("btn-no");
const musicToggle = $("music-toggle");

const SCALE = { noShrink: 0.86, noMin: 0.4, yesGrow: 1.18, yesMax: 2.6 };
const HEARTS = ["💖", "💗", "💕", "💘", "🌸"];

let CFG = null;
let PHOTOS = [];
let userName = "";
let current = "loading";
let noCount = 0;
let baseYes = 0;
let baseNo = 0;
let noTexts = [];

const fill = (tpl) =>
  String(tpl || "")
    .replace(/\{nama\}/g, userName)
    .replace(/\{pengirim\}/g, (CFG && CFG.sender) || "");

function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
  current = name;
}

function fail(title, text) {
  $("error-title").textContent = title;
  $("error-text").textContent = text;
  show("error");
}

/* ---------------- Muat data ---------------- */
async function init() {
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!/^[A-Za-z0-9]{6,40}$/.test(id)) {
    return fail("Link tidak valid", "Periksa lagi link yang kamu terima.");
  }
  try {
    const data = await loadConfession(id);
    start(data);
  } catch (e) {
    console.error(e);
    if (e.code === "expired") {
      fail("Link sudah kedaluwarsa ⏳", "Link ini hanya berlaku 24 jam. Minta pengirimnya membuat yang baru.");
    } else if (e.code === "not-found") {
      fail(
        "Link tidak ditemukan atau sudah kedaluwarsa",
        "Link hanya berlaku 24 jam. Periksa lagi link-nya, atau minta pengirimnya membuat yang baru."
      );
    } else {
      fail("Gagal memuat", "Cek koneksi internet lalu muat ulang halaman ini.");
    }
  }
}

function start(data) {
  CFG = data.config || {};
  PHOTOS = data.photos || [];
  userName = (CFG.recipient || "").trim();
  noTexts = Array.isArray(CFG.noTexts) ? CFG.noTexts : [];

  const w = CFG.welcome || {};
  $("welcome-title").textContent = fill(w.title);
  $("welcome-text").textContent = fill(w.text);
  $("welcome-hint").textContent = fill(w.hint);
  $("name-title").textContent = fill((CFG.name && CFG.name.title) || "Siapa namamu?");
  const q = CFG.question || {};
  btnYes.textContent = q.yes || "Mau";
  btnNo.textContent = q.no || "Nggak";

  if (data.musicChunks && data.musicChunks.length) {
    try {
      prepareMusic(chunksToBlobUrl(data.musicChunks));
    } catch (e) {
      console.warn("Musik gagal disiapkan", e);
    }
  }
  show("welcome");
}

/* ---------------- Alur ---------------- */
function showQuestion() {
  $("question-text").textContent = fill((CFG.question && CFG.question.text) || "{nama}, mau jadi pacarku?");
  show("question");
  requestAnimationFrame(() => {
    baseYes = parseFloat(getComputedStyle(btnYes).fontSize);
    baseNo = parseFloat(getComputedStyle(btnNo).fontSize);
  });
}

function goNext() {
  if (current !== "welcome") return;
  startMusic();
  if (userName) {
    startFlow();
  } else {
    show("name");
    setTimeout(() => nameInput.focus(), 400);
  }
}
document.addEventListener("click", () => {
  if (current === "welcome") goNext();
  else if (current === "intro") nextIntro();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (current === "welcome") {
    e.preventDefault();
    goNext();
  } else if (current === "intro") {
    e.preventDefault();
    nextIntro();
  }
});

$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = nameInput.value.trim();
  if (!v) {
    $("name-error").textContent = "Namanya diisi dulu ya 🙂";
    return;
  }
  $("name-error").textContent = "";
  userName = v;
  startFlow();
});

/* ---------------- Pengantar & mini game ---------------- */
let introLines = [];
let introIdx = 0;
let introBusy = false;
let stopGame = null;

function startFlow() {
  introLines = (Array.isArray(CFG.intro) ? CFG.intro : []).map(fill).filter(Boolean);
  introIdx = 0;
  if (introLines.length) {
    showIntroLine();
    show("intro");
  } else {
    beginGame();
  }
}

function showIntroLine() {
  const line = $("intro-line");
  line.classList.remove("in");
  line.textContent = introLines[introIdx];
  void line.offsetWidth; // restart transisi
  line.classList.add("in");
}

function nextIntro() {
  if (current !== "intro" || introBusy) return;
  introBusy = true;
  setTimeout(() => (introBusy = false), 450);
  introIdx++;
  if (introIdx < introLines.length) showIntroLine();
  else beginGame();
}

function beginGame() {
  const g = CFG.game || {};
  const info = GAME_INFO[g.type];
  if (!info) return showQuestion();

  const area = $("game-area");
  area.textContent = "";
  $("game-title").textContent = info.title;
  $("game-hint").textContent = info.hint;
  const skip = $("game-skip");
  skip.hidden = true;

  let fails = 0;
  let over = false;
  const reveal = () => (skip.hidden = false);
  const timer = setTimeout(reveal, info.skipMs);
  const finish = () => {
    if (over) return;
    over = true;
    clearTimeout(timer);
    if (stopGame) {
      stopGame();
      stopGame = null;
    }
    area.textContent = "";
    showQuestion();
  };
  skip.onclick = finish;

  show("game");
  screens.game.scrollTop = 0;
  try {
    stopGame = startGame(g.type, area, {
      photos: PHOTOS,
      config: CFG,
      fill,
      fail() {
        if (over) return;
        fails++;
        if (fails >= info.skipFails) reveal();
      },
      win() {
        if (over) return;
        skip.hidden = true;
        $("game-hint").textContent = fill(g.winText || "Berhasil! 🎉");
        launchConfetti(40);
        setTimeout(finish, 1600);
      },
    });
  } catch (e) {
    console.error(e);
    finish();
  }
}

/* ---------------- Tombol "Nggak" ---------------- */
function resizeButtons() {
  const noScale = Math.max(SCALE.noMin, Math.pow(SCALE.noShrink, noCount + 1));
  const yesScale = Math.min(SCALE.yesMax, Math.pow(SCALE.yesGrow, noCount + 1));
  if (baseNo) btnNo.style.fontSize = baseNo * noScale + "px";
  if (baseYes) btnYes.style.fontSize = baseYes * yesScale + "px";
}

function moveNoButton() {
  resizeButtons();
  if (noTexts.length) btnNo.textContent = noTexts[noCount % noTexts.length];
  noCount++;

  const pad = 12;
  const w = btnNo.offsetWidth;
  const h = btnNo.offsetHeight;
  const maxX = Math.max(window.innerWidth - w - pad, pad);
  const maxY = Math.max(window.innerHeight - h - pad, pad);
  const yes = btnYes.getBoundingClientRect();

  let x, y, tries = 0;
  do {
    x = pad + Math.random() * (maxX - pad);
    y = pad + Math.random() * (maxY - pad);
    tries++;
  } while (
    tries < 40 &&
    x < yes.right + 10 && x + w > yes.left - 10 &&
    y < yes.bottom + 10 && y + h > yes.top - 10
  );

  btnNo.classList.add("runaway");
  btnNo.style.left = x + "px";
  btnNo.style.top = y + "px";
}

["mouseenter", "pointerdown", "touchstart", "focus"].forEach((evt) => {
  btnNo.addEventListener(
    evt,
    (e) => {
      e.preventDefault();
      moveNoButton();
    },
    { passive: false }
  );
});
btnNo.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  moveNoButton();
});
window.addEventListener("resize", () => {
  if (btnNo.classList.contains("runaway")) moveNoButton();
});

/* ---------------- Layar ucapan ---------------- */
function buildSuccess() {
  const s = CFG.success || {};
  $("success-title").textContent = fill(s.title);
  $("success-text").textContent = fill(s.text);

  // foto utama = foto pertama
  if (PHOTOS[0]) {
    const img = $("hero-img");
    img.src = PHOTOS[0].data;
    $("hero-caption").textContent = fill(PHOTOS[0].caption);
    $("hero").hidden = false;
  }

  // surat (opsional)
  const L = CFG.letter;
  if (L && Array.isArray(L.paragraphs) && L.paragraphs.length) {
    $("letter-title").textContent = fill(L.title);
    $("letter-title").hidden = !L.title;
    const body = $("letter-body");
    body.textContent = "";
    L.paragraphs.forEach((t) => {
      const p = document.createElement("p");
      p.textContent = fill(t);
      body.appendChild(p);
    });
    $("letter-sign").textContent = fill(L.signature);
    $("letter").hidden = false;
  }

  // galeri = foto ke-2 dst.
  const rest = PHOTOS.slice(1);
  if (rest.length) {
    const box = $("gallery");
    box.textContent = "";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io =
      !reduce && "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) =>
              entries.forEach((en) => {
                if (en.isIntersecting) {
                  en.target.classList.add("in");
                  io.unobserve(en.target);
                }
              }),
            { root: screens.success, threshold: 0.12 }
          )
        : null;

    rest.forEach((p) => {
      const caption = fill(p.caption);
      const fig = document.createElement("figure");
      const img = document.createElement("img");
      img.src = p.data;
      img.alt = caption || "Foto kenangan";
      fig.appendChild(img);
      const cap = document.createElement("figcaption");
      cap.textContent = caption;
      fig.appendChild(cap);
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.addEventListener("click", () => openLightbox(p.data, caption));
      fig.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(p.data, caption);
        }
      });
      box.appendChild(fig);
      if (io) io.observe(fig);
      else fig.classList.add("in");
    });

    if (CFG.galleryTitle) {
      $("gallery-title").textContent = fill(CFG.galleryTitle);
      $("gallery-title").hidden = false;
    }
    box.hidden = false;
  }

  // WhatsApp (opsional) - hanya angka yang dipakai untuk membentuk tautan
  const wa = CFG.whatsapp;
  if (wa && wa.number) {
    const n = String(wa.number).replace(/\D/g, "");
    if (n.length >= 9 && n.length <= 15) {
      $("wa-btn").href = "https://wa.me/" + n + "?text=" + encodeURIComponent(fill(wa.message));
      $("wa-btn").textContent = wa.button || "Kabari aku lewat WhatsApp 💬";
      $("wa-btn").hidden = false;
    }
  }
}

btnYes.addEventListener("click", () => {
  btnNo.style.display = "none";
  buildSuccess();
  show("success");
  screens.success.scrollTop = 0;
  launchConfetti();
});

/* ---------------- Lightbox ---------------- */
const lightbox = $("lightbox");
function openLightbox(src, caption) {
  $("lightbox-img").src = src;
  $("lightbox-img").alt = caption || "Foto kenangan";
  $("lightbox-caption").textContent = caption || "";
  lightbox.hidden = false;
}
function closeLightbox() {
  lightbox.hidden = true;
  $("lightbox-img").removeAttribute("src");
}
lightbox.addEventListener("click", closeLightbox);
$("lightbox-close").addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
});

/* ---------------- Efek ---------------- */
function spawnHeart() {
  const el = document.createElement("span");
  el.className = "heart";
  el.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
  el.style.left = Math.random() * 100 + "vw";
  el.style.fontSize = 14 + Math.random() * 22 + "px";
  el.style.animationDuration = 6 + Math.random() * 6 + "s";
  $("hearts").appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function launchConfetti(count = 80) {
  const colors = ["#e63e6d", "#ffb3c6", "#ffd166", "#06d6a0", "#118ab2"];
  for (let i = 0; i < count; i++) {
    const c = document.createElement("span");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = 2.5 + Math.random() * 2.5 + "s";
    c.style.animationDelay = Math.random() * 0.8 + "s";
    document.body.appendChild(c);
    c.addEventListener("animationend", () => c.remove());
  }
}

/* ---------------- Musik (opsional) ---------------- */
let audio = null;
let muted = false;
let musicStarted = false;

function prepareMusic(url) {
  audio = new Audio(url);
  audio.loop = true;
  audio.volume = 0.5;
  audio.addEventListener("error", () => {
    musicToggle.hidden = true;
    audio = null;
  });
}

function startMusic() {
  if (!audio || musicStarted) return;
  musicStarted = true;
  audio.play().catch(() => {});
  musicToggle.hidden = false;
}

musicToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  muted = !muted;
  if (audio) audio.muted = muted;
  musicToggle.textContent = muted ? "🔇" : "🔊";
});

document.addEventListener("visibilitychange", () => {
  if (!audio || !musicStarted) return;
  if (document.hidden) audio.pause();
  else audio.play().catch(() => {});
});

/* ---------------- Start ---------------- */
setInterval(spawnHeart, 600);
init();
