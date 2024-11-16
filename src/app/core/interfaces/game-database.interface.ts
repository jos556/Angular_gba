export interface GameInfo {
  gameCode: string;      // 遊戲代碼 (如 "APCE" 代表 Pokemon Emerald)
  gameName: string;      // 遊戲名稱
  saveType: string;      // 存檔類型
  size: number;          // ROM大小
  features?: {           // 特殊功能
    rtc?: boolean;       // 實時時鐘
    rumble?: boolean;    // 震動
    gpio?: boolean;      // GPIO功能
  };
  checksums?: {          // 校驗和
    crc32?: string;
    sha1?: string;
  };
}

export interface SaveDetectionSignature {
  pattern: number[];     // 特徵碼
  mask: number[];        // 掩碼
  offset: number;        // 偏移量
  saveType: string;      // 對應的存檔類型
} 