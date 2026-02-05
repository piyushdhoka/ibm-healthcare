'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAnalysis?: boolean;
  data?: any;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('English');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState('');
  
  // Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceInputMode, setVoiceInputMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // TTS states
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Auto resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const createNewChat = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'New conversation',
      messages: [],
      createdAt: new Date()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversation(newConv.id);
    setMessages([]);
    setError('');
  };

  const selectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConversation(id);
      setMessages(conv.messages);
    }
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversation === id) {
      setActiveConversation(null);
      setMessages([]);
    }
  };

  const sendMessage = async (messageText?: string, isVoiceInput: boolean = false) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    // Track if this was a voice input for auto TTS response
    if (isVoiceInput) setVoiceInputMode(true);

    // Auto create conversation if none
    if (!activeConversation) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        title: input.trim().slice(0, 30) + (input.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date()
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversation(newConv.id);
    }

    const userMessage: Message = { role: 'user', content: textToSend.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    // Update conversation title with first message
    if (activeConversation && messages.length === 0) {
      setConversations(prev => prev.map(c => 
        c.id === activeConversation 
          ? { ...c, title: textToSend.trim().slice(0, 30) + (textToSend.length > 30 ? '...' : '') }
          : c
      ));
    }

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, language }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get response');

      let assistantMessage: Message;
      
      if (data.type === 'assessment' && data.data) {
        const d = data.data;
        assistantMessage = {
          role: 'assistant',
          content: formatAnalysis(d),
          isAnalysis: true,
          data: d
        };
      } else {
        // Clean the reply - ensure no raw JSON is shown
        let reply = data.reply || "I understand. Could you tell me more about your symptoms?";
        // If somehow reply contains JSON, extract readable text
        if (reply.includes('"type"') || reply.includes('"reply"')) {
          try {
            const parsed = JSON.parse(reply);
            reply = parsed.reply || reply;
          } catch {
            // Not JSON, keep as is
          }
        }
        assistantMessage = {
          role: 'assistant',
          content: reply
        };
      }

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Save to conversation
      const convId = activeConversation || conversations[0]?.id;
      if (convId) {
        setConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, messages: updatedMessages } : c
        ));
      }

      // Auto-play TTS response if input was via voice
      if (voiceInputMode) {
        setVoiceInputMode(false);
        await playTTSResponse(assistantMessage.content);
      }

    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
      setVoiceInputMode(false);
    } finally {
      setLoading(false);
    }
  };

  const formatAnalysis = (data: any) => {
    const urgencyMap: Record<string, string> = {
      'Low': '🟢',
      'Medium': '🟡', 
      'High': '🟠',
      'Emergency': '🔴'
    };
    const urgencyEmoji = urgencyMap[data.urgency_level] || '⚪';

    const actionMap: Record<string, string> = {
      'Low': 'Self-care at home should help',
      'Medium': 'Consider seeing a doctor within 2-3 days if symptoms persist',
      'High': 'See a doctor within 24 hours',
      'Emergency': '⚠️ SEEK IMMEDIATE MEDICAL ATTENTION - Call emergency services (911/112)'
    };
    const urgencyAction = actionMap[data.urgency_level] || '';

    return `## 🏥 Health Analysis

**📋 Summary:**
${data.analysis}

**🔍 Possible Causes:**
${data.probable_causes?.map((c: string) => `• ${c}`).join('\n') || 'Further evaluation needed'}

**${urgencyEmoji} Urgency Level: ${data.urgency_level || 'Unknown'}**
${urgencyAction}

**💊 Home Remedies & Self-Care:**
${data.home_remedies?.map((r: string) => `• ${r}`).join('\n') || 'Rest and stay hydrated'}

**👨‍⚕️ Medical Advice:**
${data.medical_advice || 'Consult a healthcare professional if symptoms persist or worsen.'}

---
*⚠️ ${data.disclaimer || 'This is AI-generated health information, not a medical diagnosis. Always consult a healthcare professional for proper medical advice.'}*`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('language', language);
        formData.append('autoDetect', 'true');
        
        try {
          const response = await fetch('/api/stt', { method: 'POST', body: formData });
          const data = await response.json();
          if (data.transcript) {
            // Auto-send the voice message (will trigger TTS response)
            sendMessage(data.transcript, true);
            // Show detected language if different
            if (data.detectedLanguage && data.detectedLanguage !== language) {
              console.log(`Detected language: ${data.detectedLanguage} (confidence: ${data.confidence}%)`);
            }
          }
        } catch (err) {
          console.error('STT error:', err);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Auto-play TTS response (for voice input mode)
  const playTTSResponse = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text.replace(/[#*_\-|]/g, '').replace(/\n+/g, '. '),
          language,
          voicePreference: 'female',
          audioFormat: 'mp3',
        }),
      });

      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) audioRef.current.pause();

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingIndex(messages.length); // Mark as playing
      audio.onended = () => setPlayingIndex(null);
      audio.play();
    } catch (err) {
      console.error('Auto-TTS error:', err);
    }
  };

  // TTS
  const speakMessage = async (text: string, index: number) => {
    if (playingIndex === index && audioRef.current) {
      audioRef.current.pause();
      setPlayingIndex(null);
      return;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text.replace(/[#*_-]/g, ''),
          language,
          voicePreference: 'female',
          audioFormat: 'mp3',
        }),
      });

      if (!response.ok) throw new Error('TTS failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) audioRef.current.pause();

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingIndex(index);
      audio.onended = () => setPlayingIndex(null);
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  return (
    <div className="flex h-screen bg-[#212121] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-[#171717] flex flex-col transition-all duration-300 overflow-hidden shrink-0`}>
        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                activeConversation === conv.id ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="flex-1 truncate text-white/80">{conv.title}</span>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
              >
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Links */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link href="/drug-info" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 transition-colors">
            <span>💊</span> Drug Information
          </Link>
          <a href="https://www.who.int/health-topics" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 transition-colors">
            <span>🌍</span> WHO Resources
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Health Assistant</span>
              <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">IBM Granite</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none hover:bg-white/5 cursor-pointer"
            >
              <option value="English" className="bg-[#212121]">🇺🇸 English</option>
              <option value="Spanish" className="bg-[#212121]">🇪🇸 Spanish</option>
              <option value="French" className="bg-[#212121]">🇫🇷 French</option>
              <option value="German" className="bg-[#212121]">🇩🇪 German</option>
              <option value="Hindi" className="bg-[#212121]">🇮🇳 Hindi</option>
              <option value="Portuguese" className="bg-[#212121]">🇧🇷 Portuguese</option>
              <option value="Italian" className="bg-[#212121]">🇮🇹 Italian</option>
              <option value="Japanese" className="bg-[#212121]">🇯🇵 Japanese</option>
              <option value="Korean" className="bg-[#212121]">🇰🇷 Korean</option>
              <option value="Chinese" className="bg-[#212121]">🇨🇳 Chinese</option>
              <option value="Dutch" className="bg-[#212121]">🇳🇱 Dutch</option>
              <option value="Arabic" className="bg-[#212121]">🇸🇦 Arabic</option>
            </select>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.length === 0 ? (
            // Welcome Screen
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="max-w-2xl w-full text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-semibold mb-3">How can I help you today?</h1>
                <p className="text-white/50 mb-8">Describe your symptoms and I'll provide health insights powered by IBM Granite AI</p>
                
                {/* Suggestion Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                  {[
                    { icon: "🤒", text: "I have a fever and headache" },
                    { icon: "😷", text: "I've been coughing for a week" },
                    { icon: "🤕", text: "I have persistent back pain" },
                    { icon: "😴", text: "I can't sleep well at night" },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(item.text)}
                      className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-white/70 text-sm">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Messages
            <div className="max-w-3xl mx-auto py-6 px-4">
              {messages.map((msg, i) => (
                <div key={i} className={`mb-6 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600' 
                        : 'bg-gradient-to-br from-emerald-400 to-cyan-500'
                    }`}>
                      {msg.role === 'user' ? (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Message Content */}
                    <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block rounded-2xl px-4 py-3 max-w-full ${
                        msg.role === 'user' 
                          ? 'bg-[#2f2f2f] text-white' 
                          : 'bg-transparent'
                      }`}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-invert prose-sm max-w-none">
                            {msg.content.split('\n').map((line, idx) => {
                              if (line.startsWith('## ')) {
                                return <h2 key={idx} className="text-lg font-semibold mt-0 mb-3 text-white">{line.slice(3)}</h2>;
                              }
                              if (line.startsWith('**') && line.endsWith('**')) {
                                return <p key={idx} className="font-semibold text-white/90 mt-3 mb-1">{line.slice(2, -2)}</p>;
                              }
                              if (line.startsWith('**')) {
                                const parts = line.split('**');
                                return (
                                  <p key={idx} className="my-1">
                                    <strong className="text-white/90">{parts[1]}</strong>
                                    <span className="text-white/70">{parts[2]}</span>
                                  </p>
                                );
                              }
                              if (line.startsWith('- ')) {
                                return <li key={idx} className="text-white/70 ml-4 my-0.5">{line.slice(2)}</li>;
                              }
                              if (line.startsWith('---')) {
                                return <hr key={idx} className="border-white/10 my-4" />;
                              }
                              if (line.startsWith('*') && line.endsWith('*')) {
                                return <p key={idx} className="text-white/50 text-xs italic mt-2">{line.slice(1, -1)}</p>;
                              }
                              if (line.trim()) {
                                return <p key={idx} className="text-white/70 my-1">{line}</p>;
                              }
                              return null;
                            })}
                          </div>
                        ) : (
                          <p className="text-white/90">{msg.content}</p>
                        )}
                      </div>
                      
                      {/* Message Actions */}
                      {msg.role === 'assistant' && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => speakMessage(msg.content, i)}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white/70"
                            title="Listen"
                          >
                            {playingIndex === i ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white/70"
                            title="Copy"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-4 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1 text-white/50">
                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto hover:text-red-300">✕</button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-[#2f2f2f] rounded-2xl border border-white/10 p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your symptoms..."
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none px-3 py-2 text-white placeholder-white/40 max-h-[200px]"
              />
              
              <div className="flex items-center gap-1 shrink-0">
                {/* Voice Button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'hover:bg-white/10 text-white/50 hover:text-white'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
                  </svg>
                </button>

                {/* Send Button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className={`p-2 rounded-lg transition-colors ${
                    input.trim() && !loading
                      ? 'bg-white text-black hover:bg-white/90'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-white/30 mt-2">
              Health Assistant can make mistakes. Please consult a healthcare professional for medical advice.
            </p>
          </div>
        </div>
      </main>

      {/* WhatsApp Button */}
      <WhatsAppButton />
    </div>
  );
}

// WhatsApp Floating Button
function WhatsAppButton() {
  const [showModal, setShowModal] = useState(false);
  const whatsappNumber = "14155238886";
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=hi`;

  const features = [
    { icon: "🎤", title: "Voice Messages", desc: "Send voice notes" },
    { icon: "💬", title: "24/7 Chat", desc: "Always available" },
    { icon: "🧠", title: "AI Analysis", desc: "IBM Granite AI" },
    { icon: "🌍", title: "Multi-language", desc: "EN, ES, HI, FR" },
  ];

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20BA5C] text-white p-4 rounded-full shadow-lg transition-all hover:scale-110"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#212121] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Health Assistant</h3>
                  <p className="text-green-400 text-xs">● Online</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {features.map((f, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <span className="text-xl">{f.icon}</span>
                  <p className="text-white text-sm font-medium mt-1">{f.title}</p>
                  <p className="text-white/50 text-xs">{f.desc}</p>
                </div>
              ))}
            </div>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-[#25D366] hover:bg-[#20BA5C] text-white font-medium py-3 rounded-xl text-center transition-colors"
            >
              Start Chat on WhatsApp
            </a>

            <div className="mt-4 flex items-center justify-center gap-2 text-white/40 text-xs">
              <span>Powered by</span>
              <svg viewBox="0 0 30 30" className="h-4 w-4" fill="none">
                <circle cx="15" cy="15" r="15" fill="#F22F46"/>
                <circle cx="10.5" cy="15" r="2.5" fill="white"/>
                <circle cx="19.5" cy="15" r="2.5" fill="white"/>
              </svg>
              <span className="font-semibold text-[#F22F46]">Twilio</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
