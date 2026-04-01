import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { GLTFLoader } from '@loaders.gl/gltf';

export interface TransitVehicle {
    id: string;
    type: 'TRAM' | 'BUS' | 'METRO' | 'TRAIN' | 'FERRY';
    position: [number, number, number];
    heading: number;
    opacity: number;
}

const REMOTE_MODELS: Record<string, string> = {
    'TRAM': '/models/tram.glb',
    'BUS': '/models/bus.glb',
    'TRAIN': '/models/train.glb',
    'METRO': '/models/metro.glb',
    'FERRY': '/models/ferry.glb'
};

const GHOST_COLOURS: Record<string, [number, number, number, number]> = {
    'TRAM': [230, 230, 245, 255],
    'METRO': [100, 200, 255, 255],
    'BUS': [255, 120, 100, 200],
    'TRAIN': [255, 200, 50, 255],
    'FERRY': [80, 240, 160, 200]
};

const METRO_OPACITY_MULTIPLIER = 0.3;
const DEFAULT_OPACITY_MULTIPLIER = 1.0;
const ORIENTATION_TRANSITION_MS = 2000;
const ORIENTATION_PITCH_OFFSET = 90;

interface TransitLayerProps {
    activeTransit: TransitVehicle[];
    transitFilter: 'ALL' | 'TRAM' | 'BUS' | 'METRO' | 'TRAIN' | 'FERRY';
}

export const createTransitLayers = ({ activeTransit, transitFilter }: TransitLayerProps) => {
    const transitTypes = ['TRAM', 'BUS', 'METRO', 'TRAIN', 'FERRY'];
    const activeParticles = activeTransit.filter(
        d => transitFilter === 'ALL' || d.type === transitFilter
    );

    return transitTypes.map(type => {
        const typeParticles = activeParticles.filter(d => d.type === type);
        const baseColor = GHOST_COLOURS[type] || [255, 255, 255, 255];
        return new ScenegraphLayer({
            id: `particles-scenegraph-${type}`,
            data: typeParticles,
            visible: typeParticles.length > 0,
            pickable: true,
            scenegraph: REMOTE_MODELS[type] || REMOTE_MODELS['BUS'],
            getPosition: (d: any) => d.position,
            getOrientation: (d: any) => [0, d.heading, ORIENTATION_PITCH_OFFSET],
            getColor: (d: any) => {
                const multiplier = type === 'METRO' ? METRO_OPACITY_MULTIPLIER : DEFAULT_OPACITY_MULTIPLIER;
                const alpha = Math.round(baseColor[3] * d.opacity * multiplier);
                return [baseColor[0], baseColor[1], baseColor[2], alpha];
            },
            sizeScale: 1,
            loaders: [GLTFLoader],
            transitions: {
                getOrientation: {
                    duration: ORIENTATION_TRANSITION_MS,
                    easing: (t: number) => t
                }
            },
            updateTriggers: {
                getColor: [type]
            }
        });
    });
};
