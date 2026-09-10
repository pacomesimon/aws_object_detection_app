import React, { useState } from 'react';
import { ImageItem, DetectionItem, OntologyClass } from '../types';
import { ListFilter, Search, Crosshair, ChevronRight, Hash, Eye } from 'lucide-react';

interface DetectionsTableProps {
  image: ImageItem | null;
  ontology: OntologyClass[];
  hoveredDetectionId: string | null;
  setHoveredDetectionId: (id: string | null) => void;
  selectedDetectionId: string | null;
  setSelectedDetectionId: (id: string | null) => void;
  minConfidence: number;
  hiddenClasses: Set<string>;
}

export const DetectionsTable: React.FC<DetectionsTableProps> = ({
  image,
  ontology,
  hoveredDetectionId,
  setHoveredDetectionId,
  selectedDetectionId,
  setSelectedDetectionId,
  minConfidence,
  hiddenClasses,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');

  if (!image) return null;

  const detections = image.detections || [];

  // Filter detections
  const filtered = detections.filter((det) => {
    if (det.confidence < minConfidence) return false;
    if (hiddenClasses.has(det.label)) return false;
    if (selectedClassFilter !== 'all' && det.label !== selectedClassFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchLabel = det.label.toLowerCase().includes(q);
      const matchDesc = det.description?.toLowerCase().includes(q) || false;
      if (!matchLabel && !matchDesc) return false;
    }
    return true;
  });

  // Calculate counts per ontology class
  const classCounts: Record<string, number> = {};
  detections.forEach((d) => {
    classCounts[d.label] = (classCounts[d.label] || 0) + 1;
  });

  const getClassColor = (label: string) => {
    const found = ontology.find((c) => c.name.toLowerCase() === label.toLowerCase());
    return found ? found.color : '#3b82f6';
  };

  return (
    <div id="detections-table-container" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-slate-100 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Detection Analytics & Instances</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/50">
              {filtered.length} visible
            </span>
          </div>
          {image.summary && (
            <p className="text-xs text-slate-300 mt-1 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              "{image.summary}"
            </p>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search detections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>

          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Classes</option>
            {ontology.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} ({classCounts[c.name] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Class Distribution Progress Bars */}
      {ontology.length > 0 && detections.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
          {ontology.map((cls) => {
            const count = classCounts[cls.name] || 0;
            const pct = detections.length > 0 ? Math.round((count / detections.length) * 100) : 0;

            return (
              <div key={cls.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-300 truncate">{cls.name}</span>
                  <span className="font-mono text-slate-400">{count}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: cls.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detections List / Table */}
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-800 rounded-lg">
            No object detections match the current filter or image has not been processed.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium uppercase tracking-wider text-[10px] bg-slate-950/60">
                <th className="py-2 px-3">Class Label</th>
                <th className="py-2 px-3">Confidence</th>
                <th className="py-2 px-3">Box [ymin, xmin, ymax, xmax]</th>
                <th className="py-2 px-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((det) => {
                const color = getClassColor(det.label);
                const isHovered = hoveredDetectionId === det.id;
                const isSelected = selectedDetectionId === det.id;

                return (
                  <tr
                    key={det.id}
                    onMouseEnter={() => setHoveredDetectionId(det.id)}
                    onMouseLeave={() => setHoveredDetectionId(null)}
                    onClick={() => setSelectedDetectionId(det.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/60 font-medium text-white'
                        : isHovered
                        ? 'bg-slate-800/80'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-semibold text-slate-100">{det.label}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-indigo-300 w-9">
                          {Math.round(det.confidence * 100)}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${det.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      [{det.box_2d.join(', ')}]
                    </td>

                    <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">
                      {det.description || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
