import { formatRupiah } from './formatters';

export interface MonthlySalesDataPoint {
  monthKey: string;
  monthLabel: string;
  monthFullName: string;
  totalSales: number;
  cashSales: number;
  creditSales: number;
  cogs: number;
  grossProfit: number;
  profitMargin: number;
  txCount: number;
  avgTicket: number;
}

export interface MonthlySalesPdfOptions {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  rangeMonths: number;
  printedBy?: string;
  monthlyData: MonthlySalesDataPoint[];
  stats: {
    totalSalesPeriod: number;
    totalProfitPeriod: number;
    totalTxPeriod: number;
    avgMonthlySales: number;
    overallMargin: number;
    peakMonth?: MonthlySalesDataPoint;
    currentMonth?: MonthlySalesDataPoint;
    prevMonth?: MonthlySalesDataPoint | null;
    momGrowthPercent: number;
    isGrowing: boolean;
  };
}

/**
 * Generate printable HTML document for Monthly Sales Report and opens print/save as PDF dialog.
 * This adheres to clean, standardized invoice/report print styles.
 */
export function exportMonthlySalesToPdf(options: MonthlySalesPdfOptions): void {
  const {
    storeName = 'OMAH SEMBAKO SEHATI',
    storeAddress = 'Pusat Distribusi & Grosir Sembako Sehati',
    storePhone = 'Telp/WA: 0812-3456-7890',
    rangeMonths,
    printedBy = 'Owner / Kasir',
    monthlyData,
    stats
  } = options;

  const now = new Date();
  const printTimestamp = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';

  // Construct table rows
  const tableRowsHtml = monthlyData.map((item, index) => {
    return `
      <tr style="${index % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">
          ${item.monthFullName}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">
          ${formatRupiah(item.totalSales)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">
          ${formatRupiah(item.cashSales)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #6d28d9;">
          ${formatRupiah(item.creditSales)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #b45309;">
          ${formatRupiah(item.cogs)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600; color: #0f766e;">
          ${formatRupiah(item.grossProfit)}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">
          <span style="background: #e6fffa; color: #0d9488; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
            ${item.profitMargin}%
          </span>
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-family: monospace; color: #475569;">
          ${item.txCount}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #475569;">
          ${formatRupiah(item.avgTicket)}
        </td>
      </tr>
    `;
  }).join('');

  // HTML Print Template
  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan_Penjualan_Bulanan_${rangeMonths}_Bulan_${now.toISOString().split('T')[0]}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-container {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .store-brand {
      font-size: 20px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
    }
    .store-desc {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }
    .report-title-badge {
      text-align: right;
    }
    .report-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .report-period {
      font-size: 12px;
      color: #0d9488;
      font-weight: 600;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 800;
      font-family: monospace;
      color: #0f172a;
    }
    .kpi-sub {
      font-size: 10px;
      color: #475569;
      margin-top: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      font-size: 11px;
    }
    th {
      background-color: #0f766e;
      color: #ffffff;
      padding: 9px 10px;
      font-weight: 700;
      border: 1px solid #0f766e;
    }
    tfoot td {
      background-color: #f1f5f9;
      font-weight: 800;
      border-top: 2px solid #0f766e;
      border-bottom: 2px solid #0f766e;
      padding: 10px;
      font-size: 12px;
    }
    .insights-card {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 24px;
      font-size: 11px;
      color: #134e4a;
    }
    .insights-title {
      font-weight: 800;
      color: #0f766e;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .footer-sign {
      display: flex;
      justify-content: space-between;
      margin-top: 35px;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
      font-size: 11px;
      color: #475569;
    }
    .sign-box {
      text-align: center;
      width: 180px;
    }
    .sign-line {
      margin-top: 50px;
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      font-weight: 700;
      color: #1e293b;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Action Bar in Preview Window (hidden on print) -->
  <div class="no-print" style="background: #0f172a; color: #fff; padding: 10px 16px; margin-bottom: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <strong style="font-size: 13px;">Pratinjau Dokumen PDF - Laporan Penjualan Bulanan</strong>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">Klik tombol cetak untuk menyimpan sebagai PDF atau mencetak langsung ke printer</p>
    </div>
    <div>
      <button onclick="window.print()" style="background: #0d9488; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer; margin-right: 8px;">
        🖨️ Cetak / Simpan PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;">
        Tutup
      </button>
    </div>
  </div>

  <!-- Header Laporan -->
  <div class="header-container">
    <div>
      <h1 class="store-brand">${storeName}</h1>
      <p class="store-desc">${storeAddress} • ${storePhone}</p>
      <p class="store-desc" style="margin-top: 3px;">Sistem ERP Terpadu Berbasis SAK EMKM</p>
    </div>
    <div class="report-title-badge">
      <div class="report-title">Laporan Penjualan Bulanan</div>
      <div class="report-period">Periode: ${rangeMonths} Bulan Terakhir</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Dicetak: ${printTimestamp}</div>
    </div>
  </div>

  <!-- KPI Ringkasan 4 Kolom -->
  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">Total Omzet (${rangeMonths} Bulan)</div>
      <div class="kpi-val" style="color: #0f766e;">${formatRupiah(stats.totalSalesPeriod)}</div>
      <div class="kpi-sub">${stats.totalTxPeriod} transaksi nota kasir</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Rata-rata Penjualan / Bulan</div>
      <div class="kpi-val">${formatRupiah(stats.avgMonthlySales)}</div>
      <div class="kpi-sub">Kinerja konsisten per periode</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Bulan Puncak (Tertinggi)</div>
      <div class="kpi-val">${formatRupiah(stats.peakMonth?.totalSales || 0)}</div>
      <div class="kpi-sub" style="color: #0d9488; font-weight: 600;">${stats.peakMonth?.monthFullName || '-'}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">MoM (Bulan Ini vs Lalu)</div>
      <div class="kpi-val" style="color: ${stats.isGrowing ? '#047857' : '#b91c1c'};">
        ${stats.isGrowing ? '+' : ''}${stats.momGrowthPercent}%
      </div>
      <div class="kpi-sub">Margin Laba: ${stats.overallMargin}%</div>
    </div>
  </div>

  <!-- Tabel Data Rincian Bulanan -->
  <table>
    <thead>
      <tr>
        <th style="text-align: left;">Periode Bulan</th>
        <th style="text-align: right;">Total Omzet</th>
        <th style="text-align: right;">Penjualan Tunai</th>
        <th style="text-align: right;">Tempo / Piutang</th>
        <th style="text-align: right;">Modal Pokok (HPP)</th>
        <th style="text-align: right;">Untung Laba Kotor</th>
        <th style="text-align: center;">Margin</th>
        <th style="text-align: center;">Nota</th>
        <th style="text-align: right;">Rerata/Nota</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td>TOTAL / RERATA</td>
        <td style="text-align: right; font-family: monospace; color: #0f766e;">${formatRupiah(stats.totalSalesPeriod)}</td>
        <td style="text-align: right; font-family: monospace; color: #047857;">${formatRupiah(monthlyData.reduce((s, m) => s + m.cashSales, 0))}</td>
        <td style="text-align: right; font-family: monospace; color: #6d28d9;">${formatRupiah(monthlyData.reduce((s, m) => s + m.creditSales, 0))}</td>
        <td style="text-align: right; font-family: monospace; color: #b45309;">${formatRupiah(monthlyData.reduce((s, m) => s + m.cogs, 0))}</td>
        <td style="text-align: right; font-family: monospace; color: #0f766e;">${formatRupiah(stats.totalProfitPeriod)}</td>
        <td style="text-align: center;">${stats.overallMargin}%</td>
        <td style="text-align: center; font-family: monospace;">${stats.totalTxPeriod}</td>
        <td style="text-align: right; font-family: monospace;">${formatRupiah(stats.totalTxPeriod > 0 ? Math.round(stats.totalSalesPeriod / stats.totalTxPeriod) : 0)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Catatan Evaluasi Bisnis Toko -->
  <div class="insights-card">
    <div class="insights-title">
      📌 Ringkasan Eksekutif & Catatan Manajemen Toko:
    </div>
    <ul style="margin: 6px 0 0 0; padding-left: 18px; line-height: 1.5;">
      <li>Total pendapatan omzet selama <strong>${rangeMonths} bulan terakhir</strong> tercatat sebesar <strong>${formatRupiah(stats.totalSalesPeriod)}</strong> dengan estimasi laba kotor sebesar <strong>${formatRupiah(stats.totalProfitPeriod)}</strong> (Margin rata-rata: <strong>${stats.overallMargin}%</strong>).</li>
      <li>Performa penjualan tertinggi dicapai pada bulan <strong>${stats.peakMonth?.monthFullName || '-'}</strong> dengan pencapaian omzet <strong>${formatRupiah(stats.peakMonth?.totalSales || 0)}</strong>.</li>
      <li>Komposisi penerimaan penjualan mayoritas tunai menjaga perputaran arus kas fisik toko tetap likuid untuk pengadaan stok barang baru.</li>
      <li>Dokumen laporan ini diterbitkan secara otomatis oleh sistem ERP Omah Sembako Sehati sebagai dokumen resmi internal toko.</li>
    </ul>
  </div>

  <!-- Bagian Tanda Tangan Resmi -->
  <div class="footer-sign">
    <div class="sign-box">
      <div>Dibuat & Diverifikasi Oleh,</div>
      <div class="sign-line">${printedBy}</div>
    </div>
    <div style="font-size: 10px; color: #94a3b8; text-align: center; max-width: 250px; align-self: flex-end;">
      Dokumen ini sah dan dicetak secara otomatis dari sistem ERP Omah Sembako Sehati pada ${printTimestamp}.
    </div>
    <div class="sign-box">
      <div>Mengetahui, Pemilik Toko</div>
      <div class="sign-line">Owner / Manajemen</div>
    </div>
  </div>

  <script>
    // Automatically trigger print dialog once loaded
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;

  // Create Blob & Open in target window/tab for printing and saving as PDF
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Open in an iframe or dedicated window
  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow) {
    // If popup is blocked by browser, create invisible iframe fallback
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 400);
    };
  }
}
