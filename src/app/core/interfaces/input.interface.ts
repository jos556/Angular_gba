export enum GBAKey {
  A = 0,
  B = 1,
  SELECT = 2,
  START = 3,
  RIGHT = 4,
  LEFT = 5,
  UP = 6,
  DOWN = 7,
  R = 8,
  L = 9
}

export interface KeyConfig {
  [key: string]: GBAKey;
}

export interface KeyState {
  keyInput: number;    // 按鍵輸入寄存器 (0x4000130)
  prevState: number;   // 上一個狀態
} 