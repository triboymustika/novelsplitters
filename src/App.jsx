import React, { useState } from 'react';
import { Sparkles, Download, Copy, Loader2, CheckCircle2, AlertCircle, Facebook, Instagram } from 'lucide-react';

export default function App() {
  const [chapterText, setChapterText] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const [parts, setParts] = useState([]);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');

  const handleApiKeyChange = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleGenerate = async () => {
    if (!apiKey || apiKey.trim() === "") {
      setError("API Key Gemini belum dimasukkan! Silakan isi kolom API Key di atas.");
      return;
    }

    if (!chapterText.trim() || chapterText.trim().length < 100) {
      setError("Silakan masukkan teks cerita setidaknya 100 karakter.");
      return;
    }

    setIsSplitting(true);
    setError('');
    setParts([]);

    try {
      // Menggunakan model Gemini 3 Flash Preview (Sesuai yang tembus di akun lu)
      const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey.trim()}`;
      
      const prompt = `
        Kamu adalah editor cerita super kejam. Potong bab cerita di bawah menjadi TEPAT 3 bagian berurutan.
        AI lain selalu gagal mematuhi batas panjang cerita. BUKTIKAN KAMU BISA!
        
        CERITA ASLI:
        """
        ${chapterText}
        """
        
        ATURAN MUTLAK KEPANJANGAN CERITA (JIKA DILANGGAR, SISTEM AKAN RUSAK):
        1. FACEBOOK (fb): HARUS 100% SAMA PERSIS dengan aslinya (Jangan dibuang 1 kata pun).
        2. INSTAGRAM (ig): RINGKAS SECARA EKSTREM! WAJIB DI BAWAH 250 KATA (sekitar 1500 karakter). Buang semua deskripsi panjang, ambil dialog inti dan konflik utamanya saja!
        3. TIKTOK (tt): RINGKAS! WAJIB DI BAWAH 400 KATA (sekitar 2500 karakter).
        
        FORMAT WAJIB:
        - Pisahkan setiap paragraf/dialog dengan enter ganda (\n\n).
        - Buat Hook (awal) & CTA (akhir) untuk masing-masing (fb, ig, tt).
        - imagePrompt: Deskripsi visual BAHASA INGGRIS tentang suasana part ini. Tulis juga di ujung kalimatnya: "With cinematic typography overlay text saying 'PART {nomor part}' and '{hook pendek}'."
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
                fb: { type: "OBJECT", properties: { hook: { type: "STRING" }, storyText: { type: "STRING" }, cta: { type: "STRING" } } },
                ig: { type: "OBJECT", properties: { hook: { type: "STRING" }, storyText: { type: "STRING" }, cta: { type: "STRING" } } },
                tt: { type: "OBJECT", properties: { hook: { type: "STRING" }, storyText: { type: "STRING" }, cta: { type: "STRING" } } },
                imagePrompt: { type: "STRING" }
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
        throw new Error("Gagal memecah teks dari server AI Google.");
      }
      
      const textResult = await textResponse.json();
      let rawJson = textResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson.includes("```")) rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsedParts = JSON.parse(rawJson);
      
      const initializedParts = parsedParts.map(p => ({
        ...p,
        imageUrl: null,
        isImageLoading: true,
        imageError: false
      }));

      setParts(initializedParts);
      setIsSplitting(false);

      // Trigger pembuatan gambar dengan API gratis alternatif
      initializedParts.forEach((part, index) => generateImageForPart(part, index));

    } catch (err) {
      console.error("Error:", err);
      setError(`Gagal: ${err.message}`);
      setIsSplitting(false);
    }
  };

  const generateImageForPart = async (part, index) => {
    // Karena API Google Key lu belum dapet izin generate gambar, kita pakai Pollinations tanpa watermark.
    // Ditambahkan seed random agar gambarnya unik setiap kali direfresh.
    const randomSeed = Math.floor(Math.random() * 999999);
    
    // Perintah disesuaikan agar AI berusaha membuat tipografi di dalam gambarnya.
    const finalPrompt = `Masterpiece digital art, hyperrealistic, dramatic lighting, 9:16 vertical poster. ${part.imagePrompt}. Ensure the text is visible.`;
    
    const encodedPrompt = encodeURIComponent(finalPrompt);
    // Menggunakan parameter nologo=true (berusaha menghilangkan watermark) & seed random
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=720&height=1280&nologo=true&seed=${randomSeed}`;

    // Kita preload gambarnya di background untuk ngecek apakah berhasil dimuat
    const img = new Image();
    img.src = imageUrl;
    
    img.onload = () => {
      setParts(prevParts => {
        const newParts = [...prevParts];
        newParts[index].imageUrl = imageUrl;
        newParts[index].isImageLoading = false;
        newParts[index].imageError = false;
        return newParts;
      });
    };

    img.onerror = () => {
      setParts(prevParts => {
        const newParts = [...prevParts];
        newParts[index].isImageLoading = false;
        newParts[index].imageError = true;
        return newParts;
      });
    };
  };

  const handleCopyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Gagal copy", err);
    }
  };

  const handleDownloadImage = async (imageUrl, partNumber) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Story_Part_${partNumber}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Gagal mengunduh gambar. Silakan klik kanan gambarnya dan pilih 'Save Image As...'.");
    }
  };

  const handlePromptChange = (text, index) => {
    setParts(prevParts => {
      const newParts = [...prevParts];
      newParts[index].imagePrompt = text;
      return newParts;
    });
  };

  const PlatformColumn = ({ title, icon, data, partIndex, platformKey }) => {
    const fullText = `${data.hook}\n\n${data.storyText}\n\n${data.cta}`;
    const copyId = `${platformKey}-${partIndex}`;
    
    // Indikator visual jika karakter kepanjangan
    const isTooLong = (platformKey === 'ig' && fullText.length > 2200) || (platformKey === 'tt' && fullText.length > 3200);
    
    return (
      <div className={`flex flex-col bg-[#0F172A] rounded-xl border ${isTooLong ? 'border-orange-500/50' : 'border-slate-700/50'} overflow-hidden h-full`}>
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
        <div className="p-2 border-t border-slate-700/50 bg-slate-800/30 text-center flex justify-center items-center gap-2">
          <span className={`text-[10px] ${isTooLong ? 'text-orange-400 font-bold' : 'text-slate-500'}`}>
            {fullText.length} karakter
          </span>
          {isTooLong && <span className="text-[10px] text-orange-400 border border-orange-400/50 px-1.5 rounded-sm">⚠️ Kepanjangan</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-cyan-500/30 pb-20">
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
        <div className="bg-[#1E293B] rounded-2xl p-6 shadow-xl border border-slate-700/50 mb-6 max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 w-full space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                API Key Gemini (Wajib diisi)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Paste API Key Gemini di sini..."
                className="w-full bg-[#0F172A] border border-slate-600 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder:text-slate-500 text-sm"
              />
            </div>
          </div>
        </div>

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

        {parts.length > 0 && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Hasil Pecahan Cerita</h2>
              <p className="text-slate-400">Batasan jumlah kata telah diterapkan secara ekstrem.</p>
            </div>
            
            {parts.map((part, index) => (
              <div key={index} className="bg-[#1E293B] rounded-2xl p-6 shadow-2xl border border-slate-700/50 relative mt-8 sm:mt-0">
                
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-lg border border-cyan-400/30 whitespace-nowrap z-10">
                  PART {part.partNumber}
                </div>

                <div className="mt-6 sm:mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  
                  <PlatformColumn title="Facebook (100% Asli)" icon={<Facebook className="w-4 h-4 text-blue-400" />} data={part.fb} partIndex={index} platformKey="fb" />
                  <PlatformColumn title="Instagram (Super Ringkas)" icon={<Instagram className="w-4 h-4 text-pink-400" />} data={part.ig} partIndex={index} platformKey="ig" />
                  <PlatformColumn title="TikTok (Ringkas)" icon={<svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>} data={part.tt} partIndex={index} platformKey="tt" />

                  <div className="flex flex-col bg-[#162032] rounded-xl border border-slate-700/50 p-4 h-full items-center justify-between">
                    <div className="w-full flex items-center justify-center gap-2 mb-4 text-slate-300 font-medium text-sm">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      Visual Cover (9:16)
                    </div>

                    <div className="relative w-full max-w-[220px] aspect-[9/16] bg-[#0F172A] rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center mb-4 shrink-0 mx-auto group">
                      {part.isImageLoading ? (
                        <div className="flex flex-col items-center gap-3 text-slate-400 p-4 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                          <p className="text-sm font-medium animate-pulse text-cyan-400">Melukis Cover...</p>
                        </div>
                      ) : part.imageError ? (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-red-900/10 p-4 text-center">
                          <AlertCircle className="w-10 h-10 text-red-400 mb-2 opacity-80" />
                          <p className="text-xs font-semibold text-red-400 mb-1">Gagal Muat Gambar</p>
                        </div>
                      ) : (
                        <>
                          <img 
                            src={part.imageUrl} 
                            alt={`Story part ${part.partNumber}`} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          {/* CSS Overlay untuk teks PART agar terlihat estetik */}
                          <div className="absolute top-6 left-0 right-0 text-center drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] pointer-events-none">
                            <h3 className="text-3xl font-black text-white uppercase tracking-widest" style={{ textShadow: '2px 2px 4px #000, -2px -2px 4px #000, 2px -2px 4px #000, -2px 2px 4px #000' }}>
                              PART {part.partNumber}
                            </h3>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="w-full space-y-2">
                      <div className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-3">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                          Prompt Gambar:
                        </label>
                        <textarea
                          value={part.imagePrompt}
                          onChange={(e) => handlePromptChange(e.target.value, index)}
                          className="w-full bg-[#0F172A] border border-slate-700 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 min-h-[60px] resize-y custom-scrollbar mb-2"
                        />
                        <button 
                          onClick={() => {
                            setParts(prev => {
                              const newP = [...prev];
                              newP[index].isImageLoading = true;
                              return newP;
                            });
                            generateImageForPart(part, index);
                          }}
                          className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3 h-3" />
                          Regenerate Gambar
                        </button>
                      </div>

                      <button
                        onClick={() => handleDownloadImage(part.imageUrl, part.partNumber)}
                        disabled={part.isImageLoading || !part.imageUrl}
                        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-white flex items-center justify-center gap-2 transition-all text-sm shadow-md"
                      >
                        <Download className="w-4 h-4" />
                        Download 
                      </button>
                    </div>
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
