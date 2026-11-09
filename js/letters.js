/**
 * letters.js
 * Pembuat surat acak: menggabungkan potongan kalimat romantis yang netral.
 * {nama} akan diganti nama penerima saat surat ditampilkan.
 */
const OPENINGS = [
  "Aku nggak terlalu pandai merangkai kata, jadi aku bikin ini supaya bisa bilang langsung ke kamu.",
  "Awalnya aku cuma ingin kenal dan ngobrol biasa saja. Nggak pernah kepikiran kalau semuanya akan berubah jadi sesuatu yang berarti buat aku.",
  "Ada hal yang sudah lama ingin aku sampaikan, tapi aku selalu bingung mulai dari mana. Jadi, izinkan aku bilang lewat surat kecil ini.",
  "Kadang perasaan datang tanpa permisi. Begitu juga yang terjadi padaku sejak mengenal kamu.",
  "Mungkin ini terdengar tiba-tiba buat kamu, tapi perasaan ini tumbuh pelan-pelan dan sekarang sudah terlalu besar untuk kusimpan sendiri.",
];

const MIDDLES = [
  "Entah sejak kapan, hal-hal kecil tentang kamu mulai menarik perhatianku: caramu bicara, caramu tertawa, dan hal-hal sederhana lain yang mungkin nggak pernah kamu sadari.",
  "Makin sering ngobrol sama kamu, makin aku merasa nyaman. Obrolan yang kelihatannya biasa saja selalu berhasil bikin hariku terasa lebih menyenangkan.",
  "Anehnya, sekarang melihat kamu saja sudah bisa bikin aku senang. Ada bagian dari diriku yang tanpa sadar mencari kamu, dan berharap besok bisa ketemu lagi.",
  "Aku mulai terbiasa menunggu kesempatan buat ngobrol sama kamu. Kalau kita nggak sempat bicara, rasanya ada yang kurang.",
  "Bersamamu, hal-hal biasa terasa istimewa. Aku jadi lebih sering tersenyum tanpa alasan, dan semua itu karena kamu.",
  "Semuanya mengalir begitu saja. Dari sekadar ingin mengenal, jadi terbiasa, lalu nyaman, sampai akhirnya muncul perasaan yang rasanya sulit untuk disembunyikan lagi.",
  "Aku suka cara kamu membuat suasana jadi hangat, bahkan tanpa kamu sadari. Itu salah satu alasan kenapa aku ingin lebih dekat denganmu.",
];

const CLOSINGS = [
  "Aku nggak ingin membuatmu merasa terbebani. Aku cuma ingin kamu tahu bahwa ada seseorang yang diam-diam merasa beruntung bisa mengenalmu.",
  "Aku nggak tahu bagaimana perasaanmu setelah membaca ini, dan itu nggak apa-apa. Aku hanya ingin jujur pada perasaanku sendiri.",
  "Aku berharap cerita kita nggak berhenti di sini. Aku masih ingin mengenalmu lebih jauh dan membuat lebih banyak cerita bersamamu.",
  "Kalau kamu mau, aku ingin berjalan lebih dekat denganmu, pelan-pelan dan apa adanya.",
  "Apa pun jawabanmu nanti, terima kasih sudah menjadi bagian dari hari-hariku.",
];

const FINALS = [
  "Singkatnya, aku suka sama kamu. Lebih dari yang pernah aku bayangkan.",
  "Jadi, ini aku, yang jujur bilang: aku suka sama kamu, {nama}.",
  "Itu saja yang ingin aku sampaikan: aku suka kamu, {nama}, dengan tulus.",
  "Terima kasih sudah membaca sampai sini. Semoga kamu tersenyum membacanya.",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pickMany(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/** Mengembalikan teks surat; paragraf dipisah baris kosong. */
export function randomLetter() {
  const mids = pickMany(MIDDLES, 2 + Math.floor(Math.random() * 2)); // 2-3 paragraf tengah
  const paragraphs = [pick(OPENINGS), ...mids, pick(CLOSINGS), pick(FINALS)];
  return paragraphs.join("\n\n");
}
