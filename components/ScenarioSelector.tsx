
import React from 'react';
import { ScenarioType } from '../types';
import { SCENARIO_DATA } from '../constants';

interface ScenarioSelectorProps {
  onSelect: (scenario: ScenarioType) => void;
}

const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ onSelect }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl px-4 animate-in fade-in duration-1000">
      {(Object.entries(SCENARIO_DATA) as [ScenarioType, any][]).map(([key, data]) => (
        <button
          key={key}
          onClick={() => onSelect(key as ScenarioType)}
          className="group relative flex flex-col items-start p-10 bg-[#080808] border border-[#1a1a1a] hover:border-[#444] hover:bg-[#0c0c0c] transition-all duration-700 text-left overflow-hidden shadow-xl hover:shadow-[0_0_30px_rgba(255,255,255,0.03)] focus:outline-none focus:ring-1 focus:ring-white/20"
          aria-label={`Selecteer scenario: ${data.title}`}
        >
          <div className="absolute top-0 left-0 w-1 h-0 bg-white/80 group-hover:h-full transition-all duration-700 ease-out" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          <div className="text-gray-600 group-hover:text-gray-300 mb-6 transition-colors duration-700 transform group-hover:scale-110 group-hover:-translate-y-1">
            {data.icon}
          </div>
          <h3 className="text-2xl font-light tracking-[0.2em] uppercase mb-4 text-gray-300 group-hover:text-white group-hover:translate-x-2 transition-all duration-700">
            {data.title}
          </h3>
          <p className="text-sm text-gray-500 font-light leading-relaxed group-hover:text-gray-400 transition-colors duration-700">
            {data.description}
          </p>
        </button>
      ))}
    </div>
  );
};

export default ScenarioSelector;
