import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { EmulatorComponent } from './components/emulator/emulator.component';
import { EmulatorTestComponent } from './components/emulator-test/emulator-test.component';

@NgModule({
  imports: [
    BrowserModule,
    AppComponent,
    EmulatorComponent,
    EmulatorTestComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { } 