import React, { useState, useMemo } from 'react';
import { useAppDatabase } from '../../database/useAppDatabase';
import { GeneralJournalTransaction, GeneralJournalCategory, JournalSide } from '../../types/erp';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Calendar, 
  Tag, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Building2,
  Zap,
  DollarSign,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  Sparkles,
  Info,
  Scale
} from 'lucide-react';
import { JournalDrilldownModal } from '../laporan/JournalDrilldownModal';
import { CANONICAL_COA } from '../../constants/accountCodes';

interface JurnalUmumViewProps {
  initialOpenModal?: boolean;
}

interface JournalFormLine {
  accountCode: string;
  side: JournalSide;
  amount: number | '';
  description: string;
}

const CATEGORY_PRESETS: {
  category: GeneralJournalCategory;
  name: string;
  badgeColor: string;
  icon: any;
  defaultLines: { accountCode: string; side: JournalSide; description: string }[];
  defaultDesc: string;
}[] = [
  {
    category: 'MODAL_MASUK',
    name: 'Modal Masuk / Tambahan Modal',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: TrendingUp,
    defaultDesc: 'Setoran modal kas pemilik toko sembako',
    defaultLines: [
      { accountCode: '1110', side: 'DEBIT', description: 'Penerimaan Kas Modal Masuk' },
      { accountCode: '3110', side: 'CREDIT', description: 'Setoran Modal Pemilik' }
    ]
  },
  {
    category: 'BEBAN_LISTRIK',
    name: 'Beban Listrik & Air',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Zap,
    defaultDesc: 'Pembayaran tagihan listrik PLN dan air toko',
    defaultLines: [
      { accountCode: '5200', side: 'DEBIT', description: 'Beban Listrik & Air Toko' },
      { accountCode: '1110', side: 'CREDIT', description: 'Pembayaran Kas Tunai Toko' }
    ]
  },
  {
    category: 'BEBAN_SEWA',
    name: 'Beban Sewa Tempat / Kios',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Building2,
    defaultDesc: 'Pembayaran sewa ruko / tempat usaha toko',
    defaultLines: [
      { accountCode: '5220', side: 'DEBIT', description: 'Beban Sewa Tempat Usaha' },
      { accountCode: '1110', side: 'CREDIT', description: 'Pembayaran Kas Tunai Toko' }
    ]
  },
  {
    category: 'BEBAN_OPERASIONAL',
    name: 'Beban Operasional Lainnya',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: TrendingDown,
    defaultDesc: 'Pengeluaran operasional toko non-kasir',
    defaultLines: [
      { accountCode: '5200', side: 'DEBIT', description: 'Beban Operasional Toko' },
      { accountCode: '1110', side: 'CREDIT', description: 'Pembayaran Kas Tunai Toko' }
    ]
  },
  {
    category: 'LAINNYA',
    name: 'Entri Kustom / Memorial Bebas',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: BookOpen,
    defaultDesc: 'Penyesuaian jurnal umum non-kasir',
    defaultLines: [
      { accountCode: '1110', side: 'DEBIT', description: '' },
      { accountCode: '3110', side: 'CREDIT', description: '' }
    ]
  }
];

