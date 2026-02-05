'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    isAssessment?: boolean;
    data?: any;
}

interface HealthChatProps {
    diagnosisContext?: any;
    onSymptomUpdate?: (symptom: string) => void;
    onAssessmentReceived?: (data: any) => void;
    voiceInput?: string;
    language: string;
}

export default function HealthChat({ diagnosisContext, onSymptomUpdate, onAssessmentReceived, voiceInput, language }: HealthChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello. Describe your symptoms, and I will analyze them for you.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);

    // Update input when voiceInput prop changes
    useEffect(() => {
        if (voiceInput) {
            setInput(prev => prev ? `${prev} ${voiceInput}` : voiceInput);
        }
    }, [voiceInput]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const speakMessage = async (text: string, index: number) => {
        if (playingIndex === index && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setPlayingIndex(null);
            return;
        }

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `TTS Failed: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
                audioRef.current.pause();
            }

            const audio = new Audio(url);
            audioRef.current = audio;
            setPlayingIndex(index);

            audio.onended = () => setPlayingIndex(null);
            audio.play();
        } catch (e) {
            console.error(e);
        }
    };

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        const currentInput = input;
        setInput('');
        setLoading(true);

        if (onSymptomUpdate) {
            onSymptomUpdate(currentInput);
        }

        try {
            // Transform history for API: remove local flags like isAssessment if backend doesnt want them
            const apiMessages = newHistory.map(m => ({ 
                role: m.role, 
                content: m.content 
            }));

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    language,
                }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            if (data.type === 'assessment' && data.data) {
                // Assessment received
                const d = data.data;
                const summary = `I've analyzed your symptoms (${d.analysis}).\n\nProbable Causes: ${d.probable_causes.join(', ')}.\n\nAdvice: ${d.medical_advice}`;
                
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: summary,
                    isAssessment: true, // Flag to render differently if needed
                    data: d 
                }]);

                if (onAssessmentReceived) {
                    onAssessmentReceived(d);
                }
            } else {
                // Normal chat reply
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply || "I'm listening." }]);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am having trouble connecting right now.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`px-5 py-3 md:px-6 md:py-4 rounded-3xl text-sm md:text-base leading-relaxed backdrop-blur-md shadow-lg border-opacity-20 ${m.role === 'user'
                                ? 'bg-white/10 text-white rounded-br-none border border-white/20'
                                : 'bg-black/30 text-white rounded-bl-none border border-white/10'
                                }`}>
                                
                                {m.content.split('\n').map((line, idx) => (
                                    <p key={idx} className={idx > 0 ? 'mt-2' : ''}>{line}</p>
                                ))}

                                {m.isAssessment && m.data && (
                                    <div className="mt-4 pt-4 border-t border-white/10 text-sm">
                                        <p className="font-semibold text-indigo-300 mb-1">Recommended Action</p>
                                        <p className="opacity-90">{m.data.medical_advice}</p>
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {m.data.home_remedies.slice(0, 2).map((r: string, rid: number) => (
                                                <span key={rid} className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-indigo-200">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {m.role === 'assistant' && (
                                <button
                                    onClick={() => speakMessage(m.content, i)}
                                    className="mt-2 text-xs md:text-sm text-indigo-300 hover:text-indigo-200 flex items-center gap-2 transition-colors bg-white/5 px-3 py-1.5 rounded-full border border-white/5 hover:bg-white/10"
                                >
                                    {playingIndex === i ? '⏹️ Stop' : '🔊 Listen'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start animate-fade-in-up">
                        <div className="bg-white/5 rounded-3xl px-6 py-4 text-sm text-white/60 animate-pulse flex items-center gap-2">
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 pt-2">
                <div className="flex gap-3 relative max-w-3xl mx-auto bg-black/20 p-2 rounded-full border border-white/10 backdrop-blur-lg">
                    <input
                        type="text"
                        className="flex-1 px-6 py-3 bg-transparent outline-none text-white placeholder-white/40 font-medium"
                        placeholder="Type a message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        disabled={loading}
                    />

                    <button
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                        className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/90 transition-all font-bold shadow-lg disabled:opacity-50 disabled:scale-95"
                    >
                        ↑
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">
                        AI can make mistakes. Check important info.
                    </p>
                </div>
            </div>
        </div>
    );
}
