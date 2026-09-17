// Angular

import { Inject, Injectable, DOCUMENT } from '@angular/core';
// Tranlsation
import { TranslateService } from '@ngx-translate/core';
import { Events } from '../../../providers/events';

export interface Locale {
	lang: string;
	// tslint:disable-next-line:ban-types
	data: Object;
}

@Injectable({
	providedIn: 'root'
})
export class TranslationService {
	// Private properties
	private langIds: any = [];
	private dir:string;
	/**
	 * Service Constructor
	 *
	 * @param translate: TranslateService
	 */
	constructor(private translate: TranslateService, @Inject(DOCUMENT) private document: Document, private events: Events,) {
		// add new langIds to the list
		this.translate.addLangs(['en']);

		// this language will be used as a fallback when a translation isn't found in the current language
		this.translate.setDefaultLang('en');
	}

	/**
	 * Load Translation
	 *
	 * @param args: Locale[]
	 */
	loadTranslations(...args: Locale[]): void {
		const locales = [...args];

		locales.forEach(locale => {
			// use setTranslation() with the third argument set to true
			// to append translations instead of replacing them
			this.translate.setTranslation(locale.lang, locale.data, true);

			this.langIds.push(locale.lang);
		});

		// add new languages to the list
		this.translate.addLangs(this.langIds);
		
	}

	/**
	 * Setup language
	 *
	 * @param lang: any
	 */
	setLanguage(lang, dir?:string) {
		if (lang) {
			// this.translate.use(this.translate.getDefaultLang());
			if(dir) this.dir = dir;
			else{
				this.dir=(lang=='he')?'rtl':'ltr'
			}
			this.translate.use(lang);
			localStorage.setItem('language', lang);
			const htmlTag = this.document.getElementsByTagName("html")[0] as HTMLHtmlElement;
			htmlTag.dir = this.dir;
			htmlTag.lang = lang;
		}
	}
	getTranslation(key){
		return this.translate.get(key)
	}
	isRTL(): boolean{
		return (this.dir === 'rtl')?true:false ;
	}
	/**
	 * Returns selected language
	 */
	getSelectedLanguage(): any {
		return localStorage.getItem('language') || 'he';
	}

	/*
		Check if key available
	*/
	hasTranslation(key: string): boolean {
		const translation = this.translate.instant(key);
		return translation !== key && translation !== '';
	}


}
