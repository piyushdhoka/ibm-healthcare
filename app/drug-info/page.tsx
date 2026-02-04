'use client';

import { useState } from 'react';
import GeometricBackground from '../../components/GeometricBackground';
import Link from 'next/link';

export default function DrugInfoPage() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState('');

    const searchDrugs = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError('');
        setResults([]);

        try {
            const response = await fetch(`/api/scrape/pubmed?query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch drug info');

            setResults(data.results || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <GeometricBackground>
            <div className="max-w-7xl mx-auto px-6 py-20 min-h-screen flex flex-col">
                {/* Nav */}
                <div className="flex justify-between items-center mb-12">
                    <Link href="/" className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm flex items-center gap-2">
                        ← Back to Assistant
                    </Link>
                </div>

                <div className="max-w-3xl mx-auto w-full flex-1">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-rose-300 mb-4 tracking-tight">
                            Drug Intelligence
                        </h1>
                        <p className="text-white/40 text-lg font-light">
                            Search the NLM database for clinical research, side effects, and usage guidelines.
                        </p>
                    </div>

                    {/* Search Box */}
                    <div className="relative mb-12">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-white/30">🔍</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Search for a medication (e.g., Ibuprofen)..."
                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 focus:bg-white/[0.05] focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-lg backdrop-blur-sm text-lg"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchDrugs()}
                        />
                        <button
                            onClick={searchDrugs}
                            disabled={loading}
                            className="absolute right-2 top-2 bottom-2 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-3">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Results */}
                    <div className="space-y-4 pb-20">
                        {results.length > 0 ? (
                            results.map((item, idx) => (
                                <a key={idx} href={item.link} target="_blank" className="block group">
                                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all">
                                        <h3 className="text-xl font-semibold text-indigo-200 group-hover:text-indigo-100 mb-2 truncate">
                                            {item.title}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-white/30 mb-3 uppercase tracking-wider">
                                            <span>{item.author}</span>
                                        </div>
                                        <p className="text-white/60 leading-relaxed font-light text-sm line-clamp-3">
                                            {item.snippet}
                                        </p>
                                        <div className="mt-4 flex items-center gap-1 text-xs font-bold text-rose-400 group-hover:text-rose-300">
                                            VIEW PUBLICATION <span>→</span>
                                        </div>
                                    </div>
                                </a>
                            ))
                        ) : (
                            !loading && query && (
                                <div className="text-center text-white/30 py-10 font-light">
                                    No results found for "{query}".
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </GeometricBackground>
    );
}
