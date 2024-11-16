import { Injectable } from '@angular/core';
import { GBAConfig } from '../interfaces/gba.interface';
import { CPUService } from './cpu.service';
import { GamePakService } from './gamepak.service';
import { GraphicsService } from './graphics.service';
import { WebGLRendererService } from './webgl-renderer.service';
import { InputService } from './input.service';
import { SaveManagerService } from './save-manager.service';
import { AudioService } from './audio.service';
import { SaveData, SaveDataType } from '../interfaces/save.interface';
import { KeyConfig } from '../interfaces/input.interface';

@Injectable({
  providedIn: 'root'
})
export class GBAEmulatorService {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private imageData: ImageData;
  private config: GBAConfig;
  private isRunning: boolean = false;
  private currentGameCode: string = '';
  private frameCount: number = 0;

  constructor(
    private cpu: CPUService,
    private gamePak: GamePakService,
    private graphics: GraphicsService,
    private renderer: WebGLRendererService,
    private input: InputService,
    private saveManager: SaveManagerService,
    private audio: AudioService
  ) {
    this.config = {
      sampleRate: 44100,
      volume: 1,
      pixelated: true
    };
  }

  public async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    
    // 設置canvas大小為GBA原始解析度
    this.canvas.width = 240;
    this.canvas.height = 160;
    
    // 設置像素化渲染
    if (this.config.pixelated) {
      this.context.imageSmoothingEnabled = false;
    }

    // 創建ImageData對象
    this.imageData = this.context.createImageData(240, 160);

    // 初始化WebGL渲染器
    this.renderer.initialize(canvas);
  }

  public async loadROM(romData: ArrayBuffer): Promise<void> {
    // 重置CPU
    this.cpu.reset();
    
    // 加載ROM到遊戲卡
    this.gamePak.loadROM(romData);
    
    // 獲取遊戲代碼
    this.currentGameCode = this.gamePak.getGameCode();
    
    // 加載最新的遊戲存檔
    const saveData = await this.saveManager.loadGameData(this.currentGameCode);
    if (saveData) {
      this.gamePak.loadSaveData(saveData);
    }
  }

  public start(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.audio.start();
      this.runEmulationLoop();
    }
  }

  public pause(): void {
    this.isRunning = false;
    this.audio.stop();
  }

  private runEmulationLoop(): void {
    if (!this.isRunning) return;

    // 執行一幀的CPU週期
    const cyclesPerFrame = 280896;
    let cycles = 0;
    
    while (cycles < cyclesPerFrame) {
      cycles += this.cpu.step();

      if (cycles % 1232 === 0) {
        this.graphics.renderScanline();
      }
    }

    // 更新畫面
    this.updateScreen();

    // 每300幀（約5秒）自動保存一次
    if (this.frameCount % 300 === 0) {
      this.autoSave();
    }

    this.frameCount++;
    requestAnimationFrame(() => this.runEmulationLoop());
  }

  private updateScreen(): void {
    const frameBuffer = this.graphics.getFrameBuffer();
    // 使用WebGL渲染
    this.renderer.render(frameBuffer);
  }

  public async saveState(description?: string): Promise<string> {
    if (!this.currentGameCode) return null;
    return this.saveManager.saveState(this.currentGameCode, description);
  }

  public async loadState(stateId?: string): Promise<boolean> {
    if (!this.currentGameCode) return false;
    return this.saveManager.loadState(this.currentGameCode, stateId);
  }

  public async getStateList(): Promise<SaveData[]> {
    if (!this.currentGameCode) return [];
    return this.saveManager.getSaveList(this.currentGameCode, SaveDataType.STATE_SAVE);
  }

  public async deleteState(stateId: string): Promise<boolean> {
    return this.saveManager.deleteSave(stateId);
  }

  // 自動保存
  private async autoSave(): Promise<void> {
    if (!this.currentGameCode) return;
    
    const saveData = this.gamePak.getSaveData();
    if (saveData) {
      await this.saveManager.saveGameData(this.currentGameCode, saveData, {
        compress: true,
        backup: true
      });
    }
  }

  public setKeyConfig(config: KeyConfig): void {
    this.input.setKeyConfig(config);
  }

  public getKeyConfig(): KeyConfig {
    return this.input.getKeyConfig();
  }

  public destroy(): void {
    this.input.destroy();
  }
} 