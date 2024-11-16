import { Injectable } from '@angular/core';
import { SaveData, SaveState, SaveDataType, SaveStorageOptions } from '../interfaces/save.interface';
import { GamePakService } from './gamepak.service';
import { CPUService } from './cpu.service';
import * as pako from 'pako';  // 使用pako進行壓縮
import { v4 as uuidv4 } from 'uuid';  // 生成唯一ID

@Injectable({
  providedIn: 'root'
})
export class SaveManagerService {
  private readonly SAVE_PREFIX = 'GBA_SAVE_';
  private readonly STATE_PREFIX = 'GBA_STATE_';
  
  constructor(
    private gamePak: GamePakService,
    private cpu: CPUService
  ) {}

  // 保存遊戲存檔
  public async saveGameData(
    gameCode: string,
    data: Uint8Array,
    options: SaveStorageOptions = {}
  ): Promise<string> {
    const saveData: SaveData = {
      id: uuidv4(),
      gameCode,
      timestamp: Date.now(),
      data,
      type: SaveDataType.GAME_SAVE
    };

    return this.storeSaveData(saveData, options);
  }

  // 保存模擬器狀態
  public async saveState(
    gameCode: string,
    description?: string,
    options: SaveStorageOptions = {}
  ): Promise<string> {
    const state: SaveState = {
      id: uuidv4(),
      gameCode,
      timestamp: Date.now(),
      cpuState: this.cpu.saveState(),
      memoryState: this.gamePak.saveState(),
      description
    };

    const saveData: SaveData = {
      id: state.id,
      gameCode,
      timestamp: state.timestamp,
      data: this.serializeState(state),
      type: SaveDataType.STATE_SAVE,
      description
    };

    return this.storeSaveData(saveData, options);
  }

  // 加載遊戲存檔
  public async loadGameData(
    gameCode: string,
    saveId?: string
  ): Promise<Uint8Array | null> {
    const saveData = await this.loadLatestSaveData(gameCode, SaveDataType.GAME_SAVE, saveId);
    return saveData ? saveData.data : null;
  }

  // 加載模擬器狀態
  public async loadState(
    gameCode: string,
    stateId?: string
  ): Promise<boolean> {
    const saveData = await this.loadLatestSaveData(gameCode, SaveDataType.STATE_SAVE, stateId);
    if (!saveData) return false;

    try {
      const state = this.deserializeState(saveData.data);
      this.cpu.loadState(state.cpuState);
      this.gamePak.loadState(state.memoryState);
      return true;
    } catch (error) {
      console.error('Failed to load state:', error);
      return false;
    }
  }

