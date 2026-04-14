/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { parseReceipt } from './lib/ocrParser';
import { supabase } from '@/lib/supabaseClient';
import { 
  ScanLine, LayoutDashboard, ShieldCheck, AlertCircle, AlertTriangle,
  Leaf, FileText, Loader2, Lock, Delete, Cpu,
  History, Calendar, Trophy, Droplets, Factory, Camera, Download, Upload, Sun, Moon, Percent, Zap, FileSpreadsheet,
  RefreshCw, Search, ArrowUpRight, ArrowDownRight, BarChart3, Map, Target, TrendingUp, ChevronRight, ChevronDown, LogOut, Plus, X, Trash2, CircleDollarSign, MoveHorizontal,
  MoreVertical, User, Settings, HelpCircle, Info, Printer, PieChart as PieChartIcon
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import pptxgen from "pptxgenjs";
import html2canvas from 'html2canvas';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, AreaChart, Area, Legend, ReferenceLine, ComposedChart, PieChart, Pie
} from 'recharts';

// --- CHART COLORS (Mimicking Recommended Charts) ---
const CHART_COLORS = {
  blue: '#1d70b8',
  orange: '#f47738',
  green: '#28a197',
  gray: '#94a3b8',
  grid: 'rgba(0,0,0,0.05)',
  gridDark: 'rgba(255,255,255,0.05)'
};

// --- DATA MASTER FPMSB TUNGGAL ---
const TARGET_ANNUAL_PKT1 = 28;
const TARGET_ANNUAL_PKT2 = 26.6;
const TARGET_ANNUAL_FELDA = 25.0; // Target for Lot Felda

const MASTER_DATA: Record<string, { luas: number; target_mt: number; target_hek: number; pkt: string }> = {
  "1": { luas: 72.15, target_mt: 137.08, target_hek: 1.90, pkt: "001" },
  "2": { luas: 68.37, target_mt: 129.91, target_hek: 1.90, pkt: "001" },
  "3": { luas: 76.59, target_mt: 145.53, target_hek: 1.90, pkt: "001" },
  "4": { luas: 92.39, target_mt: 175.54, target_hek: 1.90, pkt: "001" },
  "5": { luas: 60.19, target_mt: 114.36, target_hek: 1.90, pkt: "001" },
  "6": { luas: 80.42, target_mt: 152.79, target_hek: 1.90, pkt: "001" },
  "7": { luas: 89.46, target_mt: 169.98, target_hek: 1.90, pkt: "001" },
  "8": { luas: 82.03, target_mt: 155.85, target_hek: 1.90, pkt: "001" },
  "9": { luas: 83.61, target_mt: 158.87, target_hek: 1.90, pkt: "001" },
  "10": { luas: 84.36, target_mt: 160.28, target_hek: 1.90, pkt: "001" },
  "11": { luas: 47.85, target_mt: 90.91, target_hek: 1.90, pkt: "001" },
  "12": { luas: 76.50, target_mt: 145.34, target_hek: 1.90, pkt: "001" },
  "13": { luas: 50.75, target_mt: 96.43, target_hek: 1.90, pkt: "001" },
  "14": { luas: 70.45, target_mt: 133.85, target_hek: 1.90, pkt: "001" },
  "15": { luas: 68.36, target_mt: 129.88, target_hek: 1.90, pkt: "001" },
  "16": { luas: 64.44, target_mt: 122.44, target_hek: 1.90, pkt: "001" },
  "17": { luas: 84.08, target_mt: 159.75, target_hek: 1.90, pkt: "001" },
  "18": { luas: 76.20, target_mt: 137.15, target_hek: 1.80, pkt: "002" },
  "19": { luas: 81.75, target_mt: 147.15, target_hek: 1.80, pkt: "002" },
  "20": { luas: 68.62, target_mt: 123.52, target_hek: 1.80, pkt: "002" },
  "21": { luas: 24.26, target_mt: 43.68, target_hek: 1.80, pkt: "002" },
  "22": { luas: 65.29, target_mt: 117.52, target_hek: 1.80, pkt: "002" },
  "88": { luas: 98.51, target_mt: 177.32, target_hek: 1.80, pkt: "003" }
};

interface Transaction {
  id?: string | number;
  no_resit: string;
  no_akaun_terima?: string;
  no_lori: string;
  no_seal?: string;
  no_nota_hantaran?: string;
  kpg?: string;
  blok: string;
  tan: number;
  muda: number;
  reject?: number;
  sample?: number;
  rm_mt?: number;
  hasil_rm?: number;
  thek?: number;
  tarikh: string;
  masa_masuk: string;
  created_at: string;
  peringkat?: string;
  is_efb?: boolean;
}

