import React, { useState } from 'react';
import { DetectionItem, OntologyClass, ImageItem } from '../types';
import { Eye, EyeOff, Trash2, Search, Sliders, ChevronDown, Check, Layers, FileJson, Copy, CheckCheck } from 'lucide-react';

interface RegionsPanelProps {
  image: ImageItem | null;
  ontology: OntologyClass[];
  hoveredDetectionId: string | null;
  setHoveredDetectionId: (id: string | null) => void;
  selectedDetectionId: string | null;
  setSelectedDetectionId: (id: string | null) => void;
  minConfidence: number;
  setMinConfidence: (val: number) => void;
  hiddenClasses: Set<string>;
  onUpdateDetections?: (imageId: string, detections: DetectionItem[]) => void;
  onOpenTaxonomyModal: () => void;
}

export const RegionsPanel: React.FC<RegionsPanelProps> = ({
  image,
  ontology,
  hoveredDetectionId,
  setHoveredDetectionId,
  selectedDetectionId,
  setSelectedDetectionId,
  minConfidence,
  setMinConfidence,
  hiddenClasses,
  onUpdateDetections,
  onOpenTaxonomyModal,
}) => {
  const [activeTab, setActiveTab] = useState<'regions' | 'predictions'>('regions');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [hiddenDetectionIds, setHiddenDetectionIds] = useState<Set<string>>(new Set());

  if (!image) {
    return (
      <aside className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center text-slate-400 select-none">
        <Layers className="w-8 h-8 text-slate-300 mb-2" />
        <span className="text-xs font-semibold text-slate-600">No Image Selected</span>
        <span className="text-[11px] text-slate-400 mt-1">Select an image to inspect detection regions.</span>
      </aside>
    );
  }

  const allDetections = image.detections || [];

  // Filter detections based on minConfidence, hiddenClasses, search, and individual hidden state
  const visibleDetections = allDetections.filter((d) => {
    if (d.confidence < minConfidence) return false;
    if (hiddenClasses.has(d.label)) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchLabel = d.label.toLowerCase().includes(q);
      const matchDesc = d.description?.toLowerCase().includes(q) || false;
      if (!matchLabel && !matchDesc) return false;
    }
    return true;
  });

  const getClassColor = (label: string) => {
    const found = ontology.find((c) => c.name.toLowerCase() === label.toLowerCase());
    return found ? found.color : '#3b82f6';
  };

  const handleDeleteDetection = (detId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateDetections) return;
    const updated = allDetections.filter((d) => d.id !== detId);
    onUpdateDetections(image.id, updated);
    if (selectedDetectionId === detId) setSelectedDetectionId(null);
  };

  const handleClearAllDetections = () => {
    if (!onUpdateDetections) return;
    if (window.confirm('Delete all bounding box regions on this image?')) {
      onUpdateDetections(image.id, []);
      setSelectedDetectionId(null);
    }
  };

  const handleReassignLabel = (detId: string, newLabel: string) => {
    if (!onUpdateDetections) return;
    const updated = allDetections.map((d) => (d.id === detId ? { ...d, label: newLabel } : d));
    onUpdateDetections(image.id, updated);
  };

  const toggleIndividualVisibility = (detId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenDetectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(detId)) next.delete(detId);
      else next.add(detId);
      return next;
    });
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(visibleDetections, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  return (
    <aside
      id="label-studio-regions-sidebar"
      className="w-80 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden select-none"
    >
      {/* Sidebar Tab Header (Label Studio style) */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 pt-2 bg-slate-50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('regions')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-all border-b-2 ${
              activeTab === 'regions'
                ? 'bg-white text-slate-900 border-[#ff5411] shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            Regions ({visibleDetections.length})
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-all border-b-2 ${
              activeTab === 'predictions'
                ? 'bg-white text-slate-900 border-[#ff5411] shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            Model Predictions
          </button>
        </div>
      </div>

      {activeTab === 'regions' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick Filter and Confidence threshold bar */}
          <div className="p-2.5 border-b border-slate-100 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter regions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 pl-7 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ff5411]"
                />
              </div>
              {visibleDetections.length > 0 && (
                <button
                  onClick={handleClearAllDetections}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-medium px-1.5 py-1 rounded hover:bg-rose-50 transition-colors"
                  title="Clear all bounding box regions"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Min Confidence Threshold slider */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <div className="flex items-center gap-1">
                <Sliders className="w-3 h-3 text-slate-400" />
                <span>Min Conf:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#ff5411]"
                />
                <span className="font-mono text-slate-700 font-semibold w-7 text-right">
                  {Math.round(minConfidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Regions Tree List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {visibleDetections.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-400 text-xs">
                {allDetections.length === 0 ? (
                  <>
                    <Layers className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No regions detected</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click <strong className="text-slate-700">Auto-Annotate</strong> or draw bounding boxes with{' '}
                      <strong className="text-slate-700">Rectangle [R]</strong>.
                    </p>
                  </>
                ) : (
                  <p>No regions match the current confidence filter or search query.</p>
                )}
              </div>
            ) : (
              visibleDetections.map((det, index) => {
                const isHovered = hoveredDetectionId === det.id;
                const isSelected = selectedDetectionId === det.id;
                const isIndividuallyHidden = hiddenDetectionIds.has(det.id);
                const color = getClassColor(det.label);
                const [ymin, xmin, ymax, xmax] = det.box_2d;

                return (
                  <div
                    key={det.id}
                    onMouseEnter={() => setHoveredDetectionId(det.id)}
                    onMouseLeave={() => setHoveredDetectionId(null)}
                    onClick={() => setSelectedDetectionId(det.id)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#fff5f2] border-[#ff5411] shadow-xs'
                        : isHovered
                        ? 'bg-slate-50 border-slate-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    } ${isIndividuallyHidden ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      {/* Class Pill / Selector */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-bold text-xs text-slate-800 truncate">{det.label}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Confidence & Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {Math.round(det.confidence * 100)}%
                        </span>

                        <button
                          type="button"
                          onClick={(e) => toggleIndividualVisibility(det.id, e)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                          title={isIndividuallyHidden ? 'Show region' : 'Hide region'}
                        >
                          {isIndividuallyHidden ? (
                            <EyeOff className="w-3 h-3 text-rose-500" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteDetection(det.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete region"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Coordinates & Re-label dropdown */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
                      <span>
                        [{ymin}, {xmin}, {ymax}, {xmax}]
                      </span>

                      {/* Quick class re-assignment */}
                      <select
                        value={det.label}
                        onChange={(e) => handleReassignLabel(det.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.2 text-[10px] text-slate-700 font-sans focus:outline-none focus:border-[#ff5411]"
                      >
                        {ontology.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {det.description && (
                      <p className="text-[10px] text-slate-500 font-sans mt-1 line-clamp-1 italic">
                        {det.description}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Model Execution Summary Footer */}
          {image.summary && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold mb-1">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Detection Summary</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed italic">{image.summary}</p>
              {image.detectedWithModel && (
                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Backend: {image.detectedWithModel}</span>
                  {image.processedAt && (
                    <span>{new Date(image.processedAt).toLocaleTimeString()}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Predictions & Raw JSON Tab */
        <div className="flex-1 flex flex-col p-3 overflow-hidden text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              JSON Output
            </span>
            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
            >
              {copiedJSON ? (
                <>
                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
          <pre className="flex-1 bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-auto font-mono text-[10px] leading-tight">
            {JSON.stringify(
              {
                imageId: image.id,
                name: image.name,
                model: image.detectedWithModel || 'amazon.nova-pro-v1:0',
                detectionsCount: visibleDetections.length,
                detections: visibleDetections.map((d) => ({
                  id: d.id,
                  label: d.label,
                  confidence: d.confidence,
                  box_2d: d.box_2d,
                  description: d.description,
                })),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </aside>
  );
};
