import React, { useState, useRef } from 'react';
import { ImageItem, OntologyClass } from '../types';
import { SAMPLE_IMAGES, SampleImage } from '../data/presets';
import {
  Upload,
  Play,
  Trash2,
  Tag,
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  Plus,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';

interface DataManagerViewProps {
  images: ImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  ontology: OntologyClass[];
  onSelectImage: (id: string) => void;
  onDetectSingle: (id: string) => void;
  onDetectAll: () => void;
  isProcessingAny: boolean;
  onSwitchToLabeling: () => void;
  onApplyPreset?: (presetId: string) => void;
}

export const DataManagerView: React.FC<DataManagerViewProps> = ({
  images,
  setImages,
  ontology,
  onSelectImage,
  onDetectSingle,
  onDetectAll,
  isProcessingAny,
  onSwitchToLabeling,
  onApplyPreset,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'done' | 'idle' | 'error'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        const newImg: ImageItem = {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          url,
          mimeType: file.type || 'image/jpeg',
          status: 'idle',
        };

        setImages((prev) => [...prev, newImg]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSample = (sample: SampleImage) => {
    const existing = images.find((i) => i.name === sample.name);
    if (existing) {
      onSelectImage(existing.id);
      if (sample.recommendedOntologyId && onApplyPreset) {
        onApplyPreset(sample.recommendedOntologyId);
      }
      onSwitchToLabeling();
      return;
    }

    const sampleImg: ImageItem = {
      id: `sample-${Date.now()}`,
      name: sample.name,
      url: sample.url,
      mimeType: 'image/jpeg',
      status: 'idle',
      category: sample.category,
      recommendedOntologyId: sample.recommendedOntologyId,
    };

    setImages((prev) => [...prev, sampleImg]);
    onSelectImage(sampleImg.id);
    if (sample.recommendedOntologyId && onApplyPreset) {
      onApplyPreset(sample.recommendedOntologyId);
    }
    onSwitchToLabeling();
  };

  const handleDeleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const filteredImages = images.filter((img) => {
    if (statusFilter !== 'all' && img.status !== statusFilter) return false;
    if (searchTerm.trim() && !img.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalRegions = images.reduce((acc, img) => acc + (img.detections?.length || 0), 0);

  return (
    <div id="label-studio-data-manager" className="flex-1 bg-[#f8fafc] p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header telemetry & bulk action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-slate-900">Task Dataset Explorer</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {images.length} tasks registered &bull; {totalRegions} total localized regions &bull;{' '}
              {ontology.length} active classes in ontology
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-lg border border-slate-200 shadow-2xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload Images</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />

            <button
              onClick={onDetectAll}
              disabled={isProcessingAny || images.length === 0}
              className="flex items-center gap-1.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              {isProcessingAny ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-white" />
              )}
              <span>Auto-Annotate All Tasks</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tasks by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff5411] shadow-2xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#ff5411] shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="done">Annotated</option>
              <option value="idle">Unlabeled</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Table of Tasks (Label Studio style Data Manager grid) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4 w-16">Preview</th>
                <th className="py-3 px-4">Task / Image Name</th>
                <th className="py-3 px-4 w-32">Status</th>
                <th className="py-3 px-4 w-28">Regions</th>
                <th className="py-3 px-4">Detected Classes</th>
                <th className="py-3 px-4 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredImages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No images match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredImages.map((img, idx) => {
                  const regions = img.detections || [];
                  const uniqueClasses = Array.from(new Set(regions.map((r) => r.label)));

                  return (
                    <tr
                      key={img.id}
                      onClick={() => {
                        onSelectImage(img.id);
                        onSwitchToLabeling();
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-10 h-10 object-cover rounded border border-slate-200 shadow-2xs"
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-xs">
                        {img.name}
                      </td>
                      <td className="py-3 px-4">
                        {img.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Predicting
                          </span>
                        ) : img.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Annotated
                          </span>
                        ) : img.status === 'error' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            <Clock className="w-2.5 h-2.5" />
                            Unlabeled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {regions.length > 0 ? (
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                            {regions.length}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {uniqueClasses.slice(0, 3).map((clsName) => (
                            <span
                              key={clsName}
                              className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium"
                            >
                              {clsName}
                            </span>
                          ))}
                          {uniqueClasses.length > 3 && (
                            <span className="text-[10px] text-slate-400">
                              +{uniqueClasses.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onDetectSingle(img.id)}
                            disabled={img.status === 'processing'}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                            title="Run Auto-Detect"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => {
                              onSelectImage(img.id);
                              onSwitchToLabeling();
                            }}
                            className="p-1.5 text-[#ff5411] hover:text-[#e0480b] rounded hover:bg-[#fff5f2]"
                            title="Open in Workstation"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteImage(img.id, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Benchmark Sample Images Loader */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Benchmark Sample Datasets
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Load high-resolution test benchmarks for testing zero-shot localization capabilities.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_IMAGES.map((sample) => {
              const isSkinRash = sample.recommendedOntologyId === 'skin-rashes';
              return (
                <button
                  key={sample.id}
                  onClick={() => handleLoadSample(sample)}
                  className="group p-2.5 rounded-lg border border-slate-200 hover:border-[#ff5411] hover:bg-[#fff5f2]/40 transition-all text-left flex flex-col bg-white shadow-2xs"
                >
                  <div className="relative w-full h-28 mb-2 rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={sample.url}
                      alt={sample.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span
                      className={`absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider ${
                        isSkinRash
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isSkinRash ? 'Dermatology' : 'Hydrology'}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#ff5411] truncate">
                    {sample.name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                    {sample.category}
                  </span>
                  {sample.description && (
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {sample.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
