'use client';

import { useState, useRef } from 'react';
// import LightRays from '../components/LightRays'; // Replaced by GeometricBackground
import GeometricBackground from '../components/GeometricBackground';
import HealthChat from '../components/HealthChat';
import Link from 'next/link';
import { Circle } from 'lucide-react';

export default function Home() {
  const [symptoms, setSymptoms] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [whoData, setWhoData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showPanel, setShowPanel] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // TTS State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }

  // Chat updates analysis -> Panel slides in
  const handleChatUpdate = (newMessage: string) => {
    const updatedSymptoms = symptoms ? `${symptoms}. ${newMessage}` : newMessage;
    setSymptoms(updatedSymptoms);
    handleAnalyze(updatedSymptoms);
  };

  const handleAnalyze = async (manualSymptoms?: string) => {
    const textToAnalyze = typeof manualSymptoms === 'string' ? manualSymptoms : symptoms;

    if (!textToAnalyze.trim()) return;

    setLoading(true);
    setError('');
    setWhoData([]);
    stopAudio();

    try {
      // Step 1: AI Analysis
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: textToAnalyze, language }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        throw new Error(analyzeData.error || 'Failed to analyze symptoms');
      }

      setResult(analyzeData);
      setShowPanel(true); // Open panel on result

      // Step 2: WHO Scraping
      let whoQuery = textToAnalyze.split(' ').slice(0, 3).join(' ');
      if (analyzeData.probable_causes && analyzeData.probable_causes.length > 0) {
        whoQuery = analyzeData.probable_causes[0];
      }

      const whoResponse = await fetch(`/api/scrape/who?query=${encodeURIComponent(whoQuery)}`);
      const whoJson = await whoResponse.json();
      setWhoData(whoJson.results || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToSTT(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      // More friendly error for missing keys
      if (err.message && err.message.includes('Missing IBM STT')) {
        setError('Speech-to-Text API keys are missing. Please check configuration.');
      } else {
        setError('Could not access microphone or STT service failed.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToSTT = async (audioBlob: Blob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Speech to text failed');

      if (data.transcript) {
        // Feed voice input into chat input field
        setTranscription(data.transcript);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const playAnalysis = async () => {
    if (!result) return;
    const textToRead = `Analysis: ${result.analysis}. Probable causes include ${result.probable_causes.join(', ')}. Urgency level is ${result.urgency_level}. Medical advice: ${result.medical_advice}`;

    try {
      setIsPlaying(true);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead }),
      });

      if (!response.ok) throw new Error('Failed to generate speech');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();

    } catch (err: any) {
      console.error("TTS Error", err);
      if (err.message && err.message.includes('Missing IBM TTS')) {
        setError('Text-to-Speech API keys are missing. Please check configuration.');
      } else {
        setError(err.message);
      }
      setIsPlaying(false);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'medium': return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 'low': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  return (
    <GeometricBackground>
      <div className="relative z-10 w-full h-full flex flex-col md:flex-row min-h-screen">

        {/* CENTER: Chat Interface (Takes full width if panel closed, shifts if open) */}
        <div className={`flex-1 flex flex-col h-full transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] p-4 md:p-8 ${showPanel ? 'md:w-[55%]' : 'w-full max-w-5xl mx-auto'}`}>

          {/* Header / Hero - Compact Row Layout */}
          <header className="flex-shrink-0 flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight whitespace-nowrap">
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">Health</span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-2">Assistant</span>
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-200 uppercase tracking-widest font-semibold">
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></span>
                  IBM Granite Powered
                </span>
              </div>
              <p className="text-white/50 text-xs md:text-sm font-light max-w-lg leading-relaxed">
                Your advanced AI medical companion. Describe symptoms for real-time analysis, potential causes, and WHO-backed health resources.
              </p>

              {/* Mobile Badge */}
              <span className="md:hidden inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-200 uppercase tracking-widest font-semibold mt-1">
                IBM Granite Powered
              </span>
            </div>

            {/* Top Right Controls & WHO Card Container */}
            <div className="flex items-center gap-3 self-end md:self-auto min-w-fit">
              <Link href="/drug-info" className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs flex items-center gap-2 text-white/70 whitespace-nowrap">
                💊 Drug Info
              </Link>

              {/* WHO Quick Card (Floating/Popover style) */}
              {whoData.length > 0 && !showPanel && (
                <div className="absolute top-20 right-8 z-50 w-64 rounded-xl bg-[#0a0a0a]/90 border border-white/10 backdrop-blur-xl p-4 shadow-2xl animate-in slide-in-from-top-2 fade-in">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1 h-1 bg-blue-400 rounded-full"></span> WHO Insight
                    </span>
                    <button onClick={() => setWhoData([])} className="text-white/20 hover:text-white/80 text-xs transition-colors">✕</button>
                  </div>
                  <h4 className="text-sm font-medium text-white/90 mb-1 line-clamp-2">{whoData[0].title}</h4>
                  <a href={whoData[0].link} target="_blank" className="text-[10px] flex items-center gap-1 text-blue-300 hover:text-blue-200 transition-colors mt-2">
                    View Source ↗
                  </a>
                </div>
              )}
            </div>
          </header>

          {/* Chat Container - Maximized Height */}
          <div className="flex-1 rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative overflow-hidden flex flex-col min-h-0 ring-1 ring-white/5 mx-auto w-full">

            {/* Chat Controls (Mic/Lang) */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm border border-indigo-500/30">🤖</div>
                <h3 className="font-medium text-white/80">Consultation</h3>
              </div>
              <div className="flex gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg text-xs text-white/80 px-2 py-1 outline-none cursor-pointer hover:bg-black/60 transition-colors"
                >
                  <option value="English" className="bg-[#0a0a0a] text-white">EN</option>
                  <option value="Spanish" className="bg-[#0a0a0a] text-white">ES</option>
                  <option value="French" className="bg-[#0a0a0a] text-white">FR</option>
                  <option value="Hindi" className="bg-[#0a0a0a] text-white">HI</option>
                </select>

                <button
                  onClick={() => setShowPanel(!showPanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showPanel
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <span className="text-lg">📋</span>
                  <span className="hidden sm:inline">Analysis</span>
                </button>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isRecording
                    ? 'bg-rose-500/20 border-rose-500 text-rose-200 animate-pulse'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  {isRecording ? 'Listening...' : '🎤 Voice Input'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <HealthChat diagnosisContext={result} onSymptomUpdate={handleChatUpdate} voiceInput={transcription} language={language} />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-3 animate-in slide-in-from-bottom-2">
              ⚠️ {error}
            </div>
          )}

        </div>

        {/* RIGHT: Sliding Analysis Panel */}
        <div className={`fixed inset-y-0 right-0 w-full md:w-[45%] bg-[#050505]/90 backdrop-blur-3xl border-l border-white/10 shadow-2xl transform transition-transform duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] z-50 overflow-y-auto
            ${showPanel ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Panel Header */}
          <div className="p-8 pb-4 flex justify-between items-center sticky top-0 bg-[#050505]/80 backdrop-blur-xl z-10 border-b border-white/5">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
              <span className="text-3xl">🩺</span> Analysis
            </h2>
            <button onClick={() => setShowPanel(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
              ✕
            </button>
          </div>

          {/* Panel Content */}
          <div className="p-8 space-y-8">
            {result ? (
              <>
                {/* Clinical Summary */}
                <div className="space-y-4 animate-in slide-in-from-right-10 fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-indigo-400 font-medium tracking-wide text-xs uppercase">Clinical Insight</h3>
                    {result.urgency_level && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getUrgencyColor(result.urgency_level)}`}>
                        {result.urgency_level}
                      </span>
                    )}
                  </div>
                  <p className="text-lg leading-relaxed text-white/90 font-light border-l-2 border-indigo-500/50 pl-4">
                    {result.analysis}
                  </p>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={isPlaying ? stopAudio : playAnalysis}
                      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/70 flex items-center gap-2 transition-all"
                    >
                      {isPlaying ? '⏹️ Stop Reading' : '🔊 Read Analysis'}
                    </button>
                  </div>
                </div>

                {/* Causes */}
                <div className="animate-in slide-in-from-right-10 fade-in duration-700 delay-100">
                  <h3 className="text-amber-400 font-medium tracking-wide text-xs uppercase mb-3">Potential Causes</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {result.probable_causes?.map((cause: string, i: number) => (
                      <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
                        <span className="text-white/80 font-light">{cause}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medical Advice */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 animate-in slide-in-from-right-10 fade-in duration-700 delay-200">
                  <h3 className="text-white font-medium tracking-wide text-xs uppercase mb-2">Recommendation</h3>
                  <p className="text-indigo-100/80 text-sm leading-relaxed font-light">
                    {result.medical_advice}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {result.home_remedies?.map((remedy: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-indigo-200/60">
                        <span className="text-indigo-400 mt-0.5">✓</span>
                        {remedy}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* WHO Data */}
                {whoData.length > 0 && (
                  <div className="animate-in slide-in-from-right-10 fade-in duration-700 delay-300">
                    <h3 className="text-blue-400 font-medium tracking-wide text-xs uppercase mb-3">WHO Resources</h3>
                    <div className="space-y-3">
                      {whoData.map((item, i) => (
                        <a key={i} href={item.link} target="_blank" className="block p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors group">
                          <div className="font-medium text-blue-200 group-hover:text-blue-100 mb-1 text-sm">{item.title}</div>
                          <div className="text-xs text-white/40 line-clamp-2 font-light">{item.snippet}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-8 border-t border-white/5">
                  <p className="text-[10px] text-white/20 uppercase tracking-widest text-center">
                    {result.disclaimer || "Not a medical diagnosis."}
                  </p>
                </div>
              </>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-white/20">
                <div className="text-4xl mb-4 animate-pulse duration-[3s]">⚛</div>
                <p className="text-sm font-light">Analysis will appear here...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </GeometricBackground>
  );
}
