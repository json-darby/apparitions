import { ScatterplotLayer } from '@deck.gl/layers';

const CROWD_BOKEH_RADIUS = 3;          /* Base radius of each bokeh circle (metres) */
const CROWD_BOKEH_MAX_PX = 8;          /* Maximum pixel size at any zoom level */
const CROWD_BOKEH_MIN_PX = 1;          /* Minimum pixel size at any zoom level */

const TIME_MULTIPLIER = 0.8;
const TWINKLE_MULTIPLIER = 0.5;
const TWINKLE_OFFSET = 0.5;
const BASE_ALPHA = 30;
const BRIGHTNESS_MULTIPLIER = 80;
const BOKEH_COLOUR_R = 255;
const BOKEH_COLOUR_G = 180;
const BOKEH_COLOUR_B = 80;
const DEFAULT_FADE = 1.0;

interface CrowdLayerProps {
    crowdData: any[];
    time: number;
}

export const createCrowdLayer = ({ crowdData, time }: CrowdLayerProps) => {
    return new ScatterplotLayer({
        id: 'crowd-bokeh',
        data: crowdData,
        getPosition: (d: any) => d.position,
        getFillColor: (d: any) => {
            /* Warm amber bokeh: each dot twinkles independently using its phase */
            const twinkle = Math.sin(time * TIME_MULTIPLIER + d.phase) * TWINKLE_MULTIPLIER + TWINKLE_OFFSET;
            const fade = d.fade ?? DEFAULT_FADE;
            const alpha = Math.floor((BASE_ALPHA + twinkle * d.brightness * BRIGHTNESS_MULTIPLIER) * fade);  /* Edge fade applied */
            return [BOKEH_COLOUR_R, BOKEH_COLOUR_G, BOKEH_COLOUR_B, alpha];
        },
        getRadius: CROWD_BOKEH_RADIUS,
        radiusUnits: 'meters',
        radiusMinPixels: CROWD_BOKEH_MIN_PX,
        radiusMaxPixels: CROWD_BOKEH_MAX_PX,
        opacity: 0.6,
        updateTriggers: {
            getFillColor: [time]
        }
    });
};
