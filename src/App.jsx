import React, { useState } from 'react';
import { Sparkles, Download, Copy, Loader2, CheckCircle2, AlertCircle, Facebook, Instagram } from 'lucide-react';

export default function App() {
  const [chapterText, setChapterText] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [parts, setParts] = useState([]);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // ⚠️ MASUKKAN API KEY GEMINI LU DI SINI (Di dalam tanda kutip)
  const API_KEY = "AQ.Ab8RN6JY91pl5KgNlxBC53oiuYUE3979F_cvvLd2Nd_yLlAS6A"; 

  const handleGenerate = async () => {
    // Validasi API Key
    if (!API_KEY || API_KEY === "MASUKKAN_API_KEY_GEMINI_DI_SINI" || API_KEY === "") {
      setError("API Key Gemini belum dimasukkan! Silakan edit baris 12 di GitHub dan masukkan API Key lu.");
      return;
    }

    if (!chapterText.trim()) {
      setError("Silakan masukkan teks cerita terlebih dahulu.");
      return;
    }

    if (chapterText.trim().length < 100) {
      setError("Teks cerita terlalu pendek. Masukkan setidaknya 100 karakter.");
      return;
    }

    setIsSplitting(true);
    setError('');
    setParts([]);

    try {
      // 1. Generate text parts using Gemini 1.5 Flash (Versi Stabil)
      const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
      
      const prompt = `
        Kamu adalah editor ahli untuk konten cerita Multi-Platform (Facebook, Instagram, TikTok). 
        Tugas UTAMAMU adalah MEMOTONG teks cerita berikut menjadi TEPAT 3 bagian berurutan.
        
        CERITA ASLI:
        """
        ${chapterText}
        """
        
        ATURAN MUTLAK & BATASAN KARAKTER:
        1. FACEBOOK (fb): HARUS 100% SAMA PERSIS dengan teks asli jika part 1, 2, 3 digabung. Dilarang memotong/meringkas 1 kata pun.
        2. INSTAGRAM (ig): WAJIB di antara 1500 hingga 2000 karakter. Jika terpaksa diringkas, potong bagian narasi, JANGAN buang dialog.
        3. TIKTOK (tt): WAJIB di antara 2000 hingga 3000 karakter.
        4. FORMAT (Semua Platform): Pisahkan setiap paragraf dan dialog dengan enter ganda (\\n\\n) agar teks berongga.
        5. HOOK & CTA: Buat Hook (awal) dan CTA (akhir) BERBEDA tiap platform. (FB: Naratif, IG: Estetik/Tanya pendapat, TT: Clickbait/Bikin penasaran).
        6. PROMPT GAMBAR (imagePrompt): 1 gambar per part. Deskripsi visual murni BAHASA INGGRIS tentang adegan/suasana di part tersebut. WAJIB SFW (Safe for Work), tanpa teks, tanpa darah.
      `;

      const textPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                partNumber: { type: "NUMBER" },
                fb: {
                  type: "OBJECT",
                  properties: { hook: { type: "STRING" }, storyText: { type: "STRING" }, cta: { type: "STRING" } }
                },
                ig: {
                  type: "OBJECT",
                  properties: { hook: { type: "STRING" }, storyText: { type: "STRING" }, cta: { type: "STRING" } }
                },
                tt: {
                  type: "OBJECT",
                  properties: { hook: { type: "STRING" }, storyText: { type: "STRING" }, cta: { type: "STRING" } }
                },
                imagePrompt: { type: "STRING", description: "Safe English visual prompt without text" }
              },
              required: ["partNumber", "fb", "ig", "tt", "imagePrompt"]
            }
          }
        }
      };

      const textResponse = await fetch(textApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textPayload)
      });

      if (!textResponse.ok) {
        const errData = await textResponse.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Terjadi kesalahan pada server AI Google. Coba lagi.");
      }
      
      const textResult = await textResponse.json();
      let rawJson = textResult.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawJson) throw new Error("AI tidak mengembalikan teks format yang sesuai.");
      
      // Bersihkan jika AI membalas dengan format markdown markdown ```json
      if (rawJson.includes("```")) {
        rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      
      const parsedParts = JSON.parse(rawJson);
      
      const initializedParts = parsedParts.map(p => ({
        ...p,
        imageUrl: null,
        isImageLoading: true,
        imageError: false
      }));

      setParts(initializedParts);
      setIsSplitting(false);

      // 2. Generate images for each part (Menggunakan Pollinations AI - Gratis & Stabil)
      initializedParts.forEach((part, index) => {
        generateImageForPart(part, index);
      });

    } catch (err) {
      console.error("Generate Error:", err);
      setError(`Gagal memecah cerita: ${err.message}`);
      setIsSplitting(false);
    }
  };

  const generateImageForPart = async (part, index) => {
    try {
      // Menggunakan Pollinations AI dengan seed acak agar gambar tidak nyangkut di cache
      const seed = Math.floor(Math.random() * 100000);
      const encodedPrompt = encodeURIComponent(`High quality digital illustration for a dramatic story. Scene: ${part.imagePrompt}. Cinematic lighting, highly detailed. Aspect ratio 9:16.`);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=576&height=1024&nologo=true&seed=${seed}`;

      // Simulasi loading agar transisi visual lebih natural
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verifikasi apakah link gambar aktif (opsional tapi bagus untuk mencegah error)
      const testImage = new Image();
      testImage.src = imageUrl;
      
      testImage.onload = () => {
        setParts(prevParts => {
          const newParts = [...prevParts];
          newParts[index].imageUrl = imageUrl;
          newParts[index].isImageLoading = false;
          newParts[index].imageError = false;
          return newParts;
        });
      };

      testImage.onerror = () => {
        throw new Error("Gagal memuat gambar dari server");
      };

    } catch (err) {
      console.error("Image generation failed for part", part.partNumber, err);
      setParts(prevParts => {
        const newParts = [...prevParts];
        newParts[index].isImageLoading = false;
        newParts[index].imageError = true;
        return newParts;
      });
    }
  };

  const handleCopyText = async (text, id) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API not available");
      }
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (execErr) {
        console.error('Fallback copy failed', execErr);
      } finally {
        textArea.remove();
      }
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePromptChange = (text, index) => {
    setParts(prevParts => {
      const newParts = [...prevParts];
      newParts[index].imagePrompt = text;
      return newParts;
    });
  };

  const handleDownloadImage = async (imageUrl, partNumber) => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Story_Part_${partNumber}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // Fallback jika diblokir browser CORS
      window.open(imageUrl, '_blank');
    }
  };

  const PlatformColumn = ({ title, icon, data, partIndex, platformKey }) => {
    const fullText = `${data.hook}\n\n${data.storyText}\n\n${data.cta}`;
    const copyId = `${platformKey}-${partIndex}`;
    
    return (
      <div className="flex flex-col bg-[#0F172A] rounded-xl border border-slate-700/50 overflow-hidden h-full">
        <div className="p-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
            {icon}
            {title}
          </div>
          <button
            onClick={() => handleCopyText(fullText, copyId)}
            className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
          >
            {copiedId === copyId ? (
              <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy</>
            )}
          </button>
        </div>
        <div className="p-4 flex-1">
          <textarea 
            readOnly 
            className="w-full h-full min-h-[350px] bg-transparent resize-none outline-none text-slate-300 text-sm leading-relaxed custom-scrollbar"
            value={fullText}
          />
        </div>
        <div className="p-2 border-t border-slate-700/50 bg-slate-800/30 text-center">
          <span className={`text-[10px] ${fullText.length < 1500 && platformKey === 'ig' ? 'text-red-400' : 'text-slate-500'}`}>
            {fullText.length} karakter
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-cyan-500/30 pb-20">
      {/* Navbar */}
      <nav className="bg-[#1E293B] border-b border-slate-700/50 sticky top-0 z-50 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold flex items-baseline gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">Novel Splitter</span>
              <span className="text-sm font-medium text-slate-400 hidden sm:inline-block">by Daboy</span>
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Section */}
        <div className="bg-[#1E293B] rounded-2xl p-6 shadow-xl border border-slate-700/50 mb-10 max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            1. Masukkan Bab Cerita (Naskah Asli)
          </h2>
          <textarea
            value={chapterText}
            onChange={(e) => setChapterText(e.target.value)}
            placeholder="Paste naskah cerita lengkap (1 Bab) di sini..."
            className="w-full h-40 bg-[#0F172A] border border-slate-600 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-y transition-all placeholder:text-slate-500 leading-relaxed custom-scrollbar"
            disabled={isSplitting}
          />
          
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 inline-block w-fit">
              {chapterText.length} karakter
            </p>
            <button
              onClick={handleGenerate}
              disabled={isSplitting || !chapterText.trim()}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-white shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              {isSplitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses Cerita...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Multi-Platform & Gambar
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-start sm:items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 sm:mt-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {parts.length > 0 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Hasil Pecahan Cerita</h2>
              <p className="text-slate-400">Telah disesuaikan batas karakternya (FB: Asli, IG: 1.5K-2K, TT: 2K-3K)</p>
            </div>
            
            {parts.map((part, index) => (
              <div key={index} className="bg-[#1E293B] rounded-2xl p-6 shadow-2xl border border-slate-700/50 relative mt-8 sm:mt-0">
                
                {/* Part Header */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-lg border border-cyan-400/30 whitespace-nowrap z-10">
                  PART {part.partNumber}
                </div>

                <div className="mt-6 sm:mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  
                  {/* Column 1: Facebook */}
                  <PlatformColumn 
                    title="Facebook (100% Asli)" 
                    icon={<Facebook className="w-4 h-4 text-blue-400" />}
                    data={part.fb}
                    partIndex={index}
                    platformKey="fb"
                  />

                  {/* Column 2: Instagram */}
                  <PlatformColumn 
                    title="Instagram (1.5K - 2K)" 
                    icon={<Instagram className="w-4 h-4 text-pink-400" />}
                    data={part.ig}
                    partIndex={index}
                    platformKey="ig"
                  />

                  {/* Column 3: TikTok */}
                  <PlatformColumn 
                    title="TikTok (2K - 3K)" 
                    icon={<svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>}
                    data={part.tt}
                    partIndex={index}
                    platformKey="tt"
                  />

                  {/* Column 4: Image Generator */}
                  <div className="flex flex-col bg-[#162032] rounded-xl border border-slate-700/50 p-4 h-full items-center justify-between">
                    <div className="w-full flex items-center justify-center gap-2 mb-4 text-slate-300 font-medium text-sm">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      Visual Cover (9:16)
                    </div>

                    <div className="relative w-full max-w-[220px] aspect-[9/16] bg-[#0F172A] rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center mb-4 shrink-0 mx-auto">
                      {part.isImageLoading ? (
                        <div className="flex flex-col items-center gap-3 text-slate-400 p-4 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                          <p className="text-sm font-medium animate-pulse">Generating...</p>
                        </div>
                      ) : part.imageError ? (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-red-900/10 p-4 text-center">
                          <AlertCircle className="w-10 h-10 text-red-400 mb-2 opacity-80" />
                          <p className="text-xs font-semibold text-red-400 mb-1">Gagal Muat Gambar</p>
                        </div>
                      ) : (
                        <img 
                          src={part.imageUrl} 
                          alt={`Story part ${part.partNumber}`} 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {part.imageError ? (
                      <div className="w-full bg-red-950/30 border border-red-900/50 rounded-xl p-3 mt-auto">
                        <label className="block text-[10px] font-medium text-red-300 mb-1.5 uppercase tracking-wider">
                          Edit prompt gambar:
                        </label>
                        <textarea
                          value={part.imagePrompt}
                          onChange={(e) => handlePromptChange(e.target.value, index)}
                          className="w-full bg-[#0F172A] border border-red-900/50 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-red-500 min-h-[60px] resize-y mb-2 custom-scrollbar"
                        />
                        <button 
                          onClick={() => generateImageForPart(part, index)}
                          className="w-full py-2 bg-red-900/40 hover:bg-red-800/60 text-red-200 border border-red-800/50 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Coba Lagi
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownloadImage(part.imageUrl, part.partNumber)}
                        disabled={part.isImageLoading || !part.imageUrl}
                        className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all mt-auto text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download 
                      </button>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
}
