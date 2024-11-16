import { Injectable } from '@angular/core';
import { CPURegisters, CPUState, CPUMode } from '../interfaces/cpu.interface';
import { ARMInstructionType, DataProcessingOpcode, ShifterOperand } from '../interfaces/arm-instructions.interface';
import { InterruptType, InterruptRegisters } from '../interfaces/interrupt.interface';

@Injectable({
  providedIn: 'root'
})
export class CPUService {
  private registers: CPURegisters;
  private memory: Uint8Array;
  private cycles: number;
  private interruptRegisters: InterruptRegisters;
  private isHalted: boolean = false;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.registers = {
      r0: 0, r1: 0, r2: 0, r3: 0,
      r4: 0, r5: 0, r6: 0, r7: 0,
      r8: 0, r9: 0, r10: 0, r11: 0,
      r12: 0,
      sp: 0x03007F00, // GBA初始堆疊指針
      lr: 0,
      pc: 0,
      cpsr: CPUMode.SYSTEM,
      spsr: 0
    };
    
    this.cycles = 0;
    this.interruptRegisters = {
      IE: 0,
      IF: 0,
      IME: 0,
      HALTCNT: 0
    };
    this.isHalted = false;
  }

  public step(): number {
    // 檢查中斷
    if (this.checkInterrupts()) {
      return this.handleInterrupt();
    }

    // 如果處理器處於暫停狀態，等待中斷
    if (this.isHalted) {
      return 1;
    }

    // 正常執行指令
    const instruction = this.fetchInstruction();
    const cycles = this.executeInstruction(instruction);
    this.cycles += cycles;
    return cycles;
  }

  private fetchInstruction(): number {
    if (this.isThumbMode()) {
      // Thumb模式下讀取16位指令
      return this.readHalfWord(this.registers.pc);
    } else {
      // ARM模式下讀取32位指令
      return this.readWord(this.registers.pc);
    }
  }

  private executeInstruction(instruction: number): number {
    if (this.isThumbMode()) {
      return this.executeThumbInstruction(instruction);
    } else {
      return this.executeArmInstruction(instruction);
    }
  }

  private executeArmInstruction(instruction: number): number {
    const conditionCode = (instruction >>> 28) & 0xF;
    
    if (!this.checkCondition(conditionCode)) {
      return 1;
    }

    // 識別指令類型
    if ((instruction & 0x0F000000) === 0x0F000000) {
      return this.executeSoftwareInterrupt(instruction);
    }
    
    if ((instruction & 0x0E000000) === 0x0A000000) {
      return this.executeBranch(instruction);
    }

    if ((instruction & 0x0FC000F0) === 0x00000090) {
      return this.executeMultiply(instruction);
    }

    if ((instruction & 0x0F8000F0) === 0x00800090) {
      return this.executeMultiplyLong(instruction);
    }

    if ((instruction & 0x0FB00FF0) === 0x01000090) {
      return this.executeSwap(instruction);
    }

    // 數據處理指令
    if ((instruction & 0x0C000000) === 0x00000000) {
      return this.executeDataProcessing(instruction);
    }

    // 單數據傳輸
    if ((instruction & 0x0C000000) === 0x04000000) {
      return this.executeSingleDataTransfer(instruction);
    }

    // 塊數據傳輸
    if ((instruction & 0x0E000000) === 0x08000000) {
      return this.executeBlockDataTransfer(instruction);
    }

    throw new Error(`Unknown ARM instruction: ${instruction.toString(16)}`);
  }

  private executeDataProcessing(instruction: number): number {
    const opcode = (instruction >>> 21) & 0xF;
    const setFlags = ((instruction >>> 20) & 1) === 1;
    const rn = (instruction >>> 16) & 0xF;
    const rd = (instruction >>> 12) & 0xF;
    const operand2 = this.calculateShifterOperand(instruction);
    
    let result = 0;
    let flags = {
      N: false,
      Z: false,
      C: operand2.carryOut,
      V: false
    };

    const op1 = this.registers[`r${rn}`];
    const op2 = operand2.value;

    switch (opcode) {
      case DataProcessingOpcode.AND:
        result = op1 & op2;
        break;

      case DataProcessingOpcode.EOR:
        result = op1 ^ op2;
        break;

      case DataProcessingOpcode.SUB:
        result = op1 - op2;
        flags.V = ((op1 ^ op2) & (op1 ^ result)) < 0;
        flags.C = op1 >= op2;
        break;

      case DataProcessingOpcode.RSB:
        result = op2 - op1;
        flags.V = ((op2 ^ op1) & (op2 ^ result)) < 0;
        flags.C = op2 >= op1;
        break;

      case DataProcessingOpcode.ADD:
        result = op1 + op2;
        flags.V = ((~(op1 ^ op2) & (op1 ^ result)) >>> 31) === 1;
        flags.C = result >>> 0 < op1 >>> 0;
        break;

      case DataProcessingOpcode.ADC:
        const carry = (this.registers.cpsr & 0x20000000) ? 1 : 0;
        result = op1 + op2 + carry;
        flags.V = ((~(op1 ^ op2) & (op1 ^ result)) >>> 31) === 1;
        flags.C = result >>> 0 < op1 >>> 0;
        break;

      case DataProcessingOpcode.MOV:
        result = op2;
        break;

      case DataProcessingOpcode.MVN:
        result = ~op2;
        break;

      // ... 實現其他數據處理指令 ...
    }

    // 更新標誌
    if (setFlags) {
      flags.N = (result & 0x80000000) !== 0;
      flags.Z = result === 0;
      this.updateFlags(flags);
    }

    // 入結果
    if (rd !== 15) {
      this.registers[`r${rd}`] = result >>> 0;
    } else {
      this.registers.pc = result >>> 0;
      // PC變更需要刷新流水線
      this.flushPipeline();
    }

    return 1;
  }

  private executeBranch(instruction: number): number {
    const offset = ((instruction & 0x00FFFFFF) << 2);
    const link = (instruction & 0x01000000) !== 0;
    
    if (link) {
      // 保存返回地址
      this.registers.lr = (this.registers.pc - 4) >>> 0;
    }
    
    // 計算分支目標
    const target = (this.registers.pc + offset) >>> 0;
    this.registers.pc = target;
    
    return 3; // 分支指令通常需要3個週期
  }

  private executeMultiply(instruction: number): number {
    const rd = (instruction >>> 16) & 0xF;
    const rn = (instruction >>> 12) & 0xF;
    const rs = (instruction >>> 8) & 0xF;
    const rm = instruction & 0xF;
    const setFlags = ((instruction >>> 20) & 1) === 1;
    const accumulate = ((instruction >>> 21) & 1) === 1;

    let result = (this.registers[`r${rm}`] * this.registers[`r${rs}`]) >>> 0;
    
    if (accumulate) {
      result = (result + this.registers[`r${rn}`]) >>> 0;
    }

    this.registers[`r${rd}`] = result;

    if (setFlags) {
      const flags = {
        N: (result & 0x80000000) !== 0,
        Z: result === 0,
        C: false, // 未定義
        V: false  // 未定義
      };
      this.updateFlags(flags);
    }

    return accumulate ? 4 : 3;
  }

  private calculateShifterOperand(instruction: number): ShifterOperand {
    const immediate = (instruction & 0x02000000) !== 0;
    
    if (immediate) {
      const imm = instruction & 0xFF;
      const rotate = ((instruction >>> 8) & 0xF) * 2;
      const value = ((imm >>> rotate) | (imm << (32 - rotate))) >>> 0;
      return {
        value,
        carryOut: rotate === 0 ? this.getCarryFlag() : (value & 0x80000000) !== 0
      };
    } else {
      const rm = instruction & 0xF;
      const shiftType = (instruction >>> 5) & 0x3;
      const shiftAmount = (instruction >>> 7) & 0x1F;
      
      return this.executeShift(this.registers[`r${rm}`], shiftType, shiftAmount);
    }
  }

  private executeShift(value: number, type: number, amount: number): ShifterOperand {
    let result = 0;
    let carryOut = this.getCarryFlag();

    switch (type) {
      case 0: // LSL
        result = amount === 0 ? value : value << amount;
        carryOut = amount === 0 ? carryOut : (value & (1 << (32 - amount))) !== 0;
        break;
      case 1: // LSR
        result = amount === 0 ? 0 : value >>> amount;
        carryOut = amount === 0 ? (value & 0x80000000) !== 0 : (value & (1 << (amount - 1))) !== 0;
        break;
      case 2: // ASR
        result = amount === 0 ? (value & 0x80000000 ? 0xFFFFFFFF : 0) : value >> amount;
        carryOut = amount === 0 ? (value & 0x80000000) !== 0 : (value & (1 << (amount - 1))) !== 0;
        break;
      case 3: // ROR
        amount = amount & 0x1F;
        result = (value >>> amount) | (value << (32 - amount));
        carryOut = (result & 0x80000000) !== 0;
        break;
    }

    return {
      value: result >>> 0,
      carryOut
    };
  }

  private updateFlags(flags: { N: boolean; Z: boolean; C: boolean; V: boolean }): void {
    let cpsr = this.registers.cpsr;
    
    if (flags.N) cpsr |= 0x80000000;
    else cpsr &= ~0x80000000;
    
    if (flags.Z) cpsr |= 0x40000000;
    else cpsr &= ~0x40000000;
    
    if (flags.C) cpsr |= 0x20000000;
    else cpsr &= ~0x20000000;
    
    if (flags.V) cpsr |= 0x10000000;
    else cpsr &= ~0x10000000;
    
    this.registers.cpsr = cpsr;
  }

  private getCarryFlag(): boolean {
    return (this.registers.cpsr & 0x20000000) !== 0;
  }

  private flushPipeline(): void {
    // 在實際的ARM處理器中，這裡需要清空指令流水線
    // 在模擬器中，我們可以簡單地跳過幾個週期
    this.cycles += 2;
  }

  private executeThumbInstruction(instruction: number): number {
    // 解碼Thumb指令
    const format = (instruction >>> 13) & 0x7;
    
    switch (format) {
      case 0: // Move shifted register
        return this.executeThumbMoveShifted(instruction);
      case 1: // Add/subtract
        return this.executeThumbAddSubtract(instruction);
      // ... 其他Thumb指令格式
      default:
        throw new Error(`Unimplemented Thumb instruction format: ${format}`);
    }
  }

  private isThumbMode(): boolean {
    return (this.registers.cpsr & 0x20) !== 0;
  }

  // 記憶體訪問輔助方法
  private readWord(address: number): number {
    return (this.memory[address] |
      (this.memory[address + 1] << 8) |
      (this.memory[address + 2] << 16) |
      (this.memory[address + 3] << 24)) >>> 0;
  }

  private readHalfWord(address: number): number {
    return (this.memory[address] |
      (this.memory[address + 1] << 8)) & 0xFFFF;
  }

  private calculateOperand2(operand2: number): number {
    // 實現operand2的計算邏輯
    // 這裡需要處理立即數和寄存器移位兩種情況
    return 0; // 臨時返回
  }

  // 檢查是否有待處理的中斷
  private checkInterrupts(): boolean {
    // 檢查主中斷使能
    if (this.interruptRegisters.IME === 0) {
      return false;
    }

    // 檢查是否有使能中斷被觸發
    const pendingInterrupts = this.interruptRegisters.IE & this.interruptRegisters.IF;
    return pendingInterrupts !== 0;
  }

  // 處理中斷
  private handleInterrupt(): number {
    const pendingInterrupts = this.interruptRegisters.IE & this.interruptRegisters.IF;
    if (pendingInterrupts === 0) return 0;

    // 找到最高優先級的中斷
    const interruptNumber = this.getHighestPriorityInterrupt(pendingInterrupts);
    
    // 保存當前狀態
    const oldCPSR = this.registers.cpsr;
    const returnAddress = this.registers.pc;

    // 切換到IRQ模式
    this.switchMode(CPUMode.IRQ);
    
    // 保存返回地址和CPSR
    this.registers.lr = returnAddress - 4;
    this.registers.spsr = oldCPSR;

    // 禁用IRQ，清除Thumb標誌
    this.registers.cpsr |= 0x80;  // I bit
    this.registers.cpsr &= ~0x20; // T bit

    // 清除中斷標誌
    this.interruptRegisters.IF &= ~(1 << interruptNumber);

    // 跳轉到中斷向量
    this.registers.pc = 0x18; // IRQ向量地址

    // 解除HALT狀態
    this.isHalted = false;

    return 3; // 中斷處理通常需要3個週期
  }

  // 獲取最高優先級的中斷
  private getHighestPriorityInterrupt(pendingInterrupts: number): number {
    for (let i = 0; i < 14; i++) {
      if (pendingInterrupts & (1 << i)) {
        return i;
      }
    }
    return -1;
  }

  // 切換CPU模式
  private switchMode(newMode: CPUMode): void {
    const oldMode = this.registers.cpsr & 0x1F;
    if (oldMode === newMode) return;

    // 保存當前模式的寄存器
    this.saveRegisters(oldMode);
    
    // 切換到新模式
    this.registers.cpsr = (this.registers.cpsr & ~0x1F) | newMode;
    
    // 加載新模式的寄存器
    this.loadRegisters(newMode);
  }

  // 保存模式特定的寄存器
  private saveRegisters(mode: CPUMode): void {
    // 根據不同模式保存相應的寄存器
    switch (mode) {
      case CPUMode.USER:
      case CPUMode.SYSTEM:
        // 用戶模式和系統模式共享相同的寄存器
        break;
      case CPUMode.FIQ:
        // 保存FIQ模式的寄存器
        this.saveBankedRegisters('fiq');
        break;
      case CPUMode.IRQ:
        // 保存IRQ模式的寄存器
        this.saveBankedRegisters('irq');
        break;
      case CPUMode.SUPERVISOR:
        // 保存管理模式的寄存器
        this.saveBankedRegisters('svc');
        break;
      case CPUMode.ABORT:
        // 保存中止模式的寄存器
        this.saveBankedRegisters('abt');
        break;
      case CPUMode.UNDEFINED:
        // 保存未定義模式的寄存器
        this.saveBankedRegisters('und');
        break;
    }
  }

  // 加載模式特定的寄存器
  private loadRegisters(mode: CPUMode): void {
    // 根據不同模式加載相應的寄存器
    switch (mode) {
      case CPUMode.USER:
      case CPUMode.SYSTEM:
        // 用戶模式和系統模式共享相同的寄存器
        break;
      case CPUMode.FIQ:
        // 加載FIQ模式的寄存器
        this.loadBankedRegisters('fiq');
        break;
      case CPUMode.IRQ:
        // 加載IRQ模式的寄存器
        this.loadBankedRegisters('irq');
        break;
      case CPUMode.SUPERVISOR:
        // 加載管理模式的寄存器
        this.loadBankedRegisters('svc');
        break;
      case CPUMode.ABORT:
        // 加載中止模式的寄存器
        this.loadBankedRegisters('abt');
        break;
      case CPUMode.UNDEFINED:
        // 加載未定義模式的寄存器
        this.loadBankedRegisters('und');
        break;
    }
  }

  // 觸發中斷
  public requestInterrupt(type: InterruptType): void {
    this.interruptRegisters.IF |= (1 << type);
    
    // 如果中斷被使能且處理器處於HALT狀態，則喚醒處理器
    if ((this.interruptRegisters.IE & (1 << type)) && this.isHalted) {
      this.isHalted = false;
    }
  }

  // 寫入中斷控制寄存器
  public writeInterruptControl(address: number, value: number): void {
    switch (address) {
      case 0x4000200:
        this.interruptRegisters.IE = value & 0x3FFF;
        break;
      case 0x4000202:
        this.interruptRegisters.IF &= ~value;
        break;
      case 0x4000208:
        this.interruptRegisters.IME = value & 1;
        break;
      case 0x4000301:
        this.interruptRegisters.HALTCNT = value;
        if ((value & 0x80) === 0) {
          this.isHalted = true;
        }
        break;
    }
  }

  // 讀取中斷控制寄存器
  public readInterruptControl(address: number): number {
    switch (address) {
      case 0x4000200:
        return this.interruptRegisters.IE;
      case 0x4000202:
        return this.interruptRegisters.IF;
      case 0x4000208:
        return this.interruptRegisters.IME;
      case 0x4000301:
        return this.interruptRegisters.HALTCNT;
      default:
        return 0;
    }
  }

  // 保存CPU狀態
  public saveState(): CPUState {
    return {
      registers: { ...this.registers },
      mode: this.registers.cpsr & 0x1F,
      thumbMode: (this.registers.cpsr & 0x20) !== 0,
      cycles: this.cycles,
      interruptRegisters: { ...this.interruptRegisters },
      isHalted: this.isHalted
    };
  }

  // 加載CPU狀態
  public loadState(state: CPUState): void {
    this.registers = { ...state.registers };
    this.cycles = state.cycles;
    this.interruptRegisters = { ...state.interruptRegisters };
    this.isHalted = state.isHalted;
    
    // 更新CPU模式
    this.loadRegisters(state.mode);
  }

  private executeThumbMoveShifted(instruction: number): number {
    // 實現 Thumb 移位指令
    return 1;
  }

  private executeThumbAddSubtract(instruction: number): number {
    // 實現 Thumb 加減指令
    return 1;
  }

  private saveBankedRegisters(mode: string): void {
    // 實現寄存器組保存
  }

  private loadBankedRegisters(mode: string): void {
    // 實現寄存器組加載
  }

  private executeSoftwareInterrupt(instruction: number): number {
    // 實現軟件中斷處理
    return 3;
  }

  private executeMultiplyLong(instruction: number): number {
    // 實現長乘法指令
    return 4;
  }

  private executeSwap(instruction: number): number {
    // 實現交換指令
    return 2;
  }

  private executeSingleDataTransfer(instruction: number): number {
    // 實現單數據傳輸指令
    return 3;
  }

  private executeBlockDataTransfer(instruction: number): number {
    // 實現塊數據傳輸指令
    return 4;
  }

  private checkCondition(condition: number): boolean {
    const flags = {
      N: (this.registers.cpsr >>> 31) & 1,
      Z: (this.registers.cpsr >>> 30) & 1,
      C: (this.registers.cpsr >>> 29) & 1,
      V: (this.registers.cpsr >>> 28) & 1
    };

    switch (condition) {
      case 0x0: return flags.Z === 1;                    // EQ
      case 0x1: return flags.Z === 0;                    // NE
      case 0x2: return flags.C === 1;                    // CS/HS
      case 0x3: return flags.C === 0;                    // CC/LO
      case 0x4: return flags.N === 1;                    // MI
      case 0x5: return flags.N === 0;                    // PL
      case 0x6: return flags.V === 1;                    // VS
      case 0x7: return flags.V === 0;                    // VC
      case 0x8: return flags.C === 1 && flags.Z === 0;   // HI
      case 0x9: return flags.C === 0 || flags.Z === 1;   // LS
      case 0xA: return flags.N === flags.V;              // GE
      case 0xB: return flags.N !== flags.V;              // LT
      case 0xC: return flags.Z === 0 && flags.N === flags.V;  // GT
      case 0xD: return flags.Z === 1 || flags.N !== flags.V;  // LE
      case 0xE: return true;                             // AL
      case 0xF: return false;                            // NV
      default: return false;
    }
  }
} 