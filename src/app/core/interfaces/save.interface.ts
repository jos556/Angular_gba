export interface SaveData {
  id: string;           // 存檔ID
  gameCode: string;     // 遊戲代碼
  timestamp: number;    // 存檔時間戳
  data: Uint8Array;     // 存檔數據
  type: SaveDataType;   // 存檔類型
  description?: string; // 存檔描述
}

export interface SaveState {
  id: string;
  gameCode: string;
  timestamp: number;
  cpuState: any;
  memoryState: any;
  description?: string;
}

export enum SaveDataType {
  GAME_SAVE = 'GAME_SAVE',   // 遊戲內建存檔
  STATE_SAVE = 'STATE_SAVE'  // 模擬器狀態存檔
}

export interface SaveStorageOptions {
  compress?: boolean;   // 是否壓縮
  encrypt?: boolean;    // 是否加密
  backup?: boolean;     // 是否創建備份
} 