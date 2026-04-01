import React, { useEffect, useState } from 'react';
import { BuildingFeature } from '../layers/OSMBuildingLayer';

export interface WikiData {
    title: string;
    extract: string;
    url: string;
    thumbnail?: { source: string };
}

interface WikiModalProps {
    building: BuildingFeature | null;
    city?: string;
    coords?: { lat: number, lon: number } | null;
    onClose: () => void;
}

export const WikiModal: React.FC<WikiModalProps> = ({ building, city, coords, onClose }) => {
    const [wikiData, setWikiData] = useState<WikiData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [visibleParagraphs, setVisibleParagraphs] = useState(1);

    useEffect(() => {
        if (!building || !building.name) return;

        let isActive = true;
        setLoading(true);
        setError(false);
        setWikiData(null);
        setVisibleParagraphs(1);

        const fetchWikiData = async () => {
            try {
                const url = new URL(`http://127.0.0.1:8080/api/wikipedia/${encodeURIComponent(building.name!)}`);
                if (city) {
                    url.searchParams.append('city', city);
                }
                if (coords) {
                    url.searchParams.append('lat', coords.lat.toString());
                    url.searchParams.append('lon', coords.lon.toString());
                }
                if (building.wikidata) {
                    url.searchParams.append('wikidata', building.wikidata);
                }
                if (building.wikipedia) {
                    url.searchParams.append('wikipedia_title', building.wikipedia);
                }
                const res = await fetch(url.toString());
                if (!res.ok) {
                    if (res.status === 404) {
                        if (isActive) setError(true);
                    } else {
                        throw new Error('API Error');
                    }
                    return;
                }
                const data = await res.json();
                if (isActive) setWikiData(data);
            } catch (err) {
                if (isActive) setError(true);
            } finally {
                if (isActive) setLoading(false);
            }
        };

        fetchWikiData();

        return () => { isActive = false; };
    }, [building]);

    if (!building) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative w-full max-w-[600px] max-h-[90vh] bg-[#050505] border border-[#333] shadow-2xl flex flex-col font-sans text-white animate-scaleUp overflow-hidden">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/50 border border-white/20 hover:bg-white hover:text-black transition-colors duration-300 pointer-events-auto"
                >
                    <span className="font-mono text-sm">X</span>
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Hero Image */}
                    <div className="w-full h-[300px] bg-black border-b border-[#222] relative">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-mono text-[10px] text-white/50 tracking-[0.2em] uppercase animate-pulse">
                                    SCANNING ARCHIVES...
                                </span>
                            </div>
                        )}
                        {!loading && wikiData?.thumbnail?.source ? (
                            <div className="w-full h-full relative">
                                <img
                                    src={wikiData.thumbnail.source}
                                    alt={wikiData.title}
                                    className="w-full h-full object-cover opacity-80"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent"></div>
                            </div>
                        ) : !loading ? (
                            <div className="w-full h-full flex flex-col justify-center items-center bg-[#0a0a0a]">
                                <div className="text-white/20 font-mono text-[10px] tracking-widest uppercase mb-2">IMAGE REFERENCE CORRUPTED</div>
                                <div className="w-16 h-[1px] bg-red-600/50"></div>
                            </div>
                        ) : null}

                        {/* Overlapping Title (Brutalist style) */}
                        <div className="absolute bottom-6 left-8 right-8 z-10 drop-shadow-lg overflow-hidden">
                            <h2
                                className="font-bold font-display uppercase tracking-[-0.04em] leading-none whitespace-nowrap"
                                style={{
                                    fontSize: (wikiData?.title || building.name || "").length > 18
                                        ? `${Math.max(1.5, 48 * (16 / (wikiData?.title || building.name || "").length))}px`
                                        : '48px'
                                }}
                            >
                                {wikiData?.title || building.name}
                            </h2>
                        </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-8 pt-6">
                        <div className="mb-6 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase border-b border-[#222] pb-6">
                            <span className="text-[#666]">ENTITY ID: {building.id}</span>
                            <span className="text-[#333]">/</span>
                            <span className="text-red-500 font-bold bg-red-500/10 px-2 py-0.5 border border-red-500/30">CLASS: {building.type}</span>
                        </div>

                        {loading ? (
                            <div className="space-y-4">
                                <div className="h-2 bg-[#222] w-3/4 animate-pulse"></div>
                                <div className="h-2 bg-[#1a1a1a] w-full animate-pulse"></div>
                                <div className="h-2 bg-[#222] w-5/6 animate-pulse"></div>
                            </div>
                        ) : error || !wikiData ? (
                            <div className="py-12 text-[#555] font-mono text-xs uppercase tracking-widest border border-[#222] p-4 text-center bg-[#0a0a0a]">
                                No archival data available for this structure in the current sector.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-[14px] leading-relaxed text-[#bbb] font-body selection:bg-white/20 selection:text-white">
                                    {wikiData.extract.split('\n').filter(p => p.trim()).map((paragraph, i) => {
                                        if (i >= visibleParagraphs) return null;
                                        return <p key={i} className="mb-4">{paragraph}</p>;
                                    })}
                                </div>
                                {wikiData.extract.split('\n').filter(p => p.trim()).length > 1 && (
                                    <div className="pt-2 flex items-center gap-6">
                                        {visibleParagraphs < wikiData.extract.split('\n').filter(p => p.trim()).length && (
                                            <button
                                                onClick={() => setVisibleParagraphs(v => v + 1)}
                                                className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#888] hover:text-white transition-colors focus:outline-none"
                                            >
                                                REVEAL MORE <span className="text-[#555] translate-y-[1px] text-[8px]">▼</span>
                                            </button>
                                        )}
                                        {visibleParagraphs > 1 && (
                                            <button
                                                onClick={() => setVisibleParagraphs(1)}
                                                className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#888] hover:text-white transition-colors focus:outline-none"
                                            >
                                                COLLAPSE ALL <span className="text-[#555] -translate-y-[1px] text-[8px]">▲</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-scaleUp {
                    animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #050505;
                    border-left: 1px solid #222;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #333;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `}} />
        </div>
    );
};
