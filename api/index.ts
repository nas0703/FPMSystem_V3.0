import express from "express";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Remove static import to prevent potential startup issues in serverless environments
// import PptxGenJS from "pptxgenjs";

console.log("Loading API routes from api/index.ts...");

dotenv.config();

// Initialize Supabase client lazily to pick up runtime environment variables
let supabaseClient: any = null;

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase credentials missing");
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  return supabaseClient;
}

const router = express.Router();

// Request logging middleware
router.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// API Routes
router.get("/", (req, res) => {
  res.json({ success: true, message: "FPMSB TUNGGAL API Engine is running." });
});

router.post("/hantaran", async (req, res) => {
  try {
    const data = req.body;
    
    // Basic validation
    if (!data.no_resit || !data.no_lori || !data.blok) {
      return res.status(400).json({ 
        success: false, 
        error: "Maklumat tidak lengkap. Sila pastikan No. Resit, No. Lori dan Blok diisi." 
      });
    }

    // Mapping Luas (Hektar) mengikut gambar yang diberikan
    const BLOK_AREAS: Record<string, number> = {
      "1": 72.15, "2": 68.37, "3": 76.59, "4": 92.39, "5": 60.19,
      "6": 80.42, "7": 89.46, "8": 82.03, "9": 83.61, "10": 84.36,
      "11": 47.85, "12": 76.50, "13": 50.75, "14": 70.45, "15": 68.36,
      "16": 64.44, "17": 84.08, "18": 76.20, "19": 81.75, "20": 68.62,
      "21": 24.26, "22": 65.29, "88": 98.51 // Total LF (51.71 + 46.80)
    };

    const rawBlok = data.blok ? data.blok.toString().replace(/[^0-9]/g, '') : '';
    const blokNum = parseInt(rawBlok, 10);
    const cleanBlok = isNaN(blokNum) ? '' : blokNum.toString();
    
    let pkt = "001";
    if (blokNum >= 18 && blokNum <= 22) pkt = "002";
    else if (blokNum === 88) pkt = "003";
    
    const now = new Date();
    
    // Handle date from request or generate current date
    let dateStr = data.tarikh;
    if (dateStr) {
      dateStr = dateStr.trim();
      if (dateStr.includes('/')) {
        let [d, m, y] = dateStr.split('/');
        if (y && y.length === 2) y = '20' + y;
        dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
          // Keep as is
        } else if (parts[2] && parts[2].length === 4) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    
    if (!dateStr || !dateStr.includes('-')) {
      // Gunakan waktu tempatan (Malaysia) untuk ketepatan Hari Ini (UTC+8)
      dateStr = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    }

    const tanValue = parseFloat(data.tan) || 0;
    const rm_mt = parseFloat(data.rm_mt) || 0;
    const hasil_rm = parseFloat((tanValue * rm_mt).toFixed(2));
    const luasBlok = BLOK_AREAS[cleanBlok] || 1; // Use cleanBlok for lookup
    const thekValue = tanValue / luasBlok;

    const payload = {
      no_resit: data.no_resit.trim().toUpperCase(),
      no_akaun_terima: data.no_akaun_terima?.trim().toUpperCase() || '',
      no_lori: data.no_lori.trim().toUpperCase(),
      no_seal: data.no_seal?.trim().toUpperCase() || '',
      no_nota_hantaran: data.no_nota_hantaran?.trim().toUpperCase() || '',
      kpg: data.kpg?.trim().toUpperCase() || '',
      blok: cleanBlok, // Store cleaned blok string
      peringkat: data.is_efb ? "EFB" : `PKT ${pkt}`,
      tan: tanValue,
      muda: parseInt(data.muda) || 0,
      reject: parseFloat(data.reject) || 0,
      sample: parseInt(data.sample) || 0,
      rm_mt: rm_mt,
      hasil_rm: hasil_rm,
      thek: parseFloat(thekValue.toFixed(4)), // Simpan dengan 4 tempat perpuluhan
      tarikh: dateStr,
      masa_masuk: data.masa_masuk || now.toLocaleTimeString('en-GB', { hour12: false }),
      created_at: now.toISOString()
    };

    let dbSuccess = false;

    // 1. Supabase Insert
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error: sbError } = await supabase.from('hantaran_hasil').insert([payload]);
        if (sbError) {
          console.error("Supabase Error:", sbError);
          if (sbError.code === '23505') { // Unique violation
            return res.status(409).json({ success: false, error: `No. Resit ${payload.no_resit} sudah wujud dalam sistem.` });
          }
          throw new Error(`Ralat Pangkalan Data: ${sbError.message}`);
        }
        dbSuccess = true;
      } catch (sbErr: any) {
        console.error("Database operation failed:", sbErr.message);
        return res.status(500).json({ success: false, error: sbErr.message });
      }
    } else {
      console.warn("Supabase not configured. Skipping database insert.");
    }

    res.json({ 
      success: true, 
      ref: payload.no_resit,
      sync: { db: dbSuccess }
    });
  } catch (err: any) {
    console.error("Unexpected server error:", err);
    res.status(500).json({ success: false, error: "Ralat pelayan dalaman. Sila cuba sebentar lagi." });
  }
});

