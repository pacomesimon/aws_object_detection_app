import React, { useState } from 'react';
import { OntologyClass } from '../types';
import { Plus, Eye, EyeOff, SlidersHorizontal } from 'lucide-react';
import { COLOR_PALETTE } from '../data/presets';

interface LabelStreamRibbonProps {
  ontology: OntologyClass[];
  setOntology: React.Dispatch<React.SetStateAction<OntologyClass[]>>;
  activeLabel: string;
  setActiveLabel: (labelName: string) => void;
  hiddenClasses: Set<string>;
  toggleClassVisibility: (className: string) => void;
  currentImageDetectionsCount?: Record<string, number>;
  onOpenTaxonomyModal: () => void;
}

export const LabelStreamRibbon: React.FC<LabelStreamRibbonProps> = ({
  ontology,
  setOntology,
  activeLabel,
  setActiveLabel,
  hiddenClasses,
  toggleClassVisibility,
  currentImageDetectionsCount = {},
  onOpenTaxonomyModal,
}) => {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const trimmed = newClassName.trim();
    if (ontology.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setActiveLabel(trimmed);
      setShowAddInput(false);
      setNewClassName('');
      return;
    }

    const assignedColor = COLOR_PALETTE[ontology.length % COLOR_PALETTE.length];
    const newClass: OntologyClass = {
      id: `class-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      description: `Object class for ${trimmed}`,
      color: assignedColor,
    };

    setOntology((prev) => [...prev, newClass]);
    setActiveLabel(trimmed);
    setShowAddInput(false);
    setNewClassName('');
  };

  return (
    <div
      id="label-studio-label-stream"
      className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 text-xs select-none"
    >
      {/* Left: Classes label chips (scrollable horizontally if needed) */}
      <div className="flex items-center gap-2 flex-nowrap min-w-0 overflow-x-auto py-0.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
          Labels:
        </span>

        {ontology.map((cls, idx) => {
          const isActive = activeLabel.toLowerCase() === cls.name.toLowerCase();
          const isHidden = hiddenClasses.has(cls.name);
          const count = currentImageDetectionsCount[cls.name] || 0;
          const hotkey = idx < 9 ? idx + 1 : null;

          return (
            <div
              key={cls.id}
              className={`group inline-flex items-center rounded-md border transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              } ${isHidden ? 'opacity-40' : ''}`}
            >
              {/* Main Pill Button: sets active label */}
              <button
                type="button"
                onClick={() => setActiveLabel(cls.name)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-left font-medium"
              >
                {/* Color Dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: cls.color }}
                />

                {/* Class Name */}
                <span className={`font-semibold text-xs ${isActive ? 'text-white' : 'text-slate-800'}`}>
                  {cls.name}
                </span>

                {/* Count in current image */}
                {count > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1 rounded font-bold ${
                      isActive ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                )}

                {/* Keyboard Hotkey Badge */}
                {hotkey && (
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                      isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-400'
                    }`}
                    title={`Press [${hotkey}] key to select`}
                  >
                    {hotkey}
                  </span>
                )}
              </button>

              {/* Quick eye visibility toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleClassVisibility(cls.name);
                }}
                className={`px-1.5 py-1 text-slate-400 hover:text-slate-700 transition-colors border-l ${
                  isActive ? 'border-slate-800 hover:text-white' : 'border-slate-100'
                }`}
                title={isHidden ? `Show ${cls.name}` : `Hide ${cls.name}`}
              >
                {isHidden ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          );
        })}

        {/* Quick Add Class Inline Input */}
        {showAddInput ? (
          <form onSubmit={handleQuickAdd} className="inline-flex items-center gap-1 shrink-0">
            <input
              type="text"
              autoFocus
              placeholder="Label name..."
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="bg-white border border-[#ff5411] rounded px-2 py-0.5 text-xs text-slate-900 focus:outline-none w-28"
            />
            <button
              type="submit"
              className="bg-[#ff5411] text-white px-2 py-0.5 rounded text-xs font-semibold hover:bg-[#e0480b]"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddInput(false)}
              className="text-slate-400 hover:text-slate-600 px-1 text-xs"
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddInput(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 bg-white transition-colors shrink-0 text-xs"
          >
            <Plus className="w-3 h-3" />
            <span>Add Label</span>
          </button>
        )}
      </div>

      {/* Right: Configure Taxonomy */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenTaxonomyModal}
          className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md font-medium text-xs transition-colors shadow-2xs"
          title="Open Taxonomy & Configuration Panel"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>Taxonomy ({ontology.length})</span>
        </button>
      </div>
    </div>
  );
};
