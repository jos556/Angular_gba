import { Injectable } from '@angular/core';
import { GameInfo, SaveDetectionSignature } from '../interfaces/game-database.interface';
import { GamePakSaveType } from '../interfaces/gamepak.interface';

@Injectable({
  providedIn: 'root'
})
export class SaveDetectionService {
  // 已知遊戲數據庫
  private readonly gameDatabase: { [key: string]: GameInfo } = {
    'BPRE': {
      gameCode: 'BPRE',
      gameName: 'Pokemon Fire Red',
      saveType: 'FLASH_1M',
      size: 16777216,
      features: {
        rtc: false,
        rumble: false,
        gpio: false
      }
    },
    'BPGE': {
      gameCode: 'BPGE',
      gameName: 'Pokemon Emerald',
      saveType: 'FLASH_1M',
      size: 16777216,
      features: {
        rtc: true,
        rumble: false,
        gpio: false
      }
    },
    // ... 更多遊戲數據
  };

  // 存檔類型特徵碼
  private readonly saveSignatures: SaveDetectionSignature[] = [
    {
      pattern: [0x45, 0x45, 0x50, 0x52, 0x4F, 0x4D, 0x5F], // "EEPROM_"
      mask: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
      offset: 0x0,
      saveType: 'EEPROM'
    },
    {
      pattern: [0x53, 0x52, 0x41, 0x4D, 0x5F], // "SRAM_"
      mask: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
      offset: 0x0,
      saveType: 'SRAM'
    },
    {
      pattern: [0x46, 0x4C, 0x41, 0x53, 0x48], // "FLASH"
      mask: [0xFF, 0xFF, 0xFF, 0xFF, 0xFF],
      offset: 0x0,
      saveType: 'FLASH'
    }
  ];

  public detectSaveType(romData: Uint8Array): GamePakSaveType {
    // 1. 首先嘗試從遊戲代碼檢測
    const gameCode = this.extractGameCode(romData);
    const gameInfo = this.gameDatabase[gameCode];
    if (gameInfo) {
      return this.convertSaveTypeString(gameInfo.saveType);
    }

    // 2. 檢查ROM中的特徵碼
    const signatureType = this.detectBySignature(romData);
    if (signatureType) {
      return signatureType;
    }

    // 3. 基於ROM大小和其他特徵進行啟發式檢測
    return this.heuristicDetection(romData);
  }

  private extractGameCode(romData: Uint8Array): string {
    // 遊戲代碼位於ROM頭部0xAC-0xAF
    if (romData.length < 0xB0) return '';
    
    return String.fromCharCode(
      romData[0xAC],
      romData[0xAD],
      romData[0xAE],
      romData[0xAF]
    );
  }

  private detectBySignature(romData: Uint8Array): GamePakSaveType | null {
    for (const sig of this.saveSignatures) {
      let match = true;
      for (let i = 0; i < sig.pattern.length; i++) {
        const romByte = romData[sig.offset + i];
        if ((romByte & sig.mask[i]) !== (sig.pattern[i] & sig.mask[i])) {
          match = false;
          break;
        }
      }
      if (match) {
        return this.convertSaveTypeString(sig.saveType);
      }
    }
    return null;
  }

  private heuristicDetection(romData: Uint8Array): GamePakSaveType {
    // 檢查ROM大小
    const romSize = romData.length;
    
    // 檢查是否包含特定字符串
    const romString = this.searchForSaveStrings(romData);
    
    // 檢查訪問模式
    const accessPattern = this.analyzeAccessPattern(romData);
    
    // 根據以上信息進行判斷
    if (romSize <= 8 * 1024 * 1024) {
      // 較小的ROM通常使用EEPROM
      return GamePakSaveType.EEPROM_8KB;
    } else if (this.containsFlashCommands(romData)) {
      // 如果發現Flash寫入命令
      return GamePakSaveType.FLASH_128KB;
    } else if (this.containsSRAMAccess(romData)) {
      // 如果發現SRAM訪問模式
      return GamePakSaveType.SRAM_32KB;
    }
    
    // 默認返回最常見的類型
    return GamePakSaveType.FLASH_64KB;
  }