router.get("/hantaran", async (req, res) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: records, error } = await supabase
        .from('hantaran_hasil')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) {
        console.error("Supabase Fetch Error:", error);
        return res.status(500).json({ error: "Gagal mengambil data dari pangkalan data." });
      }
      console.log(`Fetched ${records?.length || 0} records from hantaran_hasil`);
      res.json(records);
    } else {
      console.log("Supabase not configured, returning empty array");
      res.json([]);
    }
  } catch (err: any) { 
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Ralat rangkaian atau pelayan." }); 
  }
});

router.post("/annual-yield", async (req, res) => {
  try {
    const { year, yield: yieldVal } = req.body;
    if (!year) return res.status(400).json({ error: "Tahun diperlukan." });

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('annual_yield')
        .upsert({ 
          year: parseInt(year), 
          yield: parseFloat(yieldVal) || 0
        }, { onConflict: 'year' });

      if (error) throw error;
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Supabase tidak dikonfigurasi." });
    }
  } catch (err: any) {
    console.error("Annual yield save error:", err.message || err);
    res.status(500).json({ error: "Gagal menyimpan data tahunan." });
  }
});

router.get("/annual-yield", async (req, res) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('annual_yield')
        .select('*')
        .order('year', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache')) return res.json([]);
        throw error;
      }
      res.json(data);
    } else {
      res.json([]);
    }
  } catch (err: any) {
    console.error("Annual yield fetch error:", err.message || err);
    res.status(500).json({ error: "Gagal mengambil data tahunan." });
  }
});

router.delete("/hantaran/all", async (req, res) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('hantaran_hasil')
        .delete()
        .neq('no_resit', '0'); // Delete all rows where no_resit is not '0' (effectively all)

      if (error) throw error;
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: "Supabase tidak dikonfigurasi." });
    }
  } catch (err: any) {
    console.error("Delete all error:", err.message || err);
    res.status(500).json({ success: false, error: "Gagal memadam semua data." });
  }
});

router.delete("/hantaran/:no_resit", async (req, res) => {
  try {
    const { no_resit } = req.params;
    if (!no_resit) return res.status(400).json({ success: false, error: "No. Resit diperlukan." });

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('hantaran_hasil')
        .delete()
        .eq('no_resit', no_resit.toUpperCase());

      if (error) throw error;
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: "Supabase tidak dikonfigurasi." });
    }
  } catch (err: any) {
    console.error("Delete error:", err.message || err);
    res.status(500).json({ success: false, error: "Gagal memadam data." });
  }
});

router.get("/config-check", (req, res) => {
  res.json({
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    googleSheets: false,
    env: process.env.NODE_ENV || 'development'
  });
});

