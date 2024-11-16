import { Injectable } from '@angular/core';
import { DisplayRegisters, BGControl, DisplayMode, Sprite } from '../interfaces/graphics.interface';

@Injectable({
  providedIn: 'root'
})
export class GraphicsService {
  private registers: DisplayRegisters;
  private vram: Uint8Array;
  private palette: Uint16Array;
  private oam: Uint16Array;
  private frameBuffer: Uint32Array;
  private scanline: number = 0;

  // GBA屏幕尺寸
  private readonly SCREEN_WIDTH = 240;
  private readonly SCREEN_HEIGHT = 160;

  // 渲染緩存
  private tileCache: Map<number, Uint32Array>;
  private bgCache: Map<number, Uint32Array>;
  private spriteCache: Map<number, Uint32Array>;
  
  // 緩存標誌
  private dirtyTiles: Set<number>;
  private dirtyBGs: Set<number>;
  private dirtySprites: Set<number>;

  constructor() {
    this.initializeMemory();
    this.initializeCache();
  }

  private initializeMemory(): void {
    // 初始化顯示寄存器
    this.registers = {
      DISPCNT: 0,
      DISPSTAT: 0,
      VCOUNT: 0,
      BG0CNT: 0,
      BG1CNT: 0,
      BG2CNT: 0,
      BG3CNT: 0
    };

    // 初始化顯存
    this.vram = new Uint8Array(96 * 1024);        // 96KB VRAM
    this.palette = new Uint16Array(512);           // 1KB 調色板
    this.oam = new Uint16Array(512);              // 1KB OAM
    this.frameBuffer = new Uint32Array(this.SCREEN_WIDTH * this.SCREEN_HEIGHT);
  }

  private initializeCache(): void {
    this.tileCache = new Map();
    this.bgCache = new Map();
    this.spriteCache = new Map();
    
    this.dirtyTiles = new Set();
    this.dirtyBGs = new Set();
    this.dirtySprites = new Set();
  }

  public renderScanline(): void {
    // 使用Web Worker進行並行渲染
    if (this.scanline === 0) {
      this.startParallelRendering();
    }

    // 獲取當前顯示模式
    const mode = this.registers.DISPCNT & 0x7;
    
    // 使用緩存的背景數據
    this.renderCachedBackgrounds(mode);

    // 使用緩存的精靈數據
    if (this.registers.DISPCNT & 0x1000) {
      this.renderCachedSprites();
    }

    // 更新掃描線計數器
    this.scanline = (this.scanline + 1) % this.SCREEN_HEIGHT;
    this.registers.VCOUNT = this.scanline;
  }

  private renderCachedBackgrounds(mode: number): void {
    const offset = this.scanline * this.SCREEN_WIDTH;
    
    switch (mode) {
      case DisplayMode.MODE0:
        // 使用緩存的文本背景
        for (let bg = 0; bg < 4; bg++) {
          if (this.registers.DISPCNT & (1 << (8 + bg))) {
            const bgData = this.getBGCache(bg);
            this.blendScanline(bgData, offset);
          }
        }
        break;
      
      case DisplayMode.MODE3:
      case DisplayMode.MODE4:
        // 直接使用緩存的位圖數據
        const bitmapCache = this.getBitmapCache(mode);
        this.copyToFrameBuffer(bitmapCache, offset);
        break;
    }
  }

  private getBGCache(bg: number): Uint32Array {
    const cacheKey = this.calculateBGCacheKey(bg);
    
    if (this.dirtyBGs.has(bg) || !this.bgCache.has(cacheKey)) {
      // 重新生成背景緩存
      const cache = new Uint32Array(this.SCREEN_WIDTH * this.SCREEN_HEIGHT);
      this.renderBackgroundToCache(bg, cache);
      this.bgCache.set(cacheKey, cache);
      this.dirtyBGs.delete(bg);
    }
    
    return this.bgCache.get(cacheKey);
  }

  private calculateBGCacheKey(bg: number): number {
    const bgcnt = this.getBGControl(bg);
    return (bg << 24) | 
           (bgcnt.screenBase << 16) | 
           (bgcnt.characterBase << 8) | 
           bgcnt.size;
  }

  private renderBackgroundToCache(bg: number, cache: Uint32Array): void {
    const bgcnt = this.getBGControl(bg);
    const screenBase = bgcnt.screenBase * 0x800;
    const charBase = bgcnt.characterBase * 0x4000;
    
    // 使用Web Workers進行並行渲染
    if (typeof Worker !== 'undefined') {
      const worker = new Worker('./background.worker', { type: 'module' });
      worker.postMessage({
        bg,
        bgcnt,
        screenBase,
        charBase,
        vram: this.vram,
        palette: this.palette
      });
      
      worker.onmessage = (e) => {
        cache.set(e.data);
        worker.terminate();
      };
    } else {
      // 回退到同步渲染
      this.renderBackgroundSync(bg, cache, bgcnt, screenBase, charBase);
    }
  }

