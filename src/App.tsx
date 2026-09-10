import React, { useState, useMemo } from 'react';
import { OntologyClass, ImageItem, DetectionItem, AVAILABLE_MODELS } from './types';
import { PRESET_ONTOLOGIES, SAMPLE_IMAGES } from './data/presets';
import { Navbar } from './components/Navbar';
import { LabelStreamRibbon } from './components/LabelStreamRibbon';
import { DetectionViewer } from './components/DetectionViewer';
import { RegionsPanel } from './components/RegionsPanel';
import { DataManagerView } from './components/DataManagerView';
import { OntologyManager } from './components/OntologyManager';
import { ExportModal } from './components/ExportModal';

export default function App() {
  // Active view: 'labeling' (annotation workstation) or 'datamanager' (dataset explorer)
  const [activeView, setActiveView] = useState<'labeling' | 'datamanager'>('labeling');

  // Selected Model: defaults to Gemini 3.5 Flash
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');

  // Derive Bedrock usage if the selected model is not a Gemini model
  const isBedrock = !selectedModel.startsWith('gemini');

  // Initialize with Skin Rashes Detection preset ontology (3 classes)
  const [ontology, setOntology] = useState<OntologyClass[]>(
    PRESET_ONTOLOGIES[0].classes.map((c, idx) => ({
      id: `class-init-${idx}`,
      name: c.name,
      description: c.description,
      color: c.color,
    }))
  );

  // Active label selected for annotation drawing
  const [activeLabel, setActiveLabel] = useState<string>(PRESET_ONTOLOGIES[0].classes[0].name);

  // Initialize with the 4 scientific sample benchmarks (2 skin rashes, 2 house flooding vulnerability)
  const [images, setImages] = useState<ImageItem[]>(
    SAMPLE_IMAGES.map((sample) => ({
      id: sample.id,
      name: sample.name,
      url: sample.url,
      mimeType: 'image/jpeg',
      status: 'idle',
      category: sample.category,
      recommendedOntologyId: sample.recommendedOntologyId,
    }))
  );

  const [selectedImageId, setSelectedImageId] = useState<string | null>(SAMPLE_IMAGES[0].id);
  const [hoveredDetectionId, setHoveredDetectionId] = useState<string | null>(null);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState<number>(0.2);
  const [hiddenClasses, setHiddenClasses] = useState<Set<string>>(new Set());

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
  };

  // Function to apply a preset ontology by ID
  const handleApplyPreset = (presetId: string) => {
    const preset = PRESET_ONTOLOGIES.find((p) => p.id === presetId);
    if (!preset) return;
    const loadedClasses: OntologyClass[] = preset.classes.map((c, index) => ({
      id: `class-${Date.now()}-${index}`,
      name: c.name,
      description: c.description,
      color: c.color,
    }));
    setOntology(loadedClasses);
    if (loadedClasses.length > 0) {
      setActiveLabel(loadedClasses[0].name);
    }
  };

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isTaxonomyModalOpen, setIsTaxonomyModalOpen] = useState<boolean>(false);
  const [taxonomyModalTab, setTaxonomyModalTab] = useState<'editor' | 'brainstorm'>('editor');

  const handleOpenTaxonomyModal = (tab: 'editor' | 'brainstorm' = 'editor') => {
    setTaxonomyModalTab(tab);
    setIsTaxonomyModalOpen(true);
  };

  const toggleClassVisibility = (className: string) => {
    setHiddenClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
  };

  const selectedImageIndex = images.findIndex((i) => i.id === selectedImageId);
  const currentTaskIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
  const selectedImage = images[currentTaskIndex] || null;

  const handlePrevTask = () => {
    if (currentTaskIndex > 0) {
      setSelectedImageId(images[currentTaskIndex - 1].id);
      setSelectedDetectionId(null);
    }
  };

  const handleNextTask = () => {
    if (currentTaskIndex < images.length - 1) {
      setSelectedImageId(images[currentTaskIndex + 1].id);
      setSelectedDetectionId(null);
    }
  };

  const getModelLabel = (mId: string) => {
    if (mId && (mId.startsWith('Amazon Bedrock') || mId.startsWith('Google'))) return mId;
    const found = AVAILABLE_MODELS.find((m) => m.id === mId);
    return found ? found.name : mId;
  };

  // Single Image Detection Call
  const handleDetectSingle = async (imageId: string) => {
    const imgObj = images.find((i) => i.id === imageId);
    if (!imgObj || ontology.length === 0) return;

    setImages((prev) =>
      prev.map((i) => (i.id === imageId ? { ...i, status: 'processing', errorMessage: undefined } : i))
    );

    try {
      let base64Data = imgObj.url;
      if (!imgObj.url.startsWith('data:')) {
        const fetchRes = await fetch(imgObj.url);
        const blob = await fetchRes.blob();
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: imgObj.mimeType || 'image/jpeg',
          ontology: ontology.map((c) => ({ name: c.name, description: c.description })),
          model: selectedModel,
          useBedrock: isBedrock,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Object detection request failed.');
      }

      const rawDetections = data.detections || [];
      const formattedDetections: DetectionItem[] = rawDetections.map((d: any, idx: number) => ({
        id: `det-${Date.now()}-${idx}`,
        label: d.label,
        box_2d: d.box_2d,
        confidence: typeof d.confidence === 'number' ? d.confidence : 0.85,
        description: d.description || '',
      }));

      setImages((prev) =>
        prev.map((i) =>
          i.id === imageId
            ? {
                ...i,
                status: 'done',
                detections: formattedDetections,
                summary: data.summary || '',
                processedAt: new Date().toISOString(),
                detectedWithModel: getModelLabel(data.model || selectedModel),
              }
            : i
        )
      );
    } catch (err: any) {
      console.error('Detection Error:', err);
      setImages((prev) =>
        prev.map((i) =>
          i.id === imageId
            ? {
                ...i,
                status: 'error',
                errorMessage: err.message || 'Failed to analyze object detection.',
              }
            : i
        )
      );
    }
  };

  // Detect All Images Sequential Loop
  const handleDetectAll = async () => {
    for (const img of images) {
      if (img.status !== 'processing') {
        await handleDetectSingle(img.id);
      }
    }
  };

  const handleUpdateDetections = (imageId: string, updatedDetections: DetectionItem[]) => {
    setImages((prev) =>
      prev.map((i) => (i.id === imageId ? { ...i, detections: updatedDetections } : i))
    );
  };

  const isProcessingAny = images.some((i) => i.status === 'processing');
  const isProcessingCurrent = selectedImage?.status === 'processing';
  const hasAnyDetections = images.some((i) => (i.detections || []).length > 0);

  // Compute detections per class on the current image
  const currentImageDetectionsCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!selectedImage || !selectedImage.detections) return counts;
    selectedImage.detections.forEach((d) => {
      counts[d.label] = (counts[d.label] || 0) + 1;
    });
    return counts;
  }, [selectedImage]);

  // Compute total detections per class across all images
  const globalClassCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    images.forEach((img) => {
      (img.detections || []).forEach((d) => {
        counts[d.label] = (counts[d.label] || 0) + 1;
      });
    });
    return counts;
  }, [images]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 text-slate-900 font-sans antialiased">
      {/* 1. Label Studio Application Header */}
      <Navbar
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onDetectCurrent={selectedImage ? () => handleDetectSingle(selectedImage.id) : undefined}
        onDetectAll={handleDetectAll}
        isProcessingAny={isProcessingAny}
        isProcessingCurrent={isProcessingCurrent}
        hasDetections={hasAnyDetections}
        imageCount={images.length}
        currentTaskIndex={currentTaskIndex}
        onPrevTask={handlePrevTask}
        onNextTask={handleNextTask}
        ontologyCount={ontology.length}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenOntologyModal={() => handleOpenTaxonomyModal('editor')}
      />

      {activeView === 'labeling' ? (
        /* 2. Labeling Annotation Studio Workstation */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Label Stream Ribbon (Classes selector with hotkeys) */}
          <LabelStreamRibbon
            ontology={ontology}
            setOntology={setOntology}
            activeLabel={activeLabel}
            setActiveLabel={setActiveLabel}
            hiddenClasses={hiddenClasses}
            toggleClassVisibility={toggleClassVisibility}
            currentImageDetectionsCount={currentImageDetectionsCount}
            onOpenTaxonomyModal={() => handleOpenTaxonomyModal('editor')}
          />

          {/* Central Workspace: Tool rail, Canvas Viewport, and Right Regions Inspector */}
          <div className="flex-1 flex flex-row overflow-hidden">
            {/* Center Canvas */}
            <DetectionViewer
              image={selectedImage}
              images={images}
              onSelectImage={setSelectedImageId}
              ontology={ontology}
              onDetectSingle={handleDetectSingle}
              hoveredDetectionId={hoveredDetectionId}
              setHoveredDetectionId={setHoveredDetectionId}
              selectedDetectionId={selectedDetectionId}
              setSelectedDetectionId={setSelectedDetectionId}
              minConfidence={minConfidence}
              setMinConfidence={setMinConfidence}
              hiddenClasses={hiddenClasses}
              toggleClassVisibility={toggleClassVisibility}
              onUpdateDetections={handleUpdateDetections}
              selectedModel={selectedModel}
              activeLabel={activeLabel}
              setActiveLabel={setActiveLabel}
              onOpenUploadModal={() => setActiveView('datamanager')}
              onApplyPreset={handleApplyPreset}
            />

            {/* Right Regions & Predictions Inspector Panel */}
            <RegionsPanel
              image={selectedImage}
              ontology={ontology}
              hoveredDetectionId={hoveredDetectionId}
              setHoveredDetectionId={setHoveredDetectionId}
              selectedDetectionId={selectedDetectionId}
              setSelectedDetectionId={setSelectedDetectionId}
              minConfidence={minConfidence}
              setMinConfidence={setMinConfidence}
              hiddenClasses={hiddenClasses}
              onUpdateDetections={handleUpdateDetections}
              onOpenTaxonomyModal={() => handleOpenTaxonomyModal('editor')}
            />
          </div>
        </div>
      ) : (
        /* 3. Data Manager View (Dataset Table Explorer) */
        <DataManagerView
          images={images}
          setImages={setImages}
          ontology={ontology}
          onSelectImage={setSelectedImageId}
          onDetectSingle={handleDetectSingle}
          onDetectAll={handleDetectAll}
          isProcessingAny={isProcessingAny}
          onSwitchToLabeling={() => setActiveView('labeling')}
          onApplyPreset={handleApplyPreset}
        />
      )}

      {/* Export Results Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        images={images}
        ontology={ontology}
      />

      {/* Taxonomy & Classes Configuration Modal */}
      <OntologyManager
        isOpen={isTaxonomyModalOpen}
        onClose={() => setIsTaxonomyModalOpen(false)}
        ontology={ontology}
        setOntology={setOntology}
        classCounts={globalClassCounts}
        initialTab={taxonomyModalTab}
      />
    </div>
  );
}
