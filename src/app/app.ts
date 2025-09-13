import { Component, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { ContactComponent } from './contact/contact.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReactiveFormsModule, ContactComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('aws-cdk-iac');
}
