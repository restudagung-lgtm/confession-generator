/**
 * games.js
 * Kumpulan mini game untuk halaman tampil (lihat.html).
 * Setiap game: (area, ctx) => fungsi pembersih.
 *   ctx.photos  : [{data, caption}]
 *   ctx.config  : seluruh config link
 *   ctx.fill(s) : ganti {nama}/{pengirim}
 *   ctx.fail()  : panggil saat pemain salah (untuk memunculkan tombol lewati)
 *   ctx.win()   : panggil saat game selesai
 */

export const GAME_LIST = [
  { id: "none", label: "Tanpa game", desc: "Langsung ke pertanyaan." },
  { id: "memory", label: "Cocokkan kartu foto", desc: "Membalik kartu dan mencari pasangan. Memakai fotomu." },
  { id: "catch", label: "Tangkap hati", desc: "Mengetuk 10 hati yang jatuh dari atas." },
  { id: "puzzle", label: "Puzzle foto", desc: "Menyusun foto utama yang teracak (geser kotak)." },
  { id: "scratch", label: "Gosok kejutan", desc: "Menggosok layar untuk membuka foto utama." },
  { id: "word", label: "Tebak pesan rahasia", desc: "Menebak huruf sampai pesan buatanmu terbuka." },
  { id: "quiz", label: "Kuis tentang kamu", desc: "Pertanyaan pilihan ganda buatanmu sendiri." },
];

// skipFails: jumlah kesalahan sebelum tombol "Lewati" muncul; skipMs: atau setelah sekian ms
export const GAME_INFO = {
  memory: { title: "Cocokkan kenangan 💞", hint: "Ketuk kartu dan temukan pasangan yang sama.", skipFails: 8, skipMs: 60000 },
  catch: { title: "Tangkap hatinya 💖", hint: "Ketuk 10 hati sebelum jatuh ke bawah.", skipFails: 8, skipMs: 50000 },
  puzzle: { title: "Susun fotonya 🧩", hint: "Ketuk kotak di samping ruang kosong untuk menggesernya.", skipFails: 3, skipMs: 90000 },
  scratch: { title: "Ada kejutan 🎁", hint: "Gosok layar untuk membukanya.", skipFails: 99, skipMs: 40000 },
  word: { title: "Tebak pesan rahasia 🔐", hint: "Tebak hurufnya untuk membuka pesan.", skipFails: 5, skipMs: 90000 },
  quiz: { title: "Seberapa kenal kamu? 🤔", hint: "Jawab pertanyaannya ya.", skipFails: 3, skipMs: 90000 },
};

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------------- 1. Cocokkan kartu foto ---------------- */
function memory(area, ctx) {
  const timers = [];
  const photos = ctx.photos;
  const emojis = ["💖", "🌸", "💌", "🧸", "🌷", "✨"];
  const pairs = Math.min(6, Math.max(4, photos.length));

  const faces = [];
  for (let i = 0; i < pairs; i++) {
    faces.push(
      i < photos.length
        ? { img: photos[i].data, cap: photos[i].caption || "" }
        : { txt: emojis[i - photos.length], cap: "" }
    );
  }
  const deck = shuffle(
    faces.map((f, key) => ({ ...f, key })).concat(faces.map((f, key) => ({ ...f, key })))
  );

  const grid = el("div", "memory-grid");
  const caption = el("p", "mem-caption", "");
  area.append(grid, caption);

  let first = null;
  let lock = false;
  let matched = 0;

  deck.forEach((card) => {
    const b = el("button", "mem-card");
    b.type = "button";
    b.dataset.key = card.key;
    b.setAttribute("aria-label", "Kartu tertutup");
    const inner = el("div", "mem-inner");
    const front = el("div", "mem-face mem-front", "💗");
    const back = el("div", "mem-face mem-back");
    if (card.img) {
      const im = document.createElement("img");
      im.src = card.img;
      im.alt = "";
      back.appendChild(im);
    } else {
      back.textContent = card.txt;
    }
    inner.append(front, back);
    b.appendChild(inner);

    b.addEventListener("click", () => {
      if (lock || b.classList.contains("flipped")) return;
      b.classList.add("flipped");
      if (!first) {
        first = { b, card };
        return;
      }
      const a = first;
      first = null;
      if (a.card.key === card.key) {
        a.b.classList.add("matched");
        b.classList.add("matched");
        caption.textContent = ctx.fill(card.cap) || "💞";
        matched++;
        if (matched === pairs) ctx.win();
      } else {
        lock = true;
        ctx.fail();
        timers.push(
          setTimeout(() => {
            a.b.classList.remove("flipped");
            b.classList.remove("flipped");
            lock = false;
          }, 800)
        );
      }
    });
    grid.appendChild(b);
  });

  return () => timers.forEach(clearTimeout);
}

