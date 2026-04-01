import { PolygonLayer } from '@deck.gl/layers';

const COLOUR_NAMED_LANDMARK: [number, number, number, number] = [90, 90, 95, 255];
const COLOUR_UNNAMED_LANDMARK: [number, number, number, number] = [60, 60, 60, 255];
const COLOUR_STANDARD_BUILDING: [number, number, number, number] = [40, 40, 45, 255];
const COLOUR_HIGHLIGHT: [number, number, number, number] = [255, 0, 0, 255];

const MATERIAL_AMBIENT = 0.3;
const MATERIAL_DIFFUSE = 0.6;
const MATERIAL_SHININESS = 60;
const MATERIAL_SPECULAR_COLOUR: [number, number, number] = [180, 180, 200];

export interface BuildingFeature {
    id: string;
    polygon: [number, number][][];
    height: number;
    name: string | null;
    type: string;
    landmarkType: string;
    wikidata?: string;
    wikipedia?: string;
}

interface OSMBuildingLayerProps {
    buildings: BuildingFeature[];
    showLandmarks: boolean;
    scannerActive: boolean;
    onHover: (info: any) => void;
    onClick?: (info: any) => void;
}

export const createOSMBuildingLayer = ({
    buildings,
    showLandmarks,
    scannerActive,
    onHover,
    onClick,
}: OSMBuildingLayerProps) => {
    return new PolygonLayer<BuildingFeature>({
        id: 'buildings-layer',
        data: buildings,
        extruded: true,
        wireframe: false,
        getPolygon: (d) => d.polygon,
        getElevation: (d: any) => d.height,
        getFillColor: (d: any) => {
            if (showLandmarks) {
                if (d.name) return COLOUR_NAMED_LANDMARK;
                if (d.landmarkType !== 'standard') return COLOUR_UNNAMED_LANDMARK;
                return COLOUR_STANDARD_BUILDING;
            }
            return COLOUR_STANDARD_BUILDING;
        },
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
            getFillColor: [showLandmarks]
        }
    });
};
