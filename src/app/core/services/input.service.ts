import { Injectable, NgZone, inject } from '@angular/core';
import { GBAKey, KeyConfig, KeyState } from '../interfaces/input.interface';
import { CPUService } from './cpu.service';
import { InterruptType } from '../interfaces/interrupt.interface';

@Injectable({
  providedIn: 'root'
})
export class InputService {
  private keyState!: KeyState;
  private keyConfig!: KeyConfig;
  private ngZone = inject(NgZone);

  constructor(private cpu: CPUService) {
    this.initializeKeyState();
    this.initializeKeyConfig();
    this.setupKeyboardListeners();
  }

  private initializeKeyState(): void {
    this.keyState = {
      keyInput: 0x03FF,  // 所有按鍵初始為未按下
      prevState: 0x03FF
    };
  }

  private initializeKeyConfig(): void {
    // 默認鍵盤映射
    this.keyConfig = {
      'z': GBAKey.A,        // Z鍵映射到A按鈕
      'x': GBAKey.B,        // X鍵映射到B按鈕
      'Shift': GBAKey.SELECT, // Shift鍵映射到Select按鈕
      'Enter': GBAKey.START,  // Enter鍵映射到Start按鈕
      'ArrowRight': GBAKey.RIGHT, // 右方向鍵
      'ArrowLeft': GBAKey.LEFT,   // 左方向鍵
      'ArrowUp': GBAKey.UP,       // 上方向鍵
      'ArrowDown': GBAKey.DOWN,   // 下方向鍵
      'a': GBAKey.L,        // A鍵映射到L按鈕
      's': GBAKey.R         // S鍵映射到R按鈕
    };
  }

  private setupKeyboardListeners(): void {
    // 使用NgZone.runOutsideAngular來避免不必要的變更檢測
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
      window.addEventListener('keyup', this.handleKeyUp.bind(this));
      window.addEventListener('blur', this.handleBlur.bind(this));
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // 防止按鍵事件影響頁面滾動
    if (Object.keys(this.keyConfig).includes(event.key)) {
      event.preventDefault();
    }

    const gbaKey = this.keyConfig[event.key];
    if (gbaKey !== undefined) {
      this.keyState.prevState = this.keyState.keyInput;
      // 清除對應的位（0表示按下）
      this.keyState.keyInput &= ~(1 << gbaKey);
      this.checkKeyInterrupt();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const gbaKey = this.keyConfig[event.key];
    if (gbaKey !== undefined) {
      this.keyState.prevState = this.keyState.keyInput;
      // 設置對應的位（1表示釋放）
      this.keyState.keyInput |= (1 << gbaKey);
      this.checkKeyInterrupt();
    }
  }

  private handleBlur(): void {
    // 當窗口失去焦點時，重置所有按鍵狀態
    this.keyState.prevState = this.keyState.keyInput;
    this.keyState.keyInput = 0x03FF;
  }

  private checkKeyInterrupt(): void {
    // 檢查是否需要觸發按鍵中斷
    const keyChange = this.keyState.prevState ^ this.keyState.keyInput;
    if (keyChange !== 0) {
      this.cpu.requestInterrupt(InterruptType.KEYPAD);
    }
  }

  public readKeyInput(): number {
    return this.keyState.keyInput;
  }

  public setKeyConfig(newConfig: KeyConfig): void {
    this.keyConfig = { ...newConfig };
  }

  public getKeyConfig(): KeyConfig {
    return { ...this.keyConfig };
  }

  // 用於測試的方法
  public simulateKeyPress(key: GBAKey): void {
    this.keyState.prevState = this.keyState.keyInput;
    this.keyState.keyInput &= ~(1 << key);
    this.checkKeyInterrupt();
  }

  public simulateKeyRelease(key: GBAKey): void {
    this.keyState.prevState = this.keyState.keyInput;
    this.keyState.keyInput |= (1 << key);
    this.checkKeyInterrupt();
  }

  // 清理方法
  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('blur', this.handleBlur.bind(this));
  }
} 