// --- SUB-COMPONENTS ---
const ReportSummarySection = ({ type, data, period, isDarkMode, mode = 'all' }: { type: string, data: any, period: 'day' | 'month' | 'year', isDarkMode: boolean, mode?: 'hero' | 'details' | 'all' | 'details-pkt1' | 'details-pkt2' | 'details-felda' }) => {
  if (!data) return null;
  const getTargetHek = (pkt: string) => {
    let annual = 0;
    if (pkt === "001") annual = TARGET_ANNUAL_PKT1;
    else if (pkt === "002") annual = TARGET_ANNUAL_PKT2;
    else if (pkt === "003") annual = TARGET_ANNUAL_FELDA;
    
    if (period === 'day') return annual / 365;
    if (period === 'month') return annual / 12;
    return annual;
  };

  const targetPkt1 = getTargetHek("001");
  const targetPkt2 = getTargetHek("002");
  const targetFelda = getTargetHek("003");
  
  // Calculate specific luas for each peringkat for higher accuracy
  const luasPkt1 = Object.values(MASTER_DATA).filter(b => b.pkt === "001").reduce((acc, curr) => acc + curr.luas, 0);
  const luasPkt2 = Object.values(MASTER_DATA).filter(b => b.pkt === "002").reduce((acc, curr) => acc + curr.luas, 0);
  const luasFelda = Object.values(MASTER_DATA).filter(b => b.pkt === "003").reduce((acc, curr) => acc + curr.luas, 0);
  const totalLuas = luasPkt1 + luasPkt2 + luasFelda;
  
  const totalTan = data.totalTan || ((data.pkt1_tan || 0) + (data.pkt2_tan || 0) + (data.felda_tan || 0));
  const avgYield = totalLuas > 0 ? totalTan / totalLuas : 0;
  const avgTarget = totalLuas > 0 ? (targetPkt1 * luasPkt1 + targetPkt2 * luasPkt2 + targetFelda * luasFelda) / totalLuas : 0;
  const totalMuda = data.totalMuda || ((data.pkt1_muda || 0) + (data.pkt2_muda || 0) + (data.felda_muda || 0));

  const pctPkt1 = targetPkt1 > 0 ? ((data.pkt1_tan / (luasPkt1 || 1)) / targetPkt1) * 100 : 0;
  const pctPkt2 = targetPkt2 > 0 ? ((data.pkt2_tan / (luasPkt2 || 1)) / targetPkt2) * 100 : 0;
  const pctFelda = targetFelda > 0 ? ((data.felda_tan / (luasFelda || 1)) / targetFelda) * 100 : 0;
  const totalTargetTan = (targetPkt1 * luasPkt1 + targetPkt2 * luasPkt2 + targetFelda * luasFelda);
  const pctAvg = totalTargetTan > 0 ? (totalTan / totalTargetTan) * 100 : 0;

  // Calculate average price for 'harga' type
  const avgPrice = data.avgPrice || 0;
  const price1Pct = data.price1Pct || 0;

  const showHero = mode === 'all' || mode === 'hero';
  const showDetails = mode === 'all' || mode === 'details';
  const isPkt1 = mode === 'details-pkt1';
  const isPkt2 = mode === 'details-pkt2';
  const isFelda = mode === 'details-felda';

  return (
    <div className="space-y-1.5 h-full">
      {type === 'hasil' && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Overall Average with Donut Chart */}
          {showHero && (
            <div className="bg-slate-900 p-1.5 rounded-xl shadow-lg border border-white/5 relative overflow-hidden group h-full flex flex-col">
              <div className="flex justify-between items-center mb-1 px-0.5">
                <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">{period === 'day' ? 'HARI INI' : period === 'month' ? 'BULAN INI' : 'TAHUN INI'}</p>
                <div className={`px-1 py-0.5 rounded text-[7px] font-black ${pctAvg >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {pctAvg.toFixed(1)}%
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-1">
                <div className="h-14 w-14 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Hasil', value: totalTan, fill: '#10b981' },
                          { name: 'Baki', value: Math.max(0, totalTargetTan - totalTan), fill: isDarkMode ? '#1e293b' : '#f1f5f9' }
                        ]}
                        cx="50%" cy="50%" innerRadius={18} outerRadius={24} paddingAngle={2} dataKey="value" stroke="none"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-[8px] font-black text-white leading-none">{avgYield.toFixed(2)}</p>
                    <p className="text-[4px] font-bold text-emerald-400 uppercase">T/H</p>
                  </div>
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="bg-white/5 p-0.5 px-1 rounded-md border border-white/5">
                    <p className="text-[5px] font-black text-slate-500 uppercase tracking-tighter">Hasil</p>
                    <p className="text-[8px] font-black text-emerald-400">{totalTan.toFixed(1)}<span className="text-[5px] ml-0.5 opacity-60">T</span></p>
                  </div>
                  <div className="bg-white/5 p-0.5 px-1 rounded-md border border-white/5">
                    <p className="text-[5px] font-black text-slate-500 uppercase tracking-tighter">Target</p>
                    <p className="text-[8px] font-black text-white">{avgTarget.toFixed(2)}<span className="text-[5px] ml-0.5 opacity-60">T/H</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda) && (
            <div className="flex flex-col gap-1 h-full">
              {/* Peringkat 1 */}
              {(showDetails || isPkt1) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-display font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 1</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-emerald-200 dark:hover:border-emerald-700 transition-all h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                          {(data.pkt1_tan / (luasPkt1 || 1)).toFixed(2)}<span className="text-[7px] ml-0.5 text-slate-400 font-bold">T/H</span>
                        </p>
                      </div>
                      <span className={`text-[8px] font-black ${pctPkt1 >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{pctPkt1.toFixed(0)}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                      <div className="flex flex-col">
                        <p className="text-[5px] font-black text-slate-400 uppercase tracking-tighter">Hasil</p>
                        <p className="text-[8px] font-black text-slate-600 dark:text-slate-300">{data.pkt1_tan.toFixed(1)}<span className="text-[5px] ml-0.5 opacity-60">T</span></p>
                      </div>
                      <div className="flex flex-col border-l border-slate-50 dark:border-slate-800/50 pl-1">
                        <p className="text-[5px] font-black text-slate-400 uppercase tracking-tighter">Target</p>
                        <p className="text-[8px] font-black text-slate-500 dark:text-slate-400">{targetPkt1.toFixed(2)}<span className="text-[5px] ml-0.5 opacity-60">T/H</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Peringkat 2 */}
              {(showDetails || isPkt2) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-display font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 2</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-emerald-200 dark:hover:border-emerald-700 transition-all h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                          {(data.pkt2_tan / (luasPkt2 || 1)).toFixed(2)}<span className="text-[7px] ml-0.5 text-slate-400 font-bold">T/H</span>
                        </p>
                      </div>
                      <span className={`text-[8px] font-black ${pctPkt2 >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{pctPkt2.toFixed(0)}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                      <div className="flex flex-col">
                        <p className="text-[5px] font-black text-slate-400 uppercase tracking-tighter">Hasil</p>
                        <p className="text-[8px] font-black text-slate-600 dark:text-slate-300">{data.pkt2_tan.toFixed(1)}<span className="text-[5px] ml-0.5 opacity-60">T</span></p>
                      </div>
                      <div className="flex flex-col border-l border-slate-50 dark:border-slate-800/50 pl-1">
                        <p className="text-[5px] font-black text-slate-400 uppercase tracking-tighter">Target</p>
                        <p className="text-[8px] font-black text-slate-500 dark:text-slate-400">{targetPkt2.toFixed(2)}<span className="text-[5px] ml-0.5 opacity-60">T/H</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lot Felda */}
              {(showDetails || isFelda) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-display font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>FELDA</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 group hover:border-emerald-200 dark:hover:border-emerald-700 transition-all h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                          {(data.felda_tan / (luasFelda || 1)).toFixed(2)}<span className="text-[7px] ml-0.5 text-slate-400 font-bold">T/H</span>
                        </p>
                      </div>
                      <span className={`text-[8px] font-black ${pctFelda >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{pctFelda.toFixed(0)}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-50 dark:border-slate-800/50">
                      <div className="flex flex-col">
                        <p className="text-[5px] font-black text-slate-400 uppercase tracking-tighter">Hasil</p>
                        <p className="text-[8px] font-black text-slate-600 dark:text-slate-300">{data.felda_tan.toFixed(1)}<span className="text-[5px] ml-0.5 opacity-60">T</span></p>
                      </div>
                      <div className="flex flex-col border-l border-slate-50 dark:border-slate-800/50 pl-1">
                        <p className="text-[5px] font-black text-slate-400 uppercase tracking-tighter">Target</p>
                        <p className="text-[8px] font-black text-slate-500 dark:text-slate-400">{targetFelda.toFixed(2)}<span className="text-[5px] ml-0.5 opacity-60">T/H</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {type === 'muda' && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Total Muda */}
          {showHero && (
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg border border-white/5 relative overflow-hidden h-full">
              <div className="relative z-10">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Jumlah Muda</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-display font-black text-white">{totalMuda}</p>
                  <p className="text-[8px] font-black text-rose-500 uppercase">Tandan</p>
                </div>
              </div>
            </div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda) && (
            <div className="flex flex-col gap-1 h-full">
              {(showDetails || isPkt1) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 1</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-rose-600 dark:text-rose-400">{data.pkt1_muda}</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase">Tandan</p>
                    </div>
                  </div>
                </div>
              )}
              {(showDetails || isPkt2) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 2</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-rose-600 dark:text-rose-400">{data.pkt2_muda}</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase">Tandan</p>
                    </div>
                  </div>
                </div>
              )}
              {(showDetails || isFelda) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>FELDA</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-rose-600 dark:text-rose-400">{data.felda_muda}</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase">Tandan</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {type === 'kpa_kpg' && (
        <div className="space-y-1.5 h-full flex flex-col">
          {showHero && (
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg border border-white/5 relative overflow-hidden h-full">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-0.5">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">KPG=KPA ({data.totalResit > 0 ? Math.round((data.kpgMatchCount / data.totalResit) * 100) : 0}%)</p>
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{data.kpgMatchTan.toFixed(1)} TAN</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-display font-black text-white">{data.kpgMatchCount}</p>
                  <p className="text-[8px] font-black text-emerald-400 uppercase">Resit</p>
                  <p className="text-[8px] font-black text-slate-500 uppercase ml-1">/ {data.totalResit} KPA</p>
                </div>
              </div>
            </div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda) && (
            <div className="flex flex-col gap-1 h-full">
              {(showDetails || isPkt1) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 1</p>}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{data.pkt1_kpg_match}<span className="text-[8px] text-emerald-600/50 ml-1">/ {data.pkt1_resit}</span></p>
                      <p className="text-[7px] font-bold text-emerald-500 uppercase">Resit</p>
                    </div>
                  </div>
                </div>
              )}
              {(showDetails || isPkt2) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 2</p>}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{data.pkt2_kpg_match}<span className="text-[8px] text-emerald-600/50 ml-1">/ {data.pkt2_resit}</span></p>
                      <p className="text-[7px] font-bold text-emerald-500 uppercase">Resit</p>
                    </div>
                  </div>
                </div>
              )}
              {(showDetails || isFelda) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>FELDA</p>}
                  <div className="bg-emerald-900/20 dark:bg-emerald-900/40 p-1.5 rounded-lg shadow-sm border border-emerald-500/20 h-full flex flex-col justify-center">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{data.felda_kpg_match}<span className="text-[8px] text-emerald-600/50 ml-1">/ {data.felda_resit}</span></p>
                      <p className="text-[7px] font-bold text-emerald-500 uppercase">Resit</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {type === 'harga' && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Average Price */}
          {showHero && (
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg border border-white/5 relative overflow-hidden h-full">
              <div className="relative z-10">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Purata Harga/Tan</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-display font-black text-white">RM {avgPrice.toFixed(2)}</p>
                </div>
                <div className="mt-1 pt-1 border-t border-white/5">
                  <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Harga 1% (OER)</p>
                  <p className="text-[10px] font-black text-emerald-400">RM {price1Pct.toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}

          {(showDetails || isPkt1 || isPkt2 || isFelda) && (
            <div className="flex flex-col gap-1 h-full">
              {(showDetails || isPkt1) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 1</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">RM {(data.pkt1_avg_price || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
              {(showDetails || isPkt2) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>PKT 2</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">RM {(data.pkt2_avg_price || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
              {(showDetails || isFelda) && (
                <div className="space-y-0 h-full flex flex-col">
                  {showDetails && <p className={`text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 ${period !== 'day' ? 'opacity-0 select-none' : ''}`}>FELDA</p>}
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">RM {(data.felda_avg_price || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {type === 'efb' && (
        <div className="space-y-1.5 h-full flex flex-col">
          {/* Hero Summary Card - Total EFB */}
          {showHero && (
            <div className="bg-slate-900 p-2 rounded-xl shadow-lg border border-white/5 relative overflow-hidden h-full">
              <div className="relative z-10">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Jumlah EFB (Tandan Kosong)</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-display font-black text-white">{data.efb_tan.toFixed(2)}</p>
                  <p className="text-[8px] font-black text-emerald-400 uppercase">Tan</p>
                </div>
                <div className="mt-1 pt-1 border-t border-white/5">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Bilangan Resit</p>
                  <p className="text-[10px] font-black text-white">{data.efb_resit} <span className="text-[7px] opacity-60">KPA</span></p>
                </div>
              </div>
            </div>
          )}

          {showDetails && (
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col justify-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Status Penghantaran EFB</p>
              <div className="flex justify-center items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">Berjalan Lancar</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [authRole, setAuthRole] = useState<'staff' | 'fc' | 'afc' | 'fs' | null>(null); 
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<'scan' | 'dashboard' | 'sejarah'>('scan');
  const [direction, setDirection] = useState(0);

  const handleTabChange = (newTab: 'scan' | 'dashboard' | 'sejarah') => {
    const tabs: ('scan' | 'dashboard' | 'sejarah')[] = ['scan', 'dashboard', 'sejarah'];
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = tabs.indexOf(newTab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };
  const [reportType, setReportType] = useState<'hasil' | 'muda' | 'kpa_kpg' | 'harga' | 'efb' | 'efc_format'>('hasil');
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('left');
  const [showRanking, setShowRanking] = useState(false);
  const [rankingPeriod, setRankingPeriod] = useState<'month' | 'year'>('month');
  const [chartPeriod, setChartPeriod] = useState<'day' | 'month' | 'year' | 'history' | 'monthly_trend'>('month');
  const [chartMetric, setChartMetric] = useState<'yield' | 'muda' | 'kpg' | 'efb'>('yield');
  const [showYtdChart, setShowYtdChart] = useState(true);
  const [showMonthlyTrendChart, setShowMonthlyTrendChart] = useState(true);
  const [showPriceTrendChart, setShowPriceTrendChart] = useState(true);
  const [showThekChart, setShowThekChart] = useState(true);
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<string>('all');
  const [selectedPactFilter, setSelectedPactFilter] = useState<string>('all');
  const [configStatus, setConfigStatus] = useState<{ supabase: boolean; googleSheets: boolean } | null>(null);
  
  const monthlyTrendRef = useRef<HTMLDivElement>(null);
  const thekChartRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({ 
    no_resit: '', 
    no_akaun_terima: '',
    no_lori: '', 
    no_seal: '',
    no_nota_hantaran: '',
    kpg: '',
    blok: '', 
    tan: '', 
    muda: '',
    reject: '0.00',
    sample: '0',
    rm_mt: '',
    tarikh: '',
    masa_masuk: '',
    is_efb: false
  });
  const [rawData, setRawData] = useState<Transaction[]>([]);
  const [annualData, setAnnualData] = useState<any[]>([
    { year: 2021, yield: 25.69 },
    { year: 2022, yield: 30.51 },
    { year: 2023, yield: 26.98 },
    { year: 2024, yield: 29.55 },
    { year: 2025, yield: 31.10 }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  
  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAnnualModal, setShowAnnualModal] = useState(false);
  const [showOcrActions, setShowOcrActions] = useState(false);
  const [annualForm, setAnnualForm] = useState({ year: 2026, yield: '' });
  const [exportFilter, setExportFilter] = useState<'all' | 'date' | 'month'>('all');
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [exportDate, setExportDate] = useState(new Date(new Date().getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0]);
  const [exportMonth, setExportMonth] = useState(new Date(new Date().getTime() + (8 * 60 * 60 * 1000)).toISOString().slice(0, 7));
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewFeatures, setShowNewFeatures] = useState(false);
  const [expandedTrendChart, setExpandedTrendChart] = useState<'overall' | 'pkt1' | 'pkt2' | 'felda' | null>(null);
  const [isThekExpanded, setIsThekExpanded] = useState(false);
  const [isPieExpanded, setIsPieExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>(['tarikh', 'no_resit', 'no_lori', 'blok', 'tan', 'muda', 'kpg']);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const STAFF_PIN = "123456";
  const FC_PIN = "888888";
  const AFC_PIN = "777777";
  const FS_PIN = "555555";

  const safeFetch = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Ralat pelayan (${res.status})`);
      }
      return text;
    }

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Ralat pelayan (${res.status})`);
    }
    return data;
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) showToast('success', 'Mengambil data terbaru...');
      const data = await safeFetch('/api/hantaran');
      
      if (Array.isArray(data)) {
        const parsedData = data.map((item: any) => {
          const rawBlok = String(item.blok || '').trim();
          const cleanBlok = rawBlok ? parseInt(rawBlok.replace(/[^0-9]/g, ''), 10).toString() : '';
          
          // Normalize date to YYYY-MM-DD
          let normalizedDate = '';
          if (item.tarikh) {
            const datePart = item.tarikh.split(/T| /)[0];
            const separator = datePart.includes('-') ? '-' : (datePart.includes('/') ? '/' : '');
            if (separator) {
              const parts = datePart.split(separator);
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY-MM-DD or YYYY/MM/DD
                  normalizedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                  // DD-MM-YYYY or DD/MM/YYYY
                  normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            }
          }
          
          // Fallback to created_at if tarikh is missing or invalid
          if (!normalizedDate && item.created_at) {
            normalizedDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
          }

          const rawKpg = String(item.kpg || '').trim().replace(',', '.');
          const cleanKpg = rawKpg.replace(/[^0-9.]/g, '');
          
          const rawTan = String(item.tan || '').trim().replace(',', '.');
          const cleanTan = parseFloat(rawTan.replace(/[^0-9.]/g, '')) || 0;

          const rawMuda = String(item.muda || '').trim().replace(',', '.');
          const cleanMuda = parseFloat(rawMuda.replace(/[^0-9.]/g, '')) || 0;

          const cleanReject = parseFloat(String(item.reject || '0').replace(',', '.')) || 0;
          const cleanSample = parseInt(String(item.sample || '0')) || 0;
          const cleanRmMt = parseFloat(String(item.rm_mt || '0').replace(',', '.')) || 0;
          const cleanHasilRm = parseFloat(String(item.hasil_rm || '0').replace(',', '.')) || (cleanTan * cleanRmMt);
          
          return {
            ...item,
            tan: cleanTan,
            muda: cleanMuda,
            kpg: cleanKpg,
            blok: cleanBlok,
            tarikh: normalizedDate.trim(),
            no_akaun_terima: item.no_akaun_terima || '',
            reject: cleanReject,
            sample: cleanSample,
            rm_mt: cleanRmMt,
            hasil_rm: parseFloat(cleanHasilRm.toFixed(2))
          };
        });
        setRawData(parsedData);
      } else {
        setRawData([]);
      }
    } catch (e: any) { 
      console.error("Fetch error:", e);
      showToast('error', e.message || 'Gagal memuat turun data. Sila periksa sambungan internet.'); 
    }
  };

  const handleDeleteRecord = async (no_resit: string) => {
    try {
      setIsProcessing(true);
      await safeFetch(`/api/hantaran/${no_resit}`, {
        method: 'DELETE'
      });
      
      showToast('success', `Rekod ${no_resit} telah dipadam.`);
      setRecordToDelete(null);
      fetchData(true);
    } catch (e: any) {
      console.error("Delete error:", e);
      showToast('error', e.message || 'Gagal memadam data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAllRecords = async () => {
    try {
      setIsProcessing(true);
      await safeFetch('/api/hantaran/all', {
        method: 'DELETE'
      });
      
      showToast('success', 'Semua rekod telah dipadam.');
      setShowDeleteAllModal(false);
      fetchData(true);
    } catch (e: any) {
      console.error("Delete all error:", e);
      showToast('error', e.message || 'Gagal memadam semua data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchAnnualData = async () => {
    try {
      const data = await safeFetch('/api/annual-yield');
      if (Array.isArray(data) && data.length > 0) {
          const serverData = data.map(d => ({
            ...d,
            year: parseInt(d.year) || 0,
            yield: parseFloat(d.yield) || 0
          })).filter(d => d.year > 0);
          
          // Merge server data with defaults, server data takes precedence
          setAnnualData(prev => {
            const merged = [...prev];
            serverData.forEach(sd => {
              const idx = merged.findIndex(m => m.year === sd.year);
              if (idx > -1) {
                merged[idx] = sd;
              } else {
                merged.push(sd);
              }
            });
            return merged.sort((a, b) => a.year - b.year);
          });
        }
    } catch (e: any) {
      console.error("Annual fetch error:", e.message || e);
    }
  };

  // Auto-scroll active report type into center on mount
  React.useEffect(() => {
    if (activeTab === 'dashboard') {
      const activeBtn = document.querySelector(`button[data-report-id="${reportType}"]`);
      if (activeBtn) {
        activeBtn.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab, reportType]);

  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    const types: ('hasil' | 'muda' | 'kpa_kpg' | 'harga')[] = ['hasil', 'muda', 'kpa_kpg', 'harga'];
    const currentIndex = types.indexOf(reportType as any);
    
    // If current type is not in the main swipeable types (like efc_format), don't swipe
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'left') {
      // Swipe Left (Finger moves right to left) -> Next page
      nextIndex = (currentIndex + 1) % types.length;
    } else {
      // Swipe Right (Finger moves left to right) -> Previous page
      nextIndex = (currentIndex - 1 + types.length) % types.length;
    }

    const nextType = types[nextIndex];
    setReportType(nextType);
    
    // Sync chart metric
    if (nextType === 'hasil') setChartMetric('yield');
    else if (nextType === 'muda') setChartMetric('muda');
    else if (nextType === 'kpa_kpg') setChartMetric('kpg');
    else if (nextType === 'harga') setChartMetric('yield');
  };

  const checkConfig = async () => {
    try {
      const data = await safeFetch('/api/config-check');
      setConfigStatus(data);
    } catch (e) { console.error('Config check failed', e); }
  };

  useEffect(() => {
    if (authRole) {
      fetchData(true);
      fetchAnnualData();
      checkConfig();
    }
  }, [authRole]);

  useEffect(() => {
    if (!authRole) return;

    const channel = supabase
      .channel('hantaran-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hantaran_hasil' },
        (payload) => {
          console.log("🔥 Real-time event:", payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            setRawData(prev => {
              const exists = prev.find(p => p.id === payload.new.id);
              if (exists) return prev;
              showToast('success', `Data baru: Resit ${payload.new.no_resit}`);
              return [payload.new as Transaction, ...prev];
            });
          }

          if (payload.eventType === 'DELETE') {
            setRawData(prev => prev.filter(p => p.id !== payload.old.id));
            showToast('error', 'Rekod telah dipadam.');
          }

          if (payload.eventType === 'UPDATE') {
            setRawData(prev =>
              prev.map(p => p.id === payload.new.id ? (payload.new as Transaction) : p)
            );
            showToast('success', `Rekod dikemaskini: Resit ${payload.new.no_resit}`);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log("Supabase real-time connected.");
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error("Supabase subscription error:", status, err);
          showToast('error', 'Gagal menyambung ke pangkalan data masa-nyata.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePinPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setLoginError(false);

      if (newPin.length === 6) {
        setTimeout(() => {
          if (newPin === STAFF_PIN) {
            setAuthRole('staff'); setActiveTab('scan');
          } else if (newPin === FC_PIN) {
            setAuthRole('fc'); setActiveTab('dashboard');
          } else if (newPin === AFC_PIN) {
            setAuthRole('afc'); setActiveTab('dashboard');
          } else if (newPin === FS_PIN) {
            setAuthRole('fs'); setActiveTab('dashboard');
          } else {
            setLoginError(true); setPin('');
          }
        }, 300);
      }
    }
  };

  const handleDeletePress = () => setPin(pin.slice(0, -1));
  const handleLogout = () => { setAuthRole(null); setPin(''); setActiveTab('scan'); };

  const submitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.no_resit || !formData.no_lori || !formData.blok) {
      showToast('error', 'Sila lengkapkan semua maklumat wajib.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await safeFetch('/api/hantaran', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData) 
      });
      
      if (result.success) {
        showToast('success', `Berjaya: Resit ${result.ref}`);
        setFormData({ 
          no_resit: '', 
          no_akaun_terima: '',
          no_lori: '', 
          no_seal: '', 
          no_nota_hantaran: '', 
          kpg: '', 
          blok: '', 
          tan: '', 
          muda: '', 
          reject: '0.00',
          sample: '0',
          rm_mt: '',
          tarikh: '', 
          masa_masuk: '',
          is_efb: false
        });
        fetchData(true);
      } else {
        // Handle specific status codes or error messages
        const errorMsg = result.error || 'Ralat tidak dijangka berlaku.';
        showToast('error', errorMsg);
      }
    } catch (err: any) { 
      console.error("Submission error:", err);
      showToast('error', 'Gagal menghubungi pelayan. Sila periksa sambungan internet.'); 
    } 
    finally { setIsProcessing(false); }
  };

  const exportToPPTX = async () => {
    let filteredData = rawData;

    if (exportFilter === 'date') {
      filteredData = rawData.filter(item => {
        if (item.tarikh === exportDate) return true;
        if (item.created_at) {
          const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
          return createdDate === exportDate;
        }
        return false;
      });
    } else if (exportFilter === 'month') {
      filteredData = rawData.filter(item => {
        if (item.tarikh && item.tarikh.startsWith(exportMonth)) return true;
        if (item.created_at) {
          const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().slice(0, 7);
          return createdDate.startsWith(exportMonth);
        }
        return false;
      });
    }

    if ((filteredData?.length || 0) === 0) {
      showToast('error', 'Tiada data untuk dieksport pada tarikh/bulan ini.');
      return;
    }

    const periodLabel = exportFilter === 'all' ? 'Semua Rekod' : (exportFilter === 'month' ? exportMonth : exportDate);
    const summaryData = analytics?.month || { pkt1_tan: 0, pkt2_tan: 0, felda_tan: 0, totalTan: 0, pkt1_muda: 0, pkt2_muda: 0, felda_muda: 0, totalMuda: 0, pkt1_kpg_match: 0, pkt2_kpg_match: 0, felda_kpg_match: 0, kpgMatchCount: 0 };
    
    const allPossibleCols = [
      { id: 'blok', label: 'Blok' },
      { id: 'peringkat', label: 'Peringkat' },
      { id: 'tan', label: 'Hasil (Tan)' },
      { id: 'thek', label: 'Yield (T/H)' },
      { id: 'muda', label: 'Muda' }
    ];
    
    const activeCols = allPossibleCols.filter(c => exportColumns.includes(c.id));
    if (activeCols.length === 0) activeCols.push(allPossibleCols[0]);

    const topBlocks = (analytics?.month?.rankedBlok || []).slice(0, 10);
    const tableRows = topBlocks.map(b => {
      const row: any[] = [];
      activeCols.forEach(c => {
        if (c.id === 'blok') row.push(b.blok);
        else if (c.id === 'peringkat') row.push(b.pkt === "001" ? "PKT 1" : (b.pkt === "002" ? "PKT 2" : "FELDA"));
        else if (c.id === 'tan') row.push(b.tan.toFixed(1));
        else if (c.id === 'thek') row.push(b.yieldHek.toFixed(2));
        else if (c.id === 'muda') row.push(b.muda.toString());
      });
      return row;
    });

    const exportPayload = {
      reportTitle: `Laporan Analitik: ${reportType.toUpperCase()}`,
      generatedAt: new Date().toLocaleString(),
      filters: {
        type: reportType,
        period: periodLabel,
        columns: exportColumns
      },
      summaryCards: [
        { label: "Total Tan", value: (summaryData.totalTan || 0).toFixed(1), subValue: "Keseluruhan" },
        { label: "Muda (Tandan)", value: (summaryData.totalMuda || 0).toString(), subValue: "Keseluruhan" },
        { label: "KPG=KPA (Resit)", value: (summaryData.kpgMatchCount || 0).toString(), subValue: "Keseluruhan" }
      ],
      charts: [
        {
          title: `Trend Hasil Bulanan (${new Date().getFullYear()})`,
          type: 'bar',
          data: (analytics?.monthlyTrend || []).map(d => ({ name: d.month, values: [d.yield] })),
          options: { showValue: true, valAxisTitle: "T/H" }
        },
        {
          title: "Pecahan Hasil Mengikut Peringkat",
          type: 'pie',
          data: [
            { name: 'PKT 1', values: [summaryData.pkt1_tan || 0] },
            { name: 'PKT 2', values: [summaryData.pkt2_tan || 0] },
            { name: 'FELDA', values: [summaryData.felda_tan || 0] }
          ],
          options: { showPercent: true, legendPos: 'r' }
        }
      ],
      tables: [
        {
          title: "Prestasi Mengikut Blok (Top 10)",
          headers: activeCols.map(c => c.label),
          rows: tableRows
        }
      ],
      branding: {
        companyName: "FPMSB TUNGGAL",
        logoText: "Integrated Plantation Data System",
        primaryColor: "#064E3B"
      }
    };

    try {
      setIsExporting(true);
      console.log('Starting PPTX export fetch...');
      const response = await fetch('/api/export/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gagal menjana PowerPoint: ${errorText}`);
      }

      const blob = await response.blob();
      console.log('PPTX blob received, size:', blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FPMSB_Laporan_${periodLabel.replace(/-/g, '_')}.pptx`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);
      
      showToast('success', 'PowerPoint berjaya dimuat turun.');
    } catch (error) {
      console.error('PPTX Export Error:', error);
      showToast('error', `Gagal memuat turun PowerPoint: ${error instanceof Error ? error.message : 'Sila cuba lagi'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setIsExporting(true);
      let filteredData = rawData;

    if (exportFilter === 'date') {
      filteredData = rawData.filter(item => {
        if (item.tarikh === exportDate) return true;
        if (item.created_at) {
          const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
          return createdDate === exportDate;
        }
        return false;
      });
    } else if (exportFilter === 'month') {
      filteredData = rawData.filter(item => {
        if (item.tarikh && item.tarikh.startsWith(exportMonth)) return true;
        if (item.created_at) {
          const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
          return createdDate.startsWith(exportMonth);
        }
        return false;
      });
    }

    if ((filteredData?.length || 0) === 0) {
      showToast('error', 'Tiada data untuk dieksport pada tarikh/bulan ini.');
      return;
    }

    const workbook = new ExcelJS.Workbook();

    // Helper function to create a standard sheet
    const createStandardSheet = (ws: ExcelJS.Worksheet, data: Transaction[], sheetTitle: string, isMaster: boolean = false) => {
      // Add Title Row
      ws.mergeCells('A1:M1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'FPMSB TUNGGAL';
      titleCell.font = { name: 'Arial Black', size: 20, color: { argb: 'FFFFFFFF' }, bold: true };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF064E3B' } // Emerald 900
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 50;

      // Add Subtitle Row
      ws.mergeCells('A2:M2');
      const subtitleCell = ws.getCell('A2');
      subtitleCell.value = 'SISTEM MAKLUMAT LADANG BERSEPADU';
      subtitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF065F46' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 30;

      // Add Report Type Row
      ws.mergeCells('A3:M3');
      const reportCell = ws.getCell('A3');
      reportCell.value = sheetTitle;
      reportCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF065F46' } };
      reportCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(3).height = 25;

      // Add Metadata Row (Date/Month)
      const metaText = exportFilter === 'date' ? `Tarikh: ${exportDate}` : (exportFilter === 'month' ? `Bulan: ${exportMonth}` : 'Semua Rekod');
      ws.mergeCells('A4:M4');
      const metaCell = ws.getCell('A4');
      metaCell.value = `Ladang: FPMSB TUNGGAL | ${metaText}`;
      metaCell.font = { name: 'Arial', size: 11, bold: true, italic: true, color: { argb: 'FF374151' } };
      metaCell.alignment = { horizontal: 'right', vertical: 'middle' };
      ws.getRow(4).height = 20;

      ws.addRow([]); // Spacer (Row 5)

      // Define Columns
      const allPossibleColumns = [
        { header: 'TARIKH', key: 'tarikh', width: 15 },
        { header: 'NO. RESIT', key: 'no_resit', width: 15 },
        { header: 'NO. LORI', key: 'no_lori', width: 12 },
        { header: 'NO. SEAL', key: 'no_seal', width: 12 },
        { header: 'NO. NOTA HANTARAN', key: 'no_nota', width: 20 },
        { header: 'KPG', key: 'kpg', width: 10 },
        { header: 'BLOK', key: 'blok', width: 10 },
        { header: 'PERINGKAT', key: 'peringkat', width: 12 },
        { header: 'BERAT (TAN)', key: 'tan', width: 15 },
        { header: 'BTS MUDA', key: 'muda', width: 12 },
        { header: 'TAN/HEK (T/H)', key: 'thek', width: 15 },
        { header: 'MASA MASUK', key: 'masa', width: 15 },
        { header: 'DICIPTA PADA', key: 'created', width: 25 },
      ];
      
      const activeCols = allPossibleColumns.filter(c => exportColumns.includes(c.key) || c.key === 'tarikh');
      ws.columns = activeCols;

      // Style Header Row
      const headerRow = ws.getRow(6);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF10B981' } // Emerald 500
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      // Add Data Rows
      data.forEach((item) => {
        const rowData: any = {};
        activeCols.forEach(col => {
          if (col.key === 'tarikh') rowData.tarikh = item.tarikh.split('-').reverse().join('.');
          else if (col.key === 'no_resit') rowData.no_resit = item.no_resit;
          else if (col.key === 'no_lori') rowData.no_lori = item.no_lori;
          else if (col.key === 'no_seal') rowData.no_seal = item.no_seal || '-';
          else if (col.key === 'no_nota') rowData.no_nota = item.no_nota_hantaran || '-';
          else if (col.key === 'kpg') rowData.kpg = item.kpg || '-';
          else if (col.key === 'blok') rowData.blok = item.blok;
          else if (col.key === 'peringkat') rowData.peringkat = item.peringkat || '-';
          else if (col.key === 'tan') rowData.tan = item.tan;
          else if (col.key === 'muda') rowData.muda = item.muda;
          else if (col.key === 'thek') rowData.thek = item.thek || 0;
          else if (col.key === 'masa') rowData.masa = item.masa_masuk || '-';
          else if (col.key === 'created') rowData.created = item.created_at ? new Date(item.created_at).toLocaleString() : '-';
        });
        const row = ws.addRow(rowData);
        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
          cell.font = { size: 10 };
        });
      });

      // Add Summary Row
      const summaryRow = ws.addRow({});
      const tanColIndex = activeCols.findIndex(c => c.key === 'tan') + 1;
      const mudaColIndex = activeCols.findIndex(c => c.key === 'muda') + 1;
      const thekColIndex = activeCols.findIndex(c => c.key === 'thek') + 1;

      if (tanColIndex > 0) {
        summaryRow.getCell(tanColIndex).value = data.reduce((sum, item) => sum + item.tan, 0);
        summaryRow.getCell(tanColIndex).numFmt = '#,##0.00';
      }
      if (mudaColIndex > 0) {
        summaryRow.getCell(mudaColIndex).value = data.reduce((sum, item) => sum + item.muda, 0);
      }
      if (thekColIndex > 0) {
        const totalTan = data.reduce((sum, item) => sum + item.tan, 0);
        const totalLuas = data.reduce((sum, item) => {
          const b = MASTER_DATA[item.blok];
          return sum + (b ? b.luas : 0);
        }, 0);
        summaryRow.getCell(thekColIndex).value = totalLuas > 0 ? totalTan / totalLuas : 0;
        summaryRow.getCell(thekColIndex).numFmt = '#,##0.00';
      }

      summaryRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // Amber 200
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
      });
    };

    const createEfcSheet = (ws: ExcelJS.Worksheet, data: Transaction[]) => {
      // Setup Page Layout
      ws.pageSetup.orientation = 'landscape';
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;

      // 1. TOP METADATA SECTION (Now starts at Row 1)
      ws.getCell('A1').value = 'TARIKH MULA';
      ws.getCell('A2').value = 'TARIKH TAMAT';
      ws.getCell('A3').value = 'BULAN';

      [1,2,3].forEach(r => {
        ws.getCell(`B${r}`).value = ':';
        ws.getCell(`A${r}`).font = { size: 9, bold: true };
        ws.getCell(`B${r}`).font = { size: 9, bold: true };
      });

      // Values
      ws.getCell('C1').value = exportFilter === 'date' ? exportDate.split('-').reverse().join('.') : '01.01.2026';
      ws.getCell('C2').value = exportFilter === 'date' ? exportDate.split('-').reverse().join('.') : '31.12.2026';
      ws.getCell('C3').value = exportFilter === 'month' ? ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'][parseInt(exportMonth.split('-')[1]) - 1] : 'APRIL';

      // 3. TABLE HEADERS (Row 4-5)
      const headers = [
        { col: 'A', title: 'TARIKH', rowSpan: true },
        { col: 'B', title: 'No. Kenderaan', rowSpan: true },
        { col: 'C', title: 'Trip No:', rowSpan: true },
        { col: 'D', title: 'No. Nota Hantaran', rowSpan: true },
        { col: 'E', title: 'No. Resit', rowSpan: true },
        { col: 'F', title: 'Bil. Tandan', rowSpan: true },
        { col: 'G', title: 'Tan', rowSpan: true },
        { col: 'H', title: 'OER (%)', rowSpan: true },
        { col: 'I', title: 'KPG (%)', rowSpan: true }
      ];

      headers.forEach(h => {
        const cell = ws.getCell(`${h.col}4`);
        cell.value = h.title;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (h.rowSpan) ws.mergeCells(`${h.col}4:${h.col}5`);
      });

      // 4. DATA ROWS (Starting Row 6)
      let currentRow = 6;
      data.forEach((item) => {
        const row = ws.getRow(currentRow);
        row.values = [
          item.tarikh.split('-').reverse().join('/'),
          item.no_lori,
          '1', // Trip No
          item.no_nota_hantaran || '',
          item.no_resit,
          item.muda || '',
          item.tan,
          '21.25%', // OER Placeholder
          item.kpg || ''
        ];

        row.eachCell((cell) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { size: 9 };
        });
        currentRow++;
      });

      // Fill empty rows to match the visual (up to 30 rows)
      const targetRows = Math.max(currentRow, 30);
      for (let i = currentRow; i <= targetRows; i++) {
        const row = ws.getRow(i);
        for (let j = 1; j <= 9; j++) {
          row.getCell(j).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
      }

      // 5. FOOTER (JUMLAH TAN)
      const footerRow = targetRows + 1;
      ws.mergeCells(`A${footerRow}:F${footerRow}`);
      const jumlahLabel = ws.getCell(`A${footerRow}`);
      jumlahLabel.value = 'JUMLAH TAN';
      jumlahLabel.font = { bold: true };
      jumlahLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500
      jumlahLabel.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      jumlahLabel.alignment = { horizontal: 'right' };

      const totalTan = data.reduce((sum, item) => sum + (item.tan || 0), 0);
      ws.getCell(`G${footerRow}`).value = totalTan;
      ws.getCell(`G${footerRow}`).font = { bold: true };
      ws.getCell(`G${footerRow}`).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      ws.getCell(`G${footerRow}`).alignment = { horizontal: 'center' };

      // Column Widths
      ws.getColumn('A').width = 12;
      ws.getColumn('B').width = 15;
      ws.getColumn('C').width = 8;
      ws.getColumn('D').width = 18;
      ws.getColumn('E').width = 15;
      ws.getColumn('F').width = 10;
      ws.getColumn('G').width = 10;
      ws.getColumn('H').width = 10;
      ws.getColumn('I').width = 10;
    };

    if (reportType === 'efc_format') {
      // 1. Master Data Sheet
      const masterSheet = workbook.addWorksheet('Master Data');
      createEfcSheet(masterSheet, filteredData);

      // 2. Individual Block Sheets
      const uniqueBlocks = Array.from(new Set(filteredData.map(d => d.blok))).sort((a, b) => {
        const strA = String(a);
        const strB = String(b);
        const numA = parseInt(strA);
        const numB = parseInt(strB);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return strA.localeCompare(strB);
      });

      uniqueBlocks.forEach(blok => {
        const blokData = filteredData.filter(d => d.blok === blok);
        if (blokData.length > 0) {
          const blokSheet = workbook.addWorksheet(`Blok ${blok}`);
          createEfcSheet(blokSheet, blokData);
        }
      });
    } else if (reportType === 'kpa_kpg') {
      const worksheet = workbook.addWorksheet('Rekod Hantaran');
      // --- SPECIAL KPG=KPA REPORT FORMAT ---
      const monthNames = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
      const currentMonth = exportFilter === 'month' ? monthNames[parseInt(exportMonth.split('-')[1]) - 1] : monthNames[new Date().getMonth()];
      const currentYear = exportFilter === 'month' ? exportMonth.split('-')[0] : new Date().getFullYear();

      // Filter data for KPG >= 21
      const kpgData = filteredData.filter(item => parseFloat(item.kpg || '0') >= 21);
      
      // Split into Standard and Felda
      const standardData = kpgData.filter(item => {
        const pkt = MASTER_DATA[item.blok]?.pkt || '001';
        return pkt !== '003';
      });
      const feldaData = kpgData.filter(item => {
        const pkt = MASTER_DATA[item.blok]?.pkt || '001';
        return pkt === '003';
      });

      const renderKpgTable = (data: Transaction[], title: string, startRow: number) => {
        if (!data || !Array.isArray(data)) return startRow;
        // Title
        worksheet.mergeCells(`A${startRow}:L${startRow}`);
        const t1 = worksheet.getCell(`A${startRow}`);
        t1.value = 'KPA = KPG';
        t1.font = { bold: true, size: 12 };
        t1.alignment = { horizontal: 'center' };

        worksheet.mergeCells(`A${startRow + 1}:L${startRow + 1}`);
        const t2 = worksheet.getCell(`A${startRow + 1}`);
        t2.value = `${title} ${currentMonth} ${currentYear}`;
        t2.font = { bold: true, size: 12 };
        t2.alignment = { horizontal: 'center' };

        // Headers
        const headerRowIndex = startRow + 3;
        const headers = ['Bil', 'Tarikh', 'Blok', 'No. Akaun Terima', 'Nota Hantaran', 'Berat Bersih (Tan)', 'Harga/tan', 'Hasil (RM)', 'Tandan Muda', 'Reject', 'Sample', 'KPG'];
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.values = headers;
        headerRow.height = 30;
        
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500
          cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Data
        let currentRow = headerRowIndex + 1;
        data.forEach((item, idx) => {
          const row = worksheet.getRow(currentRow);
          row.values = [
            idx + 1,
            item.tarikh.split('-').reverse().join('.'),
            item.blok,
            item.no_akaun_terima || '-',
            item.no_resit,
            item.tan,
            item.rm_mt || 0,
            item.hasil_rm || (item.tan * (item.rm_mt || 0)),
            item.muda,
            item.reject || 0,
            item.sample || 0,
            item.kpg || '-'
          ];
          row.eachCell((cell) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.font = { size: 9 };
          });
          row.getCell(6).numFmt = '#,##0.00';
          row.getCell(7).numFmt = '#,##0.00';
          row.getCell(8).numFmt = '#,##0.00';
          currentRow++;
        });

        // Totals
        const totalRow = worksheet.getRow(currentRow);
        const totalTan = data.reduce((sum, item) => sum + item.tan, 0);
        const totalHasil = data.reduce((sum, item) => sum + (item.hasil_rm || (item.tan * (item.rm_mt || 0))), 0);
        const totalMuda = data.reduce((sum, item) => sum + item.muda, 0);
        const totalReject = data.reduce((sum, item) => sum + (item.reject || 0), 0);
        const avgRmMt = data.length > 0 ? data.reduce((sum, item) => sum + (item.rm_mt || 0), 0) / data.length : 0;
        const avgKpg = data.length > 0 ? data.reduce((sum, item) => sum + parseFloat(item.kpg || '0'), 0) / data.length : 0;

        totalRow.getCell(1).value = 'JUMLAH';
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        totalRow.getCell(6).value = totalTan;
        totalRow.getCell(7).value = avgRmMt;
        totalRow.getCell(8).value = totalHasil;
        totalRow.getCell(9).value = totalMuda;
        totalRow.getCell(10).value = totalReject;
        totalRow.getCell(12).value = avgKpg;

        totalRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // Amber 200 (Consistent with other reports)
          cell.font = { bold: true, size: 10, color: { argb: 'FF064E3B' } }; // Emerald 900 text
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        totalRow.getCell(6).numFmt = '#,##0.00';
        totalRow.getCell(7).numFmt = '#,##0.00';
        totalRow.getCell(8).numFmt = '#,##0.00';
        totalRow.getCell(12).numFmt = '#,##0.00';

        return currentRow + 3; // Return next start row
      };

      let nextRow = 1;
      nextRow = renderKpgTable(standardData, 'FPMSB TUNGGAL BULAN', nextRow);
      renderKpgTable(feldaData, 'KPA-KPG LOT FELDA', nextRow);

      // --- ADD SUMMARY SHEET BY BLOK ---
      const summarySheet = workbook.addWorksheet('Ringkasan KPG=KPA', { views: [{ state: 'frozen', ySplit: 3 }] });
      
      // Title
      summarySheet.mergeCells('A1:F1');
      const t1 = summarySheet.getCell('A1');
      t1.value = 'RINGKASAN KPG=KPA MENGIKUT BLOK';
      t1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; // Emerald 900
      t1.alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.getRow(1).height = 40;

      // Headers
      const headerRow = summarySheet.getRow(3);
      headerRow.values = ['BIL', 'BLOK', 'PERINGKAT', 'JUMLAH RESIT', 'KPG MATCH (>=21)', 'PERATUS (%)'];
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      headerRow.height = 25;

      // Calculate data
      const blockSummary: { blok: string, pkt: string, totalResit: number, kpgMatch: number }[] = [];
      const uniqueBlocks = (Array.from(new Set(filteredData.map(d => d.blok))) as string[]).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });
      
      uniqueBlocks.forEach((blok: string) => {
        const blokData = filteredData.filter(d => d.blok === blok);
        const kpgMatch = blokData.filter(item => parseFloat(item.kpg || '0') >= 21).length;
        const pkt = (MASTER_DATA as any)[blok]?.pkt || '-';
        blockSummary.push({ blok, pkt, totalResit: blokData.length, kpgMatch });
      });

      // Add rows
      blockSummary.forEach((item, idx) => {
        const percentage = item.totalResit > 0 ? (item.kpgMatch / item.totalResit) * 100 : 0;
        const row = summarySheet.addRow([
          idx + 1, 
          `Blok ${item.blok}`, 
          item.pkt === '001' ? 'PKT 1' : (item.pkt === '002' ? 'PKT 2' : 'FELDA'), 
          item.totalResit,
          item.kpgMatch,
          parseFloat(percentage.toFixed(1))
        ]);
        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
          cell.font = { size: 10 };
        });
        if (idx % 2 !== 0) {
          row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; });
        }
      });

      // Summary row
      const totalRow = summarySheet.addRow([
        '', 
        'JUMLAH KESELURUHAN', 
        '', 
        blockSummary.reduce((sum, item) => sum + item.totalResit, 0),
        blockSummary.reduce((sum, item) => sum + item.kpgMatch, 0),
        ''
      ]);
      const totalResits = blockSummary.reduce((sum, item) => sum + item.totalResit, 0);
      const totalMatches = blockSummary.reduce((sum, item) => sum + item.kpgMatch, 0);
      totalRow.getCell(6).value = totalResits > 0 ? parseFloat(((totalMatches / totalResits) * 100).toFixed(1)) : 0;

      summarySheet.mergeCells(`B${totalRow.number}:C${totalRow.number}`);
      totalRow.eachCell((cell) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Emerald 100
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'medium', color: { argb: 'FF064E3B' } }, left: { style: 'thin', color: { argb: 'FF064E3B' } }, bottom: { style: 'medium', color: { argb: 'FF064E3B' } }, right: { style: 'thin', color: { argb: 'FF064E3B' } } };
      });
      totalRow.height = 30;

      summarySheet.getColumn(1).width = 8;
      summarySheet.getColumn(2).width = 15;
      summarySheet.getColumn(3).width = 20;
      summarySheet.getColumn(4).width = 15;
      summarySheet.getColumn(5).width = 20;
      summarySheet.getColumn(6).width = 15;

      // Set column widths for main sheet
      worksheet.getColumn(1).width = 5;
      worksheet.getColumn(2).width = 12;
      worksheet.getColumn(3).width = 8;
      worksheet.getColumn(4).width = 15;
      worksheet.getColumn(5).width = 15;
      worksheet.getColumn(6).width = 15;
      worksheet.getColumn(7).width = 12;
      worksheet.getColumn(8).width = 15;
      worksheet.getColumn(9).width = 12;
      worksheet.getColumn(10).width = 10;
      worksheet.getColumn(11).width = 10;
      worksheet.getColumn(12).width = 8;

    } else if (reportType === 'efb') {
      const worksheet = workbook.addWorksheet('Rekod EFB');
      const efbData = filteredData.filter(item => item.peringkat === 'EFB');
      createStandardSheet(worksheet, efbData, 'LAPORAN PENGHANTARAN EFB (TANDAN KOSONG)');
    } else {
      // Standard report sheets
      const worksheet = workbook.addWorksheet('Rekod Hantaran');
      createStandardSheet(worksheet, filteredData, `LAPORAN ANALITIK: ${reportType.toUpperCase()}`, true);

      // If it's 'hasil', also create individual block sheets
      if (reportType === 'hasil') {
        const uniqueBlocks = Array.from(new Set(filteredData.map(d => d.blok))).sort((a, b) => {
          const numA = parseInt(String(a));
          const numB = parseInt(String(b));
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return String(a).localeCompare(String(b));
        });

        uniqueBlocks.forEach(blok => {
          const blokData = filteredData.filter(d => d.blok === blok);
          if (blokData.length > 0) {
            const blokSheet = workbook.addWorksheet(`Blok ${blok}`);
            createStandardSheet(blokSheet, blokData, `REKOD HANTARAN BLOK ${blok}`);
          }
        });
      }
        // REMOVE OLD DEFINITION BELOW
    }

    if (reportType === 'muda') {
        // Sheet 1: Bts Muda Bulan Ini by Blok by Date
        const currentMonthSheet = workbook.addWorksheet('Bts Muda Bulan Ini', { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] });
        
        // Title
        currentMonthSheet.mergeCells('A1:E1');
        const t1 = currentMonthSheet.getCell('A1');
        t1.value = `BTS MUDA MENGIKUT BLOK & TARIKH (${exportMonth || new Date().toISOString().slice(0, 7)})`;
        t1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500 (App Theme)
        t1.alignment = { horizontal: 'center', vertical: 'middle' };
        currentMonthSheet.getRow(1).height = 35;

        // Get unique dates and blocks for the selected month
        const selectedMonth = exportMonth || new Date().toISOString().slice(0, 7);
        // CRITICAL: Use rawData instead of filteredData to ensure we get ALL records for the month, 
        // even if the user has a specific date filter active in the UI.
        const monthData = rawData.filter(item => {
          if (item.tarikh && item.tarikh.startsWith(selectedMonth)) return true;
          if (item.created_at) {
            const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
            return createdDate.startsWith(selectedMonth);
          }
          return false;
        });
        const uniqueDates = Array.from(new Set(monthData.map(d => d.tarikh))).sort() as string[];
        const uniqueBlocks = Array.from(new Set(monthData.map(d => d.blok))).sort((a, b) => parseInt(a as string) - parseInt(b as string)) as string[];

        // Headers for Sheet 1
        const headerRow1 = currentMonthSheet.getRow(3);
        const headers1 = ['BLOK', ...uniqueDates, 'JUMLAH'];
        headerRow1.values = headers1 as any[];
        headerRow1.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald 600
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Add Data for Sheet 1
        uniqueBlocks.forEach((blok) => {
          const rowValues: (string | number)[] = [blok as string];
          let blockTotal = 0;
          uniqueDates.forEach(date => {
            const val = monthData.filter(d => d.blok === blok && d.tarikh === date).reduce((sum, curr) => sum + (curr.muda || 0), 0);
            rowValues.push(val || 0);
            blockTotal += val;
          });
          rowValues.push(blockTotal);
          const row = currentMonthSheet.addRow(rowValues);
          row.eachCell((cell, colIdx) => {
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
            if (colIdx === headers1.length) cell.font = { bold: true };
          });
        });

        // Add Total Row for Sheet 1
        const totalRow1Values: (string | number)[] = ['JUMLAH'];
        let grandTotal1 = 0;
        uniqueDates.forEach(date => {
          const dayTotal = monthData.filter(d => d.tarikh === date).reduce((sum, curr) => sum + (curr.muda || 0), 0);
          totalRow1Values.push(dayTotal);
          grandTotal1 += dayTotal;
        });
        totalRow1Values.push(grandTotal1);
        const totalRow1 = currentMonthSheet.addRow(totalRow1Values);
        totalRow1.eachCell((cell) => {
          cell.font = { bold: true, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // Amber 200
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        });

        // Sheet 2: Bts Muda Hingga Bulan Ini by Blok by Month
        const ytdSheet = workbook.addWorksheet('Bts Muda YTD', { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] });
        
        // Title
        ytdSheet.mergeCells('A1:E1');
        const t2 = ytdSheet.getCell('A1');
        t2.value = `BTS MUDA MENGIKUT BLOK & BULAN (YTD ${new Date().getFullYear()})`;
        t2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500
        t2.alignment = { horizontal: 'center', vertical: 'middle' };
        ytdSheet.getRow(1).height = 35;

        // Get unique months for the current year
        const currentYear = new Date().getFullYear().toString();
        const yearData = rawData.filter(item => {
          if (item.tarikh && item.tarikh.startsWith(currentYear)) return true;
          if (item.created_at) {
            const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
            return createdDate.startsWith(currentYear);
          }
          return false;
        });
        
        // Helper to get month string from item
        const getMonthStr = (item: Transaction) => {
          if (item.tarikh) return item.tarikh.slice(0, 7);
          if (item.created_at) {
            return new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().slice(0, 7);
          }
          return '';
        };

        const uniqueMonths = Array.from(new Set(yearData.map(d => getMonthStr(d)))).filter(m => (m as string).startsWith(currentYear)).sort() as string[];
        const uniqueBlocksYear = Array.from(new Set(yearData.map(d => d.blok))).sort((a, b) => parseInt(a as string) - parseInt(b as string)) as string[];

        // Headers for Sheet 2
        const headerRow2 = ytdSheet.getRow(3);
        const headers2 = ['BLOK', ...uniqueMonths.map(m => {
          const date = new Date(m + '-01');
          return date.toLocaleString('ms-MY', { month: 'short' }).toUpperCase();
        }), 'JUMLAH'];
        headerRow2.values = headers2 as any[];
        headerRow2.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald 600
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Add Data for Sheet 2
        uniqueBlocksYear.forEach((blok) => {
          const rowValues: (string | number)[] = [blok as string];
          let blockTotal = 0;
          uniqueMonths.forEach(month => {
            const val = yearData.filter(d => d.blok === blok && getMonthStr(d) === month).reduce((sum, curr) => sum + (curr.muda || 0), 0);
            rowValues.push(val || 0);
            blockTotal += val;
          });
          rowValues.push(blockTotal);
          const row = ytdSheet.addRow(rowValues);
          row.eachCell((cell, colIdx) => {
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
            if (colIdx === headers2.length) cell.font = { bold: true };
          });
        });

        // Add Total Row for Sheet 2
        const totalRow2Values: (string | number)[] = ['JUMLAH'];
        let grandTotal2 = 0;
        uniqueMonths.forEach(month => {
          const monthTotal = yearData.filter(d => getMonthStr(d) === month).reduce((sum, curr) => sum + (curr.muda || 0), 0);
          totalRow2Values.push(monthTotal);
          grandTotal2 += monthTotal;
        });
        totalRow2Values.push(grandTotal2);
        const totalRow2 = ytdSheet.addRow(totalRow2Values);
        totalRow2.eachCell((cell) => {
          cell.font = { bold: true, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE68A' } }; // Amber 200
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        });

        // Auto-width columns for both sheets
        [currentMonthSheet, ytdSheet].forEach(s => {
          s.columns.forEach(column => {
            column.width = 12;
          });
          s.getColumn(1).width = 12;
        });
      }

    // --- ADD CHARTS SHEET ---
    if (reportType !== 'efc_format') {
      const chartSheet = workbook.addWorksheet('Visual Analitik');
      
      // Title
      chartSheet.mergeCells('A1:L1');
      const tCell = chartSheet.getCell('A1');
      tCell.value = 'LAPORAN VISUAL & ANALITIK GRAFIK';
      tCell.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
      tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; // Emerald 900
      tCell.alignment = { horizontal: 'center', vertical: 'middle' };
      chartSheet.getRow(1).height = 50;

      let currentImageRow = 3;

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const addChartToSheet = async (ref: React.RefObject<HTMLDivElement>, title: string) => {
        if (!ref.current) {
          console.warn(`Ref for ${title} is null`);
          return;
        }
        
        const dashboardContainer = document.getElementById('dashboard-tab-container');
        const containerWasHidden = dashboardContainer && dashboardContainer.classList.contains('hidden');
        
        // Temporarily ensure the chart and its container are visible for capture
        const originalStyle = ref.current.style.display;
        const isHidden = ref.current.offsetParent === null || containerWasHidden;
        
        if (containerWasHidden && dashboardContainer) {
          dashboardContainer.classList.remove('hidden');
          dashboardContainer.style.position = 'absolute';
          dashboardContainer.style.left = '-9999px';
          dashboardContainer.style.top = '-9999px';
          dashboardContainer.style.display = 'block';
        }

        if (isHidden) {
          ref.current.style.display = 'block';
          // Wait for the chart to re-render/resize in its new visible state
          await wait(1000);
        }

        try {
          const canvas = await html2canvas(ref.current, {
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            windowWidth: ref.current.scrollWidth + 100,
            windowHeight: ref.current.scrollHeight + 100
          });
          
          if (containerWasHidden && dashboardContainer) {
            dashboardContainer.classList.add('hidden');
            dashboardContainer.style.position = '';
            dashboardContainer.style.left = '';
            dashboardContainer.style.top = '';
            dashboardContainer.style.display = '';
          }

          if (isHidden) {
            ref.current.style.display = originalStyle;
          }
          
          const base64Image = canvas.toDataURL('image/png');
          const imageId = workbook.addImage({
            base64: base64Image,
            extension: 'png',
          });

          // Add Title for the chart
          chartSheet.mergeCells(`A${currentImageRow}:L${currentImageRow}`);
          const titleCell = chartSheet.getCell(`A${currentImageRow}`);
          titleCell.value = `> ${title}`;
          titleCell.font = { bold: true, size: 12, color: { argb: 'FF10B981' } };
          titleCell.alignment = { horizontal: 'left' };
          chartSheet.getRow(currentImageRow).height = 25;
          
          // Add the image (tl is 0-indexed)
          chartSheet.addImage(imageId, {
            tl: { col: 0, row: currentImageRow },
            ext: { width: 900, height: 450 }
          });
          
          currentImageRow += 25; // Move down for next chart
        } catch (err) {
          console.error(`Error adding ${title} to excel:`, err);
        }
      };

      if (monthlyTrendRef.current) {
        await addChartToSheet(monthlyTrendRef, `TREND BULANAN (${reportType.toUpperCase()})`);
      }
      
      if (thekChartRef.current) {
        await addChartToSheet(thekChartRef, `PRESTASI ANALITIK - THEK (${chartPeriod.toUpperCase()})`);
      }
    }

    // Finalize and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    let fileName = `FPMSB_TUNGGAL_Rekod_Hantaran_${new Date().toISOString().split('T')[0]}.xlsx`;
    if (reportType === 'kpa_kpg') {
      fileName = `FPMSB_TUNGGAL_KPG_KPA_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (reportType === 'efc_format') {
      fileName = `FPMSB_TUNGGAL_EFC_Format_${new Date().toISOString().split('T')[0]}.xlsx`;
    }
    if (exportFilter === 'date') fileName = fileName.replace('.xlsx', `_${exportDate}.xlsx`);
    if (exportFilter === 'month') fileName = fileName.replace('.xlsx', `_${exportMonth}.xlsx`);

    saveAs(blob, fileName);
    showToast('success', 'Fail Excel cantik berjaya dimuat turun.');
    setShowExportModal(false);
    } catch (error) {
      console.error('Excel Export Error:', error);
      showToast('error', 'Gagal memuat turun Excel. Sila cuba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveAnnual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const sanitizedForm = {
        year: parseInt(annualForm.year.toString()) || new Date().getFullYear(),
        yield: parseFloat(annualForm.yield.toString()) || 0
      };
      const res = await fetch('/api/annual-yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedForm)
      });
      if (res.ok) {
        showToast('success', 'Data tahunan berjaya disimpan.');
        setShowAnnualModal(false);
        fetchAnnualData();
      } else {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOcrScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast('success', 'Menganalisis resit dengan Gemini AI...');

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'undefined') {
        throw new Error('API Key Gemini tidak dijumpai. Sila masukkan GEMINI_API_KEY di tetapan Vercel dan redeploy.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type || 'image/jpeg',
              },
            },
            {
              text: `Anda adalah pakar OCR khusus untuk resit FGV Trading Sdn. Bhd dan resit EFB (Tandan Kosong). Ekstrak data dengan ketepatan 100% mengikut peraturan berikut:

LOGIK EKSTRAKSI (RESIT FGV):
- tarikh: Cari label "Tarikh Urusniaga". Gunakan format YYYY-MM-DD.
- masa_masuk: Cari baris "Gross". Ambil waktu (HH:MM:SS) yang berada di bawah kolum "Masa".
- no_resit: Ambil nilai di sebelah "No. Akuan Terima" (cth: A00008947). Nilai ini juga digunakan sebagai No. Akaun Terima.
- no_lori: Ambil nilai di sebelah "No. Lori" (cth: CCR1449).
- no_nota_hantaran: Ambil nilai 10-digit di sebelah "Nota Hantaran" (cth: 1552600137).
- kpg: Cari baris yang sama dengan "Nota Hantaran". Ambil digit dengan 2 titik perpuluhan yang berada selepas corak "21.00/" (cth: jika "21.00/19.50", ambil "19.50").
- blok: Cari baris "Penjual". Ambil 2 digit nombor yang berada tepat sebelum perkataan "SKB" (cth: jika "12 SKB", ambil "12").
- tan: Cari label "Nett.". Ambil nilai nombor (tan) di sebelahnya (cth: 3.24). 
- rm_mt: Cari label "Harga/Tan" (biasanya di bawah nilai Kpg/Kpa). Ambil nilai nombor di sebelahnya (cth: 1020.23).
- muda: pada baris >25 0, Muda, ambil number selepas 'muda :' biasanya 1 atau 2 digit (tandan).
- reject: Cari label "Reject". Ambil nilai nombor di sebelahnya.
- sample: Cari label "Sampel". Ambil nilai nombor 1, 2 atau 3 di sebelahnya.
- no_seal: Cari tulisan tangan 6-digit nombor yang terletak di bawah "M-Manual" di bahagian bawah kanan resit.
- is_efb: false

LOGIK EKSTRAKSI (RESIT EFB):
- tarikh: Cari label "Tarikh Urusniaga". Gunakan format YYYY-MM-DD.
- no_lori: Cari label "No. Lori".
- tan: Cari label "Nett". Ambil nilai nombor di sebelahnya (cth: 5.20).
- blok: Cari label "No. MPOB". Blok adalah 1 atau 2 digit nombor (biasanya tulisan tangan) yang berada tepat di bawah label "No. MPOB".
- no_resit: Cari sebarang nombor siri atau "No. Resit" di bahagian atas. Jika tiada, gunakan "EFB-" diikuti No. Lori dan Tarikh tanpa sengkang.
- is_efb: true (WAJIB true jika resit bertajuk "TANDAN KOSONG" atau "EFB")

PERATURAN TEKNIKAL:
1. Output WAJIB dalam format JSON sahaja.
2. Nilai "tan", "kpg", dan "muda" mestilah jenis 'number'.
3. Jika tulisan kabur, bandingkan Nett = Gross - Tare. Gunakan hasil matematik tersebut.
4. Tentukan is_efb berdasarkan kandungan resit.`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tarikh: { type: Type.STRING, description: "Tarikh Urusniaga (YYYY-MM-DD)" },
              masa_masuk: { type: Type.STRING, description: "Masa Masuk (HH:MM:SS)" },
              no_resit: { type: Type.STRING, description: "Nombor Resit / Akuan Terima" },
              no_lori: { type: Type.STRING, description: "Nombor Lori" },
              no_nota_hantaran: { type: Type.STRING, description: "Nombor Nota Hantaran (10 digit)" },
              kpg: { type: Type.NUMBER, description: "Nilai KPG (2 titik perpuluhan selepas 21.00/)" },
              blok: { type: Type.STRING, description: "Nombor blok (2 digit sebelum SKB)" },
              tan: { type: Type.NUMBER, description: "Berat bersih (Nett) dalam Tan" },
              rm_mt: { type: Type.NUMBER, description: "Harga per Tan (Harga/Tan)" },
              muda: { type: Type.NUMBER, description: "Bilangan tandan muda" },
              reject: { type: Type.NUMBER, description: "Berat reject" },
              sample: { type: Type.NUMBER, description: "Bilangan sampel (1, 2, atau 3)" },
              no_seal: { type: Type.STRING, description: "Nombor seal (6 digit tulisan tangan di bawah M-Manual)" },
              is_efb: { type: Type.BOOLEAN, description: "Adakah ini resit EFB?" },
              confidence: { type: Type.NUMBER, description: "Tahap keyakinan 0-100" }
            },
            required: ["tarikh", "no_resit", "no_lori", "tan", "confidence"]
          }
        }
      });

      const rawText = response.text || "{}";
      const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanText);
      console.log("GEMINI OCR RESULT:", result);

      if (result.no_resit || result.no_lori || result.tan) {
        setFormData(prev => ({
          ...prev,
          no_resit: result.no_resit || prev.no_resit,
          no_akaun_terima: result.no_resit || prev.no_resit,
          no_lori: result.no_lori || prev.no_lori,
          no_nota_hantaran: result.no_nota_hantaran || prev.no_nota_hantaran,
          no_seal: result.no_seal || prev.no_seal,
          kpg: result.kpg?.toString() || prev.kpg,
          tan: result.tan?.toString() || prev.tan,
          rm_mt: result.rm_mt?.toString() || prev.rm_mt,
          muda: result.muda?.toString() || prev.muda,
          reject: result.reject?.toString() || prev.reject,
          sample: result.sample?.toString() || prev.sample,
          tarikh: result.tarikh || prev.tarikh,
          masa_masuk: result.masa_masuk || prev.masa_masuk,
          is_efb: !!result.is_efb,
          blok: result.is_efb ? '99' : (result.blok || prev.blok)
        }));

        if (result.confidence < 70) {
          showToast('error', `⚠️ Accuracy rendah (${result.confidence}%). Sila semak maklumat.`);
        } else {
          showToast('success', result.is_efb ? `✅ Scan EFB berjaya (${result.confidence}%)` : `✅ Scan berjaya (${result.confidence}%)`);
        }
      } else {
        showToast('error', 'Gagal mengekstrak maklumat. Sila isi secara manual.');
      }

    } catch (err: any) {
      console.error('Gemini OCR Error:', err);
      showToast('error', `Ralat OCR: ${err.message || 'Sila cuba lagi.'}`);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- ANALITIK LOGIK ---
  const analytics = useMemo(() => {
    const todayStr = new Date(new Date().getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const currentMonth = todayStr.slice(0, 7);
    const currentYear = todayStr.slice(0, 4);

    const calculateForPeriod = (data: Transaction[], periodType: 'day' | 'month' | 'year') => {
      if (!data || !Array.isArray(data)) {
        return { 
          pkt1_tan: 0, pkt2_tan: 0, felda_tan: 0, 
          pkt1_muda: 0, pkt2_muda: 0, felda_muda: 0, 
          pkt1_kpg_match: 0, pkt2_kpg_match: 0, felda_kpg_match: 0,
          pkt1_resit: 0, pkt2_resit: 0, felda_resit: 0,
          blokStats: [], rankedBlok: [], totalResit: 0, kpgMatchCount: 0, kpgMatchTan: 0,
          totalTan: 0, totalMuda: 0, totalTargetTan: 0,
          avgPrice: 0, pkt1_avg_price: 0, pkt2_avg_price: 0, felda_avg_price: 0
        };
      }
      let pkt1_tan = 0, pkt2_tan = 0, felda_tan = 0;
      let pkt1_muda = 0, pkt2_muda = 0, felda_muda = 0;
      let pkt1_kpg_match = 0, pkt2_kpg_match = 0, felda_kpg_match = 0;
      let pkt1_resit = 0, pkt2_resit = 0, felda_resit = 0;
      let efb_tan = 0, efb_resit = 0;
      
      let pkt1_total_price = 0, pkt2_total_price = 0, felda_total_price = 0;
      let pkt1_price_count = 0, pkt2_price_count = 0, felda_price_count = 0;
      
      let pkt1_total_price1pct = 0, pkt2_total_price1pct = 0, felda_total_price1pct = 0;
      let pkt1_price1pct_count = 0, pkt2_price1pct_count = 0, felda_price1pct_count = 0;

      // Overall totals for the period (excluding EFB for main yield metrics)
      const ffbData = data.filter(item => item.peringkat !== 'EFB');
      const totalTan = ffbData.reduce((acc, curr) => acc + (curr.tan || 0), 0);
      const totalMuda = ffbData.reduce((acc, curr) => acc + (curr.muda || 0), 0);
      let totalResit = ffbData.length;
      
      let kpgMatchCount = 0;
      let kpgMatchTan = 0;

      const blokStats = Object.keys(MASTER_DATA).map(blok => {
        const baseTarget = MASTER_DATA[blok].target_mt;
        let scaledTarget = baseTarget;
        if (periodType === 'day') scaledTarget = baseTarget / 30;
        else if (periodType === 'year') scaledTarget = baseTarget * 12;

        return {
          blok,
          pkt: MASTER_DATA[blok].pkt,
          luas: MASTER_DATA[blok].luas,
          target_mt: scaledTarget,
          tan: 0,
          efb_tan: 0,
          muda: 0,
          resit_count: 0,
          kpg_match_count: 0,
          yieldHek: 0,
          targetHek: 0,
          progress_pct: 0,
          color: ''
        };
      });

      data.forEach(row => {
        if (row.peringkat === 'EFB') {
          efb_tan += row.tan;
          efb_resit += 1;
          const rowBlok = String(row.blok || '').trim();
          const b = blokStats.find(s => s.blok === rowBlok);
          if (b) {
            b.efb_tan += row.tan;
          }
          return;
        }

        const rowBlok = String(row.blok || '').trim();
        const b = blokStats.find(s => s.blok === rowBlok);
        
        // KPG=KPA Logic: 21.25 starting today (2026-04-13), 21.00 for historical data
        const kpgVal = parseFloat(row.kpg || "0");
        const rowDate = row.tarikh || (row.created_at ? new Date(new Date(row.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0] : '');
        const threshold = (rowDate >= '2026-04-13') ? 21.25 : 21.00;

        if (kpgVal >= threshold) {
          kpgMatchCount += 1;
          kpgMatchTan += row.tan;
        }

        if (b) {
          b.tan += row.tan;
          b.muda += row.muda;
          b.resit_count += 1;

          if (kpgVal >= threshold) {
            b.kpg_match_count += 1;
            if (b.pkt === "001") pkt1_kpg_match += 1;
            else if (b.pkt === "002") pkt2_kpg_match += 1;
            else if (b.pkt === "003") felda_kpg_match += 1;
          }
          
          if (b.pkt === "001") { 
            pkt1_tan += row.tan; pkt1_muda += row.muda; pkt1_resit += 1; 
            if (row.rm_mt) { pkt1_total_price += row.rm_mt; pkt1_price_count += 1; } 
            if (row.rm_mt && kpgVal > 0) { pkt1_total_price1pct += (row.rm_mt / kpgVal); pkt1_price1pct_count += 1; }
          } 
          else if (b.pkt === "002") { 
            pkt2_tan += row.tan; pkt2_muda += row.muda; pkt2_resit += 1; 
            if (row.rm_mt) { pkt2_total_price += row.rm_mt; pkt2_price_count += 1; } 
            if (row.rm_mt && kpgVal > 0) { pkt2_total_price1pct += (row.rm_mt / kpgVal); pkt2_price1pct_count += 1; }
          }
          else if (b.pkt === "003") { 
            felda_tan += row.tan; felda_muda += row.muda; felda_resit += 1; 
            if (row.rm_mt) { felda_total_price += row.rm_mt; felda_price_count += 1; } 
            if (row.rm_mt && kpgVal > 0) { felda_total_price1pct += (row.rm_mt / kpgVal); felda_price1pct_count += 1; }
          }
        } else {
          // Fallback to peringkat field if block not found
          const p = String(row.peringkat || '').toUpperCase();
          if (p.includes('PKT 1') || p.includes('001')) {
            pkt1_tan += row.tan; pkt1_muda += row.muda; pkt1_resit += 1;
            if (row.rm_mt) { pkt1_total_price += row.rm_mt; pkt1_price_count += 1; }
            if (row.rm_mt && kpgVal > 0) { pkt1_total_price1pct += (row.rm_mt / kpgVal); pkt1_price1pct_count += 1; }
            if (kpgVal >= 21) pkt1_kpg_match += 1;
          } else if (p.includes('PKT 2') || p.includes('002')) {
            pkt2_tan += row.tan; pkt2_muda += row.muda; pkt2_resit += 1;
            if (row.rm_mt) { pkt2_total_price += row.rm_mt; pkt2_price_count += 1; }
            if (row.rm_mt && kpgVal > 0) { pkt2_total_price1pct += (row.rm_mt / kpgVal); pkt2_price1pct_count += 1; }
            if (kpgVal >= 21) pkt2_kpg_match += 1;
          } else if (p.includes('PKT 3') || p.includes('003') || p.includes('FELDA')) {
            felda_tan += row.tan; felda_muda += row.muda; felda_resit += 1;
            if (row.rm_mt) { felda_total_price += row.rm_mt; felda_price_count += 1; }
            if (row.rm_mt && kpgVal > 0) { felda_total_price1pct += (row.rm_mt / kpgVal); felda_price1pct_count += 1; }
            if (kpgVal >= 21) felda_kpg_match += 1;
          }
        }
      });

      blokStats.forEach(b => {
        b.yieldHek = b.luas > 0 ? (b.tan / b.luas) : 0;
        
        // Calculate target based on Peringkat and Period
        let annualTargetHek = 0;
        if (b.pkt === "001") annualTargetHek = TARGET_ANNUAL_PKT1;
        else if (b.pkt === "002") annualTargetHek = TARGET_ANNUAL_PKT2;
        else if (b.pkt === "003") annualTargetHek = TARGET_ANNUAL_FELDA;
        
        let periodTargetHek = annualTargetHek;
        if (periodType === 'day') periodTargetHek = annualTargetHek / 365;
        else if (periodType === 'month') periodTargetHek = annualTargetHek / 12;

        b.progress_pct = periodTargetHek > 0 ? (b.yieldHek / periodTargetHek) * 100 : 0;
        b.targetHek = periodTargetHek;
        
        if (b.progress_pct >= 90) b.color = 'text-emerald-500 bg-emerald-50';
        else if (b.progress_pct >= 80) b.color = 'text-amber-500 bg-amber-50';
        else b.color = 'text-rose-500 bg-rose-50';
      });

      const rankedBlok = [...blokStats].sort((a, b) => {
        if (reportType === 'muda') {
          return a.muda - b.muda; // Lower is better
        } else if (reportType === 'kpa_kpg') {
          return b.kpg_match_count - a.kpg_match_count; // Higher is better
        }
        return b.yieldHek - a.yieldHek; // Default: Higher yield is better
      });
      const totalPrice = pkt1_total_price + pkt2_total_price + felda_total_price;
      const priceCount = pkt1_price_count + pkt2_price_count + felda_price_count;
      
      const totalPrice1pct = pkt1_total_price1pct + pkt2_total_price1pct + felda_total_price1pct;
      const price1pctCount = pkt1_price1pct_count + pkt2_price1pct_count + felda_price1pct_count;

      return { 
        pkt1_tan, pkt2_tan, felda_tan, efb_tan,
        pkt1_muda, pkt2_muda, felda_muda, 
        pkt1_kpg_match, pkt2_kpg_match, felda_kpg_match,
        pkt1_resit, pkt2_resit, felda_resit, efb_resit,
        blokStats, rankedBlok, totalResit, kpgMatchCount, kpgMatchTan,
        totalTan, totalMuda, totalTargetTan: blokStats.reduce((acc, b) => acc + (b.luas * b.targetHek), 0),
        avgPrice: priceCount > 0 ? totalPrice / priceCount : 0,
        price1Pct: price1pctCount > 0 ? totalPrice1pct / price1pctCount : 0,
        pkt1_avg_price: pkt1_price_count > 0 ? pkt1_total_price / pkt1_price_count : 0,
        pkt2_avg_price: pkt2_price_count > 0 ? pkt2_total_price / pkt2_price_count : 0,
        felda_avg_price: felda_price_count > 0 ? felda_total_price / felda_price_count : 0
      };
    };

    const isToday = (item: Transaction) => {
      if (item.tarikh === todayStr) return true;
      // Fallback to created_at only for April 2026 onwards
      if (todayStr < '2026-04-01') return false;
      if (!item.created_at) return false;
      const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      return createdDate === todayStr;
    };

    const isThisMonth = (item: Transaction) => {
      if (item.tarikh && item.tarikh.startsWith(currentMonth)) return true;
      // Fallback to created_at only for April 2026 onwards
      if (currentMonth < '2026-04') return false;
      if (!item.created_at) return false;
      const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      return createdDate.startsWith(currentMonth);
    };

    const isThisYear = (item: Transaction) => {
      if (item.tarikh && item.tarikh.startsWith(currentYear)) return true;
      // Fallback to created_at only for 2026 onwards
      if (currentYear < '2026') return false;
      if (!item.created_at) return false;
      const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      return createdDate.startsWith(currentYear);
    };

    const dataToday = (rawData || []).filter(isToday);
    const dataMonth = (rawData || []).filter(isThisMonth);
    const dataYear = (rawData || []).filter(isThisYear);

    // Calculate daily price stats for 'harga' report
    const dailyPriceStats = (rawData || [])
      .reduce((acc: any[], curr) => {
        const date = curr.tarikh;
        if (!date) return acc;
        let existing = acc.find(d => d.date === date);
        
        const kpgVal = parseFloat(curr.kpg || "0");
        const currentPrice1Pct = (curr.rm_mt && kpgVal > 0) ? curr.rm_mt / kpgVal : 0;

        if (!existing) {
          // Pick the first receipt that has either a price or a calculated price1Pct
          acc.push({ 
            date, 
            avgPrice: curr.rm_mt || 0, 
            price1Pct: currentPrice1Pct
          });
        } else {
          // If we already have a record for this date but it's empty (0), 
          // and the current receipt has data, update it.
          // This ensures we "pick 1 resit" that actually has data.
          if (existing.avgPrice === 0 && curr.rm_mt) {
            existing.avgPrice = curr.rm_mt;
          }
          if (existing.price1Pct === 0 && currentPrice1Pct > 0) {
            existing.price1Pct = currentPrice1Pct;
          }
        }
        return acc;
      }, [])
      .sort((a, b) => b.date.localeCompare(a.date));

    // Calculate monthly trend for current year using Resit Date (tarikh)
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1;
      const monthStr = `${currentYear}-${String(monthIndex).padStart(2, '0')}`;
      
      const monthData = (rawData || []).filter(item => {
        // Use resit date (tarikh) primarily
        if (item.tarikh && item.tarikh.startsWith(monthStr)) return true;
        
        // For March (Mac) and earlier, strictly follow tarikh (don't use entry date fallback)
        if (monthStr < '2026-04') return false;
        
        // Fallback to created_at for April 2026 onwards
        if (!item.created_at) return false;
        const createdDate = new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
        return createdDate.startsWith(monthStr);
      });

      let pkt1Tan = 0, pkt2Tan = 0, feldaTan = 0;
      let pkt1Muda = 0, pkt2Muda = 0, feldaMuda = 0;
      let pkt1Kpg = 0, pkt2Kpg = 0, feldaKpg = 0;

      monthData.forEach(item => {
        if (item.peringkat === 'EFB') return; // Exclude EFB from FFB trends
        
        const b = MASTER_DATA[item.blok];
        const kpgVal = parseFloat(item.kpg || '0');
        const rowDate = item.tarikh || (item.created_at ? new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0] : '');
        const threshold = (rowDate >= '2026-04-13') ? 21.25 : 21.00;
        
        if (b) {
          if (b.pkt === '001') {
            pkt1Tan += (item.tan || 0);
            pkt1Muda += (item.muda || 0);
            if (kpgVal >= threshold) pkt1Kpg += 1;
          } else if (b.pkt === '002') {
            pkt2Tan += (item.tan || 0);
            pkt2Muda += (item.muda || 0);
            if (kpgVal >= threshold) pkt2Kpg += 1;
          } else if (b.pkt === '003') {
            feldaTan += (item.tan || 0);
            feldaMuda += (item.muda || 0);
            if (kpgVal >= threshold) feldaKpg += 1;
          }
        } else {
          const p = String(item.peringkat || '').toUpperCase();
          if (p.includes('PKT 1') || p.includes('001')) {
            pkt1Tan += (item.tan || 0);
            pkt1Muda += (item.muda || 0);
            if (kpgVal >= threshold) pkt1Kpg += 1;
          } else if (p.includes('PKT 2') || p.includes('002')) {
            pkt2Tan += (item.tan || 0);
            pkt2Muda += (item.muda || 0);
            if (kpgVal >= threshold) pkt2Kpg += 1;
          } else if (p.includes('PKT 3') || p.includes('003') || p.includes('FELDA')) {
            feldaTan += (item.tan || 0);
            feldaMuda += (item.muda || 0);
            if (kpgVal >= threshold) feldaKpg += 1;
          }
        }
      });

      const pkt1Luas = Object.values(MASTER_DATA).filter(m => m.pkt === '001').reduce((acc, curr) => acc + curr.luas, 0);
      const pkt2Luas = Object.values(MASTER_DATA).filter(m => m.pkt === '002').reduce((acc, curr) => acc + curr.luas, 0);
      const feldaLuas = Object.values(MASTER_DATA).filter(m => m.pkt === '003').reduce((acc, curr) => acc + curr.luas, 0);

      const ffbMonthData = monthData.filter(item => item.peringkat !== 'EFB');
      const totalTan = ffbMonthData.reduce((acc, curr) => acc + (curr.tan || 0), 0);
      const efbTan = monthData.filter(item => item.peringkat === 'EFB').reduce((acc, curr) => acc + (curr.tan || 0), 0);
      const totalMuda = ffbMonthData.reduce((acc, curr) => acc + (curr.muda || 0), 0);
      const totalKpg = ffbMonthData.filter(item => {
        const kpgVal = parseFloat(item.kpg || '0');
        const rowDate = item.tarikh || (item.created_at ? new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0] : '');
        const threshold = (rowDate >= '2026-04-13') ? 21.25 : 21.00;
        return kpgVal >= threshold;
      }).length;
      const totalLuas = Object.values(MASTER_DATA).reduce((acc, curr) => acc + curr.luas, 0);
      const yieldHek = totalLuas > 0 ? totalTan / totalLuas : 0;

      // Block-specific yield for filtering
      const blockYields: Record<string, number> = {};
      Object.keys(MASTER_DATA).forEach(blok => {
        const blokData = monthData.filter(d => d.blok === blok);
        const ffbBlokData = blokData.filter(d => d.peringkat !== 'EFB');
        const blokTan = ffbBlokData.reduce((acc, curr) => acc + (curr.tan || 0), 0);
        const blokLuas = MASTER_DATA[blok].luas;
        blockYields[`yield_${blok}`] = blokLuas > 0 ? parseFloat((blokTan / blokLuas).toFixed(2)) : 0;
        blockYields[`muda_${blok}`] = ffbBlokData.reduce((acc, curr) => acc + (curr.muda || 0), 0);
        blockYields[`efb_${blok}`] = blokData.filter(d => d.peringkat === 'EFB').reduce((acc, curr) => acc + (curr.tan || 0), 0);
        blockYields[`kpg_${blok}`] = ffbBlokData.filter(item => {
          const kpgVal = parseFloat(item.kpg || '0');
          const rowDate = item.tarikh || (item.created_at ? new Date(new Date(item.created_at).getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0] : '');
          const threshold = (rowDate >= '2026-04-13') ? 21.25 : 21.00;
          return kpgVal >= threshold;
        }).length;
      });

      // Price aggregation for monthly trend
      const priceData = monthData.filter(item => item.rm_mt && item.rm_mt > 0);
      const avgPrice = priceData.length > 0 ? priceData.reduce((acc, curr) => acc + curr.rm_mt, 0) / priceData.length : 0;
      
      const price1PctData = monthData.filter(item => item.rm_mt && parseFloat(item.kpg || '0') > 0);
      const avgPrice1Pct = price1PctData.length > 0 
        ? price1PctData.reduce((acc, curr) => acc + (curr.rm_mt / parseFloat(curr.kpg || '0')), 0) / price1PctData.length 
        : 0;

      return {
        month: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'][i],
        yield: parseFloat(yieldHek.toFixed(2)),
        pkt1: pkt1Luas > 0 ? parseFloat((pkt1Tan / pkt1Luas).toFixed(2)) : 0,
        pkt2: pkt2Luas > 0 ? parseFloat((pkt2Tan / pkt2Luas).toFixed(2)) : 0,
        felda: feldaLuas > 0 ? parseFloat((feldaTan / feldaLuas).toFixed(2)) : 0,
        muda: totalMuda,
        pkt1Muda,
        pkt2Muda,
        feldaMuda,
        kpg: totalKpg,
        pkt1Kpg,
        pkt2Kpg,
        feldaKpg,
        tan: parseFloat(totalTan.toFixed(2)),
        efb: parseFloat(efbTan.toFixed(2)),
        avgPrice: parseFloat(avgPrice.toFixed(2)),
        avgPrice1Pct: parseFloat(avgPrice1Pct.toFixed(2)),
        ...blockYields,
        isCurrentMonth: monthIndex === new Date().getMonth() + 1
      };
    });

    // Filter daily price stats for current month for the daily chart
    const dailyPriceTrend = [...dailyPriceStats]
      .filter(d => d.date.startsWith(currentMonth))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      displayDate: todayStr,
      day: calculateForPeriod(dataToday, 'day'),
      month: calculateForPeriod(dataMonth, 'month'),
      year: calculateForPeriod(dataYear, 'year'),
      monthlyTrend,
      dailyPriceStats,
      dailyPriceTrend
    };
  }, [rawData, reportType]);

  // ==========================================
  // VIEW: LOG MASUK (PIN PAD)
  // ==========================================
  if (!authRole) {
    return (
      <div className={`max-w-md mx-auto min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} flex flex-col justify-center items-center p-6 relative overflow-hidden transition-colors duration-500`}>
        <div className={`absolute top-[-10%] left-[-20%] w-96 h-96 ${isDarkMode ? 'bg-emerald-600/10' : 'bg-emerald-600/5'} rounded-full blur-3xl`} />
        
        <div className="relative z-10 w-full max-w-xs flex flex-col items-center">
          <div className="mb-8 relative">
            <div className={`w-20 h-20 ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-500/5 border-emerald-500/20'} rounded-3xl border flex items-center justify-center rotate-12 shadow-lg`}>
              <div className={`w-16 h-16 ${isDarkMode ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-emerald-500/10 border-emerald-500/30'} rounded-2xl border flex items-center justify-center -rotate-12`}>
                <Leaf className="text-emerald-500" size={32} />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          </div>
          <h1 className="text-center uppercase mb-10">
            <span className={`block text-xl font-display font-black ${isDarkMode ? 'text-white' : 'text-slate-800'} tracking-widest mb-2`}>FPMSB TUNGGAL</span>
            <span className="block text-[11px] text-emerald-500 font-sans font-black uppercase tracking-[0.3em] opacity-80 mb-1">Integrated Plantation Data System</span>
            <span className={`block text-[10px] font-sans font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} tracking-[0.2em]`}>Sistem Maklumat Ladang</span>
          </h1>

          <div className="flex gap-4 mb-10 h-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-emerald-400 scale-110 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : (isDarkMode ? 'bg-slate-800' : 'bg-slate-200')}`} />
            ))}
          </div>

          {loginError && <p className="text-rose-500 text-xs font-bold uppercase tracking-widest mb-4 animate-pulse">PIN Tidak Sah</p>}

          <div className="grid grid-cols-3 gap-x-8 gap-y-6 w-full px-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button 
                key={num} 
                onClick={() => handlePinPress(num.toString())} 
                className={`text-2xl font-black p-4 rounded-full transition-all active:scale-90 ${isDarkMode ? 'text-white hover:bg-white/5' : 'text-slate-800 hover:bg-slate-100'}`}
              >
                {num}
              </button>
            ))}
            <div />
            <button 
              onClick={() => handlePinPress('0')} 
              className={`text-2xl font-black p-4 rounded-full transition-all active:scale-90 ${isDarkMode ? 'text-white hover:bg-white/5' : 'text-slate-800 hover:bg-slate-100'}`}
            >
              0
            </button>
            <button 
              onClick={handleDeletePress} 
              className={`flex justify-center items-center p-4 rounded-full transition-all active:scale-90 ${isDarkMode ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              <Delete size={28} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: APLIKASI UTAMA
  // ==========================================
  return (
    <div className="w-full max-w-md landscape:max-w-full md:max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 font-sans relative pb-24 landscape:pb-20 transition-all duration-500 overflow-hidden">
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold text-white animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
          {toast.msg}
        </div>
      )}

      {/* MODAL DATA TAHUNAN */}
      <AnimatePresence>
        {showAnnualModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAnnualModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-display font-black text-slate-800 dark:text-white uppercase tracking-widest">Data Tahunan</h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Rekod Hasil Tahunan (10 Tahun+)</p>
                  </div>
                  <button onClick={() => setShowAnnualModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                  <form onSubmit={handleSaveAnnual} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Tahun</label>
                      <input 
                        type="number" 
                        value={annualForm.year}
                        onChange={e => setAnnualForm({...annualForm, year: parseInt(e.target.value)})}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="2024"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Hasil Purata (T/H)</label>
                      <input 
                        type="number" step="0.01"
                        value={annualForm.yield}
                        onChange={e => setAnnualForm({...annualForm, yield: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isProcessing}
                      className="w-full bg-slate-900 dark:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 mt-4"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <><ShieldCheck size={20}/> Simpan Data</>}
                    </button>
                  </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-slate-800 dark:text-white text-lg flex items-center gap-2">
                <Download size={20} className="text-emerald-500" />
                Muat Turun Excel
              </h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Jenis Laporan</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {( [
                    { id: 'hasil', label: 'Hasil' },
                    { id: 'muda', label: 'Muda' },
                    { id: 'kpa_kpg', label: 'Kpg=Kpa' },
                    { id: 'efb', label: 'EFB' },
                    { id: 'efc_format', label: 'Efc Format' }
                  ] as const).map(r => (
                    <button 
                      key={r.id}
                      onClick={() => setReportType(r.id)}
                      className={`py-2 px-1 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${reportType === r.id ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Pilihan Muat Turun</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setExportFilter('all')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${exportFilter === 'all' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    Semua
                  </button>
                  <button 
                    onClick={() => setExportFilter('month')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${exportFilter === 'month' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    Bulan
                  </button>
                  <button 
                    onClick={() => setExportFilter('date')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${exportFilter === 'date' ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    Tarikh
                  </button>
                </div>
              </div>

              {exportFilter === 'month' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Pilih Bulan</label>
                  <input 
                    type="month" 
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              )}

              {exportFilter === 'date' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Pilih Tarikh</label>
                  <input 
                    type="date" 
                    value={exportDate}
                    onChange={(e) => setExportDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 block ml-1">Pilihan Kolum</label>
                <div className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {[
                    { id: 'tarikh', label: 'Tarikh' },
                    { id: 'no_resit', label: 'Resit' },
                    { id: 'no_lori', label: 'Lori' },
                    { id: 'no_seal', label: 'Seal' },
                    { id: 'no_nota', label: 'Nota' },
                    { id: 'kpg', label: 'KPG' },
                    { id: 'blok', label: 'Blok' },
                    { id: 'peringkat', label: 'Pkt' },
                    { id: 'tan', label: 'Tan' },
                    { id: 'muda', label: 'Muda' },
                    { id: 'thek', label: 'T/H' },
                    { id: 'masa', label: 'Masa' },
                    { id: 'created', label: 'Cipta' }
                  ].map(col => (
                    <button
                      key={col.id}
                      onClick={() => {
                        if (exportColumns.includes(col.id)) {
                          if (exportColumns.length > 1) setExportColumns(exportColumns.filter(c => c !== col.id));
                        } else {
                          setExportColumns([...exportColumns, col.id]);
                        }
                      }}
                      className={`px-2 py-1 text-[8px] font-black rounded-lg border transition-all uppercase tracking-tighter ${exportColumns.includes(col.id) ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 mt-2">
                <button 
                  onClick={exportToExcel}
                  disabled={isExporting}
                  className={`w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isExporting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                  {isExporting ? 'Menjana Fail...' : 'Muat Turun Excel (.xlsx)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {recordToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setRecordToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-white/10 p-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-lg font-display font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2">Padam Rekod?</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">
                  Adakah anda pasti ingin memadam rekod resit <span className="text-rose-500 font-black">{recordToDelete}</span>? Tindakan ini tidak boleh dibatalkan.
                </p>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button 
                    onClick={() => setRecordToDelete(null)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => handleDeleteRecord(recordToDelete)}
                    disabled={isProcessing}
                    className="bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : 'Ya, Padam'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE ALL CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDeleteAllModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteAllModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-white/10 p-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-display font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2 text-rose-600">Padam Semua Data?</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6">
                  Adakah anda pasti ingin memadam <span className="text-rose-500 font-black">SEMUA</span> rekod dalam pangkalan data? Tindakan ini adalah kekal dan tidak boleh dibatalkan.
                </p>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button 
                    onClick={() => setShowDeleteAllModal(false)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleDeleteAllRecords}
                    disabled={isProcessing}
                    className="bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : 'Ya, Padam Semua'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header Korporat */}
      <header className="bg-emerald-900 pt-10 pb-6 px-5 rounded-b-[40px] shadow-lg relative z-40">
        
        <div className="relative z-50 flex justify-between items-center mb-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-11 h-11 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center shadow-inner shrink-0">
              <Leaf className="text-emerald-400" size={22} />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-black text-white tracking-tighter leading-[0.9] uppercase">
                FPMSB TUNGGAL
                <span className="block text-[10px] sm:text-[11px] font-sans font-black text-emerald-300 tracking-[0.2em] mt-2 opacity-90">Integrated Plantation Data System V3.0</span>
                <span className="block text-[9px] sm:text-[10px] font-sans font-medium text-emerald-300/70 tracking-[0.15em] mt-1 normal-case">Sistem Maklumat Ladang</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pr-3 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-all shadow-lg active:scale-[0.97] z-50 group"
                aria-label="User Menu"
              >
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-inner ring-2 ring-white/10 group-hover:ring-emerald-400 transition-all">
                  {authRole === 'fc' ? 'FC' : authRole === 'afc' ? 'AFC' : authRole === 'fs' ? 'FS' : 'O'}
                </div>
                <div className="hidden sm:flex flex-col items-start mr-1">
                  <span className="text-[10px] font-black text-white uppercase leading-none">
                    {authRole === 'fc' ? 'Field Controller (FC)' : 
                     authRole === 'afc' ? 'Asst. Field Controller (AFC)' : 
                     authRole === 'fs' ? 'Field Supervisor (FS)' : 'Operator'}
                  </span>
                  <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">Online</span>
                </div>
                <ChevronDown size={14} className={`text-white/50 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-14 right-0 w-56 bg-slate-900/98 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden"
                  >
                  {/* User Profile Header */}
                  <div className="p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-black shadow-lg ring-2 ring-emerald-500/20">
                        {authRole === 'fc' ? 'FC' : authRole === 'afc' ? 'AFC' : authRole === 'fs' ? 'FS' : 'O'}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-black text-white uppercase truncate">
                          {authRole === 'fc' ? 'Field Controller (FC)' : 
                           authRole === 'afc' ? 'Asst. Field Controller (AFC)' : 
                           authRole === 'fs' ? 'Field Supervisor (FS)' : 'Operator'}
                        </p>
                        <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                          {authRole === 'fc' || authRole === 'afc' ? 'Akses Penuh' : 'Akses Terhad'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <button 
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-white hover:bg-white/10 transition-all group mb-1"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-all">
                          {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-300" />}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-wider">Mod {isDarkMode ? 'Cerah' : 'Gelap'}</span>
                      </div>
                      <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${isDarkMode ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 ${isDarkMode ? 'left-4.5' : 'left-0.5'}`} />
                      </div>
                    </button>

                    <div className="px-2 py-2">
                      <p className="text-[8px] text-white/30 font-black uppercase tracking-[0.2em] mb-2">Status Sistem</p>
                      <div className="flex gap-1.5">
                        {!configStatus ? (
                          <span className="flex items-center gap-1 text-[9px] bg-slate-500/20 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-500/30 font-black uppercase w-full justify-center">
                            <Loader2 className="animate-spin" size={10} /> Checking
                          </span>
                        ) : (
                          <div className="w-full">
                            {configStatus.supabase ? (
                              <span className="flex items-center gap-1 text-[9px] bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/30 font-black uppercase w-full justify-center">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Online
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg border border-rose-500/30 font-black uppercase w-full justify-center">
                                <div className="w-1.5 h-1.5 bg-rose-400 rounded-full" /> Offline
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-white/10 my-1 mx-2" />

                    <button 
                      onClick={() => setShowNewFeatures(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                      <Info size={16} className="text-emerald-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Ciri Baharu</span>
                      <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    </button>

                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                      <Settings size={16} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Tetapan</span>
                    </button>

                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                      <HelpCircle size={16} />
                      <span className="text-[11px] font-bold uppercase tracking-wider">Bantuan</span>
                    </button>

                    <div className="h-px bg-white/10 my-1 mx-2" />

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-xl transition-all active:scale-[0.98]"
                    >
                      <LogOut size={16} />
                      <span className="text-[11px] font-black uppercase tracking-widest">Log Keluar</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

        {/* Toggle Laporan (Hanya di Dashboard) */}
        {(authRole === 'fc' || authRole === 'afc' || authRole === 'fs') && activeTab === 'dashboard' && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Level 1: Jenis Laporan (Pill Style) - Scrollable */}
            <div className="flex overflow-x-auto scrollbar-hide bg-black/30 p-1.5 rounded-full border border-white/10 backdrop-blur-md shadow-inner gap-1">
              {([
                { id: 'hasil', label: 'Hasil' },
                { id: 'muda', label: 'Bts Muda' },
                { id: 'kpa_kpg', label: 'Kpg=Kpa' },
                { id: 'efb', label: 'EFB' },
                { id: 'harga', label: 'Harga Bts' }
              ] as const).map(r => (
                <button 
                  key={r.id} 
                  data-report-id={r.id}
                  onClick={(e) => {
                    setReportType(r.id);
                    // Sync chart metric
                    if (r.id === 'hasil') setChartMetric('yield');
                    else if (r.id === 'muda') setChartMetric('muda');
                    else if (r.id === 'kpa_kpg') setChartMetric('kpg');
                    else if (r.id === 'efb') setChartMetric('yield');
                    else if (r.id === 'harga') setChartMetric('yield'); // Default to yield for charts if on harga
                    
                    // Center the clicked button
                    (e.currentTarget as HTMLElement).scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'center'
                    });
                  }} 
                  className={`whitespace-nowrap px-6 text-[12px] font-black py-2.5 rounded-full transition-all duration-300 uppercase tracking-widest flex-shrink-0 ${reportType === r.id ? 'bg-white text-emerald-900 shadow-[0_4px_12px_rgba(255,255,255,0.3)] scale-[1.02]' : 'text-emerald-100/60 hover:text-white hover:bg-white/5'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* MODAL CIRI BAHARU */}
      <AnimatePresence>
        {showNewFeatures && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewFeatures(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Ciri Baharu</h3>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Kemas Kini April 2026</p>
                  </div>
                  <button 
                    onClick={() => setShowNewFeatures(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex gap-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                    <div className="w-10 h-10 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <Cpu size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Sistem V3.0 Pro</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Peningkatan menyeluruh pada enjin data untuk kelajuan dan ketepatan yang lebih tinggi.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <ScanLine size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">OCR Pintar V3</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Ekstraksi automatik untuk Harga/tan, Reject, dan Sample. No. Resit & Akaun Terima kini disatukan secara pintar.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <LayoutDashboard size={20} className="text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Antaramuka Harga/tan</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Label RM/MT telah dikemaskini kepada Harga/tan untuk keselarasan dengan format resit terkini.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-amber-500/10 rounded-xl flex items-center justify-center">
                      <FileSpreadsheet size={20} className="text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Eksport Excel V3</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Laporan Excel kini menyokong kolum Harga/tan yang baru untuk analisis kewangan yang lebih tepat.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-blue-500/10 rounded-xl flex items-center justify-center">
                      <Trophy size={20} className="text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Ranking Dinamik</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Sistem ranking blok yang lebih responsif berdasarkan prestasi bulanan dan tahunan.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <Upload size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Muat Naik Resit (OCR)</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Kini anda boleh memuat naik gambar resit dari galeri. Sistem akan mengekstrak data secara automatik menggunakan teknologi OCR.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-rose-500/10 rounded-xl flex items-center justify-center">
                      <Zap size={20} className="text-rose-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Optimasi Data Harian</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Paparan bilangan resit (R) kini difokuskan pada data Hari Ini untuk mengurangkan kekaburan maklumat.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <div className="w-10 h-10 shrink-0 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                      <History size={20} className="text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Sejarah Transaksi Pro</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Antaramuka sejarah yang lebih bersih dengan sistem penapisan jenis laporan yang lebih pantas.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                    <div className="w-10 h-10 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <Download size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Eksport Pintar (Custom)</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Pilih kolum spesifik untuk Excel. Laporan kini lebih kemas dan hanya mengandungi data yang anda perlukan.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                    <div className="w-10 h-10 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <FileSpreadsheet size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Ringkasan Satu Muka</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Laporan Bts Muda & KPG=KPA kini mempunyai helaian ringkasan mengikut blok dalam satu muka surat untuk audit pantas.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                    <div className="w-10 h-10 shrink-0 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <FileSpreadsheet size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Format EFC Berasaskan Blok</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Anda kini boleh memuat turun format EFC mengikut blok secara automatik pada pilihan laporan bulanan.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50">
                    <div className="w-10 h-10 shrink-0 bg-amber-500/10 rounded-xl flex items-center justify-center">
                      <CircleDollarSign size={20} className="text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Tab Harga BTS Harian</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Harga BTS 1% dan Harga/Tan kini boleh diakses melalui tab baharu. Maklumat ini akan dikemaskini secara harian untuk rujukan pantas.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
                    <div className="w-10 h-10 shrink-0 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                      <MoveHorizontal size={20} className="text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase">Navigasi "Swipe" Pintar</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">Tukar halaman laporan dengan hanya leret (swipe) ke kiri atau kanan. Navigasi satu tangan yang lebih mudah dan pantas.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowNewFeatures(false)}
                  className="w-full mt-8 py-4 bg-slate-900 dark:bg-emerald-600 text-white text-[12px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg active:scale-[0.98] transition-all"
                >
                  Faham & Teruskan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="p-5 overflow-hidden">
        {/* CONFIG WARNING BANNER */}
        {configStatus && !configStatus.supabase && (
          <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top duration-500 shadow-sm">
            <AlertTriangle className="text-rose-500 shrink-0" size={20} />
            <div>
              <p className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-tight">Pangkalan Data Tidak Bersambung</p>
              <p className="text-[10px] text-rose-600 dark:text-rose-500 font-medium leading-tight mt-1">
                Sila tetapkan <code className="bg-rose-100 dark:bg-rose-900/50 px-1 rounded font-mono">NEXT_PUBLIC_SUPABASE_URL</code> & <code className="bg-rose-100 dark:bg-rose-900/50 px-1 rounded font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di Vercel/AI Studio.
              </p>
            </div>
          </div>
        )}
        
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            {/* TAB 1: KEMASUKAN DATA */}
            {activeTab === 'scan' && (
              <div className="w-full">
                {(() => {
                  const isBlokValid = formData.blok === '' || (parseInt(formData.blok) >= 1 && parseInt(formData.blok) <= 99);
                  return (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex flex-col items-center justify-center mb-3">
                        <h2 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Rekod Hantaran</h2>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleOcrScan} 
                          accept="image/*" 
                          className="hidden" 
                          capture="environment"
                        />
                        <input 
                          type="file" 
                          ref={uploadInputRef} 
                          onChange={handleOcrScan} 
                          accept="image/*" 
                          className="hidden" 
                        />
                      </div>
                      
                      <form onSubmit={submitTransaction} className="space-y-4 mt-2">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${formData.is_efb ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                              <Factory size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">Resit EFB</p>
                              <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tandan Kosong</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newIsEfb = !formData.is_efb;
                              setFormData({
                                ...formData, 
                                is_efb: newIsEfb,
                                kpg: newIsEfb ? '' : formData.kpg,
                                muda: newIsEfb ? '0' : formData.muda,
                                reject: newIsEfb ? '0.00' : formData.reject,
                                sample: newIsEfb ? '0' : formData.sample,
                                no_seal: newIsEfb ? '' : formData.no_seal,
                                rm_mt: newIsEfb ? '' : formData.rm_mt
                              });
                            }}
                            className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.is_efb ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.is_efb ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>

                        {formData.is_efb ? (
                          <>
                            <div className="grid grid-cols-1 gap-4">
                              <FloatingInput label="No. Resit" value={formData.no_resit} onChange={v => setFormData({...formData, no_resit: v, no_akaun_terima: v})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput label="No. Lori" value={formData.no_lori} onChange={v => setFormData({...formData, no_lori: v})} />
                              <FloatingInput label="No. Nota Hantaran" value={formData.no_nota_hantaran} onChange={v => setFormData({...formData, no_nota_hantaran: v})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput 
                                label="No. Blok" 
                                type="number" 
                                value={formData.blok} 
                                onChange={v => setFormData({...formData, blok: v})} 
                                className={!isBlokValid ? 'border-red-500' : 'border-slate-200'}
                              />
                              <FloatingInput label="Berat EFB (Tan)" type="number" step="0.01" value={formData.tan} onChange={v => setFormData({...formData, tan: v})} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 gap-4">
                              <FloatingInput label="No. Resit" value={formData.no_resit} onChange={v => setFormData({...formData, no_resit: v, no_akaun_terima: v})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput label="No. Lori" value={formData.no_lori} onChange={v => setFormData({...formData, no_lori: v})} />
                              <FloatingInput label="No. Nota Hantaran" value={formData.no_nota_hantaran} onChange={v => setFormData({...formData, no_nota_hantaran: v})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput label="No. Seal" value={formData.no_seal} onChange={v => setFormData({...formData, no_seal: v})} />
                              <FloatingInput label="Harga/tan" type="number" step="0.01" value={formData.rm_mt} onChange={v => setFormData({...formData, rm_mt: v})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput label="KPG" value={formData.kpg} onChange={v => setFormData({...formData, kpg: v})} />
                              <FloatingInput 
                                label="No. Blok (1-22, 88)" 
                                type="number" 
                                value={formData.blok} 
                                onChange={v => setFormData({...formData, blok: v})} 
                                className={!isBlokValid ? 'border-red-500' : 'border-slate-200'}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput label="Berat (Tan)" type="number" step="0.01" value={formData.tan} onChange={v => setFormData({...formData, tan: v})} />
                              <FloatingInput label="Bts Muda" type="number" value={formData.muda} onChange={v => setFormData({...formData, muda: v})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <FloatingInput label="Reject" type="number" step="0.01" value={formData.reject} onChange={v => setFormData({...formData, reject: v})} />
                              <FloatingInput label="Sample" type="number" value={formData.sample} onChange={v => setFormData({...formData, sample: v})} />
                            </div>
                          </>
                        )}
                        <p className="text-[12px] text-amber-500 font-bold ml-2">
                          ⚠️ Sila semak data sebelum simpan
                        </p>
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          whileHover={{ scale: 1.01 }}
                          disabled={isProcessing || !isBlokValid || formData.blok === ''} 
                          className={`w-full text-white font-bold py-5 mt-2 rounded-3xl shadow-xl active:scale-95 transition-all flex justify-center gap-2 ${isProcessing || !isBlokValid || formData.blok === '' ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none' : 'bg-slate-900 dark:bg-emerald-600'}`}
                        >
                          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <><ShieldCheck size={20}/> Simpan Rekod</>}
                        </motion.button>
                      </form>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: ANALITIK (Field Controller Sahaja) */}
            {activeTab === 'dashboard' && (authRole === 'fc' || authRole === 'afc' || authRole === 'fs') && (
              <div id="dashboard-tab-container" className="w-full">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div 
                    key={reportType}
                    initial={{ x: swipeDirection === 'left' ? 30 : -30, opacity: 0, scale: 0.98 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    exit={{ x: swipeDirection === 'left' ? -30 : 30, opacity: 0, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    onPanEnd={(_e, info) => {
                      const threshold = 50;
                      if (info.offset.x < -threshold) handleSwipe('left');
                      else if (info.offset.x > threshold) handleSwipe('right');
                    }}
                    className="space-y-2 touch-pan-y"
                  >
                    <div className="flex flex-col items-center justify-center px-1 mb-4">
                      <h2 className="text-xs font-display font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <LayoutDashboard size={14}/> 
                        Dashboard
                      </h2>
                      <p className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-1">
                        Data Terkini: {analytics.displayDate ? `${analytics.displayDate.split('-')[2]} ${['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'][parseInt(analytics.displayDate.split('-')[1]) - 1]} ${analytics.displayDate.split('-')[0]}` : new Date().toLocaleDateString('ms-MY')}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowAnnualModal(true)}
                          className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Plus size={12} />
                          Data Tahunan
                        </motion.button>
                        <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowExportModal(true)}
                          className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black px-4 py-2 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                          <Download size={12} />
                          Export Excel
                        </motion.button>
                      </div>
                    </div>

                  {/* Ringkasan Utama Berdasarkan Report Type (Semua Tempoh) - Layout Melintang (3 Kolum) */}
                  <div className="grid grid-cols-3 gap-x-2 gap-y-3 mb-4">
                    {/* Row 1: Headers */}
                    <div className="flex items-center gap-1 px-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                      <h3 className="text-[9px] font-display font-black text-slate-500 uppercase tracking-widest">Hari</h3>
                    </div>
                    <div className="flex items-center gap-1 px-0.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="w-1 h-3 bg-slate-400 rounded-full" />
                      <h3 className="text-[9px] font-display font-black text-slate-500 uppercase tracking-widest">Bulan</h3>
                    </div>
                    <div className="flex items-center gap-1 px-0.5 animate-in fade-in slide-in-from-bottom-2 duration-700">
                      <div className="w-1 h-3 bg-slate-900 rounded-full" />
                      <h3 className="text-[9px] font-display font-black text-slate-500 uppercase tracking-widest">Tahun</h3>
                    </div>

                    {/* Row 2: Hero Stats */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <ReportSummarySection type={reportType} data={analytics.day} period="day" isDarkMode={isDarkMode} mode="hero" />
                    </div>
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <ReportSummarySection type={reportType} data={analytics.month} period="month" isDarkMode={isDarkMode} mode="hero" />
                    </div>
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <ReportSummarySection type={reportType} data={analytics.year} period="year" isDarkMode={isDarkMode} mode="hero" />
                    </div>

                    {/* Row 3: Peringkat Breakdown */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <ReportSummarySection type={reportType} data={analytics.day} period="day" isDarkMode={isDarkMode} mode="details" />
                    </div>
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <ReportSummarySection type={reportType} data={analytics.month} period="month" isDarkMode={isDarkMode} mode="details" />
                    </div>
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <ReportSummarySection type={reportType} data={analytics.year} period="year" isDarkMode={isDarkMode} mode="details" />
                    </div>
                  </div>

                  {/* MONTHLY TREND CHART */}
                  {reportType !== 'harga' && (
                    <div ref={monthlyTrendRef} className="bg-white dark:bg-slate-900 rounded-xl p-2 shadow-md border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
                      <div className="flex flex-col items-center justify-center mb-1 relative">
                        <div className="flex items-center justify-center gap-2">
                          <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
                            <BarChart3 size={10} className="text-emerald-500" />
                            Trend Bulanan ({new Date().getFullYear()}) - {reportType === 'hasil' ? 'HASIL' : reportType === 'muda' ? 'BTS MUDA' : reportType === 'efb' ? 'EFB' : 'KPG=KPA'}
                          </h3>
                        </div>
                        <motion.button 
                          whileTap={{ scale: 0.8 }}
                          onClick={() => setShowMonthlyTrendChart(!showMonthlyTrendChart)}
                          className="absolute right-0 top-0 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                        >
                          <motion.div animate={{ rotate: showMonthlyTrendChart ? 180 : 0 }}>
                            <ChevronDown size={10} className="text-slate-400" />
                          </motion.div>
                        </motion.button>
                      </div>

                      <AnimatePresence>
                        {showMonthlyTrendChart && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {/* FILTERS FOR TREND CHART */}
                            <div className="flex gap-1.5 mb-2 mt-1">
                              <div className="flex-1">
                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block ml-1">Peringkat</label>
                                <select 
                                  value={selectedPactFilter}
                                  onChange={(e) => {
                                    setSelectedPactFilter(e.target.value);
                                    setSelectedBlockFilter('all');
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-md px-1.5 py-1 text-[9px] font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                                >
                                  <option value="all">Semua Peringkat</option>
                                  <option value="001">Peringkat 1</option>
                                  <option value="002">Peringkat 2</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5 block ml-1">Blok</label>
                                <select 
                                  value={selectedBlockFilter}
                                  onChange={(e) => setSelectedBlockFilter(e.target.value)}
                                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-md px-1.5 py-1 text-[9px] font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                                >
                                  <option value="all">Semua Blok</option>
                                  {Object.keys(MASTER_DATA)
                                    .filter(b => selectedPactFilter === 'all' || MASTER_DATA[b].pkt === selectedPactFilter)
                                    .map(b => (
                                      <option key={b} value={b}>Blok {b}</option>
                                    ))
                                  }
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {/* Dedicated Filtered Chart */}
                              <div className="bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <div className={`w-1 h-1 rounded-full ${selectedPactFilter === '001' ? 'bg-blue-500' : selectedPactFilter === '002' ? 'bg-amber-500' : 'bg-emerald-500'}`} /> 
                                    {selectedBlockFilter !== 'all' ? `Blok ${selectedBlockFilter}` : selectedPactFilter !== 'all' ? `Peringkat ${selectedPactFilter === '001' ? '1' : '2'}` : 'Purata Keseluruhan'}
                                  </div>
                                  <div className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-100 dark:border-emerald-800">
                                    <p className="text-[6px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                      {reportType === 'hasil' ? 'T/H' : reportType === 'muda' ? 'Bts' : reportType === 'efb' ? 'Tan' : 'Resit'}
                                    </p>
                                  </div>
                                </div>
                                <div className="h-40 w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    {(() => {
                                      const dataKey = reportType === 'hasil' ? 
                                        (selectedBlockFilter !== 'all' ? `yield_${selectedBlockFilter}` : selectedPactFilter === '001' ? 'pkt1' : selectedPactFilter === '002' ? 'pkt2' : 'yield') : 
                                        reportType === 'muda' ? 
                                        (selectedBlockFilter !== 'all' ? `muda_${selectedBlockFilter}` : selectedPactFilter === '001' ? 'pkt1Muda' : selectedPactFilter === '002' ? 'pkt2Muda' : 'muda') : 
                                        reportType === 'efb' ? 'efb' :
                                        (selectedBlockFilter !== 'all' ? `kpg_${selectedBlockFilter}` : selectedPactFilter === '001' ? 'pkt1Kpg' : selectedPactFilter === '002' ? 'pkt2Kpg' : 'kpg');
                                      
                                      const chartData = analytics.monthlyTrend;
                                      const color = selectedPactFilter === '001' ? '#3b82f6' : selectedPactFilter === '002' ? '#f59e0b' : '#10b981';
                                      
                                      return (
                                        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                          <defs>
                                            <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                            </linearGradient>
                                          </defs>
                                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }} />
                                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }} />
                                          <Tooltip 
                                            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                            labelStyle={{ fontWeight: 800, fontSize: '9px', marginBottom: '2px', color: isDarkMode ? '#fff' : '#000' }}
                                            itemStyle={{ fontSize: '9px', fontWeight: 600 }}
                                          />
                                          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
                                          <Bar dataKey={dataKey} barSize={16} radius={[3, 3, 0, 0]} fill={color} fillOpacity={0.3}>
                                            <LabelList dataKey={dataKey} position="top" style={{ fontSize: '7px', fontWeight: '900', fill: isDarkMode ? '#94a3b8' : '#64748b' }} formatter={(v: any) => v > 0 ? (reportType === 'hasil' || reportType === 'efb' ? v.toFixed(1) : v) : ''} />
                                          </Bar>
                                          {reportType === 'hasil' && <ReferenceLine y={2.33} stroke="#f47738" strokeDasharray="4 4" label={{ position: 'right', value: 'Target', fill: '#f47738', fontSize: 7, fontWeight: 900 }} />}
                                        </ComposedChart>
                                      );
                                    })()}
                                  </ResponsiveContainer>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5">
                                {/* 1. Purata Keseluruhan Mini */}
                                <motion.div 
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => { setSelectedPactFilter('all'); setSelectedBlockFilter('all'); }}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${selectedPactFilter === 'all' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'}`}
                                >
                                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <div className="w-1 h-1 bg-emerald-500 rounded-full" /> Keseluruhan
                                  </div>
                                  <div className="h-12 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={analytics.monthlyTrend}>
                                        <Bar dataKey={reportType === 'hasil' ? 'yield' : reportType === 'muda' ? 'muda' : reportType === 'efb' ? 'efb' : 'kpg'} fill="#10b981" radius={[2, 2, 0, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </motion.div>

                                {/* 2. Peringkat 1 Mini */}
                                <motion.div 
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => { setSelectedPactFilter('001'); setSelectedBlockFilter('all'); }}
                                  className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedPactFilter === '001' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'}`}
                                >
                                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full" /> Peringkat 1
                                  </div>
                                  <div className="h-12 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={analytics.monthlyTrend}>
                                        <Bar dataKey={reportType === 'hasil' ? 'pkt1' : reportType === 'muda' ? 'pkt1Muda' : reportType === 'efb' ? 'efb' : 'pkt1Kpg'} fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </motion.div>

                                {/* 3. Peringkat 2 Mini */}
                                <motion.div 
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => { setSelectedPactFilter('002'); setSelectedBlockFilter('all'); }}
                                  className={`p-2 rounded-xl border transition-all cursor-pointer ${selectedPactFilter === '002' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'}`}
                                >
                                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                    <div className="w-1 h-1 bg-amber-500 rounded-full" /> Peringkat 2
                                  </div>
                                  <div className="h-12 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={analytics.monthlyTrend}>
                                        <Bar dataKey={reportType === 'hasil' ? 'pkt2' : reportType === 'muda' ? 'pkt2Muda' : reportType === 'efb' ? 'efb' : 'pkt2Kpg'} fill="#f59e0b" radius={[2, 2, 0, 0]} />
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </motion.div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

            {/* HARGA BTS DAILY REPORT LIST */}
            {reportType === 'harga' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {/* HARGA BTS CHARTS */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col items-center justify-center mb-2 relative">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp size={12} className="text-emerald-500" />
                        Trend Pergerakan Harga
                      </h3>
                    </div>
                    <button 
                      onClick={() => setShowPriceTrendChart(!showPriceTrendChart)}
                      className="absolute right-0 top-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                    >
                      <motion.div animate={{ rotate: showPriceTrendChart ? 180 : 0 }}>
                        <ChevronDown size={12} className="text-slate-400" />
                      </motion.div>
                    </button>
                  </div>

                  <AnimatePresence>
                    {showPriceTrendChart && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 gap-4 mt-2">
                          {/* Daily Price Movement Chart (Monthly View) */}
                          <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp size={12} className="text-emerald-500" />
                                Harian (Bulan Ini)
                              </h3>
                              <div className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                <p className="text-[7px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">RM / TAN</p>
                              </div>
                            </div>
                            <div className="h-40 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.dailyPriceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorPriceDaily" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                                  <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(str) => str.split('-')[2]} 
                                    tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis 
                                    tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                  />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    labelStyle={{ fontWeight: 800, fontSize: '10px', marginBottom: '4px', color: isDarkMode ? '#fff' : '#000' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 600 }}
                                    formatter={(value: any) => [`RM ${parseFloat(value).toFixed(2)}`, 'Harga/Tan']}
                                  />
                                  <Area type="monotone" dataKey="avgPrice" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPriceDaily)" animationDuration={1500} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Monthly Price Trend Chart (Yearly View) */}
                          <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                <BarChart3 size={12} className="text-blue-500" />
                                Bulanan (Tahunan)
                              </h3>
                              <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <p className="text-[7px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">PURATA RM / TAN</p>
                              </div>
                            </div>
                            <div className="h-40 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id="colorPriceMonthly" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                                  <XAxis 
                                    dataKey="month" 
                                    tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis 
                                    tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                  />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    labelStyle={{ fontWeight: 800, fontSize: '10px', marginBottom: '4px', color: isDarkMode ? '#fff' : '#000' }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 600 }}
                                    formatter={(value: any) => [`RM ${parseFloat(value).toFixed(2)}`, 'Purata Harga']}
                                  />
                                  <Area type="monotone" dataKey="avgPrice" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPriceMonthly)" animationDuration={1500} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-md border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                  <div className="flex items-center justify-center gap-2 mb-3 relative z-10">
                    <CircleDollarSign size={14} className="text-emerald-500" />
                    <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Laporan Harga Bts</h3>
                  </div>

                {/* Month Header Above Table Headers */}
                {analytics.dailyPriceStats && analytics.dailyPriceStats.length > 0 && (() => {
                  const firstRow = analytics.dailyPriceStats[0];
                  const [year, month] = firstRow.date.split('-');
                  const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
                  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
                  return (
                    <div className="px-2 py-2 mb-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-center">
                        {monthLabel}
                      </p>
                    </div>
                  );
                })()}

                <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="p-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Tarikh</th>
                        <th className="p-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Harga 1%</th>
                        <th className="p-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Harga/Tan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.dailyPriceStats && analytics.dailyPriceStats.length > 0 ? (
                        analytics.dailyPriceStats.map((row: any, idx: number) => {
                          const currentMonth = row.date.slice(0, 7);
                          const prevMonth = idx > 0 ? analytics.dailyPriceStats[idx - 1].date.slice(0, 7) : null;
                          const showMonthHeader = currentMonth !== prevMonth && idx > 0; // Only show for subsequent months if they exist
                          
                          const monthNames = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
                          const [year, month] = currentMonth.split('-');
                          const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

                          return (
                            <React.Fragment key={idx}>
                              {showMonthHeader && (
                                <tr className="bg-slate-100/50 dark:bg-slate-800/80">
                                  <td colSpan={3} className="p-2 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
                                    {monthLabel}
                                  </td>
                                </tr>
                              )}
                              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-50 dark:border-slate-800/50">
                                  {parseInt(row.date.split('-')[2])}hb
                                </td>
                                <td className="p-2 text-[10px] font-black text-emerald-600 dark:text-emerald-400 text-right border-b border-slate-50 dark:border-slate-800/50">
                                  RM {row.price1Pct.toFixed(2)}
                                </td>
                                <td className="p-2 text-[10px] font-black text-slate-900 dark:text-white text-right border-b border-slate-50 dark:border-slate-800/50">
                                  RM {row.avgPrice.toFixed(2)}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-[10px] font-bold text-slate-400 italic">Tiada data harga tersedia</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

            {/* CHART SECTION: PRESTASI ANALITIK */}
            {reportType !== 'harga' && (
              <div ref={thekChartRef} className="bg-slate-50 dark:bg-[#0f172a] rounded-2xl p-3 shadow-md border border-slate-200 dark:border-slate-800/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center justify-center mb-3 relative">
                <div className="flex items-center justify-center gap-2">
                  <h3 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-1.5">
                    <BarChart3 size={12} className="text-emerald-500" />
                    THEK
                  </h3>
                </div>
                <div className="absolute right-0 top-0 flex items-center gap-2">
                  <div className="flex bg-slate-200/50 dark:bg-slate-800/40 p-0.5 rounded-full backdrop-blur-sm">
                    {(['day', 'month', 'year', 'history'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setChartPeriod(p as any)}
                        className={`px-2 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all duration-300 ${chartPeriod === p ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                      >
                        {p === 'day' ? 'Hari' : p === 'month' ? 'Bulan' : p === 'year' ? 'Tahun' : 'Trend'}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowThekChart(!showThekChart)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                  >
                    <motion.div animate={{ rotate: showThekChart ? 180 : 0 }}>
                      <ChevronDown size={12} className="text-slate-400" />
                    </motion.div>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showThekChart && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3">
                      {chartPeriod !== 'history' && (
                        <div className="flex bg-slate-50 dark:bg-slate-900/50 p-0.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          {(['yield', 'muda', 'kpg', 'efb'] as const).map(m => (
                            <button 
                              key={m}
                              onClick={() => {
                                setChartMetric(m);
                                setReportType(m === 'yield' ? 'hasil' : m === 'muda' ? 'muda' : m === 'efb' ? 'efb' : 'kpa_kpg');
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${chartMetric === m ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                              {m === 'yield' ? 'Hasil' : m === 'muda' ? 'Muda' : m === 'efb' ? 'EFB' : 'KPG'}
                            </button>
                          ))}
                        </div>
                      )}

                      {chartPeriod === 'history' ? (
                        <div 
                          className="h-40 w-full cursor-pointer group relative"
                          onClick={() => setIsHistoryExpanded(true)}
                        >
                          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                            <ScanLine size={14} className="text-emerald-500" />
                          </div>
                          <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={annualData.filter(d => d && !isNaN(d.yield) && !isNaN(d.year))} 
                        margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorSummary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="0" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                        <XAxis 
                          dataKey="year" 
                          axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fontWeight: 700, fill: CHART_COLORS.gray }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                          tickLine={false} 
                          domain={[0, 32]}
                          ticks={[0, 8, 16, 24, 32]}
                          tick={{ fontSize: 11, fontWeight: 700, fill: CHART_COLORS.gray }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                            borderRadius: '8px', 
                            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                          labelStyle={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: CHART_COLORS.blue }}
                          formatter={(value: any) => {
                            const val = parseFloat(value);
                            return [!isNaN(val) ? `${val.toFixed(2)} T/H` : '0.00 T/H', 'Hasil Tahunan'];
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="yield" 
                          name="Hasil" 
                          stroke={CHART_COLORS.blue} 
                          fillOpacity={0.6} 
                          fill={CHART_COLORS.blue} 
                          strokeWidth={3} 
                          animationDuration={2000}
                        />
                        <ReferenceLine 
                          y={28} 
                          stroke="#f43f5e" 
                          strokeDasharray="8 8" 
                          strokeWidth={2}
                          label={{ value: 'TARGET', position: 'insideTopRight', fill: '#f43f5e', fontSize: 10, fontWeight: 900, dy: -10 }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
              ) : (
                <>
                  <div 
                    className="h-56 w-full mt-2 cursor-pointer group relative"
                    onClick={() => setIsThekExpanded(true)}
                  >
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                      <ScanLine size={14} className="text-emerald-500" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const periodData = analytics[chartPeriod];
                        if (!periodData || !periodData.blokStats) return <div className="flex items-center justify-center h-full text-[10px] font-bold text-slate-400">Memuatkan data...</div>;

                        const chartData = [...periodData.blokStats]
                          .filter(d => {
                            const val = chartMetric === 'yield' ? d.yieldHek : chartMetric === 'muda' ? d.muda : chartMetric === 'efb' ? d.efb_tan : d.kpg_match_count;
                            return !isNaN(val) && !isNaN(parseInt(d.blok));
                          })
                          .sort((a, b) => parseInt(a.blok) - parseInt(b.blok));

                        if (chartData.length === 0) return <div className="flex items-center justify-center h-full text-[10px] font-bold text-slate-400">Tiada data untuk dipaparkan.</div>;

                        const values = chartData.map(d => chartMetric === 'yield' ? d.yieldHek : chartMetric === 'muda' ? d.muda : chartMetric === 'efb' ? d.efb_tan : d.kpg_match_count);
                        const maxValue = Math.max(...values);
                        const minValue = Math.min(...values.filter(v => v > 0)); // Only non-zero min

                        return (
                          <ComposedChart 
                            data={chartData}
                            margin={{ top: 30, right: 10, left: -25, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                            <XAxis 
                              dataKey="blok" 
                              axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                              tickLine={false} 
                              tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }}
                              dy={5}
                            />
                            <YAxis 
                              axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                                                 tick={{ fontSize: 8, fontWeight: 700, fill: CHART_COLORS.gray }}
                              domain={[0, 'auto']}
                            />
                            {chartMetric !== 'muda' && (
                              <Tooltip 
                                cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0]?.payload;
                                    if (!data) return null;
                                    const val = chartMetric === 'yield' ? data.yieldHek : chartMetric === 'muda' ? data.muda : chartMetric === 'efb' ? data.efb_tan : data.kpg_match_count;
                                    const target = data.targetHek;
                                    const unit = chartMetric === 'yield' ? 'T/H' : chartMetric === 'muda' ? 'Bts' : chartMetric === 'efb' ? 'Tan' : 'Resit';
                                    const label = chartMetric === 'yield' ? 'Hasil' : chartMetric === 'muda' ? 'Muda' : chartMetric === 'efb' ? 'EFB' : 'KPG Match';
                                    
                                    const isMax = val === maxValue && val > 0;
                                    const isMin = val === minValue && val > 0;
  
                                    return (
                                      <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-1 gap-4">
                                          <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Blok {data.blok}</p>
                                          {isMax && <span className="text-[6px] font-black bg-emerald-500 text-white px-1 rounded">MAX</span>}
                                          {isMin && <span className="text-[6px] font-black bg-rose-500 text-white px-1 rounded">MIN</span>}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS.blue }} />
                                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                                              {label}: {(val || 0).toFixed(chartMetric === 'yield' ? 2 : 0)} <span className="text-[8px] font-normal opacity-60">{unit}</span>
                                            </p>
                                          </div>
                                          {chartMetric === 'yield' && (
                                            <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-700 pt-1 mt-0.5">
                                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS.orange }} />
                                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                Target: {(target || 0).toFixed(2)} <span className="text-[8px] font-normal opacity-60">T/H</span>
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            )}
                            <Bar 
                              dataKey={chartMetric === 'yield' ? 'yieldHek' : chartMetric === 'muda' ? 'muda' : chartMetric === 'efb' ? 'efb_tan' : 'kpg_match_count'} 
                              radius={[2, 2, 0, 0]}
                              animationDuration={1200}
                              activeBar={{ fillOpacity: 0.8, stroke: isDarkMode ? '#fff' : '#000', strokeWidth: 1 }}
                            >
                              {chartData.map((entry, index) => {
                                const val = chartMetric === 'yield' ? entry.yieldHek : chartMetric === 'muda' ? entry.muda : chartMetric === 'efb' ? entry.efb_tan : entry.kpg_match_count;
                                let color = chartMetric === 'yield' ? CHART_COLORS.green : chartMetric === 'muda' ? '#f43f5e' : chartMetric === 'efb' ? '#8b5cf6' : '#0ea5e9';
                                const maxColor = chartMetric === 'yield' ? '#059669' : chartMetric === 'muda' ? '#e11d48' : chartMetric === 'efb' ? '#7c3aed' : '#0284c7';
                                if (val === maxValue && val > 0) color = maxColor;
                                if (val === minValue && val > 0) color = '#e11d48'; // Keep rose for min
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                              <LabelList 
                                dataKey={chartMetric === 'yield' ? 'yieldHek' : chartMetric === 'muda' ? 'muda' : chartMetric === 'efb' ? 'efb_tan' : 'kpg_match_count'} 
                                position="top" 
                                angle={-90}
                                offset={8}
                                formatter={(val: number) => {
                                  let text = chartMetric === 'yield' ? val.toFixed(1) : (chartMetric === 'efb' ? val.toFixed(1) : val.toString());
                                  if (val === maxValue && val > 0) return `▲ ${text}`;
                                  if (val === minValue && val > 0) return `▼ ${text}`;
                                  return text;
                                }}
                                style={{ fontSize: '7px', fontWeight: '900', fill: CHART_COLORS.gray, textAnchor: 'start' }}
                              />
                            </Bar>
                            {chartMetric === 'yield' && (
                              <Line 
                                type="monotone" 
                                dataKey="targetHek" 
                                stroke={CHART_COLORS.orange} 
                                strokeWidth={2} 
                                dot={{ r: 3, fill: CHART_COLORS.orange, strokeWidth: 0 }} 
                                activeDot={{ r: 4 }}
                              />
                            )}
                          </ComposedChart>
                        );
                      })()}
                    </ResponsiveContainer>
                </div>
                
                <div className="flex justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.green }} />
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pencapaian</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.orange }} />
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sasaran</span>
                  </div>
                </div>

                {/* --- NEW PIE CHART SECTION --- */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-0.5 h-3 bg-indigo-500 rounded-full" />
                    <p className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Pecahan Hasil</p>
                  </div>
                  <div 
                    className="h-48 w-full cursor-pointer group relative"
                    onClick={() => setIsPieExpanded(true)}
                  >
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 p-1.5 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                      <ScanLine size={14} className="text-emerald-500" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'PKT 1', value: analytics.month?.pkt1_tan || 0 },
                            { name: 'PKT 2', value: analytics.month?.pkt2_tan || 0 },
                            { name: 'FELDA', value: analytics.month?.felda_tan || 0 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                          style={{ fontSize: '8px', fontWeight: '900', fill: isDarkMode ? '#cbd5e1' : '#475569' }}
                        >
                          <Cell fill={CHART_COLORS.blue} />
                          <Cell fill={CHART_COLORS.orange} />
                          <Cell fill={CHART_COLORS.green} />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                            borderRadius: '8px', 
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            padding: '8px'
                          }}
                          itemStyle={{ fontSize: '10px', fontWeight: 600 }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={24}
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider ml-1.5">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )}

  {/* Togol Ranking */}
          {reportType !== 'harga' && (
            <>
              <div className="flex flex-col gap-1 px-1 mt-2">
              <div className="flex justify-between items-center">
                <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prestasi Blok</h2>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowRanking(!showRanking)} 
                  className={`text-[10px] font-black px-4 py-2 rounded-full border shadow-lg flex gap-2 items-center transition-all duration-500 ${showRanking ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}
                >
                  {showRanking ? <Trophy size={14} className="text-amber-400"/> : <LayoutDashboard size={14}/>}
                  {showRanking ? 'Ranking Aktif' : 'Lihat Ranking'}
                </motion.button>
              </div>

              <AnimatePresence>
                {showRanking && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.8, filter: "blur(15px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, scale: 0.8, filter: "blur(15px)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="flex bg-slate-200/40 dark:bg-slate-800/40 backdrop-blur-md p-1.5 rounded-[22px] self-end shadow-inner border border-slate-200/50 dark:border-slate-700/50 relative overflow-hidden"
                  >
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setRankingPeriod('month')}
                      className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 z-10 ${rankingPeriod === 'month' ? 'text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}
                    >
                      {rankingPeriod === 'month' && (
                        <motion.div 
                          layoutId="activePeriod"
                          className="absolute inset-0 bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] rounded-xl -z-10"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      Bulan
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setRankingPeriod('year')}
                      className={`relative px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 z-10 ${rankingPeriod === 'year' ? 'text-white' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'}`}
                    >
                      {rankingPeriod === 'year' && (
                        <motion.div 
                          layoutId="activePeriod"
                          className="absolute inset-0 bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] rounded-xl -z-10"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      Tahun
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Senarai Blok / Ranking (Layout 3-Tempoh Bersebelahan) */}
            <motion.div 
              layout 
              className={`transition-all duration-500 ${showRanking ? 'bg-white dark:bg-slate-900 rounded-[32px] p-2 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-0' : 'space-y-1'}`}
              variants={{
                show: { 
                  transition: { 
                    staggerChildren: 0.04,
                    delayChildren: 0.02
                  } 
                }
              }}
              initial="hidden"
              animate="show"
            >
              {showRanking && (
                <div className="flex items-center gap-2 px-3 py-0.5 border-b border-slate-50 dark:border-slate-800 mb-0.5">
                  <div className="w-7 shrink-0" />
                  <div className="flex-1 grid grid-cols-4 gap-1 items-center">
                    <div className="col-span-1">
                      <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Blok</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Hari Ini</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Bulan Ini</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Tahun Ini</p>
                    </div>
                  </div>
                </div>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                {(showRanking ? analytics[rankingPeriod]?.rankedBlok || [] : analytics.month?.blokStats || []).map((s, index) => {
                  if (s.tan === 0 && !showRanking) return null;
                  
                  // Get corresponding data for Today, Month, and Year
                  const todayBlok = analytics.day?.blokStats?.find(b => b.blok === s.blok);
                  const monthBlok = analytics.month?.blokStats?.find(b => b.blok === s.blok);
                  const yearBlok = analytics.year?.blokStats?.find(b => b.blok === s.blok);

                  const getTarget = (pkt: string, period: 'day' | 'month' | 'year') => {
                    let annual = 0;
                    if (pkt === "001") annual = TARGET_ANNUAL_PKT1;
                    else if (pkt === "002") annual = TARGET_ANNUAL_PKT2;
                    else if (pkt === "003") annual = TARGET_ANNUAL_FELDA;
                    
                    if (period === 'day') return annual / 365;
                    if (period === 'month') return annual / 12;
                    return annual;
                  };

                  const targetDay = getTarget(s.pkt, 'day');
                  const targetMonth = getTarget(s.pkt, 'month');
                  const targetYear = getTarget(s.pkt, 'year');

                  const pctDay = targetDay > 0 ? ((todayBlok?.yieldHek || 0) / targetDay) * 100 : 0;
                  const pctMonth = targetMonth > 0 ? ((monthBlok?.yieldHek || 0) / targetMonth) * 100 : 0;
                  const pctYear = targetYear > 0 ? ((yearBlok?.yieldHek || 0) / targetYear) * 100 : 0;

                  // KPI Color Logic (Based on Month)
                  let kpiColorClass = "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500";
                  if (reportType === 'muda') {
                    if (s.muda < 20) kpiColorClass = "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
                    else if (s.muda <= 30) kpiColorClass = "bg-amber-500 text-white shadow-md shadow-amber-500/20";
                    else kpiColorClass = "bg-rose-500 text-white shadow-md shadow-rose-500/20";
                  } else if (reportType === 'kpa_kpg') {
                    if (s.kpg_match_count >= 5) kpiColorClass = "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
                    else if (s.kpg_match_count >= 3) kpiColorClass = "bg-amber-500 text-white shadow-md shadow-amber-500/20";
                    else kpiColorClass = "bg-rose-500 text-white shadow-md shadow-rose-500/20";
                  } else if (reportType === 'hasil') {
                    if (s.progress_pct >= 90) kpiColorClass = "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
                    else if (s.progress_pct >= 80) kpiColorClass = "bg-amber-500 text-white shadow-md shadow-amber-500/20";
                    else kpiColorClass = "bg-rose-500 text-white shadow-md shadow-rose-500/20";
                  }

                  return (
                    <motion.div 
                      layout
                      key={s.blok}
                      variants={{
                        hidden: { opacity: 0, y: 30, scale: 0.85, filter: "blur(10px)" },
                        show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                      }}
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0, scale: 0.8, filter: "blur(15px)", transition: { duration: 0.2 } }}
                      transition={{ 
                        layout: { type: "spring", stiffness: 350, damping: 30, mass: 1 },
                        opacity: { duration: 0.5, ease: "circOut" },
                        y: { type: "spring", stiffness: 450, damping: 30 }
                      }}
                      whileHover={{ scale: 1.01, y: -0.5, transition: { duration: 0.2 } }}
                      className={`${showRanking ? 'bg-transparent border-b border-slate-100 dark:border-slate-800 last:border-0 rounded-none shadow-none py-1.5 px-3' : 'bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800'} group hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/20 -z-10" />
                      <div className="flex items-center gap-2">
                        {/* Rank / Indicator */}
                        <motion.div 
                          layout="position"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] shrink-0 transition-all duration-500 group-hover:rotate-[10deg] group-hover:scale-105 shadow-inner ${kpiColorClass}`}
                        >
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={showRanking ? `rank-${index}` : `blok-${s.blok}`}
                              initial={{ y: 15, opacity: 0, rotateX: -90, scale: 0.5 }}
                              animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
                              exit={{ y: -15, opacity: 0, rotateX: 90, scale: 0.5 }}
                              transition={{ type: "spring", stiffness: 900, damping: 25 }}
                            >
                              {showRanking ? index + 1 : s.blok}
                            </motion.span>
                          </AnimatePresence>
                        </motion.div>

                        {/* Data Utama - Layout Melintang (3 Tempoh) */}
                        <div className="flex-1 grid grid-cols-4 gap-1 items-center">
                          <div className="col-span-1">
                            <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase leading-none">Blok {s.blok}</p>
                            <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter mt-0.5">
                              {s.pkt === "003" ? "Lot" : `PKT ${s.pkt === "001" ? "1" : "2"}`}
                            </p>
                          </div>

                          {/* HARI */}
                          <div className="text-center border-l border-slate-50 dark:border-slate-800 pl-0.5">
                            {reportType === 'hasil' && (
                              <>
                                <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">{(todayBlok?.yieldHek || 0).toFixed(2)}</p>
                                <div className="flex justify-center items-center gap-1 mt-0.5">
                                  <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{todayBlok?.tan.toFixed(1)} Tan</p>
                                  <span className="text-[6px] font-black bg-slate-100 dark:bg-slate-800 px-0.5 rounded text-slate-400">{todayBlok?.resit_count || 0}R</span>
                                </div>
                                <p className={`text-[7px] font-black mt-0.5 ${pctDay >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{pctDay.toFixed(0)}%</p>
                              </>
                            )}
                            {reportType === 'muda' && (
                              <div className="flex flex-col items-center">
                                <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 leading-none">{todayBlok?.muda || 0}</p>
                                <span className="text-[6px] font-black bg-slate-100 dark:bg-slate-800 px-0.5 rounded text-slate-400 mt-1">{todayBlok?.resit_count || 0}R</span>
                              </div>
                            )}
                            {reportType === 'kpa_kpg' && (
                              <div className="flex flex-col items-center">
                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-none">
                                  {todayBlok?.kpg_match_count || 0}
                                  <span className="text-[7px] text-slate-400 font-bold ml-0.5">/{todayBlok?.resit_count || 0}</span>
                                </p>
                                <p className="text-[7px] font-black text-emerald-500 mt-0.5">
                                  {todayBlok?.resit_count ? Math.round(((todayBlok.kpg_match_count || 0) / todayBlok.resit_count) * 100) : 0}%
                                </p>
                              </div>
                            )}
                          </div>

                          {/* BULAN */}
                          <div className={`text-center border-l border-slate-50 dark:border-slate-800 pl-0.5 transition-all duration-500 rounded-lg ${rankingPeriod === 'month' && showRanking ? 'bg-emerald-500/10 dark:bg-emerald-500/20 z-20' : ''}`}>
                            {reportType === 'hasil' && (
                              <>
                                <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">{(monthBlok?.yieldHek || 0).toFixed(2)}</p>
                                <div className="flex justify-center items-center gap-1 mt-0.5">
                                  <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{monthBlok?.tan.toFixed(1)} Tan</p>
                                </div>
                                <p className={`text-[7px] font-black mt-0.5 ${pctMonth >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{pctMonth.toFixed(0)}%</p>
                              </>
                            )}
                            {reportType === 'muda' && (
                              <div className="flex flex-col items-center">
                                <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 leading-none">{monthBlok?.muda || 0}</p>
                              </div>
                            )}
                            {reportType === 'kpa_kpg' && (
                              <div className="flex flex-col items-center">
                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-none">
                                  {monthBlok?.kpg_match_count || 0}
                                </p>
                                <p className="text-[7px] font-black text-emerald-500 mt-0.5">
                                  {monthBlok?.resit_count ? Math.round(((monthBlok.kpg_match_count || 0) / monthBlok.resit_count) * 100) : 0}%
                                </p>
                              </div>
                            )}
                          </div>

                          {/* TAHUN */}
                          <div className={`text-center border-l border-slate-50 dark:border-slate-800 pl-0.5 transition-all duration-500 rounded-lg ${rankingPeriod === 'year' && showRanking ? 'bg-emerald-500/10 dark:bg-emerald-500/20 z-20' : ''}`}>
                            {reportType === 'hasil' && (
                              <>
                                <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">{(yearBlok?.yieldHek || 0).toFixed(2)}</p>
                                <div className="flex justify-center items-center gap-1 mt-0.5">
                                  <p className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{yearBlok?.tan.toFixed(1)} Tan</p>
                                </div>
                                <p className={`text-[7px] font-black mt-0.5 ${pctYear >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{pctYear.toFixed(0)}%</p>
                              </>
                            )}
                            {reportType === 'muda' && (
                              <div className="flex flex-col items-center">
                                <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 leading-none">{yearBlok?.muda || 0}</p>
                              </div>
                            )}
                            {reportType === 'kpa_kpg' && (
                              <div className="flex flex-col items-center">
                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 leading-none">
                                  {yearBlok?.kpg_match_count || 0}
                                </p>
                                <p className="text-[7px] font-black text-emerald-500 mt-0.5">
                                  {yearBlok?.resit_count ? Math.round(((yearBlok.kpg_match_count || 0) / yearBlok.resit_count) * 100) : 0}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </>
        )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

            {/* TAB 3: SEJARAH DATA */}
            {activeTab === 'sejarah' && (
              <div className="w-full">
                <div className="animate-in slide-in-from-right-8 duration-300">
                  <div className="flex flex-col items-center justify-center mb-3">
                    <h2 className="text-xs font-display font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><History size={14}/> Sejarah Harian</h2>
                  </div>
                  <div className="flex justify-center gap-2 mb-4">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowExportModal(true)}
                      className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-4 py-2 rounded-full flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                    >
                      <Download size={12} />
                      Export Data (Excel)
                    </motion.button>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                    {(rawData?.length || 0) === 0 ? (
                      <p className="text-center p-6 text-xs font-bold text-slate-400">Tiada rekod hantaran.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800">Tarikh</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800">Resit / Nota</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800">Lori / Seal</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800">Muda</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800">Blok</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800">KPG</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800 text-right">Tan</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800 text-right">Hasil (RM)</th>
                              <th className="p-3 border-b border-slate-100 dark:border-slate-800 text-center">Tindakan</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {rawData.map((row, i) => (
                              <tr key={i} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <td className="p-3 whitespace-nowrap">{new Date(row.tarikh).toLocaleDateString('ms-MY', { day:'2-digit', month:'short' })}</td>
                                <td className="p-3">
                                  <div className="font-bold">{row.no_resit}</div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500 flex flex-col">
                                    {row.no_nota_hantaran && row.no_nota_hantaran !== row.no_resit && <span>Nota: {row.no_nota_hantaran}</span>}
                                    {row.no_akaun_terima && <span className="text-emerald-600 dark:text-emerald-400 font-black">Akaun: {row.no_akaun_terima}</span>}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="font-bold">{row.no_lori}</div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500">{row.no_seal || '-'}</div>
                                </td>
                                <td className="p-3 font-bold text-rose-500">{row.muda}</td>
                                <td className="p-3 font-bold">
                                  <div className="flex flex-col">
                                    <span>B{row.blok}</span>
                                    {row.peringkat === 'EFB' && (
                                      <span className="text-[8px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md font-black mt-1 w-fit">EFB</span>
                                    )}
                                  </div>
                                </td>
                                <td className={`p-3 font-bold ${parseFloat(row.kpg || "0") >= 21 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {row.kpg || '-'}
                                </td>
                                <td className="p-3 text-right font-black text-emerald-600 dark:text-emerald-400">{row.tan.toFixed(2)}</td>
                                <td className="p-3 text-right font-black text-indigo-600 dark:text-indigo-400">{(row.hasil_rm || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</td>
                                <td className="p-3 text-center">
                                  <motion.button 
                                    whileTap={{ scale: 0.8 }}
                                    onClick={() => setRecordToDelete(row.no_resit)}
                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </motion.button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- MENU NAVIGASI BAWAH --- */}
      {activeTab === 'scan' && (
        <div className="fixed bottom-24 right-6 z-[60] flex flex-col items-end gap-3">
          <AnimatePresence>
            {showOcrActions && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="flex flex-col items-end gap-3 mb-2"
              >
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { uploadInputRef.current?.click(); setShowOcrActions(false); }}
                  className="bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Muat Naik <Upload size={16} />
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { fileInputRef.current?.click(); setShowOcrActions(false); }}
                  className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Imbas Resit <Camera size={16} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowOcrActions(!showOcrActions)}
            className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-90 ${showOcrActions ? 'bg-slate-800 dark:bg-slate-700 rotate-45' : 'bg-emerald-600 dark:bg-emerald-500'}`}
          >
            {isScanning ? <Loader2 className="animate-spin text-white" size={24} /> : <Plus className={`text-white transition-transform ${showOcrActions ? '' : ''}`} size={28} />}
          </motion.button>
        </div>
      )}

      <nav className="fixed bottom-4 landscape:bottom-2 left-6 right-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)] rounded-full p-1.5 flex justify-between z-50">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => handleTabChange('scan')} 
          className={`flex-1 flex justify-center items-center gap-2 py-3 landscape:py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'scan' ? 'bg-emerald-900 dark:bg-emerald-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
        >
          <ScanLine size={16} /> Input
        </motion.button>
        
        {(authRole === 'fc' || authRole === 'afc' || authRole === 'fs') && (
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => handleTabChange('dashboard')} 
            className={`flex-1 flex justify-center items-center gap-2 py-3 landscape:py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-emerald-900 dark:bg-emerald-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
          >
            <LayoutDashboard size={16} /> Analitik
          </motion.button>
        )}

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => handleTabChange('sejarah')} 
          className={`flex-1 flex justify-center items-center gap-2 py-3 landscape:py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sejarah' ? 'bg-emerald-900 dark:bg-emerald-600 text-white shadow-md' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
        >
          <Calendar size={16} /> Sejarah
        </motion.button>
      </nav>

      {/* --- MODAL: CARTA TREND DIPERBESARKAN --- */}
      <AnimatePresence>
        {expandedTrendChart && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpandedTrendChart(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      expandedTrendChart === 'overall' ? 'bg-emerald-500' :
                      expandedTrendChart === 'pkt1' ? 'bg-blue-500' :
                      expandedTrendChart === 'pkt2' ? 'bg-amber-500' : 'bg-slate-500'
                    }`} />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                      Trend Hasil: {
                        expandedTrendChart === 'overall' ? 'Purata Keseluruhan' :
                        expandedTrendChart === 'pkt1' ? 'Peringkat 1' :
                        expandedTrendChart === 'pkt2' ? 'Peringkat 2' : 'Lot Felda'
                      }
                    </h3>
                  </div>
                  <button 
                    onClick={() => setExpandedTrendChart(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const dataKey = reportType === 'hasil' ? (
                        expandedTrendChart === 'overall' ? 'yield' :
                        expandedTrendChart === 'pkt1' ? 'pkt1' :
                        expandedTrendChart === 'pkt2' ? 'pkt2' : 'felda'
                      ) : reportType === 'muda' ? (
                        expandedTrendChart === 'overall' ? 'muda' :
                        expandedTrendChart === 'pkt1' ? 'pkt1Muda' :
                        expandedTrendChart === 'pkt2' ? 'pkt2Muda' : 'feldaMuda'
                      ) : (
                        expandedTrendChart === 'overall' ? 'kpg' :
                        expandedTrendChart === 'pkt1' ? 'pkt1Kpg' :
                        expandedTrendChart === 'pkt2' ? 'pkt2Kpg' : 'feldaKpg'
                      );
                      const vals = analytics.monthlyTrend.map(d => (d as any)[dataKey]);
                      const max = Math.max(...vals);
                      const min = Math.min(...vals.filter(v => v > 0));
                      const baseColor = reportType === 'hasil' ? (
                        expandedTrendChart === 'overall' ? '#10b981' :
                        expandedTrendChart === 'pkt1' ? '#3b82f6' :
                        expandedTrendChart === 'pkt2' ? '#f59e0b' : '#64748b'
                      ) : reportType === 'muda' ? '#f43f5e' : '#0ea5e9';
                      const maxColor = reportType === 'hasil' ? (
                        expandedTrendChart === 'overall' ? '#059669' :
                        expandedTrendChart === 'pkt1' ? '#2563eb' :
                        expandedTrendChart === 'pkt2' ? '#d97706' : '#475569'
                      ) : reportType === 'muda' ? '#e11d48' : '#0284c7';

                      return (
                        <BarChart data={analytics.monthlyTrend} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: CHART_COLORS.gray }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: CHART_COLORS.gray }} />
                          {reportType !== 'muda' && (
                            <Tooltip 
                              cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                              contentStyle={{ 
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                                borderRadius: '16px', 
                                border: 'none',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                              }}
                              labelStyle={{ fontSize: '12px', fontWeight: 800, color: isDarkMode ? '#fff' : '#1e293b', marginBottom: '4px' }}
                              formatter={(value: any) => {
                                const unit = reportType === 'hasil' ? 'T/H' : reportType === 'muda' ? 'Bts' : 'Resit';
                                const label = reportType === 'hasil' ? 'Hasil' : reportType === 'muda' ? 'Muda' : 'KPG Match';
                                const val = reportType === 'hasil' ? parseFloat(value).toFixed(2) : value;
                                return [`${val} ${unit}`, label];
                              }}
                            />
                          )}
                          <Bar 
                            dataKey={dataKey} 
                            radius={[6, 6, 0, 0]}
                            animationDuration={1000}
                          >
                            {analytics.monthlyTrend.map((entry, index) => {
                              const val = (entry as any)[dataKey];
                              let color = baseColor;
                              if (val === max && val > 0) color = maxColor;
                              if (val === min && val > 0) color = '#e11d48';
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                            <LabelList 
                              dataKey={dataKey} 
                              position="top" 
                              style={{ fontSize: '10px', fontWeight: '900', fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                              formatter={(val: number) => {
                                if (val === 0) return '';
                                let text = reportType === 'hasil' ? val.toFixed(1) : val.toString();
                                if (val === max) return `▲ MAX ${text}`;
                                if (val === min) return `▼ MIN ${text}`;
                                return text;
                              }}
                            />
                          </Bar>
                          {reportType === 'hasil' && <ReferenceLine y={2.33} stroke="#f47738" strokeDasharray="3 3" label={{ value: 'Target', position: 'right', fill: '#f47738', fontSize: 10, fontWeight: 900 }} />}
                        </BarChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    Analisis trend bulanan menunjukkan prestasi hasil (Tan/Hektar) bagi tahun {new Date().getFullYear()}. 
                    Garis jingga putus-putus mewakili sasaran bulanan (2.33 T/H).
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL EXPANDED THEK CHART */}
      <AnimatePresence>
        {isThekExpanded && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsThekExpanded(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <BarChart3 size={24} className="text-emerald-500" />
                    </div>
                    Analisis THEK: {chartMetric === 'yield' ? 'Hasil' : chartMetric === 'muda' ? 'Muda' : 'KPG Match'}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">
                    Tempoh: {chartPeriod === 'day' ? 'Hari Ini' : chartPeriod === 'month' ? 'Bulan Ini' : chartPeriod === 'year' ? 'Tahun Ini' : 'Trend Sejarah'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsThekExpanded(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="h-full w-full min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {(() => {
                      const periodData = analytics[chartPeriod];
                      if (!periodData || !periodData.blokStats) return <div />;

                      const chartData = [...periodData.blokStats]
                        .filter(d => {
                          const val = chartMetric === 'yield' ? d.yieldHek : chartMetric === 'muda' ? d.muda : d.kpg_match_count;
                          return !isNaN(val) && !isNaN(parseInt(d.blok));
                        })
                        .sort((a, b) => parseInt(a.blok) - parseInt(b.blok));

                      const values = chartData.map(d => chartMetric === 'yield' ? d.yieldHek : chartMetric === 'muda' ? d.muda : d.kpg_match_count);
                      const maxValue = Math.max(...values);
                      const minValue = Math.min(...values.filter(v => v > 0));

                      return (
                        <ComposedChart 
                          data={chartData}
                          margin={{ top: 40, right: 20, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                          <XAxis 
                            dataKey="blok" 
                            axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fontWeight: 800, fill: CHART_COLORS.gray }}
                            dy={10}
                            label={{ value: 'NOMBOR BLOK', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 900, fill: CHART_COLORS.gray }}
                          />
                          <YAxis 
                            axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fontWeight: 800, fill: CHART_COLORS.gray }}
                            domain={[0, 'auto']}
                          />
                          {chartMetric !== 'muda' && (
                            <Tooltip 
                              cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0]?.payload;
                                  if (!data) return null;
                                  const val = chartMetric === 'yield' ? data.yieldHek : chartMetric === 'muda' ? data.muda : chartMetric === 'efb' ? data.efb_tan : data.kpg_match_count;
                                  const target = data.targetHek;
                                  const unit = chartMetric === 'yield' ? 'T/H' : chartMetric === 'muda' ? 'Bts' : chartMetric === 'efb' ? 'Tan' : 'Resit';
                                  const label = chartMetric === 'yield' ? 'Hasil' : chartMetric === 'muda' ? 'Muda' : chartMetric === 'efb' ? 'EFB' : 'KPG Match';
                                  
                                  const isMax = val === maxValue && val > 0;
                                  const isMin = val === minValue && val > 0;
  
                                  return (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 min-w-[200px]">
                                      <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                                        <div className="flex flex-col">
                                          <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Blok {data.blok}</p>
                                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">PKT {data.pkt === '001' ? '1' : data.pkt === '002' ? '2' : 'FELDA'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                          {isMax && <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm">TERTINGGI (MAX)</span>}
                                          {isMin && <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full shadow-sm">TERENDAH (MIN)</span>}
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                          <div className="flex items-baseline gap-2">
                                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{(val || 0).toFixed(chartMetric === 'yield' ? 2 : 0)}</p>
                                            <p className="text-xs font-bold text-slate-400 uppercase">{unit}</p>
                                          </div>
                                        </div>
                                        {chartMetric === 'yield' && (
                                          <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sasaran</p>
                                            <div className="flex items-baseline gap-2">
                                              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{(target || 0).toFixed(2)}</p>
                                              <p className="text-xs font-bold text-slate-400 uppercase">T/H</p>
                                            </div>
                                            <div className="mt-2 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full transition-all duration-1000 ${val >= target ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                                style={{ width: `${Math.min(100, (val / (target || 1)) * 100)}%` }} 
                                              />
                                            </div>
                                            <p className="text-[10px] font-black text-right mt-1 text-slate-500 uppercase tracking-widest">
                                              {((val / (target || 1)) * 100).toFixed(0)}% Capai
                                            </p>
                                          </div>
                                        )}
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
                                          <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Luas</p>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">{data.luas} Ha</p>
                                          </div>
                                          <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Resit</p>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">{data.resit_count}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          )}
                          <Bar 
                            dataKey={chartMetric === 'yield' ? 'yieldHek' : chartMetric === 'muda' ? 'muda' : chartMetric === 'efb' ? 'efb_tan' : 'kpg_match_count'} 
                            radius={[6, 6, 0, 0]}
                            animationDuration={1500}
                          >
                            {chartData.map((entry, index) => {
                              const val = chartMetric === 'yield' ? entry.yieldHek : chartMetric === 'muda' ? entry.muda : chartMetric === 'efb' ? entry.efb_tan : entry.kpg_match_count;
                              let color = chartMetric === 'yield' ? CHART_COLORS.green : chartMetric === 'muda' ? '#f43f5e' : chartMetric === 'efb' ? '#8b5cf6' : '#0ea5e9';
                              const maxColor = chartMetric === 'yield' ? '#059669' : chartMetric === 'muda' ? '#e11d48' : chartMetric === 'efb' ? '#7c3aed' : '#0284c7';
                              if (val === maxValue && val > 0) color = maxColor;
                              if (val === minValue && val > 0) color = '#e11d48';
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                            <LabelList 
                              dataKey={chartMetric === 'yield' ? 'yieldHek' : chartMetric === 'muda' ? 'muda' : chartMetric === 'efb' ? 'efb_tan' : 'kpg_match_count'} 
                              position="top" 
                              offset={15}
                              formatter={(val: number) => {
                                let text = chartMetric === 'yield' ? val.toFixed(2) : (chartMetric === 'efb' ? val.toFixed(1) : val.toString());
                                if (val === maxValue && val > 0) return `▲ MAX ${text}`;
                                if (val === minValue && val > 0) return `▼ MIN ${text}`;
                                return text;
                              }}
                              style={{ fontSize: '10px', fontWeight: '900', fill: isDarkMode ? '#f8fafc' : '#0f172a' }}
                            />
                          </Bar>
                          {chartMetric === 'yield' && (
                            <Line 
                              type="monotone" 
                              dataKey="targetHek" 
                              stroke={CHART_COLORS.orange} 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: CHART_COLORS.orange, strokeWidth: 0 }} 
                              activeDot={{ r: 8, strokeWidth: 0 }}
                            />
                          )}
                        </ComposedChart>
                      );
                    })()}
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: CHART_COLORS.green }} />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Pencapaian Sebenar</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: CHART_COLORS.orange }} />
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Sasaran (Target)</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL EXPANDED PIE CHART */}
      <AnimatePresence>
        {isPieExpanded && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPieExpanded(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                      <PieChartIcon size={24} className="text-indigo-500" />
                    </div>
                    Pecahan Hasil Mengikut Peringkat
                  </h3>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">Analisis Komposisi Pengeluaran</p>
                </div>
                <button 
                  onClick={() => setIsPieExpanded(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 flex flex-col items-center">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'PKT 1', value: analytics.month?.pkt1_tan || 0 },
                          { name: 'PKT 2', value: analytics.month?.pkt2_tan || 0 },
                          { name: 'FELDA', value: analytics.month?.felda_tan || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill={CHART_COLORS.blue} />
                        <Cell fill={CHART_COLORS.orange} />
                        <Cell fill={CHART_COLORS.green} />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                          borderRadius: '16px', 
                          border: 'none',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                          padding: '12px'
                        }}
                        itemStyle={{ fontSize: '14px', fontWeight: 700 }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        iconSize={10}
                        formatter={(value) => <span className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-2">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-6 w-full">
                  {[
                    { label: 'PKT 1', val: analytics.month?.pkt1_tan || 0, color: CHART_COLORS.blue },
                    { label: 'PKT 2', val: analytics.month?.pkt2_tan || 0, color: CHART_COLORS.orange },
                    { label: 'FELDA', val: analytics.month?.felda_tan || 0, color: CHART_COLORS.green }
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">{(item.val).toFixed(2)}</p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase">Tan</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL EXPANDED HISTORY CHART */}
      <AnimatePresence>
        {isHistoryExpanded && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryExpanded(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <TrendingUp size={24} className="text-emerald-500" />
                    </div>
                    Trend Hasil Sejarah (Tahunan)
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mt-1">Analisis Prestasi Jangka Panjang</p>
                </div>
                <button 
                  onClick={() => setIsHistoryExpanded(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 p-8 overflow-hidden flex flex-col">
                <div className="h-full w-full min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={annualData.filter(d => d && !isNaN(d.yield) && !isNaN(d.year))} 
                      margin={{ top: 40, right: 30, left: 0, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorHistoryFull" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? CHART_COLORS.gridDark : CHART_COLORS.grid} />
                      <XAxis 
                        dataKey="year" 
                        axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                        tickLine={false} 
                        tick={{ fontSize: 14, fontWeight: 800, fill: CHART_COLORS.gray }}
                        dy={15}
                      />
                      <YAxis 
                        axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} 
                        tickLine={false} 
                        tick={{ fontSize: 14, fontWeight: 800, fill: CHART_COLORS.gray }}
                        domain={[0, 35]}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                          borderRadius: '20px', 
                          border: 'none',
                          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                          padding: '16px'
                        }}
                        itemStyle={{ fontSize: '16px', fontWeight: 800 }}
                        labelStyle={{ fontSize: '14px', fontWeight: 900, marginBottom: '8px', color: CHART_COLORS.blue }}
                        formatter={(value: any) => [`${value} Tan/Hektar`, 'Hasil']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="yield" 
                        stroke="#10b981" 
                        strokeWidth={5}
                        fillOpacity={1} 
                        fill="url(#colorHistoryFull)" 
                        animationDuration={2000}
                      />
                      <ReferenceLine 
                        y={28} 
                        stroke="#f43f5e" 
                        strokeDasharray="10 10" 
                        strokeWidth={3}
                        label={{ value: 'SASARAN (28 T/H)', position: 'insideTopRight', fill: '#f43f5e', fontSize: 14, fontWeight: 900, dy: -20 }} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full shadow-xl" style={{ backgroundColor: '#10b981' }} />
                  <span className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em]">Hasil Tahunan (Tan/Hektar)</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FloatingInput({ label, type = "text", value, onChange, step, className }: { label: string; type?: string; value: string; onChange: (v: string) => void; step?: string; className?: string }) {
  return (
    <div className="relative">
      <input required type={type} step={step} value={value} onChange={e => onChange(e.target.value)} placeholder=" " className={`block px-4 pb-2.5 pt-6 w-full text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 border rounded-2xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500 peer shadow-sm ${className || 'border-slate-200 dark:border-slate-800'}`} />
      <label className="absolute text-[12px] text-slate-400 dark:text-slate-500 font-display font-black uppercase tracking-widest duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-emerald-600 dark:peer-focus:text-emerald-400">{label}</label>
    </div>
  );
}
