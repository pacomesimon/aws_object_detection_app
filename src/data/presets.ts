import { PresetOntology } from '../types';
import skinRash1Url from '../assets/images/skin_rash_dermatitis_1788081491339.jpg';
import skinRash2Url from '../assets/images/skin_rash_urticaria_1788081503944.jpg';
import floodHouse1Url from '../assets/images/river_flood_houses_1788081517738.jpg';
import floodHouse2Url from '../assets/images/flooding_valley_houses_1788081529454.jpg';

export const COLOR_PALETTE = [
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#d946ef', // fuchsia
];

export const PRESET_ONTOLOGIES: PresetOntology[] = [
  {
    id: 'skin-rashes',
    title: 'Skin Rashes Detection',
    category: 'Clinical Dermatology',
    description: 'Clinical localization and screening of inflammatory dermatological lesions, rashes, and cutaneous eruptions.',
    classes: [
      {
        name: 'Eczema / Dermatitis',
        description: 'Erythematous, dry, itchy, or scaly patches of inflamed skin associated with atopic or contact dermatitis',
        color: '#ef4444',
      },
      {
        name: 'Urticaria / Hives',
        description: 'Raised, edematous wheals, welts, or swollen lesions with erythematous borders and pale center',
        color: '#f59e0b',
      },
      {
        name: 'Papular Rash',
        description: 'Discrete small raised inflammatory bumps, clustered erythematous papules, or localized cutaneous eruptions',
        color: '#8b5cf6',
      },
    ],
  },
  {
    id: 'house-flooding',
    title: 'House Flooding Vulnerability',
    category: 'Geospatial Hydrology',
    description: 'Disaster risk assessment classifying residential structures by flood vulnerability based on riverbank proximity and topographic elevation.',
    classes: [
      {
        name: 'Vulnerable',
        description: 'House or residential building located immediately adjacent to riverbanks, waterways, or low-lying floodplains vulnerable to inundation',
        color: '#ef4444',
      },
      {
        name: 'Non-Vulnerable',
        description: 'House or residential building situated on elevated terrain, hillsides, ridges, or safely distant from water bodies',
        color: '#10b981',
      },
    ],
  },
];

export interface SampleImage {
  id: string;
  name: string;
  category: string;
  url: string;
  recommendedOntologyId: string;
  description?: string;
}

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'sample-skin-rash-1',
    name: 'Forearm Dermatitis & Erythema',
    category: 'Skin Rashes Detection',
    url: skinRash1Url,
    recommendedOntologyId: 'skin-rashes',
    description: 'Clinical examination of forearm exhibiting acute erythematous eczema patches and localized skin irritation.',
  },
  {
    id: 'sample-skin-rash-2',
    name: 'Cutaneous Urticaria & Papules',
    category: 'Skin Rashes Detection',
    url: skinRash2Url,
    recommendedOntologyId: 'skin-rashes',
    description: 'Close-up clinical view of allergic urticaria wheals and erythematous papular rash lesions.',
  },
  {
    id: 'sample-flood-house-1',
    name: 'Riverbank Settlement Flood Risk',
    category: 'House Flooding Vulnerability',
    url: floodHouse1Url,
    recommendedOntologyId: 'house-flooding',
    description: 'Aerial drone survey showing low-lying residential houses along a riverbank compared to elevated hillside dwellings.',
  },
  {
    id: 'sample-flood-house-2',
    name: 'River Valley Elevation Survey',
    category: 'House Flooding Vulnerability',
    url: floodHouse2Url,
    recommendedOntologyId: 'house-flooding',
    description: 'Geospatial overview of residential houses situated in vulnerable floodplain zones versus elevated hillside terrain.',
  },
];
