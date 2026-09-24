import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini AI client initialized server-side with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

// API Route for AI Inventory Forecasting
app.post('/api/ai/forecast-inventory', async (req, res) => {
  try {
    const { productsData, salesSummary, daysAnalyzed = 30 } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        fallbackMode: true,
        message: 'Kunci API Gemini tidak terdeteksi pada server environment. Menggunakan mesin proyeksi statistik lokal presisi.'
      });
    }

    const systemInstruction = `Anda adalah Asisten Pakar Manajemen Rantai Pasok & Analis Persediaan Toko Retail Sembako (Inventory & Supply Chain Specialist) untuk toko 'Omah Sembako Sehati'.
Tugas Anda adalah menganalisis data riwayat penjualan kasir, stok fisik saat ini, batas minimum stok, dan memprediksi:
1. Hari/tanggal saat stok diproyeksikan habis (Stockout Prediction) berdasarkan velocity/kecepatan lari barang.
2. Tingkat risiko kehabisan stok ('CRITICAL', 'WARNING', 'HEALTHY', 'STAGNANT').
3. Rekomendasi kuantitas pemesanan ulang optimal (Optimal Reorder Quantity) dengan mempertimbangkan lead time pengiriman sembako (rata-rata 2-4 hari) dan buffer cadangan 14 hari.
4. Insight bisnis praktis dalam Bahasa Indonesia yang singkat, tajam, dan dapat langsung dieksekusi pemilik toko sembako (misal: "Segera order gula pasir karena laju beli warung tinggi menjelang akhir pekan").
5. Pola tren ('RISING', 'STABLE', 'DECLINING').`;

    const userPrompt = `Analisis data persediaan dan penjualan berikut untuk periode ${daysAnalyzed} hari terakhir:
Ringkasan Penjualan: ${JSON.stringify(salesSummary)}
Daftar Produk & Data Riwayat:
${JSON.stringify(productsData, null, 2)}

Berikan output JSON terstruktur yang memuat array prediksi per produk dan ringkasan eksekutif untuk toko sembako.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: 'Ringkasan eksekutif kondisi gudang dan stok toko dalam 2-3 kalimat'
            },
            urgentActionAdvice: {
              type: Type.STRING,
              description: 'Pesan tindakan paling mendesak untuk pemilik toko hari ini'
            },
            predictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productId: { type: Type.STRING },
                  stockoutRisk: {
                    type: Type.STRING,
                    description: 'CRITICAL | WARNING | HEALTHY | STAGNANT'
                  },
                  daysUntilStockout: { type: Type.NUMBER },
                  estimatedStockoutDate: { type: Type.STRING },
                  suggestedReorderQty: { type: Type.NUMBER },
                  trend: { type: Type.STRING, description: 'RISING | STABLE | DECLINING' },
                  aiInsight: {
                    type: Type.STRING,
                    description: 'Analisis dan saran spesifik barang dalam Bahasa Indonesia'
                  }
                },
                required: ['productId', 'stockoutRisk', 'daysUntilStockout', 'suggestedReorderQty', 'aiInsight']
              }
            }
          },
          required: ['executiveSummary', 'urgentActionAdvice', 'predictions']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');

    return res.status(200).json({
      success: true,
      data: parsed
    });
  } catch (error: any) {
    console.error('Gemini inventory forecasting server error:', error);
    return res.status(200).json({
      success: false,
      fallbackMode: true,
      error: error?.message || 'Gagal memproses prediksi AI Gemini. Menggunakan perhitungan proyeksi statistik presisi.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