export const JurnalUmumView: React.FC<JurnalUmumViewProps> = ({
  initialOpenModal = false
}) => {
  const { generalJournals, recordGeneralJournal, deleteGeneralJournal, currentUser, journals, journalLines } = useAppDatabase();
  
  const [showAddModal, setShowAddModal] = useState(initialOpenModal);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    businessDate: string;
    description: string;
    refNumber: string;
    category: GeneralJournalCategory;
    lines: JournalFormLine[];
  }>({
    businessDate: new Date().toISOString().split('T')[0],
    description: 'Setoran modal kas pemilik toko sembako',
    refNumber: '',
    category: 'MODAL_MASUK',
    lines: [
      { accountCode: '1110', side: 'DEBIT', amount: 1000000, description: 'Penerimaan Kas Modal Masuk' },
      { accountCode: '3110', side: 'CREDIT', amount: 1000000, description: 'Setoran Modal Pemilik' }
    ]
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Apply Preset
  const applyPreset = (category: GeneralJournalCategory) => {
    const preset = CATEGORY_PRESETS.find(p => p.category === category);
    if (!preset) return;

    setFormData(prev => ({
      ...prev,
      category,
      description: preset.defaultDesc,
      lines: preset.defaultLines.map(l => ({
        accountCode: l.accountCode,
        side: l.side,
        amount: prev.lines[0]?.amount || 500000,
        description: l.description
      }))
    }));
    setFormError(null);
  };

  // Add line to form
  const handleAddLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          accountCode: '5200',
          side: 'DEBIT',
          amount: '',
          description: ''
        }
      ]
    }));
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    if (formData.lines.length <= 2) {
      setFormError('Minimal harus ada 2 baris transaksi (satu Debit dan satu Kredit)!');
      return;
    }
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  // Update line field
  const handleLineChange = (index: number, field: keyof JournalFormLine, value: any) => {
    setFormData(prev => {
      const nextLines = [...prev.lines];
      nextLines[index] = {
        ...nextLines[index],
        [field]: value
      };
      return { ...prev, lines: nextLines };
    });
  };

  // Calculation of Balance in Form
  const { totalDebit, totalCredit, isBalanced, balanceDiff } = useMemo(() => {
    let deb = 0;
    let cred = 0;
    formData.lines.forEach(l => {
      const amt = typeof l.amount === 'number' ? l.amount : 0;
      if (l.side === 'DEBIT') deb += amt;
      else if (l.side === 'CREDIT') cred += amt;
    });
    return {
      totalDebit: deb,
      totalCredit: cred,
      isBalanced: deb > 0 && deb === cred,
      balanceDiff: Math.abs(deb - cred)
    };
  }, [formData.lines]);

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.description.trim()) {
      setFormError('Deskripsi transaksi wajib diisi!');
      return;
    }

    if (!isBalanced) {
      setFormError(`Jurnal belum seimbang! Total Debit (${formatRupiah(totalDebit)}) dan Total Kredit (${formatRupiah(totalCredit)}) harus sama persis.`);
      return;
    }

    try {
      recordGeneralJournal({
        businessDate: formData.businessDate,
        description: formData.description.trim(),
        refNumber: formData.refNumber.trim() || undefined,
        category: formData.category,
        lines: formData.lines.map(l => ({
          accountCode: l.accountCode,
          side: l.side,
          amount: typeof l.amount === 'number' ? l.amount : 0,
          description: l.description
        })),
        userId: currentUser.id,
        createdByName: currentUser.name
      });

      // Reset form & close modal
      setShowAddModal(false);
      setFormData({
        businessDate: new Date().toISOString().split('T')[0],
        description: 'Setoran modal kas pemilik toko sembako',
        refNumber: '',
        category: 'MODAL_MASUK',
        lines: [
          { accountCode: '1110', side: 'DEBIT', amount: 1000000, description: 'Penerimaan Kas Modal Masuk' },
          { accountCode: '3110', side: 'CREDIT', amount: 1000000, description: 'Setoran Modal Pemilik' }
        ]
      });
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan transaksi jurnal umum.');
    }
  };

  // Filtered List
  const filteredJournals = useMemo(() => {
    return generalJournals.filter(gj => {
      const matchCat = selectedCategory === 'Semua' || gj.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        gj.description.toLowerCase().includes(q) ||
        gj.id.toLowerCase().includes(q) ||
        (gj.refNumber && gj.refNumber.toLowerCase().includes(q)) ||
        gj.businessDate.includes(q);
      return matchCat && matchSearch;
    });
  }, [generalJournals, selectedCategory, searchQuery]);

  // Aggregate Stats
  const { totalInflow, totalOutflow, countInflow, countOutflow } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let cIn = 0;
    let cOut = 0;

    generalJournals.forEach(gj => {
      // Check if Kas (1110) was debited -> Inflow
      const debitKas = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'DEBIT');
      debitKas.forEach(l => {
        inflow += l.amount;
        cIn++;
      });

      // Check if Kas (1110) was credited -> Outflow
      const creditKas = gj.lines.filter(l => l.accountCode === '1110' && l.side === 'CREDIT');
      creditKas.forEach(l => {
        outflow += l.amount;
        cOut++;
      });
    });

    return { totalInflow: inflow, totalOutflow: outflow, countInflow: cIn, countOutflow: cOut };
  }, [generalJournals]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Context */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Jurnal Umum (Transaksi Non-Kasir)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Double-Entry Seimbang
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Catat transaksi non-kasir seperti modal masuk pemilik, beban sewa, listrik, dan biaya lainnya untuk memastikan pembukuan & laporan arus kas akurat.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Jurnal Baru</span>
          </button>
        </div>

        {/* 3 Metric Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Kas Masuk Non-Kasir (Modal/Lainnya)</span>
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
              +{formatRupiah(totalInflow)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{countInflow} transaksi menambah kas toko</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-rose-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Kas Keluar Non-Kasir (Sewa/Beban)</span>
              <span className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-bold text-rose-400 font-mono mt-1">
              -{formatRupiah(totalOutflow)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{countOutflow} transaksi memotong kas toko</p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-indigo-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Total Jurnal Tercatat</span>
              <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-lg font-bold text-white font-mono mt-1">
              {generalJournals.length} Entri
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Semua jurnal seimbang (Debit = Kredit)</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari deskripsi, No. Bukti, atau ID jurnal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-500 font-medium shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Kategori:
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="Semua">Semua Kategori</option>
            <option value="MODAL_MASUK">Modal Masuk</option>
            <option value="BEBAN_LISTRIK">Beban Listrik</option>
            <option value="BEBAN_SEWA">Beban Sewa</option>
            <option value="BEBAN_OPERASIONAL">Beban Operasional</option>
            <option value="LAINNYA">Lainnya</option>
          </select>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2.5">
        {filteredJournals.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Belum ada transaksi Jurnal Umum</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Catat modal awal, beban listrik, atau biaya sewa melalui tombol "Catat Jurnal Baru" di atas.
            </p>
          </div>
        ) : (
          filteredJournals.map(gj => {
            const presetInfo = CATEGORY_PRESETS.find(p => p.category === gj.category);
            const PresetIcon = presetInfo?.icon || BookOpen;

            // Check cash flow impact
            const hasDebitKas = gj.lines.some(l => l.accountCode === '1110' && l.side === 'DEBIT');
            const hasCreditKas = gj.lines.some(l => l.accountCode === '1110' && l.side === 'CREDIT');

            return (
              <div 
                key={gj.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-xs overflow-hidden"
              >
                <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                      <PresetIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {gj.description}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${presetInfo?.badgeColor || 'bg-slate-50 text-slate-600'}`}>
                          {presetInfo?.name || gj.category}
                        </span>
                        {hasDebitKas && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <ArrowUpRight className="w-2.5 h-2.5" /> Kas Masuk (+)
                          </span>
                        )}
                        {hasCreditKas && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <ArrowDownLeft className="w-2.5 h-2.5" /> Kas Keluar (-)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap font-mono">
                        <span>ID: <strong className="text-slate-600">{gj.id}</strong></span>
                        <span>•</span>
                        <span>Tgl: {gj.businessDate}</span>
                        {gj.refNumber && (
                          <>
                            <span>•</span>
                            <span>Ref: {gj.refNumber}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>Oleh: {gj.createdByName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Nominal & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <p className="text-base font-bold font-mono text-slate-900">
                        {formatRupiah(gj.totalAmount)}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 justify-start md:justify-end">
                        <CheckCircle2 className="w-3 h-3" /> Balanced
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedJournalId(gj.journalId)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                      >
                        Lihat Jurnal
                      </button>

                      <button
                        onClick={() => setDeleteConfirmId(gj.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Jurnal Umum"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-table Lines Preview */}
                <div className="bg-slate-50/80 px-3.5 py-2.5 border-t border-slate-100 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {gj.lines.map(line => {
                      const coa = CANONICAL_COA.find(c => c.code === line.accountCode);
                      return (
                        <div 
                          key={line.id} 
                          className="flex items-center justify-between p-1.5 rounded-md bg-white border border-slate-200/80 font-mono text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className={`px-1 rounded text-[9px] font-bold ${
                              line.side === 'DEBIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {line.side === 'DEBIT' ? 'D' : 'K'}
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {line.accountCode} - {coa?.name || line.accountCode}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">
                            {formatRupiah(line.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL CATAT JURNAL UMUM */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-4">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    Catat Jurnal Umum Non-Kasir
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Pilih template cepat atau atur debit & kredit berpasangan seimbang
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Template Cepat */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Template Cepat (Otomatis Atur Akun):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORY_PRESETS.filter(p => p.category !== 'LAINNYA').map(preset => {
                    const isSelected = formData.category === preset.category;
                    const Icon = preset.icon;
                    return (
                      <button
                        type="button"
                        key={preset.category}
                        onClick={() => applyPreset(preset.category)}
                        className={`p-2 rounded-xl border text-left text-xs transition flex flex-col justify-between gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <span className="font-semibold leading-tight">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.businessDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessDate: e.target.value }))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. Bukti / Referensi (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: KWT-001, PLN-9982, BUKTI-01"
                    value={formData.refNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, refNumber: e.target.value }))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi / Keterangan Transaksi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Setoran modal kas pemilik, Pembayaran token listrik PLN ruko"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Baris Akuntansi Multi-Line */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rincian Baris Jurnal (Debit & Kredit):</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.lines.map((line, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                    >
                      {/* Akun */}
                      <div className="flex-1 w-full">
                        <select
                          value={line.accountCode}
                          onChange={(e) => handleLineChange(idx, 'accountCode', e.target.value)}
                          className="w-full p-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
                        >
                          {CANONICAL_COA.map(acc => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name} ({acc.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sisi Debit / Kredit */}
                      <div className="w-28 shrink-0">
                        <select
                          value={line.side}
                          onChange={(e) => handleLineChange(idx, 'side', e.target.value as JournalSide)}
                          className={`w-full p-1.5 text-xs font-bold rounded-lg border ${
                            line.side === 'DEBIT' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : 'bg-blue-50 text-blue-800 border-blue-300'
                          }`}
                        >
                          <option value="DEBIT">DEBIT (D)</option>
                          <option value="CREDIT">KREDIT (K)</option>
                        </select>
                      </div>

                      {/* Nominal */}
                      <div className="w-36 shrink-0">
                        <input
                          type="number"
                          placeholder="Nominal (Rp)"
                          min="1"
                          required
                          value={line.amount}
                          onChange={(e) => handleLineChange(idx, 'amount', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full p-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white"
                        />
                      </div>

                      {/* Hapus Baris */}
                      {formData.lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Keseimbangan Real-Time */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isBalanced 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <div className="space-y-0.5">
                  <p className="font-bold flex items-center gap-1.5">
                    {isBalanced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>{isBalanced ? 'JURNAL SEIMBANG (BALANCE)' : 'JURNAL BELUM SEIMBANG'}</span>
                  </p>
                  <p className="text-[11px]">
                    Total Debit: <strong className="font-mono">{formatRupiah(totalDebit)}</strong> | Total Kredit: <strong className="font-mono">{formatRupiah(totalCredit)}</strong>
                  </p>
                </div>

                {!isBalanced && (
                  <span className="font-mono font-bold text-rose-600 text-xs">
                    Selisih: {formatRupiah(balanceDiff)}
                  </span>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={!isBalanced}
                  className={`px-5 py-2 text-xs font-bold rounded-xl text-white transition shadow-sm ${
                    isBalanced
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Simpan Jurnal Umum
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Hapus Jurnal Umum?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal akuntansi terkait juga akan dihapus. Perubahan saldo kas dan akun akan disesuaikan kembali.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  deleteGeneralJournal(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition"
              >
                Ya, Hapus Jurnal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drilldown Modal */}
      {selectedJournalId && (
        <JournalDrilldownModal
          journalId={selectedJournalId}
          onClose={() => setSelectedJournalId(null)}
        />
      )}
    </div>
  );
};
