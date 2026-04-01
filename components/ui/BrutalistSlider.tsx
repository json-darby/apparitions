import React from 'react';

interface BrutalistSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    active?: boolean;
    formatValue?: (value: number) => string;
}

const DEFAULT_STEP = 1000;
const MILLISECONDS_PER_SECOND = 1000;

export const BrutalistSlider: React.FC<BrutalistSliderProps> = ({
    label,
    value,
    min,
    max,
    step = DEFAULT_STEP,
    onChange,
    active = true,
    formatValue = (v) => `${Math.floor(v / MILLISECONDS_PER_SECOND)}s`
}) => {
    return (
        <div className={`flex flex-col gap-2 w-full pt-2 border-t border-white/10 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-30'}`}>
            <div className="flex justify-between items-center w-full">
                <span className="text-[10px] uppercase tracking-tighter text-white/70">{label}</span>
                <span className="text-[10px] font-bold text-white tracking-widest">{formatValue(value)}</span>
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={!active}
                className={`
                    w-full h-2 appearance-none bg-white/10 outline-none
                    /* Custom Webkit Slider styling for harsh neobrutalism */
                    [&::-webkit-slider-runnable-track]:appearance-none
                    [&::-webkit-slider-runnable-track]:h-2
                    
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-4
                    [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:bg-red-600
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-white
                    [&::-webkit-slider-thumb]:rounded-none
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:-mt-1
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(220,38,38,0.5)]
                    
                    /* Mozilla specifics */
                    [&::-moz-range-track]:appearance-none
                    [&::-moz-range-track]:h-2
                    [&::-moz-range-track]:bg-white/10
                    
                    [&::-moz-range-thumb]:appearance-none
                    [&::-moz-range-thumb]:w-4
                    [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:bg-red-600
                    [&::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:border-white
                    [&::-moz-range-thumb]:rounded-none
                    [&::-moz-range-thumb]:cursor-pointer
                `}
            />
            <div className="flex justify-between w-full mt-1">
                <span className="text-[8px] text-white/40 tracking-widest">{formatValue(min)}</span>
                <span className="text-[8px] text-white/40 tracking-widest">{formatValue(max)}</span>
            </div>
        </div>
    );
};