/* ---------------- 2. Tangkap hati ---------------- */
function catchHearts(area, ctx) {
  const TARGET = 10;
  const EMOJI = ["💖", "💗", "💕", "💘"];
  let got = 0;
  let done = false;
  let last = 0;
  let acc = 0;
  let raf = 0;
  const items = [];

  const score = el("p", "game-score");
  const field = el("div", "catch-field");
  area.append(score, field);
  const update = () => (score.textContent = "💖 " + got + "/" + TARGET);
  update();

  const W = field.clientWidth || 300;
  const H = field.clientHeight || 360;

  function spawn() {
    const b = el("button", "catch-heart", rand(EMOJI));
    b.type = "button";
    b.setAttribute("aria-label", "Hati");
    const it = { b, x: Math.random() * (W - 48), y: -48, v: 90 + Math.random() * 60 + got * 6, dead: false };
    b.style.transform = "translate(" + it.x + "px," + it.y + "px)";
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (done || it.dead) return;
      it.dead = true;
      b.remove();
      got++;
      update();
      if (got >= TARGET) {
        done = true;
        ctx.win();
      }
    });
    field.appendChild(b);
    items.push(it);
  }

  function tick(t) {
    if (done) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    acc += dt;
    if (acc > 0.8) {
      acc = 0;
      spawn();
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.dead) {
        items.splice(i, 1);
        continue;
      }
      it.y += it.v * dt;
      it.b.style.transform = "translate(" + it.x + "px," + it.y + "px)";
      if (it.y > H) {
        it.dead = true;
        it.b.remove();
        items.splice(i, 1);
        ctx.fail();
      }
    }
    raf = requestAnimationFrame(tick);
  }

  spawn();
  raf = requestAnimationFrame((t) => {
    last = t;
    tick(t);
  });
  return () => {
    done = true;
    cancelAnimationFrame(raf);
  };
}

