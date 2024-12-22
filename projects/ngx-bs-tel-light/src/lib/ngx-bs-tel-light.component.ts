import { Component, ElementRef, EventEmitter, Output, SimpleChanges, ViewChild, forwardRef, input, signal } from '@angular/core';
import { CountryISO } from './core/models/country-iso.enum';
import { SearchCountryField } from './core/models/search-country-field.enum';
import { PhoneNumberFormat } from './core/models/phone-number-format.enum';
import { Country } from './core/models/country.model';
import { ChangeData } from './core/models/change-data';
import { CountryCodeList } from './core/data/country-code';
import { AsYouType, CountryCode, PhoneNumber, getExampleNumber, parsePhoneNumber } from 'libphonenumber-js';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALIDATORS, NG_VALUE_ACCESSOR } from '@angular/forms';
import { phoneNumberValidator } from './core/validator/ngx-bs-tel-light.validator';

@Component({
    selector: 'ngx-bs-tel-light',
	standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ngx-bs-tel-light.component.html',
    styleUrls: ['./flags/css/intTellInput.css'],
    styles: `.scrollable-menu {max-height: 280px; overflow-y: auto;}`,
    providers: [
        CountryCodeList,
        {
            provide: NG_VALUE_ACCESSOR,
            // tslint:disable-next-line:no-forward-ref
            useExisting: forwardRef(() => NgxBsTelLightComponent),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useValue: phoneNumberValidator,
            multi: true,
        },
    ]
})
export class NgxBsTelLightComponent {

	// #region INPUTS OUTPUT
	//Inputs
	phoneValidation = input(true);
	//country list settings
	specifiedCountries = input<Array<string>>([]);
	preferredCountries = input<Array<string>>([]);
	selectedCountryISO = input<CountryISO | undefined>(undefined);
	selectFirstCountry = input(true);
	//Input control setting
	includeDialCode = input(false);
	enableAutoCountrySelect = input(true);
	enablePlaceholder = input(true);
	searchCountryField = input<SearchCountryField[]>([SearchCountryField.All]);
	searchCountryPlaceholder = input('Search Country');

	numberFormat =input<PhoneNumberFormat>(PhoneNumberFormat.International);
	customPlaceholder = signal("");
	value = signal("");
	inputId = input('phone');
	//Outputs
	@Output() readonly countryChange = new EventEmitter<Country>();

	//#endregion

	// #region LOCALS
	selectedCountry = signal<Country>({
		areaCodes: undefined,
		dialCode: '',
		htmlId: '',
		flagClass: '',
		iso2: '',
		name: '',
		placeHolder: '',
		priority: 0,
	});

	phoneNumber = signal<string>('');
	allCountries = signal<Array<Country>>([]);
	allCountriesfiltered = signal<Array<Country>>([]);
	preferredCountriesInDropDown = signal<Array<Country>>([]);
	countrySearchText = signal('');
	disabled = signal(false);
	errors = signal<Array<any>>(['Phone number is required.']);
	//#endregion

	@ViewChild('countryList') countryList: ElementRef | undefined;

	onTouched = () => { };
	propagateChange = (_: ChangeData | null) => { };

	constructor(private countryCodeData: CountryCodeList) { }

	//#region INIT FUNCTIONS
	ngOnInit(): void {
		this.init();
	}

	init() {
		this.fetchCountryData();
		if (this.preferredCountries().length) {
			this.updatePreferredCountries();
		}
		if (this.specifiedCountries().length) {
			this.allCountries.set(this.allCountries().filter((c) =>
				this.specifiedCountries().includes(c.iso2)
			));
			this.allCountriesfiltered.set(this.allCountries())
		}
		if (this.selectFirstCountry()) {
			if (this.preferredCountriesInDropDown.length) {
				this.setSelectedCountry(this.preferredCountriesInDropDown()[0]);
			} else {
				this.setSelectedCountry(this.allCountries()[0]);
			}
		}
		this.updateSelectedCountry();
	}


