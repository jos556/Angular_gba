export interface GamePakRegisters {
  WAITCNT: number;    // 等待狀態控制 (0x4000204)
  GPSTAT: number;     // 遊戲卡狀態 (0x4000800)
}

export interface GamePakConfig {
  romSize: number;
  saveType: GamePakSaveType;
  hasRTC: boolean;    // 是否有實時時鐘
  hasRumble: boolean; // 是否有震動功能
}

export enum GamePakSaveType {
  NONE,
  EEPROM_512B,
  EEPROM_8KB,
  SRAM_32KB,
  FLASH_64KB,
  FLASH_128KB
}

export enum GamePakWaitState {
  SRAM = 0,          // SRAM等待狀態
  ROM0_N = 2,        // 非連續ROM等待狀態 0
  ROM0_S = 4,        // 連續ROM等待狀態 0
  ROM1_N = 6,        // 非連續ROM等待狀態 1
  ROM1_S = 8,        // 連續ROM等待狀態 1
  ROM2_N = 10,       // 非連續ROM等待狀態 2
  ROM2_S = 12        // 連續ROM等待狀態 2
} 