  // 獲取存檔列表
  public async getSaveList(
    gameCode: string,
    type: SaveDataType
  ): Promise<SaveData[]> {
    const saves: SaveData[] = [];
    const prefix = type === SaveDataType.GAME_SAVE ? this.SAVE_PREFIX : this.STATE_PREFIX;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try {
          const saveData = await this.loadSaveData(key);
          if (saveData && saveData.gameCode === gameCode && saveData.type === type) {
            saves.push(saveData);
          }
        } catch (error) {
          console.error('Failed to load save data:', error);
        }
      }
    }

    // 按時間戳排序
    return saves.sort((a, b) => b.timestamp - a.timestamp);
  }

  // 刪除存檔
  public async deleteSave(saveId: string): Promise<boolean> {
    try {
      localStorage.removeItem(`${this.SAVE_PREFIX}${saveId}`);
      localStorage.removeItem(`${this.STATE_PREFIX}${saveId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete save:', error);
      return false;
    }
  }

  // 存儲存檔數據
  private async storeSaveData(
    saveData: SaveData,
    options: SaveStorageOptions
  ): Promise<string> {
    const key = `${saveData.type === SaveDataType.GAME_SAVE ? this.SAVE_PREFIX : this.STATE_PREFIX}${saveData.id}`;
    
    let data = saveData.data;
    
    // 壓縮數據
    if (options.compress) {
      data = pako.deflate(data);
    }
    
    // 加密數據
    if (options.encrypt) {
      data = await this.encryptData(data);
    }
    
    // 轉換為Base64
    const base64Data = btoa(String.fromCharCode.apply(null, Array.from(data)));
    
    // 存儲數據
    const storageData = {
      ...saveData,
      data: base64Data,
      compressed: options.compress,
      encrypted: options.encrypt
    };
    
    localStorage.setItem(key, JSON.stringify(storageData));
    
    // 創建備份
    if (options.backup) {
      localStorage.setItem(`${key}_backup`, JSON.stringify(storageData));
    }
    
    return saveData.id;
  }

  // 加載最新的存檔數據
  private async loadLatestSaveData(
    gameCode: string,
    type: SaveDataType,
    saveId?: string
  ): Promise<SaveData | null> {
    if (saveId) {
      // 加載指定的存檔
      const key = `${type === SaveDataType.GAME_SAVE ? this.SAVE_PREFIX : this.STATE_PREFIX}${saveId}`;
      return this.loadSaveData(key);
    }

    // 加載最新的存檔
    const saves = await this.getSaveList(gameCode, type);
    return saves.length > 0 ? saves[0] : null;
  }

  // 從存儲中加載存檔數據
  private async loadSaveData(key: string): Promise<SaveData | null> {
    try {
      const storageData = localStorage.getItem(key);
      if (!storageData) {
        // 嘗試從備份中恢復
        const backupData = localStorage.getItem(`${key}_backup`);
        if (!backupData) return null;
        return this.processSaveData(JSON.parse(backupData));
      }
      return this.processSaveData(JSON.parse(storageData));
    } catch (error) {
      console.error('Failed to load save data:', error);
      return null;
    }
  }

  // 處理存檔數據
  private async processSaveData(storageData: any): Promise<SaveData> {
    let data = Uint8Array.from(atob(storageData.data), c => c.charCodeAt(0));
    
    // 解密數據
    if (storageData.encrypted) {
      data = await this.decryptData(data);
    }
    
    // 解壓數據
    if (storageData.compressed) {
      data = pako.inflate(data);
    }
    
    return {
      id: storageData.id,
      gameCode: storageData.gameCode,
      timestamp: storageData.timestamp,
      data,
      type: storageData.type,
      description: storageData.description
    };
  }

  // 序列化狀態
  private serializeState(state: SaveState): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(state));
  }

  // 反序列化狀態
  private deserializeState(data: Uint8Array): SaveState {
    return JSON.parse(new TextDecoder().decode(data));
  }

  // 加密數據
  private async encryptData(data: Uint8Array): Promise<Uint8Array> {
    // 這裡實現簡單的加密，實際應用中應使用更安全的加密方法
    return data;
  }

  // 解密數據
  private async decryptData(data: Uint8Array): Promise<Uint8Array> {
    // 這裡實現簡單的解密，實際應用中應使用更安全的解密方法
    return data;
  }

  // 清理過期的存檔
  public async cleanupOldSaves(
    maxAge: number = 30 * 24 * 60 * 60 * 1000  // 默認30天
  ): Promise<void> {
    const now = Date.now();
    const saves = await this.getAllSaves();
    
    for (const save of saves) {
      if (now - save.timestamp > maxAge) {
        await this.deleteSave(save.id);
      }
    }
  }

  // 獲取所有存檔
  private async getAllSaves(): Promise<SaveData[]> {
    const saves: SaveData[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.SAVE_PREFIX) || key?.startsWith(this.STATE_PREFIX)) {
        try {
          const saveData = await this.loadSaveData(key);
          if (saveData) {
            saves.push(saveData);
          }
        } catch (error) {
          console.error('Failed to load save data:', error);
        }
      }
    }
    
    return saves;
  }
} 