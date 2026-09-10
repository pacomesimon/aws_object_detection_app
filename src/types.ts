export interface OntologyClass {
  id: string;
  name: string;
  description: string;
  color: string;
}

// [ymin, xmin, ymax, xmax] in 0..1000 scale
export type BoundingBox = [number, number, number, number];

export interface DetectionItem {
  id: string;
  label: string;
  box_2d: BoundingBox;
  confidence: number;
  description?: string;
  color?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommended?: boolean;
}

export const GEMINI_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Recommended',
    description: 'Fast, reliable multimodal visual processing and spatial localization.',
    recommended: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship Multimodal',
    description: 'Fast, high-precision multimodal vision and 2D bounding box localization.',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'High Speed',
    description: 'Balanced multimodal visual reasoning and object detection.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Efficient',
    description: 'Versatile vision and entity tagging.',
  },
];

export const BEDROCK_MODELS: ModelOption[] = [
  {
    id: 'us.amazon.nova-2-lite-v1:0',
    name: 'Amazon Nova 2 Lite',
    badge: 'Next-Gen Fast Multimodal',
    description: 'Next-generation Amazon Nova 2 model for rapid multimodal vision and spatial detection on Bedrock.',
    recommended: true,
  },
  {
    id: 'amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    badge: 'Frontier Multimodal',
    description: 'Amazon frontier multimodal foundation model for visual analysis and spatial grounding.',
  },
  {
    id: 'amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    badge: 'Ultra Low Cost',
    description: 'Ultra-fast, cost-effective multimodal visual labeling on Bedrock.',
  },
];

export const AVAILABLE_MODELS: ModelOption[] = [...GEMINI_MODELS, ...BEDROCK_MODELS];

export interface ImageItem {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  detections?: DetectionItem[];
  summary?: string;
  errorMessage?: string;
  processedAt?: string;
  detectedWithModel?: string;
  category?: string;
  recommendedOntologyId?: string;
}

export interface PresetOntology {
  id: string;
  title: string;
  category: string;
  description: string;
  classes: {
    name: string;
    description: string;
    color: string;
  }[];
}

export interface BrainstormSuggestion {
  name: string;
  description: string;
  rationale?: string;
}

export interface BrainstormMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedClasses?: BrainstormSuggestion[];
  timestamp: string;
  referenceUrlUsed?: string;
  urlFetched?: boolean;
}

export interface ExportFormatOptions {
  format: 'json' | 'coco' | 'voc' | 'csv';
  includeNormalized: boolean;
  minConfidence: number;
}

export interface BedrockConfig {
  enabled: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  invocationType: 'agent' | 'model';
  agentId?: string;
  agentAliasId?: string;
  modelId: string;
  sessionId?: string;
  mockIfCredentialsInvalid?: boolean;
}

export interface BedrockModelOption {
  id: string;
  name: string;
  provider: string;
  badge: string;
  description: string;
}

export const AVAILABLE_BEDROCK_MODELS: BedrockModelOption[] = [
  {
    id: 'us.amazon.nova-2-lite-v1:0',
    name: 'Amazon Nova 2 Lite',
    provider: 'Amazon',
    badge: 'Next-Gen Fast Multimodal',
    description: 'Next-generation Amazon Nova 2 model for rapid multimodal vision and spatial detection.',
  },
  {
    id: 'amazon.nova-pro-v1:0',
    name: 'Amazon Nova Pro',
    provider: 'Amazon',
    badge: 'Frontier Multimodal',
    description: 'Amazon frontier multimodal foundation model for visual analysis and spatial grounding.',
  },
  {
    id: 'amazon.nova-lite-v1:0',
    name: 'Amazon Nova Lite',
    provider: 'Amazon',
    badge: 'Ultra Low Cost',
    description: 'Cost-effective multimodal visual processing and labeling.',
  },
];
