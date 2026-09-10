import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, ChevronDown, Check, ChevronLeft, ChevronRight, SlidersHorizontal, Loader2, Tag, LayoutGrid } from 'lucide-react';
import { AVAILABLE_MODELS } from '../types';

interface NavbarProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onOpenExportModal: () => void;
  onDetectCurrent?: () => void;
  onDetectAll: () => void;
  isProcessingAny: boolean;
  isProcessingCurrent?: boolean;
  hasDetections: boolean;
  imageCount: number;
  currentTaskIndex: number;
  onPrevTask: () => void;
  onNextTask: () => void;
  ontologyCount: number;
  activeView: 'labeling' | 'datamanager';
  setActiveView: (view: 'labeling' | 'datamanager') => void;
  onOpenOntologyModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedModel,
  onSelectModel,
  onOpenExportModal,
  onDetectCurrent,
  onDetectAll,
  isProcessingAny,
  isProcessingCurrent = false,
  hasDetections,
  imageCount,
  currentTaskIndex,
  onPrevTask,
  onNextTask,
  ontologyCount,
  activeView,
  setActiveView,
  onOpenOntologyModal,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModelObj =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) ||
    AVAILABLE_MODELS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs select-none">
      <div className="w-full px-4 h-14 flex items-center justify-between gap-3">
        {/* Left: Label Studio Brand & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Label Studio style Orange Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#ff5411] flex items-center justify-center shadow-xs">
              <div className="w-4 h-4 border-2 border-white rounded-[2px] rotate-12 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center text-xs text-slate-500 font-medium">
              <span className="hover:text-slate-900 cursor-pointer hidden md:inline">Projects</span>
              <span className="mx-1.5 text-slate-300 hidden md:inline">/</span>
              <span className="font-semibold text-slate-900 truncate max-w-[140px] sm:max-w-[220px]">
                Object Detection
              </span>
            </div>
          </div>

          {/* View Switcher Tabs: Labeling / Data Manager */}
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              id="tab-view-labeling"
              onClick={() => setActiveView('labeling')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                activeView === 'labeling'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-[#ff5411]" />
              <span>Labeling</span>
            </button>
            <button
              id="tab-view-datamanager"
              onClick={() => setActiveView('datamanager')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                activeView === 'datamanager'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Data Manager</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-mono">
                {imageCount}
              </span>
            </button>
          </div>

          {/* Task Navigator Chevrons */}
          {imageCount > 0 && (
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-xs">
              <button
                onClick={onPrevTask}
                disabled={currentTaskIndex <= 0}
                className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                title="Previous Task"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] text-slate-700 font-semibold">
                Task {currentTaskIndex + 1} / {imageCount}
              </span>
              <button
                onClick={onNextTask}
                disabled={currentTaskIndex >= imageCount - 1}
                className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                title="Next Task"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Model Selector, Auto-Predict, Export, Taxonomy */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Model Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="btn-model-selector"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 border rounded-lg px-2.5 py-1.5 transition-all text-xs shadow-xs bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer"
            >
              <span className="font-semibold text-slate-900">
                {activeModelObj.name}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 max-h-[80vh] overflow-y-auto space-y-0.5">
                {AVAILABLE_MODELS.map((m) => {
                  const isSelected = m.id === selectedModel;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between text-xs cursor-pointer ${
                        isSelected
                          ? 'bg-slate-100 font-semibold text-slate-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Taxonomy Settings Button */}
          <button
            onClick={onOpenOntologyModal}
            className="hidden md:flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs px-2.5 py-1.5 rounded-lg transition-colors shadow-xs"
            title="Configure Ontology & Classes"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Taxonomy ({ontologyCount})</span>
          </button>

          {/* Auto-Annotate / Predict Button */}
          {imageCount > 0 && onDetectCurrent && (
            <button
              id="btn-auto-annotate-current"
              onClick={onDetectCurrent}
              disabled={isProcessingCurrent || ontologyCount === 0}
              className="flex items-center gap-1.5 font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors shadow-xs disabled:opacity-50 bg-[#0f172a] hover:bg-[#1e293b] text-white cursor-pointer"
              title="Run object detection on current image"
            >
              {isProcessingCurrent ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                  <span>Annotating...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current text-white" />
                  <span>Annotate</span>
                </>
              )}
            </button>
          )}

          {/* Export Button */}
          <button
            id="btn-export-results"
            onClick={onOpenExportModal}
            disabled={!hasDetections}
            className="flex items-center gap-1.5 bg-[#ff5411] hover:bg-[#e0480b] text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            title="Export annotations in JSON, COCO, VOC format"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
