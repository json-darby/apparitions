import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { createOSMBuildingLayer, BuildingFeature } from './layers/OSMBuildingLayer';
import { createTransitLayers, TransitVehicle } from './layers/TransitLayer';
import { createCrowdLayer } from './layers/CrowdLayer';
import { createPDOKBuildingLayer } from './layers/PDOKBuildingLayer';
import { createLocalBuildingLayer } from './layers/LocalBuildingLayer';
import { createRadarLayer } from './layers/RadarLayer';
import { ControlPanel } from './ui/ControlPanel';
import { MapView, FlyToInterpolator } from '@deck.gl/core';
import { point, lineString, featureCollection } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { usePollingEffect } from './hooks/usePollingEffect';
import { useEmergencyRadar } from './hooks/useEmergencyRadar';
import { BrutalistSlider } from './ui/BrutalistSlider';
import { WikiModal } from './ui/WikiModal';





// 15 Architectural zones across 5 Dutch cities
const LOCATIONS = [
    // AMSTERDAM
    { id: 'ams_centrum', city: 'AMSTERDAM', area: 'CENTRUM', lat: 52.3702, lon: 4.8952, bbox: '52.365,4.885,52.375,4.905' },
    { id: 'ams_zuidas', city: 'AMSTERDAM', area: 'ZUIDAS', lat: 52.3376, lon: 4.8732, bbox: '52.332,4.863,52.343,4.883' },
    { id: 'ams_depijp', city: 'AMSTERDAM', area: 'DE PIJP', lat: 52.3547, lon: 4.8918, bbox: '52.349,4.882,52.360,4.902' },

    // ROTTERDAM
    { id: 'rot_centrum', city: 'ROTTERDAM', area: 'CENTRUM', lat: 51.9225, lon: 4.4792, bbox: '51.917,4.474,51.928,4.485' },
    { id: 'rot_blaak', city: 'ROTTERDAM', area: 'BLAAK', lat: 51.9195, lon: 4.4886, bbox: '51.914,4.483,51.925,4.494' },
    { id: 'rot_zuidplein', city: 'ROTTERDAM', area: 'ZUIDPLEIN', lat: 51.8917, lon: 4.4881, bbox: '51.886,4.478,51.897,4.498' },

    // DEN HAAG
    { id: 'dhg_centrum', city: 'DEN HAAG', area: 'CENTRUM', lat: 52.0705, lon: 4.3007, bbox: '52.065,4.294,52.076,4.307' },
    { id: 'dhg_statenkwartier', city: 'DEN HAAG', area: 'STATENKWARTIER', lat: 52.0858, lon: 4.2764, bbox: '52.080,4.266,52.091,4.286' },
    { id: 'dhg_binckhorst', city: 'DEN HAAG', area: 'BINCKHORST', lat: 52.0658, lon: 4.3178, bbox: '52.060,4.308,52.071,4.328' },

    // UTRECHT
    { id: 'utr_centrum', city: 'UTRECHT', area: 'CENTRUM', lat: 52.0907, lon: 5.1214, bbox: '52.085,5.115,52.096,5.128' },
    { id: 'utr_sciencepark', city: 'UTRECHT', area: 'SCIENCE PARK', lat: 52.0869, lon: 5.1738, bbox: '52.081,5.164,52.092,5.184' },
    { id: 'utr_leidscherijn', city: 'UTRECHT', area: 'LEIDSCHE RIJN', lat: 52.0918, lon: 5.0614, bbox: '52.086,5.051,52.097,5.071' },

    // EINDHOVEN
    { id: 'ein_centrum', city: 'EINDHOVEN', area: 'CENTRUM', lat: 51.4416, lon: 5.4697, bbox: '51.436,5.463,51.447,5.477' },
    { id: 'ein_strijps', city: 'EINDHOVEN', area: 'STRIJP-S', lat: 51.4503, lon: 5.4583, bbox: '51.445,5.448,51.456,5.468' },
    { id: 'ein_hightech', city: 'EINDHOVEN', area: 'HIGH TECH CAMPUS', lat: 51.4074, lon: 5.4577, bbox: '51.402,5.448,51.413,5.468' }
];

const VIEWS = [new MapView({ id: 'main', controller: true })];
const CROWD_POINT_SPACING = 0.00015;

const DEFAULT_TRANSIT_INTERVAL_MS = 10000;
const DEFAULT_CROWDS_INTERVAL_MS = 60000;
const WEATHER_FETCH_INTERVAL_MS = 300000;
const WEATHER_CODE_THRESHOLD = 50;


interface NexusViewProps {
    onExit: () => void;
    onNavigate?: (scene: string) => void;
}

