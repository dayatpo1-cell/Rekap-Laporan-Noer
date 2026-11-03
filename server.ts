/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper pembersih angka ALP (hapus titik, koma, Rp, spasi agar jadi integer murni)
function cleanAlpValue(rawVal: any): number {
  if (typeof rawVal === 'number') return isNaN(rawVal) ? 0 : Math.round(rawVal);
  if (!rawVal) return 0;
  const digits = String(rawVal).replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
});

// Endpoint ekstraksi gambar / screenshot / PDF menggunakan Gemini Flash
app.post(['/api/extract-image', '/api/extract-pdf', '/api/extract'], async (req, res) => {
  try {
    const { base64, fileName, mimeType } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'Base64 data gambar diperlukan' });
    }

    // Tentukan MIME type yang tepat (default image/png untuk screenshot clipboard)
    let detectedMime = mimeType || 'image/png';
    if (!mimeType && fileName) {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) detectedMime = 'image/jpeg';
      else if (lower.endsWith('.png')) detectedMime = 'image/png';
      else if (lower.endsWith('.webp')) detectedMime = 'image/webp';
      else if (lower.endsWith('.pdf')) detectedMime = 'application/pdf';
    }

    const ai = new GoogleGenAI();
    const prompt = `Ekstraksi data berikut dari gambar lembar / screenshot dokumen Ilustrasi Polis asuransi (RIPLAY) ini ke dalam format JSON yang berisi 4 key berikut:

1. "NAMA AGEN" (string): Ambil nama lengkap agen dari bagian "Disajikan oleh" di paling bawah dokumen.
2. "ALP" (angka integer murni tanpa titik/koma/Rp):
   - KHUSUS untuk polis "AlliSya CI Hasanah" (produk Syariah): Ambil nilai angka pada baris "Kontribusi" di Halaman 1 pada tabel "FITUR UTAMA ASURANSI JIWA TRADISIONAL SYARIAH PESERTA" (contoh: "Kontribusi : Rp447.000", nilainya adalah 447000). JANGAN mengambil angka dari "Masa Pembayaran Kontribusi : 10 Tahun" dan JANGAN dari "Santunan Asuransi". Jika Cara Pembayaran "BULANAN", kalikan nilai Kontribusi tersebut dengan 12 (contoh: 447000 * 12 = 5364000). Jika "TAHUNAN", gunakan nilai aslinya.
   - Untuk produk lainnya: Cari angka pada baris "Premi Dasar Berkala" ATAU "Premi Asuransi Dasar". Jika di dokumen tertulis Cara Pembayaran "BULANAN", kalikan nilai premi tersebut dengan 12. Jika "TAHUNAN", gunakan nilai aslinya.
3. "NAMA TERTANGGUNG" (string): 
   - KHUSUS untuk polis "AlliSya CI Hasanah": Ambil nama dari baris "Nama Pihak Yang Diasuransikan" di Halaman 2 pada bagian SIMULASI (contoh: "KELVIN HANSEL"). JANGAN mengambil dari "Usia Masuk Pihak Yang Diasuransikan" di Halaman 1 dan JANGAN mengambil dari "Pembayar Kontribusi".
   - KHUSUS untuk produk yang memiliki tabel kolom "Tertanggung" (misal: Allianz Preferred Medical): Ambil HANYA teks nama yang dicetak TEBAL (BOLD) pada baris pertama di dalam kolom tabel "Tertanggung" tersebut (contoh: "MISITA WIJAYA"). JANGAN menyertakan teks di bawahnya yang berisi tanggal lahir, usia, atau jenis kelamin. JANGAN mengambil dari "Nama Pemegang Polis" jika ada tabel "Tertanggung".
   - Untuk produk lainnya: Ambil nama dari baris "Nama Tertanggung" (atau jika tidak ada, dari "Nama Pemegang Polis"). Bersihkan dari teks kurung seperti "(Wanita)", "(Pria)", dsb.
4. "JENIS PRODUK" (string): Ambil nama program/produk yang tertera tepat di bawah tulisan "RIPLAY VERSI PERSONAL" (contoh: SmartLink Protection Life, Allianz Preferred Medical, AlliSya CI Hasanah, dll).

ATURAN WAJIB:
- Output HANYA berupa objek JSON yang valid tanpa teks awalan/akhiran.
- Jangan gunakan simbol mata uang ("Rp") atau pemisah ribuan pada nilai "ALP". Nilai ALP harus angka integer murni.
- Jika dokumen ini BUKAN merupakan dokumen Ilustrasi Polis / RIPLAY (misalnya gambar lain/kosong), kembalikan nilai string kosong "" untuk teks dan angka 0 untuk ALP. 
- Jangan pernah menebak atau menyalin data dari file/dokumen sebelumnya.`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          inlineData: {
            data: base64,
            mimeType: detectedMime,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const rawAlp = parsed['ALP'] ?? parsed['alp'] ?? 0;
    const cleanAlp = cleanAlpValue(rawAlp);

    return res.json({
      success: true,
      data: {
        nama_agen: parsed['NAMA AGEN'] || parsed['nama_agen'] || '',
        alp: cleanAlp,
        nama_tertanggung: parsed['NAMA TERTANGGUNG'] || parsed['nama_tertanggung'] || '',
        jenis_produk: parsed['JENIS PRODUK'] || parsed['jenis_produk'] || '',
      },
      raw: parsed,
    });
  } catch (error: any) {
    console.error('Gagal mengekstrak gambar:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal memproses gambar',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
