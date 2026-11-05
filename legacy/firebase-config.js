/**
 * KOLLABORA CAFE - Konfigurasi Firebase Firestore (100% Gratis & Siap Hosting di Vercel)
 * 
 * PANDUAN AKTIVASI SINKRONISASI REALTIME ANTAR-PERANGKAT (HANYA 3 MENIT):
 * 1. Buka https://console.firebase.google.com/ (Login dengan akun Google Anda - Gratis tanpa kartu kredit).
 * 2. Klik "Add project" / "Tambahkan proyek", beri nama "kollabora-cafe", lalu klik Continue.
 * 3. Di menu sidebar kiri, klik "Build" -> "Firestore Database" -> klik "Create database".
 *    - Pilih lokasi (misal asia-southeast1 / Singapore / Jakarta).
 *    - Pilih "Start in test mode" (agar langsung bisa baca & tulis).
 * 4. Di Project Settings (ikon roda gigi di kiri atas) -> scroll ke bawah -> klik ikon Web (</>) untuk mendaftarkan web app.
 * 5. Salin objek `firebaseConfig` yang diberikan dan tempelkan nilai-nilainya ke bawah ini,
 *    lalu ubah `enabled: true`.
 * 
 * Begitu `enabled: true`:
 * - Setiap Admin menambah/mengedit/menghapus menu, menu di HP semua pelanggan langsung ter-update seketika!
 * - Setiap pelanggan membuat pesanan di HP-nya, pesanan langsung masuk di dashboard Admin seketika!
 * - Riwayat pesanan tiap user tetap tersimpan rapi di HP masing-masing tanpa perlu mereka login.
 */

window.KOLLABORA_FIREBASE_CONFIG = {
  enabled: false, // <-- UBAH KE true SETELAH MENGISI DATA DI BAWAH INI
  apiKey: "MASUKKAN_API_KEY_ANDA",
  authDomain: "kollabora-cafe.firebaseapp.com",
  projectId: "kollabora-cafe",
  storageBucket: "kollabora-cafe.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Inisialisasi otomatis jika diaktifkan
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.KOLLABORA_FIREBASE_CONFIG && window.KOLLABORA_FIREBASE_CONFIG.enabled) {
      if (typeof KollaboraDB !== 'undefined' && KollaboraDB.cloudSync) {
        KollaboraDB.cloudSync.init(window.KOLLABORA_FIREBASE_CONFIG);
      }
    }
  });
}
