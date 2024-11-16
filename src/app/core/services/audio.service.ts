import { Injectable } from '@angular/core';
import { AudioRegisters, ChannelConfig, WaveData } from '../interfaces/audio.interface';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private registers: AudioRegisters;
  private channels: ChannelConfig[];
  private waveData: WaveData;
  private sampleRate: number;
  private isRunning: boolean = false;

  // 音頻處理節點
  private oscillators: OscillatorNode[];
  private gains: GainNode[];
  private noiseBuffer: AudioBuffer;
  private noiseSource: AudioBufferSourceNode;

  constructor() {
    this.initializeAudio();
  }

  private initializeAudio(): void {
    // 初始化Web Audio API
    this.audioContext = new AudioContext();
    this.sampleRate = this.audioContext.sampleRate;
    
    // 創建主音量控制
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    // 初始化寄存器
    this.registers = {
      SOUND1CNT_L: 0,
      SOUND1CNT_H: 0,
      SOUND1CNT_X: 0,
      SOUND2CNT_L: 0,
      SOUND2CNT_H: 0,
      SOUND3CNT_L: 0,
      SOUND3CNT_H: 0,
      SOUND3CNT_X: 0,
      SOUND4CNT_L: 0,
      SOUND4CNT_H: 0,
      SOUNDCNT_L: 0,
      SOUNDCNT_H: 0,
      SOUNDCNT_X: 0,
      SOUNDBIAS: 0
    };

    // 初始化通道配置
    this.channels = new Array(4).fill(null).map(() => ({
      enabled: false,
      volume: 0,
      frequency: 0
    }));

    // 初始化波形數據
    this.waveData = {
      data: new Uint8Array(32),
      position: 0,
      length: 32,
      bank: 0
    };

    // 初始化音頻節點
    this.initializeNodes();
  }

  private initializeNodes(): void {
    this.oscillators = [];
    this.gains = [];

    // 創建方波通道
    for (let i = 0; i < 2; i++) {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      
      this.oscillators.push(oscillator);
      this.gains.push(gain);
    }

    // 創建波形通道
    const waveOscillator = this.audioContext.createOscillator();
    const waveGain = this.audioContext.createGain();
    
    waveOscillator.setPeriodicWave(this.createCustomWave());
    waveOscillator.connect(waveGain);
    waveGain.connect(this.masterGain);
    
    this.oscillators.push(waveOscillator);
    this.gains.push(waveGain);

    // 創建噪音通道
    this.createNoiseChannel();
  }

  private createCustomWave(): PeriodicWave {
    const real = new Float32Array(32);
    const imag = new Float32Array(32);
    
    // 將波形數據轉換為頻域
    for (let i = 0; i < 32; i++) {
      real[i] = (this.waveData.data[i] - 8) / 8;
      imag[i] = 0;
    }
    
    return this.audioContext.createPeriodicWave(real, imag);
  }

  private createNoiseChannel(): void {
    const bufferSize = this.sampleRate;
    this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    
    // 生成白噪音
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseSource = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    
    this.noiseSource.buffer = this.noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    
    this.gains.push(noiseGain);
  }

  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.audioContext.resume();
    
    // 啟動所有振盪器
    this.oscillators.forEach(osc => osc.start());
    this.noiseSource.start();
  }

  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.audioContext.suspend();
  }

  public writeRegister(address: number, value: number): void {
    switch (address) {
      // 聲音1寄存器
      case 0x4000060:
        this.registers.SOUND1CNT_L = value;
        this.updateChannel1();
        break;
      case 0x4000062:
        this.registers.SOUND1CNT_H = value;
        this.updateChannel1();
        break;
      case 0x4000064:
        this.registers.SOUND1CNT_X = value;
        this.updateChannel1();
        break;

      // 聲音2寄存器
      case 0x4000068:
        this.registers.SOUND2CNT_L = value;
        this.updateChannel2();
        break;
      case 0x400006C:
        this.registers.SOUND2CNT_H = value;
        this.updateChannel2();
        break;

      // 聲音3寄存器
      case 0x4000070:
        this.registers.SOUND3CNT_L = value;
        this.updateChannel3();
        break;
      case 0x4000072:
        this.registers.SOUND3CNT_H = value;
        this.updateChannel3();
        break;
      case 0x4000074:
        this.registers.SOUND3CNT_X = value;
        this.updateChannel3();
        break;

      // 聲音4寄存器
      case 0x4000078:
        this.registers.SOUND4CNT_L = value;
        this.updateChannel4();
        break;
      case 0x400007C:
        this.registers.SOUND4CNT_H = value;
        this.updateChannel4();
        break;

      // 控制寄存器
      case 0x4000080:
        this.registers.SOUNDCNT_L = value;
        this.updateMasterVolume();
        break;
      case 0x4000082:
        this.registers.SOUNDCNT_H = value;
        this.updateMixing();
        break;
      case 0x4000084:
        this.registers.SOUNDCNT_X = value;
        this.updateEnable();
        break;
      case 0x4000088:
        this.registers.SOUNDBIAS = value;
        break;
    }
  }

  private updateChannel1(): void {
    if (!this.channels[0].enabled) return;

    const freq = 131072 / (2048 - (this.registers.SOUND1CNT_X & 0x7FF));
    this.oscillators[0].frequency.setValueAtTime(freq, this.audioContext.currentTime);

    const volume = ((this.registers.SOUND1CNT_H >> 12) & 0xF) / 15;
    this.gains[0].gain.setValueAtTime(volume, this.audioContext.currentTime);

    const dutyCycle = (this.registers.SOUND1CNT_H >> 6) & 0x3;
    this.updateDutyCycle(0, dutyCycle);
  }

  private updateChannel2(): void {
    if (!this.channels[1].enabled) return;

    const freq = 131072 / (2048 - (this.registers.SOUND2CNT_H & 0x7FF));
    this.oscillators[1].frequency.setValueAtTime(freq, this.audioContext.currentTime);

    const volume = ((this.registers.SOUND2CNT_L >> 12) & 0xF) / 15;
    this.gains[1].gain.setValueAtTime(volume, this.audioContext.currentTime);

    const dutyCycle = (this.registers.SOUND2CNT_L >> 6) & 0x3;
    this.updateDutyCycle(1, dutyCycle);
  }

  private updateChannel3(): void {
    if (!this.channels[2].enabled) return;

    const freq = 65536 / (2048 - (this.registers.SOUND3CNT_X & 0x7FF));
    this.oscillators[2].frequency.setValueAtTime(freq, this.audioContext.currentTime);

    const volume = [0, 1, 0.5, 0.25][(this.registers.SOUND3CNT_H >> 13) & 0x3];
    this.gains[2].gain.setValueAtTime(volume, this.audioContext.currentTime);

    if (this.registers.SOUND3CNT_L & 0x40) {
      this.updateWaveform();
    }
  }

  private updateChannel4(): void {
    if (!this.channels[3].enabled) return;

    const divisor = [8, 16, 32, 48, 64, 80, 96, 112][this.registers.SOUND4CNT_H & 0x7];
    const shift = (this.registers.SOUND4CNT_H >> 4) & 0xF;
    const freq = 524288 / divisor / Math.pow(2, shift + 1);
    
    const volume = ((this.registers.SOUND4CNT_L >> 12) & 0xF) / 15;
    this.gains[3].gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  private updateDutyCycle(channel: number, duty: number): void {
    // 占空比值: 12.5%, 25%, 50%, 75%
    const dutyCycles = [0.125, 0.25, 0.5, 0.75];
    const osc = this.oscillators[channel] as OscillatorNode;
    
    // Web Audio API不直接支持修改方波的占空比
    // 這裡使用自定義波形來模擬不同的占空比
    const real = new Float32Array(2);
    const imag = new Float32Array(2);
    
    real[0] = dutyCycles[duty];
    real[1] = 1 - dutyCycles[duty];
    
    const wave = this.audioContext.createPeriodicWave(real, imag);
    osc.setPeriodicWave(wave);
  }

  private updateWaveform(): void {
    // 更新波形通道的自定義波形
    const wave = this.createCustomWave();
    this.oscillators[2].setPeriodicWave(wave);
  }

  private updateMasterVolume(): void {
    const volume = ((this.registers.SOUNDCNT_L >> 4) & 0x7) / 7;
    this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }

  private updateMixing(): void {
    // 實現聲道混合邏輯
    const dmgVolume = [0.25, 0.5, 1][this.registers.SOUNDCNT_L & 0x3];
    const rightEnabled = (this.registers.SOUNDCNT_L >> 8) & 0xF;
    const leftEnabled = (this.registers.SOUNDCNT_L >> 12) & 0xF;
    
    for (let i = 0; i < 4; i++) {
      const gain = this.gains[i];
      const pan = this.audioContext.createStereoPanner();
      
      if (rightEnabled & (1 << i)) {
        pan.pan.value = 1;
      } else if (leftEnabled & (1 << i)) {
        pan.pan.value = -1;
      } else {
        pan.pan.value = 0;
      }
      
      gain.gain.value *= dmgVolume;
    }
  }

  private updateEnable(): void {
    const masterEnable = (this.registers.SOUNDCNT_X >> 7) & 1;
    
    if (masterEnable) {
      for (let i = 0; i < 4; i++) {
        this.channels[i].enabled = ((this.registers.SOUNDCNT_X >> i) & 1) !== 0;
        this.gains[i].gain.value = this.channels[i].enabled ? this.channels[i].volume : 0;
      }
    } else {
      this.channels.forEach(channel => channel.enabled = false);
      this.gains.forEach(gain => gain.gain.value = 0);
    }
  }

  public writeWaveRAM(address: number, value: number): void {
    const offset = address - 0x4000090;
    this.waveData.data[offset] = value;
    
    if (this.channels[2].enabled) {
      this.updateWaveform();
    }
  }
} 