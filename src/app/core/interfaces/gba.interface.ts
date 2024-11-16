export interface GBAConfig {
  biosPath?: string;
  romPath?: string;
  sampleRate?: number;
  volume?: number;
  pixelated?: boolean;
}

export interface SaveState {
  id: number;
  date: Date;
  data: any;
} 