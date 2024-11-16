export enum InterruptType {
  VBLANK = 0,      // 垂直空白中斷
  HBLANK = 1,      // 水平空白中斷
  VCOUNT = 2,      // 垂直計數器匹配
  TIMER0 = 3,      // 定時器0溢出
  TIMER1 = 4,      // 定時器1溢出
  TIMER2 = 5,      // 定時器2溢出
  TIMER3 = 6,      // 定時器3溢出
  SERIAL = 7,      // 串行通信
  DMA0 = 8,        // DMA0結束
  DMA1 = 9,        // DMA1結束
  DMA2 = 10,       // DMA2結束
  DMA3 = 11,       // DMA3結束
  KEYPAD = 12,     // 按鍵輸入
  GAMEPAK = 13     // 遊戲卡中斷
}

export interface InterruptRegisters {
  IE: number;      // 中斷使能寄存器
  IF: number;      // 中斷標誌寄存器
  IME: number;     // 主中斷使能寄存器
  HALTCNT: number; // 待機控制寄存器
} 