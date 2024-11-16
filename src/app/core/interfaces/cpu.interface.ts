import { InterruptRegisters } from './interrupt.interface';

export interface CPURegisters {
  // General Purpose Registers
  r0: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  r6: number;
  r7: number;
  r8: number;
  r9: number;
  r10: number;
  r11: number;
  r12: number;
  
  // Special Purpose Registers
  sp: number;    // R13 - Stack Pointer
  lr: number;    // R14 - Link Register
  pc: number;    // R15 - Program Counter
  
  // Program Status Registers
  cpsr: number;  // Current Program Status Register
  spsr: number;  // Saved Program Status Register
}

export interface CPUState {
  registers: CPURegisters;
  mode: CPUMode;
  thumbMode: boolean;
  cycles: number;
  interruptRegisters: InterruptRegisters;
  isHalted: boolean;
}

export enum CPUMode {
  USER = 0x10,
  FIQ = 0x11,
  IRQ = 0x12,
  SUPERVISOR = 0x13,
  ABORT = 0x17,
  UNDEFINED = 0x1B,
  SYSTEM = 0x1F
} 