  private blendScanline(source: Uint32Array, offset: number): void {
    // 使用普通混合
    for (let x = 0; x < this.SCREEN_WIDTH; x++) {
      const srcColor = source[offset + x];
      if (srcColor !== 0) {
        this.frameBuffer[offset + x] = this.blendColors(
          this.frameBuffer[offset + x],
          srcColor
        );
      }
    }
  }

  private blendColors(bottom: number, top: number): number {
    // 實現alpha混合
    const topAlpha = (top >>> 24) & 0xFF;
    if (topAlpha === 0xFF) return top;
    if (topAlpha === 0) return bottom;
    
    const bottomAlpha = (bottom >>> 24) & 0xFF;
    const finalAlpha = topAlpha + ((bottomAlpha * (255 - topAlpha)) >> 8);
    
    const rb = ((top & 0xFF00FF) * topAlpha + 
                (bottom & 0xFF00FF) * (255 - topAlpha)) >> 8;
    const g = ((top & 0x00FF00) * topAlpha + 
               (bottom & 0x00FF00) * (255 - topAlpha)) >> 8;
    
    return (finalAlpha << 24) | (rb & 0xFF00FF) | (g & 0x00FF00);
  }

  private startParallelRendering(): void {
    // 在新的幀開始時啟動並行渲染
    if (typeof Worker !== 'undefined') {
      const worker = new Worker('./frame.worker', { type: 'module' });
      worker.postMessage({
        registers: this.registers,
        vram: this.vram,
        palette: this.palette,
        oam: this.oam
      });
      
      worker.onmessage = (e) => {
        this.frameBuffer.set(e.data);
        worker.terminate();
      };
    }
  }

  private getSpriteWidth(attr0: number, attr1: number): number {
    const shape = (attr0 >> 14) & 3;
    const size = (attr1 >> 14) & 3;
    const sizes = [
      [8, 16, 32, 64],   // Square
      [16, 32, 32, 64],  // Horizontal
      [8, 8, 16, 32],    // Vertical
    ];
    return sizes[shape][size];
  }

  private getSpriteHeight(attr0: number, attr1: number): number {
    const shape = (attr0 >> 14) & 3;
    const size = (attr1 >> 14) & 3;
    const sizes = [
      [8, 16, 32, 64],   // Square
      [8, 8, 16, 32],    // Horizontal
      [16, 32, 32, 64],  // Vertical
    ];
    return sizes[shape][size];
  }

  private getBGControl(bg: number): BGControl {
    const value = [
      this.registers.BG0CNT,
      this.registers.BG1CNT,
      this.registers.BG2CNT,
      this.registers.BG3CNT
    ][bg];

    return {
      priority: value & 3,
      characterBase: (value >> 2) & 0x3,
      mosaic: ((value >> 6) & 1) !== 0,
      colorMode: ((value >> 7) & 1) !== 0,
      screenBase: (value >> 8) & 0x1F,
      overflow: ((value >> 13) & 1) !== 0,
      size: (value >> 14) & 3
    };
  }

  private convert15To32(color: number): number {
    const r = (color & 0x1F) << 3;
    const g = ((color >> 5) & 0x1F) << 3;
    const b = ((color >> 10) & 0x1F) << 3;
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  public getFrameBuffer(): Uint32Array {
    return this.frameBuffer;
  }

  public writeRegister(address: number, value: number): void {
    switch (address) {
      case 0x4000000:
        this.registers.DISPCNT = value;
        break;
      case 0x4000004:
        this.registers.DISPSTAT = value;
        break;
      case 0x4000008:
        this.registers.BG0CNT = value;
        break;
      case 0x400000A:
        this.registers.BG1CNT = value;
        break;
      case 0x400000C:
        this.registers.BG2CNT = value;
        break;
      case 0x400000E:
        this.registers.BG3CNT = value;
        break;
    }
  }

  public readRegister(address: number): number {
    switch (address) {
      case 0x4000000:
        return this.registers.DISPCNT;
      case 0x4000004:
        return this.registers.DISPSTAT;
      case 0x4000006:
        return this.registers.VCOUNT;
      case 0x4000008:
        return this.registers.BG0CNT;
      case 0x400000A:
        return this.registers.BG1CNT;
      case 0x400000C:
        return this.registers.BG2CNT;
      case 0x400000E:
        return this.registers.BG3CNT;
      default:
        return 0;
    }
  }

  private renderCachedSprites(): void {
    // 實現精靈渲染邏輯
  }

  private getBitmapCache(mode: number): Uint32Array {
    // 實現位圖緩存邏輯
    return new Uint32Array(this.SCREEN_WIDTH * this.SCREEN_HEIGHT);
  }

  private copyToFrameBuffer(source: Uint32Array, offset: number): void {
    this.frameBuffer.set(source.subarray(offset, offset + this.SCREEN_WIDTH), offset);
  }

  private renderBackgroundSync(
    bg: number,
    cache: Uint32Array,
    bgcnt: any,
    screenBase: number,
    charBase: number
  ): void {
    // 實現同步背景渲染邏輯
  }
} 