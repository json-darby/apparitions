import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { GLTFLoader } from '@loaders.gl/gltf';

/* ── Visual Constants ── */

/** Baseline radius of the ground glow ring, in metres. */
const GROUND_GLOW_RADIUS_BASE_M = 50;

/** Amplitude of the breathing oscillation on the ring, in metres (subtle). */
const GROUND_GLOW_BREATH_AMPLITUDE_M = 8;

/** Speed of the breathing cycle (higher = faster). */
const BREATH_SPEED = 1.2;

/** Ground glow fill opacity ceiling (0–255). */
const GROUND_GLOW_OPACITY = 50;

/** Slight elevation to prevent Z-fighting with terrain. */
const GROUND_GLOW_ELEVATION_M = 0.5;

/** Elevation of the atmospheric beacon halo, in metres. */
const BEACON_ELEVATION_M = 30;

/** Radius of the beacon halo, in metres. */
const BEACON_RADIUS_M = 25;

/** Elevation of the floating diamond plumbob, in metres. */
const PLUMBOB_ELEVATION_M = 60;

/** Minimum pixel size of the diamond so it never disappears when zoomed out. */
const PLUMBOB_MIN_PIXELS = 18;

/** Maximum pixel size of the diamond. */
const PLUMBOB_MAX_PIXELS = 60;

/** Transition duration for smooth position changes, in milliseconds. */
const TRANSITION_DURATION_MS = 600;

/** Age in seconds at which the marker begins fading out. */
const FADE_START_AGE_S = 50;

/** Age in seconds at which the marker fully disappears. */
const FADE_END_AGE_S = 60;

/** Fallback colour when an incident has no colour data. */
const DEFAULT_COLOUR: [number, number, number, number] = [255, 0, 0, 255];

/* ── Helpers ── */

/**
 * Computes per-incident opacity based on how long ago it was spawned.
 * Full opacity until FADE_START_AGE_S, then linear fade to 0 at FADE_END_AGE_S.
 */
const computeFadeOpacity = (incident: any, currentTime: number): number => {
    const spawnTime = incident._spawnTime || currentTime;
    const ageSeconds = currentTime - spawnTime;

    if (ageSeconds < FADE_START_AGE_S) return 1.0;
    if (ageSeconds >= FADE_END_AGE_S) return 0.0;

    return 1.0 - ((ageSeconds - FADE_START_AGE_S) / (FADE_END_AGE_S - FADE_START_AGE_S));
};

/* ── Layer Factory ── */

/**
 * Creates the three-layer radar marker stack: ground glow, atmospheric beacon,
 * and the floating diamond plumbob. All layers support per-incident fade-out.
 *
 * @param incidents Array of active emergency incidents to render.
 * @param time Current epoch time in seconds, drives breathing and fade animations.
 */
export const createRadarLayer = (incidents: any[], time: number = 0) => {
    /* Breathing oscillation (subtle) */
    const breathOffset = Math.sin(time * BREATH_SPEED) * GROUND_GLOW_BREATH_AMPLITUDE_M;
    const breathingRadius = GROUND_GLOW_RADIUS_BASE_M + breathOffset;

    /* Breathing opacity for the ring: gentle pulse between 0.3 and 0.5 */
    const ringBreathFactor = 0.3 + 0.2 * ((Math.sin(time * BREATH_SPEED) + 1) / 2);

    return [
        /* Ground glow ring — subtle breathing radius and opacity */
        new ScatterplotLayer({
            id: 'emergency-radar-glow-layer',
            data: incidents,
            pickable: false,
            stroked: true,
            filled: true,
            radiusScale: 1,
            radiusMinPixels: 4,
            radiusMaxPixels: 200,
            lineWidthMinPixels: 1,
            getPosition: (d: any) => [d.longitude, d.latitude, GROUND_GLOW_ELEVATION_M],
            getFillColor: (d: any) => {
                const c = d.color || DEFAULT_COLOUR;
                const fade = computeFadeOpacity(d, time);
                return [c[0], c[1], c[2], Math.round(GROUND_GLOW_OPACITY * fade * ringBreathFactor)];
            },
            getLineColor: (d: any) => {
                const c = d.color || DEFAULT_COLOUR;
                const fade = computeFadeOpacity(d, time);
                return [c[0], c[1], c[2], Math.round(200 * fade * ringBreathFactor)];
            },
            getRadius: () => breathingRadius,
            getLineWidth: 2,
            updateTriggers: {
                getRadius: [time],
                getFillColor: [time],
                getLineColor: [time]
            }
        }),
        /* Atmospheric beacon halo — gentle counter-phase breathing */
        new ScatterplotLayer({
            id: 'emergency-radar-beacon-layer',
            data: incidents,
            pickable: false,
            stroked: true,
            filled: false,
            radiusScale: 1,
            getPosition: (d: any) => [d.longitude, d.latitude, BEACON_ELEVATION_M],
            getLineColor: (d: any) => {
                const c = d.color || DEFAULT_COLOUR;
                const fade = computeFadeOpacity(d, time);
                const breathAlpha = 0.15 + 0.15 * ((Math.sin(time * BREATH_SPEED + Math.PI) + 1) / 2);
                return [c[0], c[1], c[2], Math.round(255 * breathAlpha * fade)];
            },
            getRadius: () => BEACON_RADIUS_M + breathOffset * 0.4,
            getLineWidth: 5,
            updateTriggers: {
                getRadius: [time],
                getLineColor: [time]
            }
        }),
        /* Floating diamond plumbob — 3D Sims-style marker */
        new ScenegraphLayer({
            id: 'emergency-radar-plumbob-layer',
            data: incidents,
            pickable: false,
            scenegraph: '/models/plumbob.glb',
            loaders: [GLTFLoader],
            sizeScale: 15, // Change if the model is too big or small
            // Ensure the model tints to the emergency colour
            _lighting: 'pbr',
            getColor: (d: any) => {
                const c = d.color || DEFAULT_COLOUR;
                const fade = computeFadeOpacity(d, time);
                return [c[0], c[1], c[2], Math.round(255 * fade)];
            },
            getPosition: (d: any) => {
                const hash = (d.id || '').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                // Hover bobbing animation using a sine wave
                const bob = Math.sin(time * 2 + hash) * 3;
                return [d.longitude, d.latitude, PLUMBOB_ELEVATION_M + bob];
            },
            getOrientation: (d: any) => {
                // Continuous rotation around the Y (up) axis
                const speedMultiplier = 60; // degrees per second
                const rotation = (time * speedMultiplier) % 360;
                return [0, rotation, 0];
            },
            updateTriggers: {
                getColor: [time],
                getPosition: [time],
                getOrientation: [time]
            }
        })
    ];
};