/* ---------------- 3. Puzzle foto (geser) ---------------- */
function puzzle(area, ctx) {
  const N = 3;
  const S = 720;
  const GAP = 6;
  const TILE = (S - GAP * (N - 1)) / N;
  const BLANK = N * N - 1;

  const canvas = el("canvas", "puzzle-canvas");
  canvas.width = S;
  canvas.height = S;
  const status = el("p", "game-score", "Gerakan: 0");
  area.append(canvas, status);
  const c = canvas.getContext("2d");

  const neighbors = (pos) => {
    const r = Math.floor(pos / N);
    const col = pos % N;
    const out = [];
    if (col > 0) out.push(pos - 1);
    if (col < N - 1) out.push(pos + 1);
    if (r > 0) out.push(pos - N);
    if (r < N - 1) out.push(pos + N);
    return out;
  };

  // acak dengan gerakan sah dari kondisi selesai, jadi pasti bisa diselesaikan
  const board = Array.from({ length: N * N }, (_, i) => i);
  let blank = BLANK;
  let prev = -1;
  const doMove = (p) => {
    board[blank] = board[p];
    board[p] = BLANK;
    prev = blank;
    blank = p;
  };
  for (let k = 0; k < 90; k++) {
    const opts = neighbors(blank).filter((p) => p !== prev);
    doMove(rand(opts));
  }
  const isSolved = () => board.every((t, i) => t === i);
  while (isSolved()) doMove(rand(neighbors(blank)));

  let moves = 0;
  let solved = false;
  const img = new Image();
  let side = 0;
  let sx = 0;
  let sy = 0;

  function draw() {
    c.clearRect(0, 0, S, S);
    if (!img.naturalWidth) return;
    if (solved) {
      c.drawImage(img, sx, sy, side, side, 0, 0, S, S);
    } else {
      const part = side / N;
      for (let pos = 0; pos < N * N; pos++) {
        const tile = board[pos];
        const dx = (pos % N) * (TILE + GAP);
        const dy = Math.floor(pos / N) * (TILE + GAP);
        if (tile === BLANK) {
          c.fillStyle = "rgba(230,62,109,0.12)";
          c.fillRect(dx, dy, TILE, TILE);
          continue;
        }
        c.drawImage(img, sx + (tile % N) * part, sy + Math.floor(tile / N) * part, part, part, dx, dy, TILE, TILE);
      }
    }
    canvas.dataset.state = board.join("");
  }

  img.onload = () => {
    side = Math.min(img.naturalWidth, img.naturalHeight);
    sx = (img.naturalWidth - side) / 2;
    sy = (img.naturalHeight - side) * 0.3;
    draw();
  };
  img.src = ctx.photos[0].data;

  canvas.addEventListener("click", (e) => {
    if (solved) return;
    const r = canvas.getBoundingClientRect();
    const col = Math.min(N - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * N)));
    const row = Math.min(N - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * N)));
    const pos = row * N + col;
    if (!neighbors(blank).includes(pos)) return;
    doMove(pos);
    moves++;
    status.textContent = "Gerakan: " + moves;
    if (moves % 30 === 0) ctx.fail();
    if (isSolved()) {
      solved = true;
      draw();
      ctx.win();
    } else {
      draw();
    }
  });

  return () => {};
}

/* ---------------- 4. Gosok kejutan ---------------- */
function scratch(area, ctx) {
  const wrap = el("div", "scratch-wrap");
  const img = document.createElement("img");
  img.src = ctx.photos[0].data;
  img.alt = "Kejutan";
  const cv = document.createElement("canvas");
  wrap.append(img, cv);
  area.appendChild(wrap);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = wrap.clientWidth || 300;
  const h = wrap.clientHeight || 400;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.scale(dpr, dpr);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#ff9ebb");
  g.addColorStop(1, "#e63e6d");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.font = "600 22px 'Segoe UI', system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText("Gosok di sini 💞", w / 2, h / 2);

  let drawing = false;
  let lx = 0;
  let ly = 0;
  let moves = 0;
  let done = false;

  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (w / r.width), (e.clientY - r.top) * (h / r.height)];
  };
  const stroke = (x1, y1, x2, y2) => {
    c.globalCompositeOperation = "destination-out";
    c.lineWidth = 44;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };
  const check = () => {
    if (done) return;
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < d.length; i += 64) {
      total++;
      if (d[i] < 40) clear++;
    }
    if (clear / total > 0.5) {
      done = true;
      cv.classList.add("done");
      ctx.win();
    }
  };

  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drawing = true;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    [lx, ly] = pos(e);
    stroke(lx, ly, lx, ly);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drawing || done) return;
    const [x, y] = pos(e);
    stroke(lx, ly, x, y);
    lx = x;
    ly = y;
    if (++moves % 8 === 0) check();
  });
  const end = () => {
    drawing = false;
    check();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);

  return () => {};
}

