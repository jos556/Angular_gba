import { Injectable } from '@angular/core';
import { GamePakRegisters, GamePakConfig, GamePakSaveType, GamePakWaitState } from '../interfaces/gamepak.interface';
import { InterruptType } from '../interfaces/interrupt.interface';
import { CPUService } from './cpu.service';
import { SaveDetectionService } from './save-detection.service';

@Injectable({
  providedIn: 'root'
})
export class GamePakService {
  private registers: GamePakRegisters;
  private config: GamePakConfig;
  private romData: Uint8Array;
  private saveData: Uint8Array;
  private isTransferring: boolean = false;

  constructor(
    private cpu: CPUService,
    private saveDetection: SaveDetectionService
  ) {
    this.registers = {
      WAITCNT: 0,
      GPSTAT: 0
    };
  }

  public loadROM(data: ArrayBuffer): void {
    this.romData = new Uint8Array(data);
    this.detectGamePakConfig();
    this.initializeSaveData();
  }

  private detectGamePakConfig(): void {
    this.config = {
      romSize: this.romData.length,
      saveType: this.saveDetection.detectSaveType(this.romData),
      hasRTC: this.detectRTC(),
      hasRumble: this.detectRumble()
    };
  }

  private detectRTC(): boolean {
    // 檢測是否有RTC
    return false;
  }

  private detectRumble(): boolean {
    // 檢測是否有震動功能
    return false;
  }

  private initializeSaveData(): void {
    // 根據存檔類型初始化存檔數據
    switch (this.config.saveType) {
      case GamePakSaveType.EEPROM_512B:
        this.saveData = new Uint8Array(512);
        break;
      case GamePakSaveType.EEPROM_8KB:
        this.saveData = new Uint8Array(8 * 1024);
        break;
      case GamePakSaveType.SRAM_32KB:
        this.saveData = new Uint8Array(32 * 1024);
        break;
      case GamePakSaveType.FLASH_64KB:
        this.saveData = new Uint8Array(64 * 1024);
        break;
      case GamePakSaveType.FLASH_128KB:
        this.saveData = new Uint8Array(128 * 1024);
        break;
    }
  }

  public readROM(address: number): number {
    if (address >= this.romData.length) {
      return 0xFF; // 超出範圍返回0xFF
    }
    return this.romData[address];
  }

  public writeSaveData(address: number, value: number): void {
    if (!this.saveData || address >= this.saveData.length) {
      return;
    }

    this.saveData[address] = value;
    // 觸發遊戲卡中斷
    this.triggerGamePakInterrupt();
  }

  public readSaveData(address: number): number {
    if (!this.saveData || address >= this.saveData.length) {
      return 0xFF;
    }
    return this.saveData[address];
  }

  private triggerGamePakInterrupt(): void {
    // 設置遊戲卡狀態寄存器
    this.registers.GPSTAT |= 0x1;
    // 請求遊戲卡中斷
    this.cpu.requestInterrupt(InterruptType.GAMEPAK);
  }

  public writeRegister(address: number, value: number): void {
    switch (address) {
      case 0x4000204: // WAITCNT
        this.registers.WAITCNT = value;
        this.updateWaitStates();
        break;
      case 0x4000800: // GPSTAT
        // 只能清除狀態位
        this.registers.GPSTAT &= ~value;
        break;
    }
  }

  public readRegister(address: number): number {
    switch (address) {
      case 0x4000204: // WAITCNT
        return this.registers.WAITCNT;
      case 0x4000800: // GPSTAT
        return this.registers.GPSTAT;
      default:
        return 0;
    }
  }

  private updateWaitStates(): void {
    // 更新ROM和SRAM的等待狀態
    const waitcnt = this.registers.WAITCNT;
    
    // SRAM 等待狀態
    const sramWait = (waitcnt & 0x3) << 2;
    
    // ROM 等待狀態
    const rom0N = ((waitcnt >> 2) & 0x3) << 2;
    const rom0S = ((waitcnt >> 4) & 0x1) ? 1 : 4;
    const rom1N = ((waitcnt >> 5) & 0x3) << 2;
    const rom1S = ((waitcnt >> 7) & 0x1) ? 1 : 4;
    const rom2N = ((waitcnt >> 8) & 0x3) << 2;
    const rom2S = ((waitcnt >> 10) & 0x1) ? 1 : 4;

    // 可以存儲這些值以供後續訪問使用
  }

  public startDMATransfer(): void {
    if (this.isTransferring) {
      return;
    }

    this.isTransferring = true;
    // 模擬DMA傳輸完成
    setTimeout(() => {
      this.isTransferring = false;
      this.triggerGamePakInterrupt();
    }, 0);
  }

  public saveState(): any {
    return {
      registers: { ...this.registers },
      saveData: Array.from(this.saveData || []),
      config: { ...this.config }
    };
  }

  public loadState(state: any): void {
    this.registers = { ...state.registers };
    this.saveData = new Uint8Array(state.saveData);
    this.config = { ...state.config };
  }

  public getGameCode(): string {
    // 從ROM頭部讀取遊戲代碼
    if (this.romData && this.romData.length >= 0xB0) {
      return String.fromCharCode(
        this.romData[0xAC],
        this.romData[0xAD],
        this.romData[0xAE],
        this.romData[0xAF]
      );
    }
    return '';
  }

  public loadSaveData(data: Uint8Array): void {
    this.saveData = data;
  }

  public getSaveData(): Uint8Array {
    return this.saveData;
  }
} 