  private searchForSaveStrings(romData: Uint8Array): string[] {
    const saveStrings: string[] = [];
    const searchPatterns = [
      'EEPROM',
      'SRAM',
      'FLASH',
      'SAVE',
      'BATTERY'
    ];

    // 將ROM數據轉換為字符串進行搜索
    const textDecoder = new TextDecoder('ascii');
    const romText = textDecoder.decode(romData);

    for (const pattern of searchPatterns) {
      if (romText.includes(pattern)) {
        saveStrings.push(pattern);
      }
    }

    return saveStrings;
  }

  private analyzeAccessPattern(romData: Uint8Array): string {
    // 分析ROM中的存儲器訪問模式
    let sramAccess = 0;
    let eepromAccess = 0;
    let flashAccess = 0;

    // 搜索常見的存儲器訪問指令
    for (let i = 0; i < romData.length - 4; i++) {
      const word = (romData[i] |
        (romData[i + 1] << 8) |
        (romData[i + 2] << 16) |
        (romData[i + 3] << 24)) >>> 0;

      // SRAM訪問模式 (0x0E000000)
      if ((word & 0x0F000000) === 0x0E000000) {
        sramAccess++;
      }
      // EEPROM訪問模式 (0x0DFFFF00)
      if ((word & 0x0FFFFF00) === 0x0DFFFF00) {
        eepromAccess++;
      }
      // Flash命令模式 (0x0E005555)
      if ((word & 0x0FFFFFF) === 0x0E005555) {
        flashAccess++;
      }
    }

    // 返回最可能的訪問模式
    if (flashAccess > sramAccess && flashAccess > eepromAccess) {
      return 'FLASH';
    } else if (sramAccess > eepromAccess) {
      return 'SRAM';
    } else if (eepromAccess > 0) {
      return 'EEPROM';
    }

    return 'UNKNOWN';
  }

  private containsFlashCommands(romData: Uint8Array): boolean {
    // Flash命令序列
    const flashCommands = [
      [0xAA, 0x55, 0xA0], // 寫入命令
      [0xAA, 0x55, 0x80, 0xAA, 0x55, 0x10], // 擦除命令
    ];

    for (const command of flashCommands) {
      let found = false;
      for (let i = 0; i < romData.length - command.length; i++) {
        found = true;
        for (let j = 0; j < command.length; j++) {
          if (romData[i + j] !== command[j]) {
            found = false;
            break;
          }
        }
        if (found) return true;
      }
    }
    return false;
  }

  private containsSRAMAccess(romData: Uint8Array): boolean {
    // 檢查SRAM訪問指令模式
    for (let i = 0; i < romData.length - 4; i++) {
      const word = (romData[i] |
        (romData[i + 1] << 8) |
        (romData[i + 2] << 16) |
        (romData[i + 3] << 24)) >>> 0;

      // 檢查SRAM訪問地址範圍 (0x0E000000-0x0E00FFFF)
      if ((word & 0x0FF00000) === 0x0E000000) {
        return true;
      }
    }
    return false;
  }

  private convertSaveTypeString(saveType: string): GamePakSaveType {
    switch (saveType.toUpperCase()) {
      case 'EEPROM_4K':
      case 'EEPROM_512B':
        return GamePakSaveType.EEPROM_512B;
      case 'EEPROM_64K':
      case 'EEPROM_8KB':
        return GamePakSaveType.EEPROM_8KB;
      case 'SRAM_32K':
      case 'SRAM_32KB':
        return GamePakSaveType.SRAM_32KB;
      case 'FLASH_512K':
      case 'FLASH_64KB':
        return GamePakSaveType.FLASH_64KB;
      case 'FLASH_1M':
      case 'FLASH_128KB':
        return GamePakSaveType.FLASH_128KB;
      default:
        return GamePakSaveType.NONE;
    }
  }
} 