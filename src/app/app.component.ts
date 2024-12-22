import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxBsTelLightComponent } from '../../projects/ngx-bs-tel-light/src/public-api';
import { SearchCountryField } from '../../projects/ngx-bs-tel-light/src/lib/core/models/search-country-field.enum';
import { CountryISO } from '../../projects/ngx-bs-tel-light/src/lib/core/models/country-iso.enum';
import { PhoneNumberFormat } from '../../projects/ngx-bs-tel-light/src/lib/core/models/phone-number-format.enum';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxBsTelLightComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'ngx-bs-tel-light-app';

	//Input maxsimum lengght
	inputMaxLength: string = "20"
	//Specify countries 
	specifiedCountries: string[] = []
	includeDialCode = false;
	SearchCountryField = SearchCountryField;
	CountryISO = CountryISO;
	PhoneNumberFormat = PhoneNumberFormat;
	preferredCountries: CountryISO[] = [
		CountryISO.Israel,
		CountryISO.UnitedStates,
	];

  phoneForm = new FormGroup({
		phone: new FormControl(undefined, [Validators.required]),
	});
}

