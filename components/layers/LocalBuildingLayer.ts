import { GeoJsonLayer } from '@deck.gl/layers';

const FALLBACK_HEIGHT = 10;
const COLOUR_DEFAULT_FILL: [number, number, number, number] = [40, 40, 45, 255];
const COLOUR_HIGHLIGHT: [number, number, number, number] = [255, 0, 0, 255];

const MATERIAL_AMBIENT = 0.3;
const MATERIAL_DIFFUSE = 0.6;
const MATERIAL_SHININESS = 60;
const MATERIAL_SPECULAR_COLOUR: [number, number, number] = [180, 180, 200];

interface LocalBuildingLayerProps {
    data: any; // Raw GeoJSON FeatureCollection
    scannerActive: boolean;
    onHover: (info: any) => void;
}

export const createLocalBuildingLayer = ({
    data,
    scannerActive,
    onHover,
}: LocalBuildingLayerProps) => {
    return new GeoJsonLayer({
        id: 'local-buildings-layer',
        data: data,
        extruded: true,
        wireframe: false,
        /* Automatically reads geometry from the JSON. Calculates height from the PDOK properties. */
        getElevation: (f: any) => {
            if (f.properties && f.properties.h_dak_max !== undefined && f.properties.h_maaiveld !== undefined) {
                return f.properties.h_dak_max - f.properties.h_maaiveld;
            }
            return FALLBACK_HEIGHT; /* Fallback height */
        },
        
        getFillColor: COLOUR_DEFAULT_FILL,
        
        material: {
            ambient: MATERIAL_AMBIENT,
            diffuse: MATERIAL_DIFFUSE,
            shininess: MATERIAL_SHININESS,
            specularColor: MATERIAL_SPECULAR_COLOUR
        },
        
        pickable: scannerActive,
        autoHighlight: scannerActive,
        highlightColor: COLOUR_HIGHLIGHT,
        onHover: onHover,
        
        updateTriggers: {
            pickable: scannerActive,
            autoHighlight: scannerActive,
        }
    });
};
