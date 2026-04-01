import React from 'react';
import { BrutalistSlider } from './BrutalistSlider';
import { FlyToInterpolator } from '@deck.gl/core';

const ANIMATION_DURATION_MS = 300;
const DROPDOWN_OFFSET_PX = 200;
const DEFAULT_MAP_PITCH = 45;
const DEFAULT_MAP_BEARING = 0;
const DEFAULT_MAP_ZOOM = 15.5;
const TRANSITION_DURATION_MS = 1200;

interface LocationDef {
    id: string;
    city: string;
    area: string;
    lat: number;
    lon: number;
    bbox: string;
}

interface ControlPanelProps {
    status: string;
    scannerActive: boolean;
    setScannerActive: (v: boolean) => void;
    setHoverInfo: (v: any) => void;
    showLandmarks: boolean;
    setShowLandmarks: (v: boolean) => void;
    transitActive: boolean;
    setTransitActive: (v: boolean) => void;
    currentLocation: LocationDef;
    LOCATIONS: LocationDef[];
    showCrowds: boolean;
    setShowCrowds: (v: boolean) => void;
    transitStatus: string;
    transitCounts: Record<string, number>;
    transitFilter: 'ALL' | 'TRAM' | 'BUS' | 'METRO' | 'TRAIN' | 'FERRY';
    setTransitFilter: (v: any) => void;
    transitInterval: number;
    setTransitInterval: (v: number) => void;
    crowdsInterval: number;
    setCrowdsInterval: (v: number) => void;
    weather: string;
    handleLocationChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    setViewState: (updater: any) => void;
    panelExpanded: boolean;
    setPanelExpanded: (v: boolean) => void;
    isDutch: boolean;
    usePdokGeometry: boolean;
    setUsePdokGeometry: (v: boolean) => void;
    showComingSoon: boolean;
    radarActive: boolean;
    setRadarActive: (v: boolean) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
    status, scannerActive, setScannerActive, setHoverInfo,
    showLandmarks, setShowLandmarks, transitActive, setTransitActive,
    currentLocation, LOCATIONS, showCrowds, setShowCrowds,
    transitStatus, transitCounts, transitFilter, setTransitFilter,
    transitInterval, setTransitInterval, crowdsInterval, setCrowdsInterval,
    weather, handleLocationChange, setViewState,
    panelExpanded, setPanelExpanded, isDutch,
    usePdokGeometry, setUsePdokGeometry, showComingSoon,
    radarActive, setRadarActive
}) => {
    const [showCityDropdown, setShowCityDropdown] = React.useState(false);
    const [showAreaDropdown, setShowAreaDropdown] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const panelContentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowCityDropdown(false);
                setShowAreaDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    React.useEffect(() => {
        if ((showCityDropdown || showAreaDropdown) && dropdownRef.current && panelContentRef.current) {
            const dropdownRect = dropdownRef.current.getBoundingClientRect();
            const panelRect = panelContentRef.current.getBoundingClientRect();
            const dropdownBottom = dropdownRect.bottom - panelRect.top + DROPDOWN_OFFSET_PX;

            if (dropdownBottom > panelContentRef.current.clientHeight) {
                panelContentRef.current.scrollTo({
                    top: dropdownBottom - panelContentRef.current.clientHeight + panelContentRef.current.scrollTop,
                    behavior: 'smooth'
                });
            }
        }
    }, [showCityDropdown, showAreaDropdown]);

    const cities = Array.from(new Set(LOCATIONS.map(loc => loc.city))) as string[];
    const areasForCurrentCity = LOCATIONS.filter(loc => loc.city === currentLocation.city);

    const handleCitySelect = (city: string) => {
        const centrumLocation = LOCATIONS.find(loc => loc.city === city && loc.area === 'CENTRUM');
        if (centrumLocation) {
            const syntheticEvent = {
                target: { value: centrumLocation.id }
            } as React.ChangeEvent<HTMLSelectElement>;
            handleLocationChange(syntheticEvent);
        }
        setShowCityDropdown(false);
    };

    const handleAreaSelect = (locationId: string) => {
        const syntheticEvent = {
            target: { value: locationId }
        } as React.ChangeEvent<HTMLSelectElement>;
        handleLocationChange(syntheticEvent);
        setShowAreaDropdown(false);
    };

    return (
        <div className="absolute top-32 left-8 py-6 pl-6 bg-black/50 border border-white/20 backdrop-blur-md z-40 w-80 pointer-events-auto shadow-2xl font-mono transition-all duration-300">
            <div className="flex items-center justify-between cursor-pointer group pr-6" onClick={() => setPanelExpanded(!panelExpanded)}>
                <p className="text-[10px] text-white/50 tracking-tighter uppercase font-bold group-hover:text-white transition-colors duration-300">
                    NE-NET-01: OVERPASS_API: SPECTRAL_SYNC
                </p>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className={`w-4 h-4 text-white/40 transition-transform duration-300 ${panelExpanded ? 'rotate-180' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>

            <div className={`transition-all duration-300 ${panelExpanded ? 'max-h-[calc(100vh-16rem)] opacity-100 mt-6 overflow-y-auto pr-6' : 'max-h-0 opacity-0 mt-0 overflow-hidden pr-6'}`} style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }} ref={panelContentRef}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">DATA LINK</span>
                        <span className={`text-[10px] font-bold ${status === 'ONLINE' ? 'text-green-500' : 'text-yellow-500 animate-pulse'}`}>
                            {status}
                        </span>
                    </div>

                    <div className="relative flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">
                            {isDutch ? '3D KADASTER (HD)' : '3D CADASTRE (HD)'}
                        </span>

                        <div
                            className={`absolute right-[50px] pointer-events-none text-red-500 font-mono text-[10px] tracking-widest uppercase transition-opacity duration-300 ${showComingSoon ? 'opacity-100' : 'opacity-0'
                                }`}
                        >
                            {isDutch ? 'BINNENKORT' : 'COMING SOON'}
                        </div>

                        <button
                            onClick={() => setUsePdokGeometry(!usePdokGeometry)}
                            className="flex items-center justify-center p-1 border transition-all border-white/20 text-white/40 hover:bg-white/10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" className="w-5 h-5">
                                <circle cx="12" cy="12" r="7" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">{isDutch ? 'SCANNER (HOVER)' : 'SCANNER (HOVER)'}</span>
                        <button
                            onClick={() => {
                                setScannerActive(!scannerActive);
                                if (scannerActive) setHoverInfo(null);
                            }}
                            className={`px-3 py-1 text-[10px] transition-all border ${scannerActive ? 'bg-white/10 border-white/40 text-white font-bold' : 'border-white/20 text-white/40 hover:bg-white/10'}`}
                            disabled={status !== 'ONLINE'}
                        >
                            {scannerActive ? (isDutch ? 'ACTIEF' : 'ACTIVE') : 'UIT / OFF'}
                        </button>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">{isDutch ? 'OPMERKELIJKE GEBOUWEN' : 'NOTABLE STRUCTURES'}</span>
                        <button
                            onClick={() => setShowLandmarks(!showLandmarks)}
                            className={`px-3 py-1 text-[10px] transition-all border ${showLandmarks ? 'bg-white/10 border-white/40 text-white font-bold' : 'border-white/20 text-white/40 hover:bg-white/10'}`}
                            disabled={status !== 'ONLINE'}
                        >
                            {showLandmarks ? (isDutch ? 'ACTIEF' : 'ACTIVE') : 'UIT / OFF'}
                        </button>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">{isDutch ? 'LIVE TRANSIT' : 'LIVE TRANSIT'}</span>
                        <button
                            onClick={() => setTransitActive(!transitActive)}
                            className={`px-3 py-1 text-[10px] transition-all border ${transitActive ? 'bg-white/10 border-white/40 text-white font-bold' : 'border-white/20 text-white/40 hover:bg-white/10'}`}
                        >
                            {transitActive ? (isDutch ? 'ACTIEF' : 'ACTIVE') : 'UIT / OFF'}
                        </button>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className={`text-[10px] uppercase tracking-tighter ${!currentLocation.id.startsWith('ams_') ? 'text-white/20' : ''}`}>
                            {isDutch ? 'DRUKTE SENSOREN' : 'CROWD SENSORS'}
                        </span>
                        <button
                            onClick={() => {
                                if (currentLocation.id.startsWith('ams_')) setShowCrowds(!showCrowds);
                            }}
                            disabled={!currentLocation.id.startsWith('ams_')}
                            className={`px-3 py-1 text-[10px] transition-all border ${!currentLocation.id.startsWith('ams_')
                                ? 'border-white/10 text-white/20 cursor-not-allowed bg-transparent'
                                : showCrowds
                                    ? 'bg-white/10 border-white/40 text-white font-bold'
                                    : 'border-white/20 text-white/40 hover:bg-white/10'
                                }`}
                        >
                            {!currentLocation.id.startsWith('ams_') ? (isDutch ? 'ONBESCHIKBAAR' : 'UNAVAILABLE') : showCrowds ? (isDutch ? 'ACTIEF' : 'ACTIVE') : 'UIT / OFF'}
                        </button>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">{isDutch ? 'NOODUPDATES' : 'EMERGENCY UPDATES'}</span>
                        <button
                            onClick={() => setRadarActive(!radarActive)}
                            className={`px-3 py-1 text-[10px] transition-all border ${radarActive ? 'bg-white/10 border-white/40 text-white font-bold' : 'border-white/20 text-white/40 hover:bg-white/10'}`}
                        >
                            {radarActive ? (isDutch ? 'ACTIEF' : 'ACTIVE') : 'UIT / OFF'}
                        </button>
                    </div>

                    {transitActive && (
                        <>
                            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                <span className="text-[10px] uppercase tracking-tighter">TRANSIT LINK</span>
                                <span className={`text-[10px] font-bold ${transitStatus.includes('API') ? 'text-red-500' : 'text-blue-400'}`}>
                                    {transitStatus}
                                </span>
                            </div>
                            <div className="border-b border-white/10 pb-2 text-[8px] text-white/50 tracking-widest leading-relaxed mt-1">
                                TRAM:{transitCounts.TRAM || 0} BUS:{transitCounts.BUS || 0} METRO:{transitCounts.METRO || 0} TRAIN:{transitCounts.TRAIN || 0}
                            </div>
                            <div className="flex justify-between items-center border-b border-white/10 pb-2 mt-2">
                                <span className="text-[10px] uppercase tracking-tighter">{isDutch ? 'FILTER' : 'FILTER'}</span>
                                <select
                                    value={transitFilter}
                                    onChange={(e) => setTransitFilter(e.target.value as any)}
                                    className="bg-black border border-white/20 text-white text-[10px] p-1 uppercase tracking-widest cursor-pointer outline-none hover:border-white transition-colors appearance-none"
                                >
                                    <option value="ALL">{isDutch ? 'ALLES' : 'ALL'}</option>
                                    <option value="TRAM">TRAM</option>
                                    <option value="BUS">BUS</option>
                                    <option value="METRO">METRO</option>
                                    <option value="TRAIN">{isDutch ? 'TREIN' : 'TRAIN'}</option>
                                    <option value="FERRY">{isDutch ? 'VEER' : 'FERRY'}</option>
                                </select>
                            </div>
                            <BrutalistSlider
                                label="TRANSIT POLL INTERVAL"
                                value={transitInterval}
                                min={5000}
                                max={60000}
                                onChange={setTransitInterval}
                                active={transitActive}
                            />
                        </>
                    )}

                    {(showCrowds && currentLocation.id.startsWith('ams_')) && (
                        <div className="pb-2">
                            <BrutalistSlider
                                label="CROWD POLL INTERVAL"
                                value={crowdsInterval}
                                min={10000}
                                max={120000}
                                onChange={setCrowdsInterval}
                                active={showCrowds}
                            />
                        </div>
                    )}

                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                        <span className="text-[10px] uppercase tracking-tighter">{isDutch ? 'ATMOSFEER' : 'ATMOSPHERE'}</span>
                        <span className={`text-[10px] font-bold ${weather === 'REGEN' || weather === 'RAIN' ? 'text-blue-400' : 'text-white/60'}`}>
                            {String(weather)}
                        </span>
                    </div>
                </div>

                <div className="mt-8 border-t border-white/20 pt-4">
                    <p className="text-[10px] text-white/40 mb-2 uppercase">{isDutch ? 'LOCATIE KIEZEN' : 'SELECT LOCATION'}</p>
                    <div className="flex flex-col gap-2">
                        <div className="relative" ref={dropdownRef}>
                            <div className="w-full h-10 bg-black border border-white/20 text-white uppercase tracking-widest flex items-center justify-between px-2 overflow-hidden">
                                <button
                                    onClick={() => {
                                        setShowAreaDropdown(!showAreaDropdown);
                                        setShowCityDropdown(false);
                                    }}
                                    className="flex-1 text-left hover:text-white/70 transition-colors truncate"
                                    style={{ fontSize: 'clamp(0.6rem, 2vw, 0.875rem)' }}
                                >
                                    {currentLocation.area}
                                </button>

                                <span className="text-white/40 px-1 flex-shrink-0">|</span>

                                <button
                                    onClick={() => {
                                        setShowCityDropdown(!showCityDropdown);
                                        setShowAreaDropdown(false);
                                    }}
                                    className="flex-1 text-right hover:text-white/70 transition-colors truncate"
                                    style={{ fontSize: 'clamp(0.6rem, 2vw, 0.875rem)' }}
                                >
                                    {currentLocation.city}
                                </button>
                            </div>

                            {showCityDropdown && (
                                <div className="absolute top-full left-0 w-full bg-black border border-white/20 mt-1 z-50 max-h-60 overflow-y-auto animate-slideDown">
                                    {cities.map(city => (
                                        <button
                                            key={city}
                                            onClick={() => handleCitySelect(city)}
                                            className={`w-full text-left px-3 py-2 text-sm uppercase tracking-widest hover:bg-white/10 transition-colors ${city === currentLocation.city ? 'bg-white/5 text-white' : 'text-white/70'
                                                }`}
                                        >
                                            {city}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {showAreaDropdown && (
                                <div className="absolute top-full left-0 w-full bg-black border border-white/20 mt-1 z-50 max-h-60 overflow-y-auto animate-slideDown">
                                    {areasForCurrentCity.map(loc => (
                                        <button
                                            key={loc.id}
                                            onClick={() => handleAreaSelect(loc.id)}
                                            className={`w-full text-left px-3 py-2 text-sm uppercase tracking-widest hover:bg-white/10 transition-colors ${loc.id === currentLocation.id ? 'bg-white/5 text-white' : 'text-white/70'
                                                }`}
                                        >
                                            {loc.area}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setViewState((prev: any) => ({
                                    ...prev,
                                    longitude: currentLocation.lon,
                                    latitude: currentLocation.lat,
                                    zoom: DEFAULT_MAP_ZOOM,
                                    pitch: DEFAULT_MAP_PITCH,
                                    bearing: DEFAULT_MAP_BEARING,
                                    transitionDuration: TRANSITION_DURATION_MS,
                                    transitionInterpolator: new FlyToInterpolator()
                                }));
                            }}
                            className="w-full bg-black/50 border border-white/20 text-white text-[10px] py-2 uppercase tracking-widest hover:bg-white hover:text-black hover:border-white transition-all duration-300 backdrop-blur-sm"
                        >
                            {isDutch ? 'RESET WEERGAVE' : 'RESET VIEW'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
