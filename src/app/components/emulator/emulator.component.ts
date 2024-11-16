import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GBAEmulatorService } from '../../core/services/gba-emulator.service';
import { KeyConfig, GBAKey } from '../../core/interfaces/input.interface';

@Component({
  selector: 'app-emulator',
  templateUrl: './emulator.component.html',
  styleUrls: ['./emulator.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class EmulatorComponent implements OnInit, OnDestroy {
  @ViewChild('gbaCanvas', { static: true }) canvasRef: ElementRef<HTMLCanvasElement>;
  
  public keyConfig: KeyConfig;
  public showKeyConfig: boolean = false;

  constructor(private emulatorService: GBAEmulatorService) {
    this.keyConfig = this.emulatorService.getKeyConfig();
  }

  async ngOnInit() {
    await this.emulatorService.initialize(this.canvasRef.nativeElement);
  }

  ngOnDestroy() {
    this.emulatorService.destroy();
  }

  async onROMUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files[0];
    if (file) {
      const romData = await file.arrayBuffer();
      await this.emulatorService.loadROM(romData);
      this.emulatorService.start();
    }
  }

  onPause() {
    this.emulatorService.pause();
  }

  toggleKeyConfig() {
    this.showKeyConfig = !this.showKeyConfig;
  }

  updateKeyConfig() {
    this.emulatorService.setKeyConfig(this.keyConfig);
  }

  getKeyName(key: GBAKey): string {
    return GBAKey[key];
  }
} 