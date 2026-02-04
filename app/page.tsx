'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [symptoms, setSymptoms] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // TTS State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleAnalyze = async () => {
    if (!symptoms.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    stopAudio();

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze symptoms');
      }

      setResult(data);
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
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone.');
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
        setSymptoms((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const playAnalysis = async () => {
    if (!result) return;
    
    // Construct the text to read
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
        setError(err.message);
        setIsPlaying(false);
    }
  };

  const stopAudio = () => {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
      }
  };


  const getUrgencyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-blue-900 tracking-tight">
            Agentic AI Health Symptom Checker
          </h1>
          <p className="text-gray-600 text-lg">
            Powered by <span className="font-semibold text-blue-600">IBM Granite</span>
          </p>
          <div className="inline-block bg-blue-50 text-blue-800 px-4 py-2 rounded-full text-sm border border-blue-100">
            🛡️ Verified Medical Data Sources & Guidelines
          </div>
        </header>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2">
                <label className="block text-gray-700 font-medium text-lg">
                Describe your symptoms
                </label>
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                        isRecording 
                        ? 'bg-red-100 text-red-600 animate-pulse border border-red-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                >
                    {isRecording ? (
                        <>
                            <span className="h-3 w-3 bg-red-500 rounded-full"></span>
                            Stop Recording
                        </>
                    ) : (
                        <>
                            <span>🎤</span> Use Microphone
                        </>
                    )}
                </button>
            </div>
            
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g., I have a sore throat, mild fever, and a headache that started yesterday..."
              className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 bg-gray-50 mb-4"
            />
            
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Hindi">Hindi</option>
                <option value="German">German</option>
              </select>

              <button
                onClick={handleAnalyze}
                disabled={loading || !symptoms}
                className={`px-8 py-3 rounded-xl font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-md
                  ${loading || !symptoms ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : 'Check Symptoms'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
            <div className="flex">
              <div className="shrink-0">
                ⚠️
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up">
            
            {/* Result Header */}
            <div className={`p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50`}>
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Health Assessment</h2>
                <button 
                  onClick={isPlaying ? stopAudio : playAnalysis}
                  className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                  title="Read aloud"
                >
                  {isPlaying ? '⏹️ Stop' : '🔊 Listen'}
                </button>
              </div>
              
              {result.urgency_level && (
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${getUrgencyColor(result.urgency_level)}`}>
                  {result.urgency_level} Priority
                </span>
              )}
            </div>

            <div className="p-8 space-y-8">
              
              {/* Analysis */}
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  🔍 Analysis
                </h3>
                <p className="text-gray-600 leading-relaxed bg-blue-50/50 p-4 rounded-lg">
                  {result.analysis}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Probable Causes */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    📋 Probable Causes
                  </h3>
                  <ul className="space-y-2">
                    {result.probable_causes?.map((cause: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                        <span className="text-blue-500 font-bold">•</span>
                        <span className="text-gray-700">{cause}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Home Remedies */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    🌿 Home Remedies
                  </h3>
                  <ul className="space-y-2">
                    {result.home_remedies?.map((remedy: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                        <span className="text-green-600">✓</span>
                        <span className="text-gray-700">{remedy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Medical Advice */}
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                  👨‍⚕️ Medical Recommendation
                </h3>
                <p className="text-yellow-800">
                  {result.medical_advice}
                </p>
              </div>

            </div>

             {/* Disclaimer Footer */}
            <div className="bg-gray-100 p-4 text-center border-t border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Disclaimer</p>
              <p className="text-sm text-gray-600 italic max-w-2xl mx-auto">
                {result.disclaimer || "This tool is for educational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider for diagnosis and treatment."}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
