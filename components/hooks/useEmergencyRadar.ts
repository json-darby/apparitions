import { useState, useEffect, useCallback, useRef } from 'react';
import { usePollingEffect } from './usePollingEffect';

/* ── Types ── */

/** Represents a single emergency incident from the P2000 scraper. */
export interface EmergencyIncident {
    id: string;
    text: string;
    rawText?: string;
    agency: string;
    colour: number[];
    color: number[];
    isPrio1: boolean;
    longitude: number;
    latitude: number;
    timestamp: number;
    ageMinutes: number;
}

/** The shape returned by the useEmergencyRadar hook. */
export interface EmergencyRadarState {
    activeAlert: EmergencyIncident | null;
    radarIncidents: EmergencyIncident[];
    localAlerts: EmergencyIncident[];
}

/** Location descriptor required by the hook for bounding-box calculations. */
export interface RadarLocation {
    id: string;
    bbox: string;
}

/* ── Constants ── */

/** Interval between P2000 API polls, in milliseconds. */
const RADAR_POLL_INTERVAL_MS = 20000;

/** Duration each notification message remains visible, in milliseconds. */
const ALERT_DISPLAY_DURATION_MS = 20000;

/** Duration each plumbob 3D marker remains on the map, in milliseconds. */
const PLUMBOB_DURATION_MS = 60000;

/** Delay before the first alert pops from the queue, in milliseconds. */
const QUEUE_POP_DELAY_MS = 1000;

/** Delay before the mock system-startup alert fires, in milliseconds. */
const MOCK_STARTUP_DELAY_MS = 500;

/** Buffer multiplier applied to the bounding box for locality checks. */
const LOCALITY_BUFFER_RATIO = 0.20;

/** The backend endpoint for stateless P2000 incident data. */
const P2000_RADAR_ENDPOINT = '/api/p2000/radar';

/** Amsterdam-specific mock incident injected on radar activation. */
const MOCK_INCIDENTS: EmergencyIncident[] = [
    {
        id: 'SYSTEM-STARTUP',
        text: 'NOTIFICATIONS ON / SYSTEM READY',
        latitude: 52.3732,
        longitude: 4.8973,
        agency: 'SYSTEM',
        colour: [255, 255, 255, 255],
        color: [255, 255, 255, 255],
        isPrio1: true,
        timestamp: Date.now() / 1000,
        ageMinutes: 0
    },
    /* ──────── DELETE: Test plumbob incidents ──────── */
    {
        id: 'MOCK-DAM-SQUARE',
        text: 'Ambulance Inzet Dam Amsterdam (TEST)',
        latitude: 52.3731,
        longitude: 4.8932,
        agency: 'AMBULANCE',
        colour: [59, 130, 246, 255],
        color: [59, 130, 246, 255],
        isPrio1: true,
        timestamp: Date.now() / 1000,
        ageMinutes: 0
    },
    {
        id: 'MOCK-DE-WALLEN',
        text: 'Politie inzet Oudezijds Voorburgwal (TEST)',
        latitude: 52.3731,
        longitude: 4.8980,
        agency: 'POLICE',
        colour: [220, 38, 38, 255],
        color: [220, 38, 38, 255],
        isPrio1: true,
        timestamp: Date.now() / 1000,
        ageMinutes: 0
    },
    {
        id: 'MOCK-CENTRAAL',
        text: 'Brandweer Amsterdam Centraal Station (TEST)',
        latitude: 52.3791,
        longitude: 4.9003,
        agency: 'FIRE',
        colour: [239, 68, 68, 255],
        color: [239, 68, 68, 255],
        isPrio1: true,
        timestamp: Date.now() / 1000,
        ageMinutes: 0
    }
    /* ──────── END DELETE ──────── */
];

/* ── Hook ── */

/**
 * Encapsulates all P2000 emergency radar logic: polling, FIFO queueing,
 * paced display, and locality-based 3D marker synchronisation.
 *
 * @param radarActive Whether the user has toggled the emergency updates on.
 * @param currentLocation The currently selected map location (provides id and bbox).
 * @returns The active alert, radar incidents for the 3D layer, and local alerts.
 */
