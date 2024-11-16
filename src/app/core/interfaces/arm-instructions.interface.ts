export enum ARMInstructionType {
  DataProcessing = 0,
  Multiply = 1,
  MultiplyLong = 2,
  SingleDataSwap = 3,
  BranchExchange = 4,
  HalfwordTransfer = 5,
  SingleDataTransfer = 6,
  BlockDataTransfer = 7,
  Branch = 8,
  CoprocessorDataTransfer = 9,
  CoprocessorDataOperation = 10,
  SoftwareInterrupt = 11
}

export enum DataProcessingOpcode {
  AND = 0x0,
  EOR = 0x1,
  SUB = 0x2,
  RSB = 0x3,
  ADD = 0x4,
  ADC = 0x5,
  SBC = 0x6,
  RSC = 0x7,
  TST = 0x8,
  TEQ = 0x9,
  CMP = 0xA,
  CMN = 0xB,
  ORR = 0xC,
  MOV = 0xD,
  BIC = 0xE,
  MVN = 0xF
}

export interface ShifterOperand {
  value: number;
  carryOut: boolean;
} 