router.post("/export/pptx", async (req, res) => {
  console.log("POST /api/export/pptx hit");
  try {
    const payload = req.body;
    if (!payload) {
      console.error("No payload received");
      return res.status(400).json({ success: false, error: "No payload received" });
    }
    const { reportTitle, generatedAt, filters, summaryCards, charts, tables, branding } = payload;
    console.log("Payload parsed, reportTitle:", reportTitle);

    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new (PptxGenJS as any)();
    console.log("PptxGenJS instance created");
    
    // Set Presentation Metadata & Layout
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "FPMSB TUNGGAL Intelligence Engine";
    pptx.subject = "Plantation Analytics Report";
    pptx.title = reportTitle || "Report";
    pptx.company = branding?.companyName || "FPMSB TUNGGAL";

    // 1. Title Slide
    let slide = pptx.addSlide();
    slide.background = { color: (branding?.primaryColor || "#064E3B").replace('#', '') };
    slide.addText(branding?.companyName || "FPMSB TUNGGAL", { 
      x: 0.5, y: 1.5, w: 12, h: 1, 
      fontSize: 44, bold: true, color: "FFFFFF", align: "center" 
    });
    slide.addText(reportTitle || "Laporan Analitik", { 
      x: 0.5, y: 2.5, w: 12, h: 0.5, 
      fontSize: 24, bold: true, color: "FFFFFF", align: "center" 
    });
    slide.addText(`Tempoh: ${filters?.period || "N/A"}`, { 
      x: 0.5, y: 3.5, w: 12, h: 0.5, 
      fontSize: 14, color: "FFFFFF", align: "center" 
    });
    slide.addText(`Dijana pada: ${generatedAt || new Date().toLocaleString()}`, { 
      x: 0.5, y: 4.2, w: 12, h: 0.5, 
      fontSize: 10, color: "A7F3D0", align: "center" 
    });

    // 2. Summary Slide
    if (summaryCards && summaryCards.length > 0) {
      slide = pptx.addSlide();
      slide.addText("Ringkasan Prestasi", { 
        x: 0.5, y: 0.4, w: 4, h: 0.4, 
        fontSize: 20, bold: true, color: (branding?.primaryColor || "#064E3B").replace('#', '') 
      });
      
      const rows: any[][] = [
        [
          { text: "Metrik", options: { bold: true, fill: "F1F5F9" } }, 
          { text: "Nilai", options: { bold: true, fill: "F1F5F9" } }, 
          { text: "Info Tambahan", options: { bold: true, fill: "F1F5F9" } }
        ]
      ];
      summaryCards.forEach((card: any) => {
        rows.push([card.label, card.value, card.subValue || "-"]);
      });

      slide.addTable(rows, { 
        x: 0.5, y: 1.0, w: 12, 
        border: { pt: 1, color: "E2E8F0" }, 
        fill: { color: "F8FAFC" }, 
        fontSize: 11, align: "center" 
      });
    }

    // 3. Charts Slides
    if (charts && charts.length > 0) {
      charts.forEach((chart: any) => {
        slide = pptx.addSlide();
        slide.addText(chart.title, { 
          x: 0.5, y: 0.4, w: 12, h: 0.4, 
          fontSize: 20, bold: true, color: (branding?.primaryColor || "#064E3B").replace('#', '') 
        });
        
        const chartTypeMap: any = {
          'bar': pptx.ChartType.bar,
          'line': pptx.ChartType.line,
          'pie': pptx.ChartType.pie
        };

        slide.addChart(chartTypeMap[chart.type] || pptx.ChartType.bar, chart.data, {
          x: 0.5, y: 1.0, w: 12, h: 5.5,
          ...chart.options
        });
      });
    }

    // 4. Tables Slides
    if (tables && tables.length > 0) {
      tables.forEach((table: any) => {
        slide = pptx.addSlide();
        slide.addText(table.title, { 
          x: 0.5, y: 0.4, w: 12, h: 0.4, 
          fontSize: 20, bold: true, color: (branding?.primaryColor || "#064E3B").replace('#', '') 
        });
        
        const tableRows = [
          table.headers.map((h: string) => ({ 
            text: h, 
            options: { fill: (branding?.primaryColor || "#064E3B").replace('#', ''), color: "FFFFFF", bold: true } 
          })),
          ...table.rows
        ];

        slide.addTable(tableRows, { 
          x: 0.5, y: 1.0, w: 12, 
          fontSize: 10, align: "center", 
          border: { pt: 1, color: "E2E8F0" } 
        });
      });
    }

    console.log("Generating buffer...");
    const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
    console.log("Buffer generated, size:", buffer.length);
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename=Laporan_${(filters?.period || "Export").replace(/ /g, '_')}.pptx`);
    res.send(buffer);
    console.log("Response sent");

  } catch (err: any) {
    console.error("PPTX Generation Error:", err);
    res.status(500).json({ success: false, error: "Gagal menjana PowerPoint." });
  }
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/api", router);

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  if (req.path.startsWith('/api')) {
    console.error("API Error handler:", err);
    return res.status(500).json({ success: false, error: err.message || "Ralat pelayan dalaman." });
  }
  next(err);
});

// API 404 handler - only for /api routes
app.use("/api", (req, res) => {
  console.warn(`API 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: `Laluan API ${req.method} ${req.url} tidak dijumpai.` });
});

export default app;
