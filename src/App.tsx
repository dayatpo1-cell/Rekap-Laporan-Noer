/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Save,
  X,
  FileCheck2,
  Eye,
  ExternalLink,
  Table as TableIcon,
  FileText,
  Files,
  SlidersHorizontal,
  AlertTriangle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { extractPdfDocument } from './utils/pdfExtractor.ts';

// Helper untuk membersihkan dan mengonversi input ALP ke integer murni tanpa koma/titik/simbol
export const parseAlpNumber = (val: any): number => {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }
  if (!val) return 0;
  // Hilangkan semua karakter selain digit angka (mendukung input "6.000.000", "Rp 6.000.000", dll)
  const clean = String(val).replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
};

export interface InsuranceRecord {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'manual';
  nama_agen: string;
  alp: number | string;
  nama_tertanggung: string;
  jenis_produk: string;
  caraBayar?: string;
  premiDasar?: number;
  fileUrl?: string;
  source?: 'ai' | 'fast_native' | 'ocr_regex' | 'sample';
  timestamp: number;
}

export default function App() {
  const initialRecords: InsuranceRecord[] = [
    {
      id: 'rec-sample-3',
      fileName: 'AlliSya_CI_Hasanah_Kelvin_Hansel.pdf',
      fileType: 'pdf',
      nama_agen: 'KEVIN SURAWI',
      alp: 5364000,
      nama_tertanggung: 'KELVIN HANSEL',
      jenis_produk: 'AlliSya CI Hasanah',
      caraBayar: 'BULANAN',
      premiDasar: 447000,
      source: 'sample',
      timestamp: Date.now() + 1000,
    },
    {
      id: 'rec-sample-2',
      fileName: 'Allianz_Preferred_Medical_Misita.pdf',
      fileType: 'pdf',
      nama_agen: 'KEVIN SURAWI',
      alp: 16656000,
      nama_tertanggung: 'MISITA WIJAYA',
      jenis_produk: 'Allianz Preferred Medical',
      caraBayar: 'BULANAN',
      premiDasar: 1388000,
      source: 'sample',
      timestamp: Date.now(),
    },
    {
      id: 'rec-sample-1',
      fileName: 'Ilustrasi_c9e2d079.pdf',
      fileType: 'pdf',
      nama_agen: 'ROMENTI SAGALA',
      alp: 6000000,
      nama_tertanggung: 'JHONSON HUTABARAT',
      jenis_produk: 'SmartLink Protection Life',
      caraBayar: 'BULANAN',
      premiDasar: 500000,
      fileUrl: '/assets/aistudio/Ilustrasi_c9e2d079.pdf',
      source: 'sample',
      timestamp: Date.now() - 1000,
    },
  ];

  const [records, setRecords] = useState<InsuranceRecord[]>(initialRecords);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('rec-sample-3');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InsuranceRecord>>({});
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'table' | 'preview' | 'pdf_list'>('table');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<{ url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRecord = records.find((r) => r.id === selectedRecordId) || records[0];

  // Handler eksekusi ekstraksi asli untuk banyak file PDF
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const allFiles = Array.from(files);

    // Filter ketat: HANYA file PDF
    const pdfFiles = allFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    const nonPdfCount = allFiles.length - pdfFiles.length;
    if (nonPdfCount > 0) {
      setErrorMessage(
        `${nonPdfCount} berkas diabaikan karena bukan file PDF. Hanya dokumen .pdf yang diproses.`
      );
      setTimeout(() => setErrorMessage(null), 5000);
    }

    if (pdfFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    const startBatchTime = performance.now();
    setProcessStatus(`Mengekstrak ${pdfFiles.length} file PDF secara paralel...`);

    // Proses SEMUA file PDF secara bersamaan (PARALEL) untuk kecepatan maksimal
    const extractTasks = pdfFiles.map(async (file, i) => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const extracted = await extractPdfDocument(file);
        return {
          id: `rec-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          fileName: file.name,
          fileType: 'pdf' as const,
          nama_agen: extracted.nama_agen || 'Tidak Ditemukan',
          alp: Number(extracted.alp) || 0,
          nama_tertanggung: extracted.nama_tertanggung || 'Tidak Ditemukan',
          jenis_produk: extracted.jenis_produk || 'Tidak Ditemukan',
          fileUrl: objectUrl,
          source: extracted.source,
          timestamp: Date.now() + i,
        };
      } catch (err) {
        console.error('Error saat ekstraksi berkas:', file.name, err);
        return {
          id: `rec-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          fileName: file.name,
          fileType: 'pdf' as const,
          nama_agen: '',
          alp: 0,
          nama_tertanggung: file.name.replace(/\.pdf$/i, '').toUpperCase(),
          jenis_produk: '',
          fileUrl: objectUrl,
          timestamp: Date.now() + i,
        };
      }
    });

    const newExtractedRecords = await Promise.all(extractTasks);
    const totalTimeSec = ((performance.now() - startBatchTime) / 1000).toFixed(2);

    setRecords((prev) => [...newExtractedRecords, ...prev]);
    if (newExtractedRecords.length > 0) {
      setSelectedRecordId(newExtractedRecords[0].id);
    }
    setIsProcessing(false);
    setProcessStatus(`Selesai! ${newExtractedRecords.length} file diproses dalam ${totalTimeSec} detik.`);
    setTimeout(() => setProcessStatus(''), 4000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Export ke Excel (.xlsx) dengan JUDUL HURUF KAPITAL terstandarisasi
  const handleExportExcel = () => {
    // Sinkronisasi otomatis jika pengguna sedang mengedit baris sebelum menekan download
    let currentRecords = records;
    if (editingId) {
      const cleanAlp = parseAlpNumber(editForm.alp);
      currentRecords = records.map((r) => {
        if (r.id === editingId) {
          return {
            ...r,
            nama_agen: editForm.nama_agen !== undefined ? String(editForm.nama_agen).trim() : r.nama_agen,
            alp: cleanAlp,
            nama_tertanggung: editForm.nama_tertanggung !== undefined ? String(editForm.nama_tertanggung).trim() : r.nama_tertanggung,
            jenis_produk: editForm.jenis_produk !== undefined ? String(editForm.jenis_produk).trim() : r.jenis_produk,
          };
        }
        return r;
      });
      setRecords(currentRecords);
      setEditingId(null);
    }

    // Pastikan nilai ALP adalah integer murni sesuai tampilan di web
    const exportData = currentRecords.map((r) => ({
      NAMA_AGEN: r.nama_agen,
      ALP: parseAlpNumber(r.alp),
      NAMA_TERTANGGUNG: r.nama_tertanggung,
      JENIS_PRODUK: r.jenis_produk,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    worksheet['!cols'] = [
      { wch: 28 }, // NAMA_AGEN
      { wch: 18 }, // ALP
      { wch: 30 }, // NAMA_TERTANGGUNG
      { wch: 32 }, // JENIS_PRODUK
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DATA_ASURANSI');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(workbook, `REKAP_ASURANSI_${dateStr}.xlsx`);
  };

  // Salin tabel dengan header kapital untuk langsung di-paste ke Excel
  const handleCopyForExcel = () => {
    let currentRecords = records;
    if (editingId) {
      const cleanAlp = parseAlpNumber(editForm.alp);
      currentRecords = records.map((r) => {
        if (r.id === editingId) {
          return {
            ...r,
            nama_agen: editForm.nama_agen !== undefined ? String(editForm.nama_agen).trim() : r.nama_agen,
            alp: cleanAlp,
            nama_tertanggung: editForm.nama_tertanggung !== undefined ? String(editForm.nama_tertanggung).trim() : r.nama_tertanggung,
            jenis_produk: editForm.jenis_produk !== undefined ? String(editForm.jenis_produk).trim() : r.jenis_produk,
          };
        }
        return r;
      });
      setRecords(currentRecords);
      setEditingId(null);
    }

    const headers = ['NAMA_AGEN', 'ALP', 'NAMA_TERTANGGUNG', 'JENIS_PRODUK'];

    const rows = currentRecords.map((r) =>
      [r.nama_agen, parseAlpNumber(r.alp), r.nama_tertanggung, r.jenis_produk].join('\t')
    );
    const tsvContent = [headers.join('\t'), ...rows].join('\n');

    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = (rec: InsuranceRecord) => {
    setEditingId(rec.id);
    setEditForm({ ...rec });
  };

  const handleSaveEdit = (id: string) => {
    const cleanAlp = parseAlpNumber(editForm.alp);
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            nama_agen: editForm.nama_agen !== undefined ? String(editForm.nama_agen).trim() : r.nama_agen,
            alp: cleanAlp,
            nama_tertanggung: editForm.nama_tertanggung !== undefined ? String(editForm.nama_tertanggung).trim() : r.nama_tertanggung,
            jenis_produk: editForm.jenis_produk !== undefined ? String(editForm.jenis_produk).trim() : r.jenis_produk,
          };
        }
        return r;
      })
    );
    setEditingId(null);
  };

  const handleDeleteRecord = (id: string) => {
    if (records.length <= 1) {
      alert('Minimal harus ada satu data dalam tabel.');
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecordId === id) {
      const remaining = records.filter((r) => r.id !== id);
      setSelectedRecordId(remaining[0]?.id || '');
    }
  };

  const handleAddManualRow = () => {
    const newId = `rec-${Date.now()}`;
    const newRow: InsuranceRecord = {
      id: newId,
      fileName: 'Input_Manual.pdf',
      fileType: 'manual',
      nama_agen: 'NAMA AGEN',
      alp: 12000000,
      nama_tertanggung: 'NAMA TERTANGGUNG',
      jenis_produk: 'NAMA PRODUK',
      caraBayar: 'BULANAN',
      premiDasar: 1000000,
      timestamp: Date.now(),
    };
    setRecords((prev) => [newRow, ...prev]);
    setSelectedRecordId(newId);
    handleStartEdit(newRow);
  };

  const totalALP = records.reduce((acc, curr) => acc + parseAlpNumber(curr.alp), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Rekap Otomatis Dokumen PDF Asuransi ke Excel
              </h1>
              <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI EXTRACTION AKTIF
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Format Kolom Excel: <code className="text-emerald-300 font-mono font-bold">NAMA_AGEN</code> | <code className="text-emerald-300 font-mono font-bold">ALP</code> | <code className="text-emerald-300 font-mono font-bold">NAMA_TERTANGGUNG</code> | <code className="text-emerald-300 font-mono font-bold">JENIS_PRODUK</code>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/40 transition disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengekstrak PDF...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload PDF (Bisa Banyak File)</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopyForExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm"
            title="Salin data dengan header huruf kapital untuk ditempel langsung di Excel"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Tersalin!' : 'Salin Tabel'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Processing State Banner */}
        {isProcessing && (
          <div className="bg-blue-950/60 border border-blue-500/60 text-blue-200 px-5 py-3.5 rounded-2xl flex items-center gap-3 text-xs shadow-lg animate-pulse">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-white text-sm">Sedang Mengekstrak Data Dokumen PDF...</div>
              <div className="text-slate-300 mt-0.5">{processStatus}</div>
            </div>
          </div>
        )}

        {/* Error Notification if Non-PDF was uploaded */}
        {errorMessage && (
          <div className="bg-amber-950/60 border border-amber-600/60 text-amber-200 px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-amber-900/60 rounded text-amber-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Drag & Drop PDF ONLY Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden group ${
            isDragging
              ? 'border-red-500 bg-red-950/40 scale-[1.01]'
              : 'border-slate-700 hover:border-red-500 bg-slate-900/60 hover:bg-slate-900/90'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3 group-hover:scale-110 transition-transform">
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Tarik & Lepas File Dokumen PDF Ilustrasi Polis (Bisa Banyak File Sekaligus)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Sistem secara otomatis membaca isi PDF, menghitung nilai <strong>ALP</strong> (bulanan × 12), mengekstrak <strong>NAMA AGEN</strong>, <strong>NAMA TERTANGGUNG</strong>, dan <strong>JENIS PRODUK</strong>, lalu merekapnya menjadi file Excel.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] font-semibold text-slate-300 flex-wrap justify-center">
            <span className="bg-red-950/70 border border-red-800/80 text-red-300 px-3 py-1 rounded-full flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-red-400" />
              <span>Format Khusus *.pdf</span>
            </span>
            <span className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 px-3 py-1 rounded-full font-mono">
              {records.length} Berkas PDF Direkap
            </span>
            <span className="bg-blue-950/60 border border-blue-800/80 text-blue-400 px-3 py-1 rounded-full">
              Siap Download ke Excel
            </span>
          </div>
        </div>

        {/* Toolbar & Options */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'table'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Tabel Rekap Excel ({records.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('pdf_list')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'pdf_list'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Files className="w-4 h-4" />
              <span>Daftar Berkas PDF ({records.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Inspektur Dokumen ({selectedRecord.fileName})</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <button
              onClick={handleAddManualRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tambah Baris</span>
            </button>
            <button
              onClick={() => {
                setRecords(initialRecords);
                setSelectedRecordId('rec-sample-3');
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Reset ke Sampel Awal"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Table View */}
        {activeTab === 'table' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Tabel Rekapitulasi Data Asuransi (Siap Download ke Excel)</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono">
                    {records.length} Baris Data
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kolom judul di file Excel hasil download diatur dalam huruf kapital: <strong className="text-emerald-300 font-mono">NAMA_AGEN, ALP, NAMA_TERTANGGUNG, JENIS_PRODUK</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyForExcel}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  {copied ? 'Tersalin!' : 'Salin Semua Data'}
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .XLSX</span>
                </button>
              </div>
            </div>

            {/* Table Element */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b-2 border-slate-800 font-mono text-[11px] tracking-wider text-slate-300">
                    <th className="py-3.5 px-4 w-14 text-center border-r border-slate-800 text-slate-500">
                      NO
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-800 text-blue-400 font-bold bg-blue-950/20">
                      NAMA_AGEN
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-800 text-emerald-400 font-bold bg-emerald-950/20">
                      ALP
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-800 text-purple-400 font-bold bg-purple-950/20">
                      NAMA_TERTANGGUNG
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-800 text-amber-400 font-bold bg-amber-950/20">
                      JENIS_PRODUK
                    </th>
                    <th className="py-3.5 px-4 w-36 text-center">
                      AKSI / LIHAT PDF
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-sans">
                  {records.map((rec, index) => {
                    const isEditing = editingId === rec.id;
                    const isSelected = selectedRecordId === rec.id;

                    return (
                      <tr
                        key={rec.id}
                        className={`transition hover:bg-slate-800/60 ${
                          isSelected ? 'bg-slate-800/40' : ''
                        }`}
                      >
                        {/* No */}
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono border-r border-slate-800">
                          <div className="font-bold">{index + 1}</div>
                          <div className="text-[10px] text-red-400 font-semibold mt-0.5">
                            PDF
                          </div>
                        </td>

                        {/* NAMA_AGEN */}
                        <td className="py-3.5 px-4 border-r border-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.nama_agen || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, nama_agen: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(rec.id);
                              }}
                              className="w-full bg-slate-950 border border-blue-500 rounded px-2.5 py-1 text-white text-xs font-semibold focus:outline-none"
                            />
                          ) : (
                            <div className="font-bold text-white">
                              {rec.nama_agen || <span className="text-slate-500 italic">-</span>}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]" title={rec.fileName}>
                            File: {rec.fileName}
                          </div>
                        </td>

                        {/* ALP */}
                        <td className="py-3.5 px-4 border-r border-slate-800 font-mono">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editForm.alp !== undefined ? editForm.alp : ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, alp: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(rec.id);
                                }}
                                onBlur={() => handleSaveEdit(rec.id)}
                                autoFocus
                                placeholder="Misal: 6000000"
                                className="w-full bg-slate-950 border-2 border-emerald-500 rounded px-2.5 py-1 text-emerald-400 font-bold text-xs focus:outline-none shadow-sm"
                              />
                              <div className="text-[10px] text-emerald-400 font-sans font-medium">
                                Rp {parseAlpNumber(editForm.alp).toLocaleString('id-ID')}
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleStartEdit(rec)}
                              className="cursor-pointer group/alp py-1 px-1 -mx-1 rounded hover:bg-slate-800/80 transition"
                              title="Klik untuk mengedit nilai ALP"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-emerald-400 text-sm tracking-wide">
                                  {parseAlpNumber(rec.alp)}
                                </span>
                                <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover/alp:opacity-100 transition-opacity" />
                              </div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                Rp {parseAlpNumber(rec.alp).toLocaleString('id-ID')}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* NAMA_TERTANGGUNG */}
                        <td className="py-3.5 px-4 border-r border-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.nama_tertanggung || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, nama_tertanggung: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(rec.id);
                              }}
                              className="w-full bg-slate-950 border border-purple-500 rounded px-2.5 py-1 text-white text-xs font-semibold focus:outline-none"
                            />
                          ) : (
                            <div className="font-semibold text-slate-100">
                              {rec.nama_tertanggung || <span className="text-slate-500 italic">-</span>}
                            </div>
                          )}
                        </td>

                        {/* JENIS_PRODUK */}
                        <td className="py-3.5 px-4 border-r border-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.jenis_produk || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, jenis_produk: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(rec.id);
                              }}
                              className="w-full bg-slate-950 border border-amber-500 rounded px-2.5 py-1 text-white text-xs focus:outline-none"
                            />
                          ) : (
                            <div className="text-slate-200">
                              {rec.jenis_produk || <span className="text-slate-500 italic">-</span>}
                            </div>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(rec.id)}
                                  className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                                  title="Simpan Perubahan"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                                  title="Batal"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                {rec.fileUrl && (
                                  <button
                                    onClick={() => {
                                      setPreviewModalUrl({
                                        url: rec.fileUrl!,
                                        title: rec.fileName,
                                      });
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                                    title="Lihat Pratinjau Dokumen PDF"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleStartEdit(rec)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                                  title="Edit Baris"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(rec.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                  title="Hapus Baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-950 border-t-2 border-slate-700 font-semibold text-slate-200">
                    <td colSpan={2} className="py-4 px-4 text-right text-slate-400 uppercase font-mono text-[11px]">
                      TOTAL AKUMULASI ALP:
                    </td>
                    <td className="py-4 px-4 font-mono text-emerald-400 text-base border-r border-slate-800">
                      {totalALP}
                      <span className="text-xs text-slate-400 ml-1.5 font-normal font-sans">
                        (Rp {totalALP.toLocaleString('id-ID')})
                      </span>
                    </td>
                    <td colSpan={3} className="py-4 px-4 text-slate-400 text-xs">
                      Total {records.length} berkas PDF siap di-generate ke format Excel
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>
                  Format file: <strong>.XLSX</strong> | Judul Header:{' '}
                  <span className="text-emerald-400 font-mono font-bold">
                    NAMA_AGEN, ALP, NAMA_TERTANGGUNG, JENIS_PRODUK
                  </span>
                </span>
              </div>
              <button
                onClick={handleExportExcel}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                <Download className="w-4 h-4" />
                <span>Download File Excel (.XLSX)</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: PDF Document List */}
        {activeTab === 'pdf_list' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Files className="w-5 h-5 text-red-400" />
                  <span>Daftar Dokumen PDF Terunggah ({records.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Seluruh file yang tersimpan berasal dari dokumen format .pdf. Klik tombol lihat untuk membuka PDF.
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PDF Tambahan</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.map((rec, i) => (
                <div
                  key={rec.id}
                  className="bg-slate-950 border border-slate-800 hover:border-red-900/60 rounded-xl overflow-hidden flex flex-col group transition"
                >
                  <div className="h-40 bg-slate-900/90 relative flex flex-col items-center justify-center p-4 border-b border-slate-800">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-2 group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-white truncate max-w-full text-center px-2">
                      {rec.fileName}
                    </span>
                    <span className="text-[10px] text-red-400/90 font-mono mt-1 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/40">
                      DOKUMEN PDF
                    </span>

                    {rec.fileUrl && (
                      <button
                        onClick={() =>
                          setPreviewModalUrl({
                            url: rec.fileUrl!,
                            title: rec.fileName,
                          })
                        }
                        className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold"
                      >
                        <Eye className="w-4 h-4 text-red-400" />
                        <span>Buka & Baca PDF</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono text-slate-500">Berkas #{i + 1}</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        ALP: {rec.alp}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white truncate">
                      {rec.nama_tertanggung}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      Agen: <span className="text-slate-200">{rec.nama_agen}</span>
                    </div>
                    <div className="text-[11px] text-amber-400 truncate">
                      {rec.jenis_produk}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Detailed PDF Viewer */}
        {activeTab === 'preview' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-400" />
                  <span>Dokumen PDF: {selectedRecord.fileName}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Pratinjau lembar PDF dan data ekstraksi yang akan masuk ke Excel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedRecordId}
                  onChange={(e) => setSelectedRecordId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {records.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      #{i + 1} - {r.nama_tertanggung} ({r.fileName})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setActiveTab('table')}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Kembali ke Tabel
                </button>

                {selectedRecord.fileUrl && (
                  <a
                    href={selectedRecord.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                  >
                    <span>Tab Baru</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Metrics of this PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-sans">
              <div>
                <div className="text-slate-400 text-[11px] font-mono font-bold">NAMA_AGEN</div>
                <div className="text-white font-bold mt-1 text-sm">{selectedRecord.nama_agen}</div>
                <div className="text-[10px] text-slate-500">Footer Dokumen PDF</div>
              </div>
              <div>
                <div className="text-emerald-400 text-[11px] font-mono font-bold">ALP (INTEGER)</div>
                <div className="text-emerald-400 font-bold font-mono mt-1 text-base">
                  {selectedRecord.alp}
                </div>
                <div className="text-[10px] text-slate-500">Premi Dasar × 12 (Bulanan)</div>
              </div>
              <div>
                <div className="text-purple-400 text-[11px] font-mono font-bold">NAMA_TERTANGGUNG</div>
                <div className="text-purple-200 font-bold mt-1 text-sm">{selectedRecord.nama_tertanggung}</div>
                <div className="text-[10px] text-slate-500">Tertanggung Utama</div>
              </div>
              <div>
                <div className="text-amber-400 text-[11px] font-mono font-bold">JENIS_PRODUK</div>
                <div className="text-amber-200 font-bold mt-1 text-sm">{selectedRecord.jenis_produk}</div>
                <div className="text-[10px] text-slate-500">RIPLAY Dokumen PDF</div>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="h-[650px] w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
              <iframe
                src={`${selectedRecord.fileUrl || '/assets/aistudio/Ilustrasi_c9e2d079.pdf'}#toolbar=1&navpanes=0`}
                className="w-full h-full border-0"
                title="PDF Document Viewer"
              />
            </div>
          </div>
        )}
      </main>

      {/* Modal Zoom PDF Viewer */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-400" />
                <h4 className="text-sm font-bold text-white truncate max-w-md">
                  {previewModalUrl.title}
                </h4>
              </div>
              <button
                onClick={() => setPreviewModalUrl(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-950">
              <iframe
                src={previewModalUrl.url}
                className="w-full h-[650px] border-0"
                title="Modal PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
