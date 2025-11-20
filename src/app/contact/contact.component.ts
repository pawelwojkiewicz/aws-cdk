import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-contact',
  imports: [FormsModule, HttpClientModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css',
})
export class ContactComponent {
  public form: FormGroup;
  public messages = signal<any[]>([]);
  http = inject(HttpClient);
  fb = inject(FormBuilder);

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  submitForm() {
    console.log(environment.apiUrl);
    this.http
      .post(environment.apiUrl, this.form.value)
      .subscribe(() => alert('Wiadomość wysłana!'));
  }

  getMessages() {
    this.http.get(environment.apiUrl).subscribe((m: any) => {
      alert('Wiadomośći pobrane!');
      this.messages.set(m.messages);
    });
  }
}
