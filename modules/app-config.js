export const SCALP_REGIONS = {
  bangs: { label: "Bangs Root", color: 0xef476f },
  "side-bangs-left": { label: "Side Bangs Left", color: 0xb967ff },
  "side-bangs-right": { label: "Side Bangs Right", color: 0xffd166 },
  "side-left": { label: "Side Left", color: 0x47c978 },
  "side-right": { label: "Side Right", color: 0x36c9c6 },
  back: { label: "Back", color: 0x4778e8 },
  unassigned: { label: "Unassigned", color: 0x77747d }
};

export const DEFAULT_HAIR_COLOR = "#2c223a";
export const CURVE_LATTICE_FEATURE_ENABLED = false;
export const GROUP_CURVE_FEATURE_ENABLED = true;
export const DEFAULT_HAIR_MATERIAL_ID = "default-purple";
export const ROOT_SCALP_OFFSET_DISTANCE = 0.08;
export const DEFAULT_HAIR_MATERIAL_SETTINGS = {
  color: DEFAULT_HAIR_COLOR,
  shadowColor: "#555a78",
  highlightColor: "#e7ebff",
  roughness: 0.72,
  shadowThreshold: 0.12,
  shadowSoftness: 0.025,
  backGradientStrength: 0.36,
  backGradientPower: 1.35,
  highlightWidth: 0.055,
  highlightSoftness: 0.018,
  highlightStrength: 0.68,
  highlightShift: 0.12,
  highlightJaggedness: 0.22,
  highlightJaggedFrequency: 7
};

export const STRAND_GROUPS = [
  { id: "bangs", label: "Front Bangs" },
  { id: "side-bangs-left", label: "Side Bangs Left" },
  { id: "side-bangs-right", label: "Side Bangs Right" },
  { id: "side-left", label: "Side Left" },
  { id: "side-right", label: "Side Right" },
  { id: "back", label: "Back" },
  { id: "unassigned", label: "Unassigned" }
];

export const HAIR_LAYERS = [
  { id: "bottom", label: "Bottom", defaultOffset: -0.04, colorFactor: 0.34 },
  { id: "mid", label: "Mid", defaultOffset: 0, colorFactor: 0.6 },
  { id: "top", label: "Top", defaultOffset: 0.08, colorFactor: 1 },
  { id: "accent", label: "Accent", defaultOffset: 0.16, colorFactor: 1.08 }
];
export const MATERIAL_LAYER_COLOR_FACTORS = { bottom: 0.38, mid: 0.64, top: 1, accent: 1.08 };
export const LAYER_HUE_SHIFTS = { bottom: -0.045, mid: -0.015, top: 0.012, accent: 0.032 };
export const LAYER_ROOT_OFFSET_FACTORS = { bottom: 0.72, mid: 0.42, top: 0.16, accent: 0.08 };
export const DEFAULT_HAIR_LAYER = "mid";
export const DEFAULT_LAYER_OFFSETS = Object.fromEntries(HAIR_LAYERS.map((layer) => [layer.id, layer.defaultOffset]));
export const DEFAULT_BRAID_MESH_PRESET = "classic";

export const DEFAULT_SWEEP_PROFILE = [
  { x: 1, z: -0.31 }, { x: 0.94, z: -0.18 }, { x: 0.55, z: 0.14 },
  { x: 0, z: 0.36 }, { x: -0.55, z: 0.14 }, { x: -0.94, z: -0.18 },
  { x: -1, z: -0.31 }, { x: -0.7, z: -0.36 }, { x: 0.7, z: -0.36 }
];
export const ROUND_SWEEP_PROFILE = [
  { x: 1, z: 0 }, { x: 0.7, z: 0.7 }, { x: 0, z: 1 }, { x: -0.7, z: 0.7 },
  { x: -1, z: 0 }, { x: -0.7, z: -0.7 }, { x: 0, z: -1 }, { x: 0.7, z: -0.7 }
];
export const DEFAULT_TAPER_CURVE = [
  { position: 0, value: 0.3, interpolation: "smooth" },
  { position: 0.11, value: 0.6, interpolation: "smooth" },
  { position: 0.43, value: 0.95, interpolation: "smooth" },
  { position: 0.68, value: 0.8, interpolation: "smooth" },
  { position: 0.89, value: 0.4, interpolation: "smooth" },
  { position: 1, value: 0, interpolation: "smooth" }
];
export const DEFAULT_DEPTH_CURVE = [
  { position: 0, value: 0.18, interpolation: "smooth" },
  { position: 0.25, value: 0.66, interpolation: "smooth" },
  { position: 1, value: 0, interpolation: "smooth" }
];
export const DEFAULT_BRAID_WIDTH_CURVE = [
  { position: 0, value: 0.72, interpolation: "smooth" },
  { position: 0.14, value: 1, interpolation: "smooth" },
  { position: 0.72, value: 1, interpolation: "smooth" },
  { position: 1, value: 0.2, interpolation: "smooth" }
];
export const DEFAULT_BRAID_DEPTH_CURVE = [
  { position: 0, value: 0.72, interpolation: "smooth" },
  { position: 0.16, value: 1, interpolation: "smooth" },
  { position: 0.78, value: 0.92, interpolation: "smooth" },
  { position: 1, value: 0.18, interpolation: "smooth" }
];
export const TAPER_VALUE_MAX = 1.5;
