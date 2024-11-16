export interface AudioRegisters {
  // 聲音1 - 方波
  SOUND1CNT_L: number;  // 頻率掃描 (0x4000060)
  SOUND1CNT_H: number;  // 波形占空比 (0x4000062)
  SOUND1CNT_X: number;  // 頻率控制 (0x4000064)

  // 聲音2 - 方波
  SOUND2CNT_L: number;  // 波形占空比 (0x4000068)
  SOUND2CNT_H: number;  // 頻率控制 (0x400006C)

  // 聲音3 - 波形
  SOUND3CNT_L: number;  // 使能/WAVE RAM選擇 (0x4000070)
  SOUND3CNT_H: number;  // 音量控制 (0x4000072)
  SOUND3CNT_X: number;  // 頻率控制 (0x4000074)

  // 聲音4 - 噪音
  SOUND4CNT_L: number;  // 音量/包絡 (0x4000078)
  SOUND4CNT_H: number;  // 噪音參數 (0x400007C)

  // 聲音控制
  SOUNDCNT_L: number;   // 主音量控制 (0x4000080)
  SOUNDCNT_H: number;   // 聲音混合 (0x4000082)
  SOUNDCNT_X: number;   // 聲音使能 (0x4000084)

  // 聲音偏置
  SOUNDBIAS: number;    // 聲音偏置 (0x4000088)
}

export interface ChannelConfig {
  enabled: boolean;     // 是否啟用
  volume: number;       // 音量 (0-15)
  frequency: number;    // 頻率
  dutyCycle?: number;   // 占空比 (僅用於方波)
  length?: number;      // 長度
  envelope?: {          // 包絡
    initialVolume: number;
    direction: number;  // 0: 減小, 1: 增加
    stepTime: number;
  };
  sweep?: {            // 頻率掃描 (僅用於聲音1)
    time: number;
    direction: number; // 0: 增加, 1: 減小
    shift: number;
  };
}

export interface WaveData {
  data: Uint8Array;    // 波形數據
  position: number;    // 當前位置
  length: number;      // 波形長度
  bank: number;        // 當前使用的WAVE RAM庫
} 