	protected async fetchCountryData(): Promise<void> {
		this.allCountries.set(this.countryCodeData.allCountries.map(c => ({
			name: c[0].toString(),
			iso2: c[1].toString(),
			dialCode: c[2].toString(),
			priority: +c[3] || 0,
			areaCodes: (c[4] as string[]) || undefined,
			htmlId: `item-${c[1].toString()}`,
			flagClass: `iti__flag iti__${c[1].toString().toLocaleLowerCase()}`,
			placeHolder: '',
		})));
	
		if (this.enablePlaceholder()) {
			const placeholderPromises = this.allCountries().map(async country => {
				var pNumber = await this.getPhoneNumberPlaceHolder(country.iso2.toUpperCase());
				const asYouType = new AsYouType(country.iso2.toUpperCase() as CountryCode)
				country.placeHolder = asYouType.input(pNumber)
				return country;
			});
	
			this.allCountries.set(await Promise.all(placeholderPromises));
		}
	
		this.allCountriesfiltered.set([...this.allCountries()]);
	}
	

	/**
	 * Include Preferred countries, before all countries list.
	 */
	private updatePreferredCountries() {
		if (this.preferredCountries().length) {
			this.preferredCountriesInDropDown.set([]);
			this.preferredCountries().forEach((iso2) => {
				const preferredCountry = this.allCountries().filter((c) => {
					return c.iso2 === iso2;
				});

				this.preferredCountriesInDropDown().push(preferredCountry[0]);
			});
		}
	}

	/**
	 * Updates selectedCountry.
	 */
	private updateSelectedCountry() {
		if (this.selectedCountryISO()) {
			var result = this.allCountries().find((c) => {
				return c.iso2.toLowerCase() === this.selectedCountryISO()?.toLowerCase();
			})
			this.selectedCountry.set(result ?? {} as Country)
			if (this.selectedCountry()) {
				if (this.phoneNumber()) {
					this.onPhoneNumberChange();
				} else {
					// Reason: avoid https://stackoverflow.com/a/54358133/1617590
					// tslint:disable-next-line: no-null-keyword
					this.propagateChange(null);
				}
			}
		}
	}
	//#endregion

	//#region SEARCH FUNCTION 
	/**
	* Search country based on country name, iso2, dialCode or all of them.
	* List will remove all results that not match
	*/
	public searchCountry() {
		this.allCountriesfiltered.set(this.allCountries())
		if (!this.countrySearchText()) {
			return;
		}
		const countrySearchTextLower = this.countrySearchText().toLowerCase();
		const country = this.allCountriesfiltered().filter((c) => {
			if (this.searchCountryField().indexOf(SearchCountryField.All) > -1) {
				// Search in all fields
				if (c.iso2.toLowerCase().startsWith(countrySearchTextLower)) {
					return c;
				}
				if (c.name.toLowerCase().startsWith(countrySearchTextLower)) {
					return c;
				}
				if (c.dialCode.startsWith(this.countrySearchText())) {
					return c;
				}
			} else {
				// Or search by specific SearchCountryField(s)
				if (this.searchCountryField().indexOf(SearchCountryField.Iso2) > -1) {
					if (c.iso2.toLowerCase().startsWith(countrySearchTextLower)) {
						return c;
					}
				}
				if (this.searchCountryField().indexOf(SearchCountryField.Name) > -1) {
					if (c.name.toLowerCase().startsWith(countrySearchTextLower)) {
						return c;
					}
				}
				if (this.searchCountryField().indexOf(SearchCountryField.DialCode) > -1) {
					if (c.dialCode.startsWith(this.countrySearchText())) {
						return c;
					}
				}
			}
			return
		});

		if (country.length > 0) {
			this.allCountriesfiltered.set(country)
		}
	}
	//#endregion

	//#region SELECTED COUNTRY

