import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmulatorComponent } from './components/emulator/emulator.component';
import { EmulatorTestComponent } from './components/emulator-test/emulator-test.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    EmulatorComponent,
    EmulatorTestComponent
  ]
})
export class AppComponent {
  title = 'GBA Emulator';
} 