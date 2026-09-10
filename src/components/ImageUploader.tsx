import React, { useRef, useState } from 'react';
import { ImageItem } from '../types';
import { SAMPLE_IMAGES, SampleImage } from '../data/presets';
import { Upload, Image as ImageIcon, Trash2, Play, CheckCircle2, AlertCircle, Loader2, Layers } from 'lucide-react';

interface ImageUploaderProps {
  images: ImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;
  onDetectSingle: (imageId: string) => void;
  onDetectAll: () => void;
  isProcessingAny: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  setImages,
  selectedImageId,
  setSelectedImageId,
  onDetectSingle,
  onDetectAll,
  isProcessingAny,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'samples'>('upload');
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

        setImages((prev) => {
          const updated = [...prev, newImg];
          if (!selectedImageId) setSelectedImageId(newImg.id);
          return updated;
        });
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
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
      setSelectedImageId(existing.id);
      return;
    }

    const sampleImg: ImageItem = {
      id: `sample-${Date.now()}`,
      name: sample.name,
      url: sample.url,
      mimeType: 'image/jpeg',
      status: 'idle',
    };

    setImages((prev) => [...prev, sampleImg]);
    setSelectedImageId(sampleImg.id);
  };

  const handleDeleteImage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (selectedImageId === id) {
      const remaining = images.filter((i) => i.id !== id);
      setSelectedImageId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  return (
    <div id="image-uploader-container" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm text-slate-100">
      <div id="uploader-header" className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold tracking-tight text-white">Input Images</h2>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {images.length} {images.length === 1 ? 'image' : 'images'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Upload images or select sample benchmarks for detection.</p>
        </div>

        {images.length > 0 && (
          <button
            id="btn-detect-all"
            onClick={onDetectAll}
            disabled={isProcessingAny}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isProcessingAny ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            Detect All Images
          </button>
        )}
      </div>

      {/* Tabs for Upload vs Sample Library */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> My Uploads
        </button>
        <button
          onClick={() => setActiveTab('samples')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'samples'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-300" /> Test Samples
        </button>
      </div>

      {/* Upload Drop Zone */}
      {activeTab === 'upload' && (
        <div
          id="dropzone-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-400 bg-indigo-950/30 scale-[0.99]'
              : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-indigo-400">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-200">Click or Drag & Drop images here</p>
          <p className="text-[11px] text-slate-400 mt-1">Supports PNG, JPG, WEBP, GIF</p>
        </div>
      )}

      {/* Samples Tab */}
      {activeTab === 'samples' && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {SAMPLE_IMAGES.map((sample) => (
            <div
              key={sample.id}
              onClick={() => handleLoadSample(sample)}
              className="group relative h-24 rounded-lg overflow-hidden border border-slate-800 hover:border-indigo-500 cursor-pointer transition-all"
            >
              <img src={sample.url} alt={sample.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent p-2 flex flex-col justify-end">
                <span className="text-[10px] text-indigo-300 font-semibold">{sample.category}</span>
                <span className="text-xs font-medium text-white truncate">{sample.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Thumbnails Queue */}
      {images.length > 0 && (
        <div className="mt-4 space-y-2">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Image Queue ({images.length})</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
            {images.map((img) => {
              const isSelected = selectedImageId === img.id;
              const isProcessing = img.status === 'processing';
              const isDone = img.status === 'done';
              const isError = img.status === 'error';

              return (
                <div
                  key={img.id}
                  onClick={() => setSelectedImageId(img.id)}
                  className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-slate-800'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-950'
                  }`}
                >
                  <div className="h-20 w-full overflow-hidden bg-slate-950 flex items-center justify-center relative">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />

                    {/* Status Badges */}
                    <div className="absolute top-1.5 left-1.5">
                      {isProcessing && (
                        <span className="flex items-center gap-1 bg-slate-900/90 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                          <Loader2 className="w-3 h-3 animate-spin" /> Detecting
                        </span>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1 bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                          <CheckCircle2 className="w-3 h-3" /> {img.detections?.length || 0}
                        </span>
                      )}
                      {isError && (
                        <span className="flex items-center gap-1 bg-rose-950/90 text-rose-300 border border-rose-500/40 text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                          <AlertCircle className="w-3 h-3" /> Error
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDeleteImage(img.id, e)}
                      className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="p-2 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium text-slate-200 truncate">{img.name}</span>
                    {img.status === 'idle' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDetectSingle(img.id);
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 rounded border border-indigo-800/50"
                        title="Detect this image"
                      >
                        Run
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