	/**
	 * Set the selected Country.
	 */
	setSelectedCountry(country: Country) {
		this.selectedCountry.set(country);
		this.countryChange.emit(country);
	}
	public onCountrySelect(country: Country, el: any): void {
		this.setSelectedCountry(country);

		if (this.phoneNumber() && this.phoneNumber().length > 0) {
			this.value.set(this.phoneNumber());
			const number = this.getParsedNumber(
				this.phoneNumber(),
				this.selectedCountry().iso2
			);
			const intlNo = number
				? number.formatInternational()
				: '';
			// parse phoneNumber if separate dial code is needed
			if (this.includeDialCode() && intlNo) {
				this.value.set(this.removeDialCode(intlNo));
			}

			this.propagateChange({
				number: this.value(),
				internationalNumber: intlNo,
				nationalNumber: number
					? number.formatNational()
					: '',
				// e164Number: number
				// 	? this.phoneUtil.format(number, lpn.PhoneNumberFormat.E164)
				// 	: '',
				countryCode: this.selectedCountry().iso2.toUpperCase(),
				dialCode: '+' + this.selectedCountry().dialCode,
			});
		} else {
			// Reason: avoid https://stackoverflow.com/a/54358133/1617590
			// tslint:disable-next-line: no-null-keyword
			this.propagateChange(null);
		}

		el.focus();
	}
	//#endregion

	//#region PHONE CHANGE
	public onPhoneNumberChange(): void {
		let countryCode: string | undefined;
		// Handle the case where the user sets the value programatically based on a persisted ChangeData obj.
		if (this.phoneNumber() && typeof this.phoneNumber() === 'object') {
			const numberObj: ChangeData = this.phoneNumber() as ChangeData;
			this.phoneNumber.set(numberObj.number ?? "");
			countryCode = numberObj.countryCode;
		}

		this.value.set(this.phoneNumber());
		countryCode = countryCode || this.selectedCountry().iso2;
		const number = this.getParsedNumber(this.phoneNumber(), countryCode);

		// auto select country based on the extension (and areaCode if needed) (e.g select Canada if number starts with +1 416)
		if (this.enableAutoCountrySelect()) {
			countryCode =
				number && number.countryCallingCode
					? this.getCountryIsoCode(+number.countryCallingCode, number)
					: this.selectedCountry().iso2;
			if (countryCode && countryCode !== this.selectedCountry().iso2) {
				const newCountry = this.allCountries()
					.sort((a, b) => {
						return a.priority - b.priority;
					})
					.find((c) => c.iso2 === countryCode);
				if (newCountry) {
					this.selectedCountry.set(newCountry);
				}
			}
		}

		countryCode = countryCode ? countryCode : this.selectedCountry().iso2;
		if (!this.value()) {
			// Reason: avoid https://stackoverflow.com/a/54358133/1617590
			// tslint:disable-next-line: no-null-keyword
			this.propagateChange(null);
		} else {
			if (this.value().length > 1) {
				const intlNo = number
					? number.formatInternational()
					: '';

				// parse phoneNumber if separate dial code is needed
				if (this.includeDialCode() && intlNo) {
					this.value.set(this.removeDialCode(intlNo));
				}

				this.propagateChange({
					number: this.value(),
					internationalNumber: intlNo,
					nationalNumber: number
						? number.formatNational()
						: '',
					// e164Number: number
					// 	? this.phoneUtil.format(number, lpn.PhoneNumberFormat.E164)
					// 	: '',
					countryCode: countryCode.toUpperCase(),
					dialCode: '+' + this.selectedCountry().dialCode,
				});
			}
		}

	}

	resolvePlaceholder(): string {
		let placeholder = '';
		if (this.customPlaceholder()) {
			placeholder = this.customPlaceholder();
		} else if (this.selectedCountry().placeHolder) {
			placeholder = this.selectedCountry().placeHolder
			if (this.includeDialCode()) {
				placeholder = this.removeDialCode(placeholder);
			}
		}
		return placeholder;
	}

	public onInputKeyPress(event: KeyboardEvent): void {
		const allowedChars = /[0-9\+\-\(\)\ ]/;
		const allowedCtrlChars = /[axcv]/; // Allows copy-pasting
		const allowedOtherKeys = [
			'ArrowLeft',
			'ArrowUp',
			'ArrowRight',
			'ArrowDown',
			'Home',
			'End',
			'Insert',
			'Delete',
			'Backspace',
		];

		if (
			!allowedChars.test(event.key) &&
			!(event.ctrlKey && allowedCtrlChars.test(event.key)) &&
			!allowedOtherKeys.includes(event.key)
		) {
			event.preventDefault();
		}
	}
	//#endregion

