import React, { useState } from 'react';
import { ImageItem, OntologyClass } from '../types';
import { Download, FileJson, Table, Check, X, Code } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  ontology: OntologyClass[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  images,
  ontology,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'coco' | 'csv'>('json');
  const [minConfidenceFilter] = useState(0.0);
  const [scope] = useState<'all' | 'processed'>('processed');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const processedImages = images.filter((img) => img.status === 'done');

  // Generate Structured JSON export payload
  const generateJSONPayload = () => {
    const targetImages = scope === 'all' ? images : processedImages;

    return {
      metadata: {
        generator: 'Label Studio - Amazon Bedrock AgentCore Object Detection Engine',
        exportedAt: new Date().toISOString(),
        totalImages: targetImages.length,
        ontologyClasses: ontology.map((c) => ({ name: c.name, description: c.description })),
      },
      results: targetImages.map((img) => {
        const detections = (img.detections || [])
          .filter((d) => d.confidence >= minConfidenceFilter)
          .map((d) => {
            const [ymin, xmin, ymax, xmax] = d.box_2d;
            return {
              id: d.id,
              label: d.label,
              confidence: Number(d.confidence.toFixed(4)),
              description: d.description || '',
              box_2d_normalized_1000: d.box_2d,
              box_2d_normalized_float: [
                Number((ymin / 1000).toFixed(4)),
                Number((xmin / 1000).toFixed(4)),
                Number((ymax / 1000).toFixed(4)),
                Number((xmax / 1000).toFixed(4)),
              ],
            };
          });

        return {
          imageId: img.id,
          imageName: img.name,
          status: img.status,
          summary: img.summary || '',
          detectionCount: detections.length,
          detections,
        };
      }),
    };
  };

  // Generate COCO Format JSON
  const generateCOCOPayload = () => {
    const targetImages = scope === 'all' ? images : processedImages;

    const categories = ontology.map((cls, idx) => ({
      id: idx + 1,
      name: cls.name,
      supercategory: 'object',
    }));

    const categoryMap: Record<string, number> = {};
    categories.forEach((cat) => {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    });

    const cocoImages: any[] = [];
    const annotations: any[] = [];
    let annotationId = 1;

    targetImages.forEach((img, imgIdx) => {
      const imageId = imgIdx + 1;
      cocoImages.push({
        id: imageId,
        file_name: img.name,
        width: img.width || 1000,
        height: img.height || 1000,
      });

      (img.detections || []).forEach((d) => {
        if (d.confidence < minConfidenceFilter) return;

        const [ymin, xmin, ymax, xmax] = d.box_2d;
        const catId = categoryMap[d.label.toLowerCase()] || 1;

        // COCO bbox format: [x, y, width, height]
        const bboxWidth = xmax - xmin;
        const bboxHeight = ymax - ymin;

        annotations.push({
          id: annotationId++,
          image_id: imageId,
          category_id: catId,
          bbox: [xmin, ymin, bboxWidth, bboxHeight],
          area: bboxWidth * bboxHeight,
          score: d.confidence,
          iscrowd: 0,
        });
      });
    });

    return {
      info: {
        description: 'Label Studio - Amazon Bedrock AgentCore Object Detection Export',
        date_created: new Date().toISOString(),
      },
      categories,
      images: cocoImages,
      annotations,
    };
  };

  // Generate CSV
  const generateCSVPayload = () => {
    const targetImages = scope === 'all' ? images : processedImages;
    const rows = [
      ['image_name', 'label', 'confidence', 'ymin', 'xmin', 'ymax', 'xmax', 'description'],
    ];

    targetImages.forEach((img) => {
      (img.detections || []).forEach((d) => {
        if (d.confidence < minConfidenceFilter) return;
        rows.push([
          `"${img.name}"`,
          `"${d.label}"`,
          d.confidence.toFixed(4),
          d.box_2d[0].toString(),
          d.box_2d[1].toString(),
          d.box_2d[2].toString(),
          d.box_2d[3].toString(),
          `"${(d.description || '').replace(/"/g, '""')}"`,
        ]);
      });
    });

    return rows.map((r) => r.join(',')).join('\n');
  };

  const getExportDataString = () => {
    if (selectedFormat === 'json') {
      return JSON.stringify(generateJSONPayload(), null, 2);
    } else if (selectedFormat === 'coco') {
      return JSON.stringify(generateCOCOPayload(), null, 2);
    } else if (selectedFormat === 'csv') {
      return generateCSVPayload();
    }
    return JSON.stringify(generateJSONPayload(), null, 2);
  };

  const handleDownload = () => {
    const content = getExportDataString();
    const ext = selectedFormat === 'csv' ? 'csv' : 'json';
    const mime = selectedFormat === 'csv' ? 'text/csv' : 'application/json';

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `label_studio_export_${selectedFormat}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportDataString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-900">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#ff5411] flex items-center justify-center text-white">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export Annotations</h3>
              <p className="text-[11px] text-slate-500">Download formatted training data or inspect payload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Format Selection Cards */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedFormat('json')}
                className={`p-3 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                  selectedFormat === 'json'
                    ? 'border-[#ff5411] bg-[#fff5f2] text-slate-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <FileJson className="w-4 h-4 text-[#ff5411]" />
                <div>
                  <div className="text-xs font-semibold">Structured JSON</div>
                  <div className="text-[10px] text-slate-400">Full metadata & boxes</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('coco')}
                className={`p-3 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                  selectedFormat === 'coco'
                    ? 'border-[#ff5411] bg-[#fff5f2] text-slate-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Code className="w-4 h-4 text-emerald-600" />
                <div>
                  <div className="text-xs font-semibold">COCO Format</div>
                  <div className="text-[10px] text-slate-400">Computer Vision benchmark</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('csv')}
                className={`p-3 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                  selectedFormat === 'csv'
                    ? 'border-[#ff5411] bg-[#fff5f2] text-slate-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Table className="w-4 h-4 text-amber-600" />
                <div>
                  <div className="text-xs font-semibold">CSV File</div>
                  <div className="text-[10px] text-slate-400">Tabular spreadsheet</div>
                </div>
              </button>
            </div>
          </div>

          {/* Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">Payload Preview</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-[#ff5411] hover:text-[#e0480b] font-medium flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[10px] font-mono text-emerald-300 max-h-52 overflow-auto whitespace-pre">
              {getExportDataString()}
            </pre>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {processedImages.length} of {images.length} tasks ready for export
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white rounded-lg border border-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#ff5411] hover:bg-[#e0480b] rounded-lg shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
