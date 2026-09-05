'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { UploadCloud, Pill, History, Box, FileText, CheckCircle, AlertCircle, Sparkles, Download, FileSpreadsheet } from 'lucide-react';

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'medicines' | 'sales' | 'stock'>('medicines');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [importedStats, setImportedStats] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setSuccess(false);
      setErrorMsg('');

      const fileName = selectedFile.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const firstSheet = wb.SheetNames[0];
            const ws = wb.Sheets[firstSheet];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            if (data.length > 0) {
              setHeaders(Object.keys(data[0] as object));
              setCsvData(data);
            }
          } catch (err: any) {
            setErrorMsg('Failed to parse Excel file: ' + err.message);
          }
        };
        reader.readAsBinaryString(selectedFile);
      } else {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: function (results) {
            if (results.data.length > 0) {
              setHeaders(Object.keys(results.data[0] as object));
              setCsvData(results.data);
            }
          },
        });
      }
    }
  };

  const loadSampleCSV = async (type: 'medicines' | 'sales') => {
    try {
      const sampleUrl = type === 'medicines' ? '/sample_marg_medicines.csv' : '/sample_marg_sales.csv';
      const res = await fetch(sampleUrl);
      const text = await res.text();
      setActiveTab(type);
      setSuccess(false);
      setErrorMsg('');

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          if (results.data.length > 0) {
            setHeaders(Object.keys(results.data[0] as object));
            setCsvData(results.data);
            setFile(new File([text], type === 'medicines' ? 'sample_marg_medicines.csv' : 'sample_marg_sales.csv', { type: 'text/csv' }));
          }
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    if (csvData.length === 0) return;
    setImporting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab, data: csvData }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setImportedStats(data.results);
      } else {
        setErrorMsg(data.error || 'Failed to import data');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setImporting(false);
    }
  };

  const cards = [
    {
      id: 'medicines',
      title: 'Import Medicines',
      icon: <Pill size={24} className="text-teal-600" />,
      desc: 'Item Master (PRO Table) with pack sizes, MRP, and salt',
      color: 'bg-teal-50 border-teal-500',
    },
    {
      id: 'sales',
      title: 'Import Sales History',
      icon: <History size={24} className="text-blue-600" />,
      desc: 'Sales Bills (DIS Table) to detect chronic patient repeat orders',
      color: 'bg-blue-50 border-blue-500',
    },
    {
      id: 'stock',
      title: 'Import Stock / Batches',
      icon: <Box size={24} className="text-green-600" />,
      desc: 'Batch stock levels (PROBAT Table) with expiry dates',
      color: 'bg-green-50 border-green-500',
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">MARG ERP Data Synchronization</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Extract inventory, pack sizes (10/15 tabs/strip), and chronic patient orders from MARG
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => loadSampleCSV('medicines')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-semibold border border-teal-200 transition-colors text-center"
            >
              <Sparkles size={14} /> Try Sample Medicines CSV
            </button>
            <button
              onClick={() => loadSampleCSV('sales')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-semibold border border-blue-200 transition-colors text-center"
            >
              <Sparkles size={14} /> Try Sample Sales Register CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cards.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveTab(c.id as any);
                    setFile(null);
                    setCsvData([]);
                    setSuccess(false);
                  }}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    activeTab === c.id
                      ? c.color + ' shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="mb-2">{c.icon}</div>
                  <h3 className="font-bold text-gray-900 text-sm">{c.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Dropzone */}
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50/50 transition-colors">
              <UploadCloud size={44} className="mx-auto text-teal-600 mb-3" />
              <h3 className="text-base font-bold text-gray-900 mb-1">
                Upload MARG Export (.xlsx, .xls, .csv)
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Drag and drop your exported Excel or CSV file here, or click to choose file
              </p>
              <input type="file" id="fileUpload" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              <label
                htmlFor="fileUpload"
                className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Browse Excel / CSV Files
              </label>
            </div>

            {/* Success Feedback */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-800 p-5 rounded-2xl flex items-start gap-3 shadow-xs">
                <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-sm">MARG ERP Import Completed Successfully!</h4>
                  <p className="text-xs text-green-700 mt-1">
                    {importedStats?.medicines ? `Imported/Updated ${importedStats.medicines} medicine records. ` : ''}
                    {importedStats?.customers ? `Identified ${importedStats.customers} chronic patients. ` : ''}
                    {importedStats?.prescriptions ? `Generated ${importedStats.prescriptions} auto-refill subscriptions.` : ''}
                  </p>
                  <p className="text-xs text-green-800 font-semibold mt-2">
                    Check the Medicines, Customers, and Refills tabs to view your newly synced data.
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2 text-xs font-semibold">
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            {/* Preview & Mapping Table */}
            {file && !success && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-teal-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">{file.name}</h3>
                      <p className="text-xs text-gray-500">{csvData.length} records detected in file</p>
                    </div>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 text-center"
                  >
                    {importing ? 'Importing...' : 'Confirm & Ingest Into Database'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 font-semibold">
                        {headers.slice(0, 6).map((h) => (
                          <th key={h} className="p-2.5 border-b">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-700">
                      {csvData.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          {headers.slice(0, 6).map((h) => (
                            <td key={h} className="p-2.5 truncate max-w-[150px]">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-gray-400 italic">Showing top 5 rows preview from uploaded CSV</p>
              </div>
            )}
          </div>

          {/* Right Column: Step-by-Step MARG Export Guide */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <h3 className="font-bold text-sm text-gray-900 font-heading">How to Export from MARG ERP</h3>
              <ol className="space-y-3 text-xs text-gray-600 list-decimal list-inside">
                <li className="leading-relaxed">
                  <strong className="text-gray-800">Item Master (Medicines):</strong>
                  <p className="pl-4 text-gray-500 mt-0.5">
                    Navigate to <em>Masters &gt; Inventory Master &gt; Item Master</em>. Press <code>Alt + P</code> and select <em>Export to Excel/CSV</em>.
                  </p>
                </li>
                <li className="leading-relaxed">
                  <strong className="text-gray-800">Sales Register (Customer History):</strong>
                  <p className="pl-4 text-gray-500 mt-0.5">
                    Go to <em>Daily Reports &gt; Sale Report &gt; Sale Register</em>. Filter date range and export as CSV.
                  </p>
                </li>
                <li className="leading-relaxed">
                  <strong className="text-gray-800">Batch Stock &amp; Expiry:</strong>
                  <p className="pl-4 text-gray-500 mt-0.5">
                    Go to <em>Stocks &gt; Current Stock &gt; Filter PROBAT</em> and export batch balances.
                  </p>
                </li>
                <li className="leading-relaxed">
                  <strong className="text-gray-800">SQL Query Executor (Fastest):</strong>
                  <p className="pl-4 text-gray-500 mt-0.5">
                    Enable SQL Query Executor in Operator powers, run query on <code>PRO</code> or <code>DIS</code>, and click Export.
                  </p>
                </li>
              </ol>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border border-teal-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Live API Available</span>
              <h4 className="font-bold text-sm text-gray-900">MARG API Gateway</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Want automatic real-time sync without manual CSV exports? Configure the MARG API Gateway in Settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