/* ---------------- 5. Tebak pesan rahasia ---------------- */
function word(area, ctx) {
  const secret =
    String((ctx.config.game && ctx.config.game.word) || "")
      .toUpperCase()
      .replace(/[^A-Z ]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "AKU SUKA KAMU";
  const letters = new Set(secret.replace(/ /g, "").split(""));
  const guessed = new Set();
  let wrong = 0;
  let done = false;

  const box = el("div", "word-slots");
  const info = el("p", "game-score");
  const kbd = el("div", "kbd");
  area.append(box, info, kbd);

  const slots = [];
  secret.split(" ").forEach((w) => {
    const wd = el("div", "word-w");
    w.split("").forEach((ch) => {
      const s = el("span", "slot", "");
      wd.appendChild(s);
      slots.push({ ch, s });
    });
    box.appendChild(wd);
  });

  const keys = {};
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((ch) => {
    const b = el("button", "key", ch);
    b.type = "button";
    b.addEventListener("click", () => guess(ch));
    keys[ch] = b;
    kbd.appendChild(b);
  });

  const render = () => {
    slots.forEach(({ ch, s }) => (s.textContent = guessed.has(ch) ? ch : ""));
    info.textContent = "Salah: " + wrong;
  };
  const check = () => {
    if ([...letters].every((l) => guessed.has(l))) {
      done = true;
      ctx.win();
    }
  };
  const reveal = () => {
    const left = [...letters].filter((l) => !guessed.has(l));
    if (!left.length) return;
    const l = rand(left);
    guessed.add(l);
    keys[l].disabled = true;
    keys[l].classList.add("right");
  };
  function guess(ch) {
    if (done || guessed.has(ch) || keys[ch].disabled) return;
    keys[ch].disabled = true;
    if (letters.has(ch)) {
      guessed.add(ch);
      keys[ch].classList.add("right");
    } else {
      wrong++;
      keys[ch].classList.add("wrong");
      ctx.fail();
      if (wrong % 3 === 0) reveal(); // bantuan: tiap 3 salah, satu huruf dibuka
    }
    render();
    check();
  }

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) guess(e.key.toUpperCase());
  };
  document.addEventListener("keydown", onKey);
  render();
  return () => document.removeEventListener("keydown", onKey);
}

/* ---------------- 6. Kuis tentang kamu ---------------- */
function quiz(area, ctx) {
  const list = ((ctx.config.game && ctx.config.game.quiz) || []).filter(
    (it) => it && it.q && Array.isArray(it.options) && it.options.length >= 2 && Number.isInteger(it.answer)
  );
  const timers = [];
  if (!list.length) {
    timers.push(setTimeout(() => ctx.win(), 0));
    return () => timers.forEach(clearTimeout);
  }

  let i = 0;
  let lock = false;
  const prog = el("p", "game-score");
  const q = el("p", "quiz-q");
  const opts = el("div", "quiz-opts");
  area.append(prog, q, opts);

  function render() {
    prog.textContent = "Pertanyaan " + (i + 1) + "/" + list.length;
    q.textContent = ctx.fill(list[i].q);
    opts.textContent = "";
    list[i].options.forEach((o, k) => {
      const b = el("button", "quiz-opt", ctx.fill(o));
      b.type = "button";
      b.addEventListener("click", () => pick(b, k));
      opts.appendChild(b);
    });
  }
  function pick(b, k) {
    if (lock) return;
    if (k === list[i].answer) {
      lock = true;
      b.classList.add("right");
      timers.push(
        setTimeout(() => {
          lock = false;
          i++;
          if (i >= list.length) ctx.win();
          else render();
        }, 650)
      );
    } else {
      b.classList.add("wrong");
      b.disabled = true;
      ctx.fail();
    }
  }
  render();
  return () => timers.forEach(clearTimeout);
}

const IMPL = { memory, catch: catchHearts, puzzle, scratch, word, quiz };

export function startGame(type, area, ctx) {
  const f = IMPL[type];
  if (!f) return null;
  return f(area, ctx) || (() => {});
}