const NexusView: React.FC<NexusViewProps> = ({ onExit, onNavigate }) => {
    const [currentLocation, setCurrentLocation] = useState(LOCATIONS[0]);
    const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
    const [selectedBuilding, setSelectedBuilding] = useState<BuildingFeature | null>(null);
    const [selectedCoords, setSelectedCoords] = useState<{lat: number, lon: number} | null>(null);
    const [status, setStatus] = useState('INITIALISING CONSTRUCT...');

    const [usePdokGeometry, setUsePdokGeometry] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [scannerActive, setScannerActive] = useState(true);
    const [showLandmarks, setShowLandmarks] = useState(false);
    const [transitActive, setTransitActive] = useState(false);
    const [transitInterval, setTransitInterval] = useState(DEFAULT_TRANSIT_INTERVAL_MS);
    const [showCrowds, setShowCrowds] = useState(false);
    const [radarActive, setRadarActive] = useState(false);
    const [crowdsInterval, setCrowdsInterval] = useState(DEFAULT_CROWDS_INTERVAL_MS);
    const [crowdData, setCrowdData] = useState<any[]>([]);
    const [panelExpanded, setPanelExpanded] = useState(true);

    // P2000 Emergency Radar (delegated to dedicated hook)
    const { activeAlert, radarIncidents, localAlerts } = useEmergencyRadar(radarActive, currentLocation);

    const [weather, setWeather] = useState('FETCHING...');
    const [time, setTime] = useState(Math.floor(Date.now() / 1000));
    const [hoverInfo, setHoverInfo] = useState<any>(null);

    const [transitStatus, setTransitStatus] = useState('UIT / OFF');
    const [transitFilter, setTransitFilter] = useState<'ALL' | 'TRAM' | 'BUS' | 'METRO' | 'TRAIN' | 'FERRY'>('ALL');
    const [activeTransit, setActiveTransit] = useState<TransitVehicle[]>([]);
    const [transitCounts, setTransitCounts] = useState<Record<string, number>>({});
    const [transitNetworks, setTransitNetworks] = useState<Record<string, any | null>>({});

    const [viewState, setViewState] = useState({
        longitude: LOCATIONS[0].lon,
        latitude: LOCATIONS[0].lat,
        zoom: 15.5,
        pitch: 45,
        bearing: 0,
        maxPitch: 85
    });

    // Persist synthetic vehicles to avoid erratic randomized jumping
    const syntheticStateRef = React.useRef<{ locId: string, vehicles: any[] } | null>(null);

    // Handler for "Coming Soon" toggle
    const handleModelToggle = () => {
        setShowComingSoon(true);
        setTimeout(() => {
            setShowComingSoon(false);
        }, 2000);
    };

    // Time loop for spectral trails
    useEffect(() => {
        let frame: number;
        const animate = () => {
            setTime(Date.now() / 1000);
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, []);

    // Update deck.gl view state
    useEffect(() => {
        setViewState(prev => ({
            ...prev,
            longitude: currentLocation.lon,
            latitude: currentLocation.lat,
            zoom: 15.5,
            pitch: 45,
            bearing: 0,
            transitionDuration: 2000,
            transitionInterpolator: new FlyToInterpolator()
        }));
    }, [currentLocation]);

    // Atmospheric Weather fetching
    useEffect(() => {
        let isActive = true;
        const fetchWeather = async () => {
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${currentLocation.lat}&longitude=${currentLocation.lon}&current_weather=true`);
                const data = await res.json();
                const code = data.current_weather?.weathercode ?? 0;
                const weatherStatus = code > WEATHER_CODE_THRESHOLD ? 'RAIN' : 'CLEAR SKY';
                if (isActive) setWeather(weatherStatus);
            } catch (e) {
                if (isActive) setWeather('API ERROR');
            }
        };
        fetchWeather();
        const int = setInterval(fetchWeather, WEATHER_FETCH_INTERVAL_MS);
        return () => {
            isActive = false;
            clearInterval(int);
        };
    }, [currentLocation]);

    // Fetch Transit Infrastructure Networks
    useEffect(() => {
        if (!transitActive) return;
        let isActive = true;
        const fetchNetworks = async () => {
            const query = `
                [out:json][timeout:25];
                (
                  way["railway"~"tram|subway|rail"](${currentLocation.bbox});
                  way["highway"~"primary|secondary|tertiary|residential|unclassified|bus_guideway"](${currentLocation.bbox});
                  way["route"="ferry"](${currentLocation.bbox});
                );
                out geom;
            `;
            try {
                const cacheName = 'apparitions-transit-net-cache';
                const cacheKey = `https://overpass-api.de/api/interpreter?loc=${currentLocation.id}-transitNet`;
                const cache = await caches.open(cacheName);
                const cachedResponse = await cache.match(cacheKey);

                let data;
                if (cachedResponse) {
                    data = await cachedResponse.json();
                } else {
                    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
                    if (!res.ok) throw new Error('Overpass Net Error');
                    data = await res.json();
                    await cache.put(cacheKey, new Response(JSON.stringify(data)));
                }

                if (!isActive) return;

                const networks: Record<string, any[]> = { TRAM: [], BUS: [], METRO: [], TRAIN: [], FERRY: [] };

                data.elements.forEach((way: any) => {
                    if (way.type === 'way' && way.geometry && way.geometry.length > 1) {
                        const coords = way.geometry.map((n: any) => [n.lon, n.lat]);
                        const ls = lineString(coords);

                        if (way.tags?.route === 'ferry') networks.FERRY.push(ls);
                        else if (way.tags?.railway === 'tram') networks.TRAM.push(ls);
                        else if (way.tags?.railway === 'subway') networks.METRO.push(ls);
                        else if (way.tags?.railway === 'rail') networks.TRAIN.push(ls);
                        else networks.BUS.push(ls);
                    }
                });

                setTransitNetworks({
                    TRAM: networks.TRAM.length > 0 ? featureCollection(networks.TRAM) : null,
                    BUS: networks.BUS.length > 0 ? featureCollection(networks.BUS) : null,
                    METRO: networks.METRO.length > 0 ? featureCollection(networks.METRO) : null,
                    TRAIN: networks.TRAIN.length > 0 ? featureCollection(networks.TRAIN) : null,
                    FERRY: networks.FERRY.length > 0 ? featureCollection(networks.FERRY) : null,
                });
            } catch (err) {
                console.warn('Network fetch error', err);
            }
        };
        fetchNetworks();
        return () => { isActive = false; };
    }, [currentLocation, transitActive]);

    // Compute a wider bbox for the API that includes the 20% fade buffer on all sides
    const apiBbox = useMemo(() => {
        const [minLat, minLon, maxLat, maxLon] = currentLocation.bbox.split(',').map(Number);
        const latSpan = maxLat - minLat;
        const lonSpan = maxLon - minLon;
        const buf = Math.max(latSpan, lonSpan) * 0.20;  // Equal buffer on all sides
        return `${minLat - buf},${minLon - buf},${maxLat + buf},${maxLon + buf}`;
    }, [currentLocation.bbox]);

    // Live Transit via usePollingEffect Hook
    const { data: transitData, error: transitError, loading: transitLoading } = usePollingEffect<any>({
        apiEndpoint: 'http://127.0.0.1:8080/api/transit',
        pollingIntervalMs: transitInterval,
        queryParams: {
            bbox: apiBbox
        },
        enabled: transitActive
    });

    useEffect(() => {
        if (!transitActive) {
            setTransitStatus('OFF');
            setActiveTransit([]);
            setTransitCounts({});
            return;
        }

        if (transitLoading && activeTransit.length === 0) {
            setTransitStatus('CONNECTING...');
        } else if (transitError) {
            // Handle proxy error and fallback to synthetic
            console.warn("OVAPI Proxies failed, generating persistent synthetic local transit data.", transitError);
            setTransitStatus('API ERROR / SYNTHETIC');

            if (!syntheticStateRef.current || syntheticStateRef.current.locId !== currentLocation.id) {
                const numEntities = Math.floor(Math.random() * 6) + 12; // 12-18 vehicles
                const [minLat, minLon, maxLat, maxLon] = currentLocation.bbox.split(',').map(Number);
                const types = ['TRAM', 'BUS', 'METRO', 'TRAIN'];

                syntheticStateRef.current = {
                    locId: currentLocation.id,
                    vehicles: Array.from({ length: numEntities }).map((_, i) => {
                        const type = types[i % types.length];
                        const lat = minLat + (maxLat - minLat) / 2 + (Math.random() - 0.5) * 0.02;
                        const lon = minLon + (maxLon - minLon) / 2 + (Math.random() - 0.5) * 0.02;

                        return {
                            id: `SYNTH-${i}`,
                            vehiclenumber: `SYNTH-${i}`,
                            dataownercode: `SYS`,
                            latitude: lat,
                            longitude: lon,
                            type: type,
                            linename: 'SYNTH',
                            heading: Math.random() * Math.PI * 2,
                            speed: 0.0003 + Math.random() * 0.0002
                        };
                    })
                };
            } else {
                syntheticStateRef.current.vehicles.forEach(v => {
                    v.latitude += Math.cos(v.heading) * v.speed;
                    v.longitude += Math.sin(v.heading) * v.speed;
                    v.heading += (Math.random() - 0.5) * 0.2;
                });
            }

            // Sync synthetic parsing logic
            const vehiclesList = syntheticStateRef.current.vehicles;
            processTransitVehicles(vehiclesList);

        } else if (transitData) {
            const vehiclesList = Object.values(transitData).filter((v: any) =>
                v && typeof v === 'object' &&
                (v.latitude || v.current_lat || v.lat) &&
                (v.longitude || v.current_lon || v.lon)
            );
            processTransitVehicles(vehiclesList);
        }

        function processTransitVehicles(vehiclesList: any[]) {
            const [minLat, minLon, maxLat, maxLon] = currentLocation.bbox.split(',').map(Number);
            // 20% extra buffer equally on all sides; fade zone from edge inward
            const latSpan = maxLat - minLat;
            const lonSpan = maxLon - minLon;
            const buf = Math.max(latSpan, lonSpan) * 0.20;  // Equal buffer on all sides
            const bufferLat = buf;
            const bufferLon = buf;

            const nextVehicles: TransitVehicle[] = [];
            const nextCounts: Record<string, number> = { TRAM: 0, BUS: 0, METRO: 0, TRAIN: 0, FERRY: 0 };
            const seenIds = new Set<string>();

            vehiclesList.forEach((v: any) => {
                let lon = parseFloat(v.longitude || v.current_lon || v.lon);
                let lat = parseFloat(v.latitude || v.current_lat || v.lat);
                const type = v.type || 'BUS';
                const id = `${v.dataownercode || ''}-${v.vehiclenumber || v.id || ''}-${v.linename || ''}`;

                if (seenIds.has(id)) return;

                if (lon > minLon - bufferLon && lon < maxLon + bufferLon &&
                    lat > minLat - bufferLat && lat < maxLat + bufferLat) {
                    seenIds.add(id);

                    // Edge fade: compute how far inside/outside the bbox the vehicle is
                    const distInsideLat = Math.min(lat - minLat, maxLat - lat) / latSpan;
                    const distInsideLon = Math.min(lon - minLon, maxLon - lon) / lonSpan;
                    const edgeDist = Math.min(distInsideLat, distInsideLon);  // negative = outside bbox

                    let fadeOpacity = 1.0;
                    if (edgeDist < -0.02) {
                        // Outer fade zone: -20% to -2% → opacity 0 to 1
                        fadeOpacity = Math.max(0, 1.0 - ((-edgeDist - 0.02) / 0.18));
                    } else if (edgeDist < 0.02) {
                        // Near-edge zone: subtle fade from 0.7 to 1.0
                        fadeOpacity = 0.7 + 0.3 * ((edgeDist + 0.02) / 0.04);
                    }

                    const network = transitNetworks[type as keyof typeof transitNetworks];
                    const backendHeading = parseFloat(v.heading) || 0;
                    const directionId = parseInt(v.direction_id) || 0;
                    let heading = backendHeading;

                    if (network && network.features.length > 0) {
                        try {
                            const pt = point([lon, lat]);
                            const snapped = nearestPointOnLine(network, pt);
                            if (snapped && snapped.geometry) {
                                lon = snapped.geometry.coordinates[0];
                                lat = snapped.geometry.coordinates[1];

                                // Compute heading from the nearest line segment direction
                                const featureIdx = snapped.properties?.index ?? 0;
                                const feature = network.features[featureIdx < network.features.length ? featureIdx : 0];
                                if (feature && feature.geometry) {
                                    const coords = feature.geometry.coordinates;
                                    const segIdx = snapped.properties?.location ?? 0;
                                    const i = Math.min(Math.floor(segIdx), coords.length - 2);
                                    if (i >= 0 && i < coords.length - 1) {
                                        const dx = coords[i + 1][0] - coords[i][0];
                                        const dy = coords[i + 1][1] - coords[i][1];
                                        let segBearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

                                        // Resolve 180° ambiguity using GPS-delta heading or direction_id
                                        if (backendHeading > 0.1) {
                                            // Backend has a computed heading from actual movement — use it as truth
                                            const diff = Math.abs(((segBearing - backendHeading + 540) % 360) - 180);
                                            if (diff > 90) segBearing = (segBearing + 180) % 360;
                                        } else if (directionId === 1) {
                                            // No movement data — use direction_id to flip
                                            segBearing = (segBearing + 180) % 360;
                                        }

                                        heading = segBearing;
                                    }
                                }
                            }
                        } catch (e) {
                            // Fallback to raw gps + api heading
                        }
                    }

                    // Metro runs underground, surface vehicles slightly above road level
                    const elevation = type === 'METRO' ? -8 : 2;
                    nextVehicles.push({ id, type, position: [lon, lat, elevation], heading, opacity: fadeOpacity });
                    nextCounts[type] = (nextCounts[type] || 0) + 1;
                }
            });

            setActiveTransit(nextVehicles);
            setTransitCounts(nextCounts);

            if (!transitError) {
                const total = Object.values(nextCounts).reduce((a, b) => a + b, 0);
                setTransitStatus(`TRACKING: ${total} ENTITIES`);
            }
        }

    }, [transitActive, currentLocation, transitNetworks, transitData, transitError, transitLoading]);

    // Crowd Density via usePollingEffect Hook
    const { data: rawCrowdData, error: crowdError } = usePollingEffect<any>({
        apiEndpoint: 'http://127.0.0.1:8080/api/crowds',
        pollingIntervalMs: crowdsInterval,
        queryParams: {
            bbox: apiBbox
        },
        enabled: showCrowds && currentLocation.id.startsWith('ams_')
    });

    useEffect(() => {
        if (!showCrowds || !currentLocation.id.startsWith('ams_')) {
            setCrowdData([]);
            return;
        }

        if (crowdError) {
            console.warn('[CROWD] Crowd proxy failed:', crowdError);
            return;
        }

        if (rawCrowdData && rawCrowdData.elements) {
            const ways = rawCrowdData.elements || [];
            if (ways.length === 0) return;

            // Bbox and fade zone for crowd points (same as transit)
            const [minLat, minLon, maxLat, maxLon] = currentLocation.bbox.split(',').map(Number);
            const latSpan = maxLat - minLat;
            const lonSpan = maxLon - minLon;

            // Distribute bokeh points along footpath geometries
            const points: Array<{ position: [number, number]; phase: number; brightness: number; fade: number }> = [];

            for (const way of ways) {
                if (!way.geometry || way.geometry.length < 2) continue;

                for (let i = 0; i < way.geometry.length - 1; i++) {
                    const a = way.geometry[i];
                    const b = way.geometry[i + 1];
                    const dLon = b.lon - a.lon;
                    const dLat = b.lat - a.lat;
                    const segLen = Math.sqrt(dLon * dLon + dLat * dLat);
                    const numPts = Math.max(1, Math.floor(segLen / CROWD_POINT_SPACING));

                    for (let j = 0; j <= numPts; j++) {
                        const t = numPts > 0 ? j / numPts : 0;
                        const jitter = (Math.random() - 0.5) * 0.00004;
                        const ptLon = a.lon + dLon * t + jitter;
                        const ptLat = a.lat + dLat * t + jitter;

                        // Edge fade for crowd points
                        const distInsideLat = Math.min(ptLat - minLat, maxLat - ptLat) / latSpan;
                        const distInsideLon = Math.min(ptLon - minLon, maxLon - ptLon) / lonSpan;
                        const edgeDist = Math.min(distInsideLat, distInsideLon);
                        let fade = 1.0;
                        if (edgeDist < -0.02) {
                            fade = Math.max(0, 1.0 - ((-edgeDist - 0.02) / 0.18));
                        } else if (edgeDist < 0.02) {
                            fade = 0.7 + 0.3 * ((edgeDist + 0.02) / 0.04);
                        }

                        points.push({
                            position: [ptLon, ptLat],
                            phase: Math.random() * Math.PI * 2,
                            brightness: Math.random() * 0.5 + 0.5,
                            fade
                        });
                    }
                }
            }

            setCrowdData(points);
        }

    }, [showCrowds, currentLocation, rawCrowdData, crowdError]);



    // Fetch Geometry via Overpass API (with 90-day browser cache)
    useEffect(() => {
        let isActive = true;
        const fetchBuildings = async () => {
            setBuildings([]);
            setStatus('FETCHING GEOMETRY...');

            // Fetch both ways and relations for buildings, historic sites, museums, and places of worship
            const query = `
        [out:json][timeout:25];
        (
          way["building"](${currentLocation.bbox});
          relation["building"](${currentLocation.bbox});
          way["tourism"="museum"](${currentLocation.bbox});
          relation["tourism"="museum"](${currentLocation.bbox});
          way["amenity"="place_of_worship"](${currentLocation.bbox});
          relation["amenity"="place_of_worship"](${currentLocation.bbox});
        );
        out geom;
      `;

            try {
                const cacheName = 'apparitions-overpass-cache';
                const cacheKey = `https://overpass-api.de/api/interpreter?loc=${currentLocation.id}-geom-v5`;
                const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000; // 7,776,000,000 ms

                let parsedBuildings: BuildingFeature[] = [];
                const cache = await caches.open(cacheName);
                const cachedResponse = await cache.match(cacheKey);

                let useCache = false;
                if (cachedResponse) {
                    const cachedData = await cachedResponse.json();
                    if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp < NINETY_DAYS_MS)) {
                        useCache = true;
                        if (!isActive) return;
                        parsedBuildings = cachedData.data;
                    }
                }

                if (!useCache) {
                    const res = await fetch('https://overpass-api.de/api/interpreter', {
                        method: 'POST',
                        body: query
                    });
                    if (!res.ok) throw new Error('Overpass Error');
                    const data = await res.json();

                    if (!isActive) return;

                    // Parse both ways and relations
                    parsedBuildings = data.elements
                        .map((element: any) => {
                            let polygons: number[][][] = [];

                            if (element.type === 'way' && element.geometry) {
                                polygons = [[element.geometry.map((node: any) => [node.lon, node.lat])]];
                            } else if (element.type === 'relation' && element.members) {
                                // For relations, assemble the outer ways into polygons
                                // (Inner ways/holes are skipped for simplicity in this brutalist style)
                                const outerWays = element.members.filter((m: any) => m.role === 'outer' && m.geometry);
                                outerWays.forEach((way: any) => {
                                    polygons.push([way.geometry.map((node: any) => [node.lon, node.lat])]);
                                });
                            }

                            if (polygons.length === 0) return null;

                            const tags = element.tags || {};

                            // 1. Try explicit height tag
                            let height = 15; // default fallback
                            if (tags.height) {
                                // removing any 'm' suffix and parsing
                                const parsed = parseFloat(tags.height.replace(/m/gi, '').trim());
                                if (!isNaN(parsed)) height = parsed;
                            }
                            // 2. Try building:levels
                            else if (tags['building:levels']) {
                                const levels = parseFloat(tags['building:levels']);
                                if (!isNaN(levels)) {
                                    height = Math.max(levels * 3.0, 3.0); // ~3m per human scale level
                                }
                            }
                            // 3. Deterministic pseudo-random scatter based on coordinates for variety
                            else {
                                // Calculate footprint area (sq meters) using Shoelace formula
                                const poly = polygons[0][0];
                                const latScale = 111320; // approx meters per degree lat
                                const lonScale = 111320 * Math.cos(poly[0][1] * Math.PI / 180);

                                let areaSqM = 0;
                                for (let i = 0; i < poly.length; i++) {
                                    const p1 = poly[i];
                                    const p2 = poly[(i + 1) % poly.length];
                                    areaSqM += (p1[0] * lonScale * p2[1] * latScale) - (p2[0] * lonScale * p1[1] * latScale);
                                }
                                areaSqM = Math.abs(areaSqM) / 2;

                                // Base height off realistic architectural footprints
                                let baseHeight = 8;
                                if (areaSqM < 40) baseHeight = 4; // Sheds, garages
                                else if (areaSqM < 150) baseHeight = 8; // Standard houses (2-3 stories)
                                else if (areaSqM < 600) baseHeight = 14; // Medium residential blocks
                                else if (areaSqM < 2000) baseHeight = 22; // Large commercial/apartments
                                else baseHeight = 35 + (Math.min(areaSqM - 2000, 10000) / 1000) * 5; // Towers, massive complexes

                                // Add a tiny 1-2m deterministic scatter so terrace rows aren't perfectly flat
                                const hash = Math.abs(Math.sin(poly[0][0] * 12.9898 + poly[0][1] * 78.233)) * 43758.5453;
                                height = baseHeight + (hash % 2) - 1;
                            }

                            const name = tags.name || null;
                            const type = tags.building || 'building';

                            // Determine landmark category
                            let landmarkType = 'standard';
                            if (tags.building === 'commercial' || tags.building === 'retail' || tags['building:use'] === 'commercial' || tags.mall) {
                                landmarkType = 'commercial';
                            } else if (tags.tourism === 'museum' || tags.historic || tags.amenity === 'place_of_worship' || tags.building === 'civic') {
                                landmarkType = 'civic';
                            } else if (tags.building === 'train_station' || tags.railway === 'station' || tags.industrial) {
                                landmarkType = 'industrial';
                            }

                            const wikidata = tags.wikidata || undefined;
                            const wikipedia = tags.wikipedia || undefined;

                            // Return all sub-polygons for this feature
                            return polygons.map(poly => ({
                                id: element.id.toString(),
                                polygon: poly,
                                height: height,
                                name: name,
                                type: type,
                                landmarkType: landmarkType,
                                wikidata: wikidata,
                                wikipedia: wikipedia
                            }));
                        })
                        .filter(Boolean)
                        .flat(); // Flatten in case a relation generated multiple separate polygons

                    await cache.put(cacheKey, new Response(JSON.stringify({
                        timestamp: Date.now(),
                        data: parsedBuildings
                    })));
                }

                setBuildings(parsedBuildings);
                setStatus('ONLINE');
            } catch (err) {
                if (isActive) setStatus('API ERROR');
            }
        };

        fetchBuildings();
        return () => { isActive = false; };
    }, [currentLocation]);

    // Ghostly Styles mapping — each transport type has its own spectral colour
    const GHOST_COLOURS: Record<string, [number, number, number, number]> = {
        'TRAM': [230, 230, 245, 255],     // Soft Pearl
        'METRO': [100, 200, 255, 255],    // Spectral Cyan
        'BUS': [255, 120, 100, 200],      // Warm Coral
        'TRAIN': [255, 200, 50, 255],     // Amber Gold
        'FERRY': [80, 240, 160, 200]      // Soft Jade
    };

    // True-scale radii in metres (crowd bokeh = 3m for a person)
    const GHOST_RADII: Record<string, number> = {
        'TRAM': 7,      // ~30m long vehicle
        'METRO': 8,     // Wide underground car
        'BUS': 6,       // ~12m long vehicle
        'TRAIN': 9,     // Large rail vehicle
        'FERRY': 10     // Broad watercraft
    };

    const isNL = ['ams_centrum', 'ams_zuidas', 'ams_depijp', 'rot_centrum', 'rot_blaak', 'rot_zuidplein', 'dhg_centrum', 'dhg_statenkwartier', 'dhg_binckhorst', 'utr_centrum', 'utr_sciencepark', 'utr_leidscherijn', 'ein_centrum', 'ein_strijps', 'ein_hightech'].includes(currentLocation.id);

    const handleBuildingClick = useCallback((info: any) => {
        if (info.object && info.object.name) {
            setSelectedBuilding(info.object);
            if (info.coordinate) {
                setSelectedCoords({ lat: info.coordinate[1], lon: info.coordinate[0] });
            } else {
                setSelectedCoords(null);
            }
        }
    }, []);

    const layers = [
        usePdokGeometry && isNL
            ? createPDOKBuildingLayer({ scannerActive, onHover: setHoverInfo, onClick: handleBuildingClick })
            : createOSMBuildingLayer({ buildings, showLandmarks, scannerActive, onHover: setHoverInfo, onClick: handleBuildingClick }),
        ...createTransitLayers({ activeTransit, transitFilter }),
        createCrowdLayer({ crowdData, time }),
        ...(radarActive && radarIncidents.length > 0 ? createRadarLayer(radarIncidents, time) : [])
    ].filter(Boolean);

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const loc = LOCATIONS.find(l => l.id === e.target.value);
        if (loc) {
            setHoverInfo(null);
            setCurrentLocation(loc);
            if (!loc.id.startsWith('ams_')) {
                setShowCrowds(false);
            }
        }
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-body text-white selection:bg-white/20 selection:text-white noise">
            <style dangerouslySetInnerHTML={{
                __html: `
          canvas {
            contrast(1.2) brightness(0.85);
            outline: none;
          }
          @keyframes marquee {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
          @keyframes fadeOut {
            0% { opacity: 1; }
            90% { opacity: 1; }
            100% { opacity: 0; display: none; }
          }
          @keyframes slideDown {
            0% { 
              opacity: 0;
              transform: translateY(-10px);
            }
            100% { 
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }
          .animate-slideDown {
            animation: slideDown 0.2s ease-out forwards;
          }
        `
            }} />

            {/* ── Global Nav ── */}
            <nav className="relative top-0 left-0 w-full h-[100px] z-[100] px-8 md:px-12 flex items-center justify-between pointer-events-none mix-blend-difference">
                <div className="font-display font-bold text-2xl tracking-tighter text-white pointer-events-auto">
                    APPARITIONS: NEXUS
                </div>

                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-[40px] text-xs font-bold tracking-[0.2em] pointer-events-auto">
                    <button onClick={onExit} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HOME</button>
                    <button onClick={() => onNavigate && onNavigate('menu')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">GAMES</button>
                    <button onClick={() => onNavigate && onNavigate('core')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">CORE</button>
                    <button onClick={() => onNavigate && onNavigate('nexus')} className="text-white font-bold transition-colors duration-300 tracking-[0.2em] focus:outline-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">NEXUS</button>
                    <button onClick={() => onNavigate && onNavigate('help')} className="text-[#555] hover:text-white transition-colors duration-300 tracking-[0.2em] focus:outline-none">HELP</button>
                </div>

                <div className="pointer-events-auto font-sans relative">
                    <button onClick={() => onNavigate && onNavigate('contact')} className="px-6 py-2 border border-white/20 rounded-full text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-black transition-colors duration-500">
                        Contact
                    </button>
                </div>
            </nav>

            {/* Emergency Notification UI (Below Contact) */}
            {radarActive && activeAlert && (
                <div 
                    key={activeAlert.id}
                    className="absolute top-[90px] right-8 md:right-12 w-[320px] bg-[#050505]/95 border border-[#333] p-5 shadow-2xl z-[150] pointer-events-auto backdrop-blur-md"
                    style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: activeAlert.color && activeAlert.color.length >= 3
                                ? `rgba(${activeAlert.color[0]}, ${activeAlert.color[1]}, ${activeAlert.color[2]}, 1)`
                                : '#333',
                        animation: 'slideInRight 0.5s ease-out forwards, fadeOut 0.5s ease-in 14.5s forwards'
                    }}
                >
                    <div className="text-[10px] uppercase font-bold tracking-[0.2em] mb-3" style={{
                        color: activeAlert.color && activeAlert.color.length >= 3
                                ? `rgba(${activeAlert.color[0]}, ${activeAlert.color[1]}, ${activeAlert.color[2]}, 1)`
                                : '#FFF'
                    }}>
                        {activeAlert.agency || 'SYSTEM'} INTERCEPT
                    </div>
                    <div className="text-xs text-white/90 font-mono leading-relaxed">
                        {activeAlert.text}
                    </div>
                </div>
            )}

            {/* Map Canvas */}
            <div
                className="absolute inset-0 w-full h-full cursor-crosshair z-0 pointer-events-auto"
                onContextMenu={(e) => e.preventDefault()}
            >
                <DeckGL
                    views={VIEWS}
                    viewState={viewState}
                    onViewStateChange={(e) => {
                        // Strip transition properties on user interaction so panning/zooming doesn't freeze or lag
                        const { transitionDuration, transitionInterpolator, ...rest } = e.viewState as any;
                        setViewState(rest);
                    }}
                    controller={{ dragRotate: true, doubleClickZoom: true, dragPan: true, scrollZoom: true, touchZoom: true, touchRotate: true, keyboard: true }}
                    layers={layers}
                    parameters={{
                        clearColor: [0, 0, 0, 1],
                        depthTest: true
                    } as any}
                    style={{ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%' }}
                />
            </div>

            {/* Brutalist Tooltip */}
            {hoverInfo && hoverInfo.object && scannerActive && (
                <div
                    className="absolute z-50 pointer-events-none p-4 bg-black/50 border border-white backdrop-blur-md shadow-2xl font-mono"
                    style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}
                >
                    <p className="text-[9px] text-white/50 mb-1 tracking-widest uppercase">
                        ENTITY ID: {hoverInfo.object.id}
                    </p>
                    <p className="text-base font-bold tracking-widest uppercase text-white mb-2">
                        {hoverInfo.object.name || (
                            hoverInfo.object.landmarkType === 'civic' ? 'CIVIC STRUCTURE' :
                                hoverInfo.object.landmarkType === 'commercial' ? 'COMMERCIAL STRUCTURE' :
                                    hoverInfo.object.landmarkType === 'industrial' ? 'INDUSTRIAL STRUCTURE' :
                                        'UNKNOWN STRUCTURE'
                        )}
                    </p>
                    <div className="inline-block px-2 py-1 bg-red-600/20 border border-red-600">
                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">
                            CLASS: {hoverInfo.object.type}
                        </p>
                    </div>
                </div>
            )}

            {/* Brutalist Control Interface */}
            <ControlPanel
                status={status}
                scannerActive={scannerActive} setScannerActive={setScannerActive}
                setHoverInfo={setHoverInfo}
                showLandmarks={showLandmarks} setShowLandmarks={setShowLandmarks}
                transitActive={transitActive} setTransitActive={setTransitActive}
                currentLocation={currentLocation} LOCATIONS={LOCATIONS}
                showCrowds={showCrowds} setShowCrowds={setShowCrowds}
                transitStatus={transitStatus} transitCounts={transitCounts}
                transitFilter={transitFilter} setTransitFilter={setTransitFilter}
                transitInterval={transitInterval} setTransitInterval={setTransitInterval}
                crowdsInterval={crowdsInterval} setCrowdsInterval={setCrowdsInterval}
                weather={weather}
                handleLocationChange={handleLocationChange}
                setViewState={setViewState}
                panelExpanded={panelExpanded} setPanelExpanded={setPanelExpanded}
                isDutch={false}
                usePdokGeometry={false}
                setUsePdokGeometry={handleModelToggle}
                showComingSoon={showComingSoon}
                radarActive={radarActive}
                setRadarActive={setRadarActive}
            />

            {/* Minimal Compass */}
            <div className="absolute bottom-8 right-8 z-40 pointer-events-auto">
                <button
                    onClick={() => {
                        setViewState(prev => ({
                            ...prev,
                            bearing: 0,
                            transitionDuration: 600,
                            transitionInterpolator: new FlyToInterpolator()
                        }));
                    }}
                    className="group relative w-14 h-14 flex items-center justify-center"
                    title="Reset North"
                >
                    <div className="absolute inset-0 rounded-full border border-white/15 bg-black/40 backdrop-blur-sm group-hover:border-white/30 transition-colors duration-300" />
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 40 40"
                        fill="none"
                        className="w-8 h-8 relative z-10 transition-transform duration-300"
                        style={{ transform: `rotate(${-(viewState as any).bearing || 0}deg)` }}
                    >
                        {/* North needle */}
                        <polygon points="20,4 23,20 20,18 17,20" fill="#dc2626" opacity="0.9" />
                        {/* South needle */}
                        <polygon points="20,36 23,20 20,22 17,20" fill="white" opacity="0.2" />
                        {/* N label */}
                        <text x="20" y="3" textAnchor="middle" fill="#dc2626" fontSize="5" fontFamily="monospace" fontWeight="bold" opacity="0.8">N</text>
                    </svg>
                </button>
            </div>

            {/* ── PRIORITY EMERGENCY UI (ABSOLUTE TOP LAYER) ── */}
            {/* Ticker Removed as per UI Redesign */}

            <WikiModal 
                building={selectedBuilding}
                city={currentLocation.city}
                coords={selectedCoords}
                onClose={() => setSelectedBuilding(null)}
            />
        </div>
    );
};

export default NexusView;
