export interface DisplayRegisters {
  DISPCNT: number;    // LCD控制 (0x4000000)
  DISPSTAT: number;   // LCD狀態 (0x4000004)
  VCOUNT: number;     // 垂直計數 (0x4000006)
  BG0CNT: number;     // BG0控制 (0x4000008)
  BG1CNT: number;     // BG1控制 (0x400000A)
  BG2CNT: number;     // BG2控制 (0x400000C)
  BG3CNT: number;     // BG3控制 (0x400000E)
}

export interface BGControl {
  priority: number;       // 優先級 (0-3)
  characterBase: number;  // 字符數據基地址
  mosaic: boolean;       // 馬賽克效果
  colorMode: boolean;    // false: 16/16, true: 256/1
  screenBase: number;    // 屏幕數據基地址
  overflow: boolean;     // 溢出包裹
  size: number;          // 屏幕大小 (0-3)
}

export enum DisplayMode {
  MODE0 = 0,  // 4個文本背景
  MODE1 = 1,  // 2個文本背景 + 1個旋轉縮放背景
  MODE2 = 2,  // 2個旋轉縮放背景
  MODE3 = 3,  // 單個15位直接顏色位圖
  MODE4 = 4,  // 單個8位調色板位圖
  MODE5 = 5   // 小尺寸15位直接顏色位圖
}

export interface Sprite {
  attr0: number;  // Y坐標、旋轉/縮放、模式、馬賽克、色深、形狀
  attr1: number;  // X坐標、旋轉/縮放參數、水平翻轉、垂直翻轉、大小
  attr2: number;  // 圖塊索引、調色板、優先級
} 