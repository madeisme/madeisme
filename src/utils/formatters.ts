/**
 * Formatting Utilities for Omah Sembako Sehati ERP
 * 
 * Aturan Uang:
 * Semua nominal adalah Long integer Rupiah.
 * Format tampilan: Rp 15.000 (pemisah ribuan dengan titik, tanpa desimal).
 */

export function formatRupiah(amount: number | bigint): string {
  const num = typeof amount === 'bigint' ? Number(amount) : Math.round(Number(amount) || 0);
  if (num < 0) {
    return '-Rp' + Math.abs(num).toLocaleString('id-ID');
  }
  return 'Rp' + num.toLocaleString('id-ID');
}

/**
 * Menghitung subtotal per baris dengan pembulatan integer (Math.round)
 * Sesuai aturan: "Semua total dibulatkan per-baris, bukan di akhir."
 */
export function calculateLineTotal(qty: number, unitPrice: number): number {
  return Math.round(qty * unitPrice);
}

export function formatDateIndo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIndo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Menambahkan jumlah hari ke tanggal YYYY-MM-DD
 */
export function addDaysToDate(dateStr: string, days: number): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Mengecek apakah tanggal jatuh tempo sudah lewat (Overdue)
 */
export function isDateOverdue(dueDateStr: string, compareDateStr?: string): boolean {
  try {
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const ref = compareDateStr ? new Date(compareDateStr) : new Date();
    ref.setHours(0, 0, 0, 0);
    return due.getTime() < ref.getTime();
  } catch {
    return false;
  }
}

/**
 * Menghitung selisih hari jatuh tempo (sisa hari atau hari keterlambatan)
 */
export function getDaysRemainingOrOverdue(dueDateStr: string, compareDateStr?: string): { days: number; isOverdue: boolean } {
  try {
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const ref = compareDateStr ? new Date(compareDateStr) : new Date();
    ref.setHours(0, 0, 0, 0);
    
    const diffMs = due.getTime() - ref.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { days: Math.abs(diffDays), isOverdue: true };
    }
    return { days: diffDays, isOverdue: false };
  } catch {
    return { days: 0, isOverdue: false };
  }
}

