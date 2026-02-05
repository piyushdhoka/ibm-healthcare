'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface HealthChatProps {
    diagnosisContext?: any;
    onSymptomUpdate: (symptom: string) => void;
    voiceInput?: string;
    language: string;
}

export default function HealthChat({ diagnosisContext, onSymptomUpdate, voiceInput, language }: HealthChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello. Describe your symptoms, and I will analyze them for you.' }
    ]);
    const [input, setInput] = useState('');

    // Update input when voiceInput prop changes
    useEffect(() => {
        if (voiceInput) {
            setInput(prev => prev ? `${prev} ${voiceInput}` : voiceInput);
        }
    }, [voiceInput]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [playingIndex, setPlayingIndex] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Track if we have already welcomed the user with context
    const [hasWelcomedContext, setHasWelcomedContext] = useState(false);

    // Auto-respond when diagnosis changes (if not already discussed)
    useEffect(() => {
        // Only trigger if we have a diagnosis and it's substantial
        if (diagnosisContext && diagnosisContext.analysis && !hasWelcomedContext && messages.length > 2) {
            // Logic for context updates
        }
    }, [diagnosisContext]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setLoading(true);

        // 1. Trigger Global Analysis Update
        onSymptomUpdate(currentInput);

        // 2. Get Chatbot Response
        // We pass the *current known* context. Note: The parent update related to this input might take a moment.
        // Ideally we'd wait for the new context. But for immediate feedback, we can send the current input.
        // The Chat API should be smart enough to ask a follow up based on the input text itself + previous history.

        // Slight delay to allow UI to settle?
        // setTimeout(async () => { ... }, 1000); 

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentInput,
                    history: messages,
                    language,
                    // We pass the *previous* context purely for history, but the NLU will look at the new message.
                    context: diagnosisContext ? `Current Analysis: ${diagnosisContext.analysis}` : ''
                }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error);

            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am having trouble connecting right now.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`px-6 py-4 rounded-3xl text-sm md:text-base leading-relaxed backdrop-blur-md shadow-lg border-opacity-20 ${m.role === 'user'
                                ? 'bg-white/10 text-white rounded-br-none border border-white/20'
                                : 'bg-black/30 text-white rounded-bl-none border border-white/10'
                                }`}>
                                {m.content}
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
                    <div className="flex justify-start">
                        <div className="bg-white/5 rounded-3xl px-6 py-4 text-sm text-white/60 animate-pulse flex items-center gap-2">
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4">
                <div className="flex gap-3 relative max-w-3xl mx-auto bg-black/20 p-2 rounded-full border border-white/10 backdrop-blur-lg">
                    <input
                        type="text"
                        className="flex-1 px-6 py-3 bg-transparent outline-none text-white placeholder-white/40 font-medium"
                        placeholder="Describe symptoms..."
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
            </div>
        </div>
    );
}