export function useEmergencyRadar(
    radarActive: boolean,
    currentLocation: RadarLocation
): EmergencyRadarState {
    /* ── Internal State ── */
    const [playbackQueue, setPlaybackQueue] = useState<EmergencyIncident[]>([]);
    const [activeAlert, setActiveAlert] = useState<EmergencyIncident | null>(null);
    const [radarIncidents, setRadarIncidents] = useState<EmergencyIncident[]>([]);
    const [localAlerts, setLocalAlerts] = useState<EmergencyIncident[]>([]);
    const [activeMockIds, setActiveMockIds] = useState<Set<string>>(new Set());

    /** Persistent set of incident IDs already processed, survives re-renders. */
    const seenAlerts = useRef<Set<string>>(new Set());

    /* ── Mock Incident Sequencer ── */
    useEffect(() => {
        if (!radarActive || !currentLocation.id.startsWith('ams_')) {
            setActiveMockIds(new Set());
            return;
        }

        // Activate all mock incidents immediately on startup
        const timer = setTimeout(() => {
            setActiveMockIds(new Set(MOCK_INCIDENTS.map(m => m.id)));
        }, MOCK_STARTUP_DELAY_MS);

        return () => clearTimeout(timer);
    }, [radarActive, currentLocation.id]);

    /* ── P2000 Polling ── */
    const { data: queueData, error: queueError } = usePollingEffect<any>({
        apiEndpoint: P2000_RADAR_ENDPOINT,
        pollingIntervalMs: RADAR_POLL_INTERVAL_MS,
        enabled: radarActive
    });

    /* ── State Cleanup on Disable ── */
    useEffect(() => {
        if (!radarActive) {
            setPlaybackQueue([]);
            setActiveAlert(null);
            seenAlerts.current.clear();
            setRadarIncidents([]);
            setLocalAlerts([]);
        }
    }, [radarActive]);

    /* ── Queue Ingestion (populate playback array, deduplicate) ── */
    useEffect(() => {
        if (!radarActive) return;

        if (queueError) {
            console.warn('[P2000] Queue fetch failed:', queueError);
        }

        let allIncidents: EmergencyIncident[] = [];
        if (queueData && queueData.incidents) {
            allIncidents = [...queueData.incidents];
        }

        // Inject mock incidents when viewing an Amsterdam location
        if (currentLocation.id.startsWith('ams_')) {
            const activeMocks = MOCK_INCIDENTS.filter(m => activeMockIds.has(m.id));
            allIncidents = [...activeMocks, ...allIncidents];
        }

        /*
         * Filter to genuinely unseen incidents BEFORE the state updater.
         * This prevents React Strict Mode's double-invocation from
         * emptying the queue (see deep-cuts skill, entry #1).
         */
        const newIncidents = allIncidents.filter(
            inc => !seenAlerts.current.has(inc.id)
        );

        if (newIncidents.length > 0) {
            newIncidents.forEach(inc => seenAlerts.current.add(inc.id));

            setPlaybackQueue(prev => {
                const currentIds = new Set(prev.map(i => i.id));
                const toAdd = newIncidents.filter(inc => !currentIds.has(inc.id));
                return [...prev, ...toAdd];
            });
        }
    }, [queueData, queueError, radarActive, currentLocation, activeMockIds]);

    /* ── Alert Expiry Handler (clears the notification only, NOT the plumbob) ── */
    const handleAlertFinished = useCallback(() => {
        setActiveAlert(null);
        setLocalAlerts([]);
    }, []);

    /* ── Playback Queue Processor (FIFO, paced at ALERT_DISPLAY_DURATION_MS) ── */
    useEffect(() => {
        if (!activeAlert && playbackQueue.length > 0) {
            const timer = setTimeout(() => {
                const nextAlert = playbackQueue[0];
                setActiveAlert(nextAlert);
                setPlaybackQueue(prev => prev.slice(1));

                // Determine whether the alert falls within the visible map viewport
                const [minLat, minLon, maxLat, maxLon] = currentLocation.bbox.split(',').map(Number);
                const latSpan = maxLat - minLat;
                const lonSpan = maxLon - minLon;
                const buf = Math.max(latSpan, lonSpan) * LOCALITY_BUFFER_RATIO;
                const lat = nextAlert.latitude;
                const lon = nextAlert.longitude;

                const isLocal = nextAlert.id.startsWith('SYSTEM') || nextAlert.id.startsWith('MOCK') || (
                    lat > minLat - buf && lat < maxLat + buf &&
                    lon > minLon - buf && lon < maxLon + buf
                );

                if (isLocal) {
                    setLocalAlerts([nextAlert]);
                } else {
                    setLocalAlerts([]);
                }

                // Add plumbob to the map (skip for system notifications)
                if (nextAlert.id !== 'SYSTEM-STARTUP') {
                    const markerIncident = { ...nextAlert, _spawnTime: Date.now() / 1000 };
                    setRadarIncidents(prev => [...prev, markerIncident]);

                    // Automatically remove the plumbob after PLUMBOB_DURATION_MS
                    setTimeout(() => {
                        setRadarIncidents(prev => prev.filter(inc => inc.id !== nextAlert.id));
                    }, PLUMBOB_DURATION_MS);
                }

                // Automatically expire the notification message
                const messageTimer = setTimeout(() => {
                    handleAlertFinished();
                }, ALERT_DISPLAY_DURATION_MS);

                return () => clearTimeout(messageTimer);
            }, QUEUE_POP_DELAY_MS);

            return () => clearTimeout(timer);
        }
    }, [activeAlert, playbackQueue, currentLocation, handleAlertFinished]);

    return { activeAlert, radarIncidents, localAlerts };
}
