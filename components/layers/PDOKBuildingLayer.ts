import { MVTLayer } from '@deck.gl/geo-layers';

const FALLBACK_HEIGHT = 10;
const MIN_ZOOM_LEVEL = 14;
const MAX_ZOOM_LEVEL = 20;

const COLOUR_STANDARD_BUILDING: [number, number, number, number] = [40, 40, 45, 255];
const COLOUR_HIGHLIGHT: [number, number, number, number] = [255, 0, 0, 255];

const MATERIAL_AMBIENT = 0.3;
const MATERIAL_DIFFUSE = 0.6;
const MATERIAL_SHININESS = 60;
const MATERIAL_SPECULAR_COLOUR: [number, number, number] = [180, 180, 200];

interface PDOKBuildingLayerProps {
    scannerActive: boolean;
    onHover: (info: any) => void;
    onClick?: (info: any) => void;
}

export const createPDOKBuildingLayer = ({ scannerActive, onHover, onClick }: PDOKBuildingLayerProps) => {
    return new MVTLayer({
        id: 'pdok-buildings-layer',
        data: 'http://127.0.0.1:8080/api/pdok/tiles/{z}/{x}/{y}',
        minZoom: MIN_ZOOM_LEVEL,
        maxZoom: MAX_ZOOM_LEVEL,
        extruded: true,
        wireframe: false,
        getElevation: (d: any) => {
            if (d.properties && d.properties.h_dak_max !== undefined && d.properties.h_maaiveld !== undefined) {
                return d.properties.h_dak_max - d.properties.h_maaiveld;
            }
            return FALLBACK_HEIGHT; /* Fallback height */
        },
        getFillColor: () => COLOUR_STANDARD_BUILDING,
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
        onClick: onClick,
        updateTriggers: {
            pickable: scannerActive,
            autoHighlight: scannerActive,
        }
    });
};