	//#region NG_VALUE_ACCESSOR required functions
	ngOnChanges(changes: SimpleChanges): void {
		const selectedISO = changes['selectedCountryISO'];
		if (
			this.allCountries() &&
			selectedISO &&
			selectedISO.currentValue !== selectedISO.previousValue
		) {
			this.updateSelectedCountry();
		}
		if (changes['preferredCountries']) {
			this.updatePreferredCountries();
		}
	}

	registerOnChange(fn: any): void {
		this.propagateChange = fn;
	}

	registerOnTouched(fn: any) {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled.set(isDisabled);
	}

	writeValue(obj: any): void {
		if (obj === undefined) {
			this.init();
		}
		this.phoneNumber.set(obj);
		setTimeout(() => {
			this.onPhoneNumberChange();
		}, 1);
	}
	//#endregion

	//#region PHONE NUMBER HELPERS
	/**
	 * Returns parse PhoneNumber object.
	 * @param phoneNumber string
	 * @param countryCode string
	 */
	private getParsedNumber(
		phoneNumber: string,
		countryCode: string
	): PhoneNumber | null {
		let number: PhoneNumber;
		try {
			number = parsePhoneNumber(phoneNumber, countryCode.toUpperCase() as CountryCode); //
			return number
		} catch (e) { }
		return null;
	}

	/**
	 * Cleans dialcode from phone number string.
	 * @param phoneNumber string
	 */
	private removeDialCode(phoneNumber: string): string {
		const number = this.getParsedNumber(phoneNumber, this.selectedCountry().iso2);
		if (number) {
			if (this.numberFormat() == PhoneNumberFormat.International) {
				number.formatInternational()
			} else {
				number.formatNational()
			}
		}

		if (phoneNumber.startsWith('+') && this.includeDialCode()) {
			phoneNumber = phoneNumber.substr(phoneNumber.indexOf(' ') + 1);
		}
		return phoneNumber;
	}

	/**
	 * Sifts through all countries and returns iso code of the primary country
	 * based on the number provided.
	 * @param countryCode country code in number format
	 * @param number PhoneNumber object
	 */
	private getCountryIsoCode(
		countryCode: number,
		number: PhoneNumber
	): string | undefined {
		// Will use this to match area code from the first numbers
		var tempNumber: any = number
		let rawNumber = '';
		if (tempNumber && tempNumber['values_'] && tempNumber['values_']['2']) {
			rawNumber = tempNumber['values_']['2'].toString();
		}
		// List of all countries with countryCode (can be more than one. e.x. US, CA, DO, PR all have +1 countryCode)
		const countries = this.allCountries().filter(
			(c) => c.dialCode === countryCode.toString()
		);
		// Main country is the country, which has no areaCodes specified in country-code.ts file.
		const mainCountry = countries.find((c) => c.areaCodes === undefined);
		// Secondary countries are all countries, which have areaCodes specified in country-code.ts file.
		const secondaryCountries = countries.filter(
			(c) => c.areaCodes !== undefined
		);
		let matchedCountry = mainCountry ? mainCountry.iso2 : undefined;

		/*
			Iterate over each secondary country and check if nationalNumber starts with any of areaCodes available.
			If no matches found, fallback to the main country.
		*/
		secondaryCountries.forEach((country) => {
			country.areaCodes?.forEach((areaCode) => {
				if (rawNumber.startsWith(areaCode)) {
					matchedCountry = country.iso2;
				}
			});
		});

		return matchedCountry;
		return ""
	}

	/**
	 * Gets formatted example phone number from phoneUtil.
	 * @param countryCode string
	 */
	async getPhoneNumberPlaceHolder(countryCode: string): Promise<string> {
		try {
			const response = await fetch('https://unpkg.com/libphonenumber-js@1.9.6/examples.mobile.json');
			const examples = await response.json();
			const exampleNumber = getExampleNumber(countryCode.toUpperCase() as CountryCode, examples);
			return exampleNumber?.nationalNumber.toString() || "";
		} catch (error) {
			console.error('Error fetching phone number placeholder:', error);
			return "";
		}
	}
}




