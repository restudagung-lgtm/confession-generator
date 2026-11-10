# 💌 Web Confession Generator

Alat untuk membuat web confession interaktif. Alurnya:

1. **Link 1 (`index.html`)**: halaman setting. Pengguna memilih 1–8 foto, mengatur nama
   dan teks, mini game, surat (bisa diacak), WhatsApp, dan musik (semuanya opsional kecuali foto).
2. Setelah menekan **Buat link**, muncul **link 2** (`lihat.html?id=...`) untuk dikirim
   ke pasangan. Link ini berlaku **24 jam**, lalu menampilkan pesan "kedaluwarsa".

Murni HTML/CSS/JavaScript tanpa build, jadi bisa di-host di GitHub Pages.
Data disimpan sementara di Firebase Firestore.

## Struktur

```
confession-generator/
├── index.html            # link 1: setting / generator
├── lihat.html            # link 2: tampilan untuk pasangan
├── css/
│   ├── generator.css
│   └── viewer.css
├── js/
│   ├── firebase-config.js  # ISI config Firebase di sini
│   ├── db.js               # simpan/muat data (Firestore atau mode demo)
│   ├── image-utils.js      # kompres foto di browser
│   ├── letters.js          # pembuat surat acak
│   ├── games.js            # 6 mini game + daftar pilihan
│   ├── generator.js        # logika halaman setting
│   └── viewer.js           # logika halaman tampil
├── firestore.rules       # aturan keamanan Firestore
└── README.md
```

## Mode demo (tanpa Firebase)

Jika `js/firebase-config.js` belum diisi, aplikasi berjalan di mode demo: data disimpan
di browser sendiri (IndexedDB), jadi link hanya terbuka di browser yang sama.
Cocok untuk mencoba. Untuk dipakai sungguhan, siapkan Firebase.

```bash
python3 -m http.server 8000   # lalu buka http://localhost:8000
```

## Menyiapkan Firebase (sekali saja)

1. Buka [Firebase Console](https://console.firebase.google.com), buat **project baru**
   (terpisah dari proyek lain).
2. **Build → Firestore Database → Create database** (pilih lokasi terdekat, mulai dengan
   *production mode*).
3. **Rules**: salin isi `firestore.rules` ke tab Rules, lalu **Publish**.
4. **Project settings → General → Your apps → Web (`</>`)**: daftarkan app web, lalu salin
   `apiKey`, `authDomain`, `projectId`, `appId` ke `js/firebase-config.js`.
5. (Disarankan) Di Google Cloud, pasang **budget alert** dan pertimbangkan **Firebase App Check**
   agar penggunaan tidak disalahgunakan.

> Setiap kali `firestore.rules` berubah, salin ulang ke tab **Rules** di Firebase Console
> lalu **Publish**.

### Penghapusan data kedaluwarsa

Setelah 24 jam, aturan keamanan langsung menolak pembacaan link tersebut, tetapi datanya
masih ada di Firestore sampai dihapus. Ada tiga cara membersihkannya:

- **Otomatis saat dibuka (bawaan).** Saat link kedaluwarsa dibuka, aplikasi menghapus data
  link itu (dokumen utama, foto, musik). Server hanya mengizinkan penghapusan jika memang
  sudah lewat masa berlaku. Ini hanya membersihkan link yang sempat dibuka lagi.
- **Manual.** Di Firebase Console → Firestore → Data, hapus dokumen lama di koleksi
  `confessions` (pastikan subkoleksi `photos` dan `music` ikut terhapus; konsol biasanya
  menawarkan opsi untuk itu). Tanggal ada di field `expiresAt`.
- **TTL (opsional, butuh billing).** Firestore TTL menghapus data lama secara otomatis,
  tetapi fitur ini **hanya bisa dipakai jika project punya billing aktif**; di project tanpa
  billing, membuatnya akan gagal dengan error `403: billing disabled`. Jika billing sudah
  aktif, buka **Time-to-live (TTL)** dan buat tiga kebijakan dengan field `expiresAt` untuk
  collection group `confessions`, `photos`, dan `music`. TTL tidak menghapus tepat waktu;
  biasanya dalam kisaran sehari setelah kedaluwarsa.

> `apiKey` Firebase untuk web memang publik. Yang melindungi data adalah `firestore.rules`.

## Deploy ke GitHub Pages

1. Upload semua isi folder ini ke repository GitHub.
2. **Settings → Pages**, pilih branch `main`, folder `/ (root)`, lalu **Save**.
3. Buka `https://<username>.github.io/<nama-repo>/` untuk halaman setting.

## Mini game

Alur di link 2: Welcome → (isi nama, jika tidak diisi pembuat) → kalimat pengantar
(satu per satu, ketuk untuk lanjut) → **mini game** → pertanyaan → ucapan.
Game hanya dimainkan di link 2. Pembuat memilih satu di link 1 (atau "Tanpa game"):

| Game | Keterangan |
|---|---|
| Cocokkan kartu foto | Mencari pasangan kartu; memakai foto pembuat (maks. 6 pasang, sisanya emoji) |
| Tangkap hati | Mengetuk 10 hati yang jatuh |
| Puzzle foto | Menggeser kotak untuk menyusun foto utama (pasti bisa diselesaikan) |
| Gosok kejutan | Menggosok layar untuk membuka foto utama |
| Tebak pesan rahasia | Menebak huruf; pesan 3–24 huruf buatan pembuat. Tiap 3 kesalahan, satu huruf dibuka |
| Kuis tentang kamu | 1–5 pertanyaan pilihan ganda buatan pembuat |

Tombol **Lewati game** muncul jika pemain sering salah atau terlalu lama, jadi pemain
tidak terjebak. Game baru bisa ditambah di `js/games.js` (daftarkan di `GAME_LIST`,
`GAME_INFO`, dan `IMPL`).

## Cara kerja & batasan

- Foto dikompres di browser (maks ±1100 px, JPEG) dan disimpan sebagai teks base64.
  Satu foto per dokumen Firestore, maksimal **8 foto**.
- Musik opsional: mp3 maksimal **2 MB**, dipotong menjadi beberapa dokumen.
- Link memakai ID acak 12 karakter sehingga sulit ditebak. Siapa pun yang memegang
  link dapat membukanya selama 24 jam. Daftar data tidak bisa dilihat dari klien.
- Pembuatan satu link memakai sekitar 3–13 penulisan Firestore, dan membuka link memakai
  sekitar 2–13 pembacaan. Perhatikan kuota harian paket gratis (Spark) jika dipakai banyak orang.
- Jam di perangkat pembuat harus akurat. Aturan Firestore menolak waktu kedaluwarsa yang
  menyimpang jauh dari jam server.
- Karena alat ini terbuka untuk umum, jangan unggah musik atau foto yang bukan hakmu.

## Mengubah masa berlaku

Ubah `LIFETIME_HOURS` di `js/firebase-config.js` (maksimal 30 jam sesuai `firestore.rules`;
ubah angka `30` di aturan jika ingin lebih lama) dan sesuaikan tulisan "24 jam" di
`index.html` serta `js/viewer.js`.
