'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DrugInfoPage() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    const searchDrugs = async (searchQuery?: string) => {
        const q = searchQuery || query;
        if (!q.trim()) return;
        setLoading(true);
        setError('');
        setResults([]);

        // Add to history
        if (!searchHistory.includes(q.trim())) {
            setSearchHistory(prev => [q.trim(), ...prev].slice(0, 10));
        }

        try {
            const response = await fetch(`/api/scrape/pubmed?query=${encodeURIComponent(q)}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch drug info');

            setResults(data.results || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const popularDrugs = [
        { name: 'Ibuprofen', icon: '💊' },
        { name: 'Paracetamol', icon: '🩹' },
        { name: 'Aspirin', icon: '💉' },
        { name: 'Metformin', icon: '🔬' },
        { name: 'Omeprazole', icon: '💎' },
        { name: 'Amoxicillin', icon: '🦠' },
    ];

    return (
        <div className="flex h-screen bg-[#212121] text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[#171717] flex flex-col shrink-0">
                {/* Back Button */}
                <div className="p-3">
                    <Link
                        href="/"
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-white/20 hover:bg-white/10 transition-colors text-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Chat
                    </Link>
                </div>

                {/* Search History */}
                <div className="flex-1 overflow-y-auto px-2">
                    <p className="px-3 py-2 text-xs text-white/40 uppercase tracking-wider">Recent Searches</p>
                    <div className="space-y-1">
                        {searchHistory.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => { setQuery(item); searchDrugs(item); }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 transition-colors text-left"
                            >
                                <span>💊</span>
                                <span className="truncate">{item}</span>
                            </button>
                        ))}
                        {searchHistory.length === 0 && (
                            <p className="px-3 py-2 text-sm text-white/30">No recent searches</p>
                        )}
                    </div>
                </div>

                {/* Quick Links */}
                <div className="p-3 border-t border-white/10 space-y-1">
                    <a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 transition-colors">
                        <span>📚</span> PubMed Database
                    </a>
                    <a href="https://www.drugs.com/" target="_blank" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/70 transition-colors">
                        <span>💊</span> Drugs.com
                    </a>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative min-w-0">
                {/* Header */}
                <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Drug Information</span>
                        <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-400 rounded-full">PubMed</span>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {results.length === 0 && !loading ? (
                        // Welcome Screen
                        <div className="h-full flex flex-col items-center justify-center px-4">
                            <div className="max-w-2xl w-full text-center">
                                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                </div>
                                <h1 className="text-3xl font-semibold mb-3">Drug Intelligence Search</h1>
                                <p className="text-white/50 mb-8">Search for medications to find clinical research, side effects, and usage guidelines from PubMed</p>
                                
                                {/* Popular Drugs Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left mb-8">
                                    {popularDrugs.map((drug, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setQuery(drug.name); searchDrugs(drug.name); }}
                                            className="flex items-center gap-3 p-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <span className="text-2xl">{drug.icon}</span>
                                            <span className="text-white/70 text-sm">{drug.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Results
                        <div className="max-w-3xl mx-auto py-6 px-4">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-4"></div>
                                    <p className="text-white/50">Searching PubMed database...</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-white/40 text-sm mb-6">{results.length} results for "{query}"</p>
                                    <div className="space-y-4">
                                        {results.map((item, idx) => (
                                            <a key={idx} href={item.link} target="_blank" className="block group">
                                                <div className="p-5 rounded-2xl bg-[#2f2f2f] border border-white/5 hover:border-indigo-500/30 transition-all">
                                                    <h3 className="text-lg font-medium text-white group-hover:text-indigo-300 mb-2 line-clamp-2">
                                                        {item.title}
                                                    </h3>
                                                    {item.author && (
                                                        <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                                            </svg>
                                                            <span>{item.author}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-white/60 text-sm leading-relaxed line-clamp-3 mb-4">
                                                        {item.snippet}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 group-hover:text-indigo-300">
                                                        <span>View on PubMed</span>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </>
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

                {/* Search Input */}
                <div className="p-4 border-t border-white/10 shrink-0">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-center gap-2 bg-[#2f2f2f] rounded-2xl border border-white/10 p-2">
                            <div className="pl-3 text-white/30">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search for a medication (e.g., Ibuprofen, Metformin)..."
                                className="flex-1 bg-transparent outline-none px-2 py-2 text-white placeholder-white/40"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && searchDrugs()}
                            />
                            <button
                                onClick={() => searchDrugs()}
                                disabled={loading || !query.trim()}
                                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                                    query.trim() && !loading
                                        ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                                }`}
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                        <p className="text-center text-xs text-white/30 mt-2">
                            Data sourced from PubMed / National Library of Medicine
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
