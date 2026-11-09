/**
 * image-utils.js
 * Kompres foto di browser sebelum diunggah (supaya kecil dan muat di Firestore).
 */
const MAX_SIDE = 1100;
const TARGET_LEN = 600000; // panjang dataURL yang diincar
const HARD_LEN = 850000; // batas keras (dokumen Firestore maks ~1 MiB)

async function toBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (_) {
    // fallback untuk browser lama
    return await new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        res(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        rej(new Error("Format foto tidak didukung. Pakai JPG atau PNG."));
      };
      img.src = url;
    });
  }
}

export async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Bukan file gambar.");
  const bmp = await toBitmap(file);
  const w0 = bmp.width;
  const h0 = bmp.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();

  let q = 0.8;
  let out = canvas.toDataURL("image/jpeg", q);
  for (let i = 0; i < 6 && out.length > TARGET_LEN; i++) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", Math.max(q, 0.3));
  }
  if (out.length > HARD_LEN) throw new Error("Foto terlalu besar setelah dikompres.");
  return out;
}
