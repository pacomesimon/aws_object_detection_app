import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImageItem, DetectionItem, OntologyClass, AVAILABLE_MODELS } from '../types';
import { PRESET_ONTOLOGIES } from '../data/presets';
import {
  MousePointer,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Tag,
  Loader2,
  AlertCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react';

interface DetectionViewerProps {
  image: ImageItem | null;
  images: ImageItem[];
  onSelectImage: (id: string) => void;
  ontology: OntologyClass[];
  onDetectSingle: (imageId: string) => void;
  hoveredDetectionId: string | null;
  setHoveredDetectionId: (id: string | null) => void;
  selectedDetectionId: string | null;
  setSelectedDetectionId: (id: string | null) => void;
  minConfidence: number;
  setMinConfidence: (val: number) => void;
  hiddenClasses: Set<string>;
  toggleClassVisibility: (className: string) => void;
  onUpdateDetections?: (imageId: string, detections: DetectionItem[]) => void;
  selectedModel?: string;
  activeLabel: string;
  setActiveLabel: (label: string) => void;
  onOpenUploadModal?: () => void;
  onApplyPreset?: (presetId: string) => void;
}

export const DetectionViewer: React.FC<DetectionViewerProps> = ({
  image,
  images,
  onSelectImage,
  ontology,
  onDetectSingle,
  hoveredDetectionId,
  setHoveredDetectionId,
  selectedDetectionId,
  setSelectedDetectionId,
  minConfidence,
  hiddenClasses,
  onUpdateDetections,
  selectedModel = 'gemini-3.5-flash',
  activeLabel,
  setActiveLabel,
  onOpenUploadModal,
  onApplyPreset,
}) => {
  // Tools: 'select' (hand/pan) or 'rectangle' (bbox draw)
  const [activeTool, setActiveTool] = useState<'select' | 'rectangle'>('rectangle');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showFill, setShowFill] = useState<boolean>(true);
  const [fillOpacity, setFillOpacity] = useState<number>(0.18);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState<boolean>(false);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // For manual box creation
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Keyboard Shortcuts (Standard Label Studio: R for rectangle, V for select, Delete to remove, 1-9 for classes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input / textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        setActiveTool('rectangle');
      } else if (e.key === 'v' || e.key === 'V' || e.key === 'h' || e.key === 'H') {
        setActiveTool('select');
      } else if (e.key === 'l' || e.key === 'L') {
        setShowLabels((prev) => !prev);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDetectionId && image && onUpdateDetections) {
          const updated = (image.detections || []).filter((d) => d.id !== selectedDetectionId);
          onUpdateDetections(image.id, updated);
          setSelectedDetectionId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedDetectionId(null);
        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
      } else if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        if (index < ontology.length) {
          setActiveLabel(ontology[index].name);
        }
      } else if (e.key === '=' || e.key === '+') {
        setZoomLevel((z) => Math.min(300, z + 25));
      } else if (e.key === '-') {
        setZoomLevel((z) => Math.max(50, z - 25));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDetectionId, image, onUpdateDetections, ontology, setActiveLabel]);

  // Color mapping per label name
  const getClassColor = useCallback(
    (label: string) => {
      const found = ontology.find((c) => c.name.toLowerCase() === label.toLowerCase());
      return found ? found.color : '#3b82f6';
    },
    [ontology]
  );

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setNaturalDimensions({ width: target.naturalWidth, height: target.naturalHeight });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (activeTool === 'rectangle' || e.shiftKey) {
      setIsDrawing(true);
      setDrawStart({ x, y });
      setDrawCurrent({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (naturalDimensions) {
      setCursorCoords({
        x: Math.round(x * naturalDimensions.width),
        y: Math.round(y * naturalDimensions.height),
      });
    }

    if (isDrawing && drawStart) {
      setDrawCurrent({ x, y });
    }
  };

  const handleMouseLeave = () => {
    setCursorCoords(null);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent || !image || !onUpdateDetections) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    const ymin = Math.round(Math.min(drawStart.y, drawCurrent.y) * 1000);
    const xmin = Math.round(Math.min(drawStart.x, drawCurrent.x) * 1000);
    const ymax = Math.round(Math.max(drawStart.y, drawCurrent.y) * 1000);
    const xmax = Math.round(Math.max(drawStart.x, drawCurrent.x) * 1000);

    // Filter out accidental clicks (minimum 15px bounding box in 1000 scale)
    if (xmax - xmin > 15 && ymax - ymin > 15) {
      const newDet: DetectionItem = {
        id: `manual-${Date.now()}`,
        label: activeLabel || (ontology[0]?.name || 'Object'),
        box_2d: [ymin, xmin, ymax, xmax],
        confidence: 1.0,
        description: 'Manually annotated region',
      };

      const updated = [...(image.detections || []), newDet];
      onUpdateDetections(image.id, updated);
      setSelectedDetectionId(newDet.id);
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  if (!image) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 p-8 text-center text-slate-500">
        <ImageIcon className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No Image Task Selected</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Select a task from the Data Manager or upload benchmark images to start annotating.
        </p>
      </div>
    );
  }

  // Filter detections based on minConfidence and hiddenClasses
  const visibleDetections = (image.detections || []).filter((det) => {
    if (det.confidence < minConfidence) return false;
    if (hiddenClasses.has(det.label)) return false;
    return true;
  });

  const activeLabelObj = ontology.find((c) => c.name.toLowerCase() === activeLabel.toLowerCase()) || ontology[0];

  return (
    <div
      id="detection-viewer-studio"
      className="flex-1 flex flex-row overflow-hidden relative bg-[#f8fafc] select-none"
    >
      {/* 1. Left Vertical Tool Rail (Label Studio Iconic 48px Toolbar) */}
      <div
        id="label-studio-tool-rail"
        className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-2 gap-1.5 z-20 shrink-0"
      >
        {/* Tool: Select / Pan */}
        <button
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded-lg transition-colors ${
            activeTool === 'select'
              ? 'bg-[#fff5f2] text-[#ff5411] border border-[#ff5411]/40'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Select / Move Tool [V]"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Tool: Rectangle Bounding Box */}
        <button
          onClick={() => setActiveTool('rectangle')}
          className={`p-2 rounded-lg transition-colors relative ${
            activeTool === 'rectangle'
              ? 'bg-[#fff5f2] text-[#ff5411] border border-[#ff5411]/40'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Rectangle Bounding Box Tool [R]"
        >
          <Square className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-[#ff5411] font-bold">
            R
          </span>
        </button>

        <div className="w-6 h-[1px] bg-slate-200 my-1"></div>

        {/* Zoom In */}
        <button
          onClick={() => setZoomLevel((z) => Math.min(300, z + 25))}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom In [+]"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom Out [-]"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Zoom to Fit / Reset */}
        <button
          onClick={() => setZoomLevel(100)}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Reset Zoom to 100% [F]"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="w-6 h-[1px] bg-slate-200 my-1"></div>

        {/* Toggle Labels */}
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`p-2 rounded-lg transition-colors ${
            showLabels ? 'text-slate-800 bg-slate-100' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="Toggle Labels [L]"
        >
          {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        {/* Toggle Fill Tint */}
        <button
          onClick={() => setShowFill(!showFill)}
          className={`p-2 rounded-lg text-xs font-mono font-bold transition-colors ${
            showFill ? 'text-[#ff5411] bg-[#fff5f2]' : 'text-slate-400 hover:text-slate-700'
          }`}
          title="Toggle Fill Tint"
        >
          {showFill ? 'FILL' : 'LINE'}
        </button>

        <div className="mt-auto w-6 h-[1px] bg-slate-200 my-1"></div>

        {/* Toggle Tasks / Image Drawer */}
        <button
          onClick={() => setIsTaskDrawerOpen(!isTaskDrawerOpen)}
          className={`p-2 rounded-lg transition-colors ${
            isTaskDrawerOpen ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Toggle Task Queue Drawer"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Collapsible Task Queue Drawer (Slide-out sidebar of images) */}
      {isTaskDrawerOpen && (
        <div className="w-60 bg-white border-r border-slate-200 flex flex-col z-20 shadow-md">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tasks ({images.length})
            </span>
            {onOpenUploadModal && (
              <button
                onClick={onOpenUploadModal}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#ff5411] hover:text-[#e0480b]"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {images.map((img, idx) => {
              const isSelected = img.id === image.id;
              const regionsCount = (img.detections || []).length;
              return (
                <div
                  key={img.id}
                  onClick={() => onSelectImage(img.id)}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[#fff5f2] border-[#ff5411]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-10 h-10 object-cover rounded shrink-0 border border-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{img.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                      {regionsCount > 0 ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1 rounded border border-emerald-200">
                          {regionsCount} regions
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">
                          Unlabeled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Main Center Annotation Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Canvas Workspace Stage */}
        <div
          ref={containerRef}
          id="label-studio-canvas-stage"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className={`flex-1 canvas-grid-pattern overflow-auto flex items-center justify-center p-6 relative ${
            activeTool === 'rectangle' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        >
          {/* AI Detection Loading Overlay */}
          {image.status === 'processing' && (
            <div className="absolute inset-0 z-30 bg-slate-900/60 backdrop-blur-2xs flex flex-col items-center justify-center text-center p-6">
              <Loader2 className="w-10 h-10 text-[#ff5411] animate-spin mb-3" />
              <h4 className="text-sm font-semibold text-white">
                {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name || 'Amazon Bedrock'}{' '}
                Detecting Objects...
              </h4>
              <p className="text-xs text-slate-300 mt-1 max-w-xs">
                Extracting 2D spatial bounding box coordinates based on your active ontology.
              </p>
            </div>
          )}

          {/* Scientific Domain Preset Hint Banner */}
          {(() => {
            if (!image?.recommendedOntologyId || !onApplyPreset) return null;
            const recommendedPreset = PRESET_ONTOLOGIES.find((p) => p.id === image.recommendedOntologyId);
            if (!recommendedPreset) return null;
            const isPresetMatching = ontology.some((c) =>
              recommendedPreset.classes.some((rc) => rc.name.toLowerCase() === c.name.toLowerCase())
            );
            if (isPresetMatching) return null;

            return (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-25 bg-slate-900/90 text-white backdrop-blur-md border border-slate-700 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2.5 text-xs">
                <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Scientific Domain: <strong className="text-amber-200">{recommendedPreset.title}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onApplyPreset(recommendedPreset.id)}
                  className="bg-[#ff5411] hover:bg-[#e0480b] text-white px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors shadow-xs ml-1"
                >
                  Load {recommendedPreset.classes.length}-Class Taxonomy
                </button>
              </div>
            );
          })()}

          {/* Error Banner */}
          {image.status === 'error' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-rose-50 border border-rose-200 rounded-lg p-3 shadow-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-left text-xs">
                <span className="font-semibold text-rose-900">Detection Failed: </span>
                <span className="text-rose-700">{image.errorMessage || 'Unable to predict objects.'}</span>
              </div>
              <button
                onClick={() => onDetectSingle(image.id)}
                className="bg-rose-600 text-white text-xs px-2.5 py-1 rounded font-semibold hover:bg-rose-700 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Image & SVG Bounding Box Canvas Container */}
          <div
            className="relative inline-block transition-transform duration-150 ease-out shadow-2xl rounded-sm overflow-hidden bg-white border border-slate-300"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            <img
              ref={imgRef}
              src={image.url}
              alt={image.name}
              onLoad={handleImageLoad}
              className="max-w-full max-h-[640px] object-contain block pointer-events-none select-none"
            />

            {/* Render Bounding Box Overlays */}
            {imgRef.current && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-auto"
                style={{ width: '100%', height: '100%' }}
              >
                {visibleDetections.map((det) => {
                  const color = getClassColor(det.label);
                  const [ymin, xmin, ymax, xmax] = det.box_2d;

                  // Scale 0..1000 to percentage 0..100%
                  const top = `${ymin / 10}%`;
                  const left = `${xmin / 10}%`;
                  const width = `${(xmax - xmin) / 10}%`;
                  const height = `${(ymax - ymin) / 10}%`;

                  const isHovered = hoveredDetectionId === det.id;
                  const isSelected = selectedDetectionId === det.id;

                  return (
                    <g
                      key={det.id}
                      onMouseEnter={() => setHoveredDetectionId(det.id)}
                      onMouseLeave={() => setHoveredDetectionId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetectionId(det.id);
                      }}
                      className="cursor-pointer group"
                    >
                      {/* Box Fill */}
                      {showFill && (
                        <rect
                          x={left}
                          y={top}
                          width={width}
                          height={height}
                          fill={color}
                          fillOpacity={isHovered || isSelected ? 0.35 : fillOpacity}
                          className="transition-opacity duration-150"
                        />
                      )}

                      {/* Box Stroke */}
                      <rect
                        x={left}
                        y={top}
                        width={width}
                        height={height}
                        fill="none"
                        stroke={color}
                        strokeWidth={isHovered || isSelected ? 3 : 2}
                        strokeDasharray={isSelected ? '4 2' : 'none'}
                        className="transition-all duration-150"
                      />

                      {/* Selected Box Anchor Handles (Label Studio aesthetic) */}
                      {isSelected && (
                        <>
                          <rect
                            x={`calc(${left} - 3px)`}
                            y={`calc(${top} - 3px)`}
                            width="6"
                            height="6"
                            fill="#ffffff"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                          <rect
                            x={`calc(${left} + ${width} - 3px)`}
                            y={`calc(${top} - 3px)`}
                            width="6"
                            height="6"
                            fill="#ffffff"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                          <rect
                            x={`calc(${left} - 3px)`}
                            y={`calc(${top} + ${height} - 3px)`}
                            width="6"
                            height="6"
                            fill="#ffffff"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                          <rect
                            x={`calc(${left} + ${width} - 3px)`}
                            y={`calc(${top} + ${height} - 3px)`}
                            width="6"
                            height="6"
                            fill="#ffffff"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                        </>
                      )}

                      {/* Label Studio Box Tag Badge (Top-left of box) */}
                      {showLabels && (
                        <foreignObject
                          x={left}
                          y={ymin < 50 ? top : `calc(${top} - 22px)`}
                          width="240"
                          height="26"
                          className="overflow-visible pointer-events-none"
                        >
                          <div
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
                            style={{ backgroundColor: color }}
                          >
                            <span>{det.label}</span>
                            <span className="opacity-90 font-mono text-[9px] font-medium">
                              {Math.round(det.confidence * 100)}%
                            </span>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}

                {/* Real-time Drawing Preview Box */}
                {isDrawing && drawStart && drawCurrent && (
                  <g>
                    <rect
                      x={`${Math.min(drawStart.x, drawCurrent.x) * 100}%`}
                      y={`${Math.min(drawStart.y, drawCurrent.y) * 100}%`}
                      width={`${Math.abs(drawCurrent.x - drawStart.x) * 100}%`}
                      height={`${Math.abs(drawCurrent.y - drawStart.y) * 100}%`}
                      fill={activeLabelObj?.color || '#ff5411'}
                      fillOpacity="0.25"
                      stroke={activeLabelObj?.color || '#ff5411'}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                    <foreignObject
                      x={`${Math.min(drawStart.x, drawCurrent.x) * 100}%`}
                      y={`calc(${Math.min(drawStart.y, drawCurrent.y) * 100}% - 20px)`}
                      width="160"
                      height="20"
                      className="overflow-visible pointer-events-none"
                    >
                      <div
                        className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: activeLabelObj?.color || '#ff5411' }}
                      >
                        {activeLabel}
                      </div>
                    </foreignObject>
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>

        {/* 4. Canvas Bottom Status Bar (Label Studio standard telemetry bar) */}
        <div className="h-8 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-500 font-medium select-none z-10">
          <div className="flex items-center gap-4">
            {/* Dimensions */}
            {naturalDimensions && (
              <span className="font-mono text-slate-600">
                {naturalDimensions.width} × {naturalDimensions.height} px
              </span>
            )}

            {/* Coordinates */}
            {cursorCoords && (
              <span className="font-mono text-slate-600">
                X: {cursorCoords.x} &bull; Y: {cursorCoords.y}
              </span>
            )}

            {/* Active Tool */}
            <span className="hidden sm:inline">
              Tool:{' '}
              <strong className="text-slate-800">
                {activeTool === 'rectangle' ? 'Rectangle [R]' : 'Select / Pan [V]'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Active Label indicator */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Drawing Class:</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activeLabelObj?.color }}
              />
              <span className="font-bold text-slate-800">{activeLabel}</span>
            </div>

            {/* Zoom level */}
            <span className="font-mono text-slate-600">{zoomLevel}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
