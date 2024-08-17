import { Component, OnInit } from '@angular/core';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.page.html',
    styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

    language: string;
    firstdayofweek: string;
    theme: string;
    searchRange: number;
    cleanTimeUnitSort: string;

    constructor(
        private storage: Storage,
        private translate: TranslateService
    ) {

    }

    ngOnInit() {
        this.storage.get('language')
            .then(langValue => {
                if (langValue) {
                    this.language = langValue;
                } else {
                    this.language = 'en';
                }
            });

        this.storage.get('firstday')
            .then(firstdayValue => {
                if (firstdayValue) {
                    this.firstdayofweek = firstdayValue;
                } else {
                    this.firstdayofweek = 'mo';
                }
            });

        this.storage.get('searchRange')
            .then(searchValue => {
                if (searchValue) {
                    this.searchRange = searchValue;
                } else {
                    this.searchRange = 15;
                }
            });

        this.storage.get('cleanTimeUnitSort')
            .then(cleanTimeUnitSortValue => {
                if (cleanTimeUnitSortValue) {
                    this.cleanTimeUnitSort = cleanTimeUnitSortValue;
                } else {
                    this.cleanTimeUnitSort = "ymd";
                }
            });
    }

    selectLanguage() {
        this.storage.set('language', this.language);
        this.translate.setDefaultLang(this.language);
        this.translate.use(this.language);
    }

    selectFirstDayOfWeek() {
        this.storage.set('firstday', this.firstdayofweek);
        //this.translate.setDefaultLang(this.language);
        //this.translate.use(this.language);
    }

    selectTheme() {
        this.storage.set('theme', this.theme);
    }

    selectSearchRange() {
        this.storage.set('searchRange', this.searchRange);
    }

    selectCleanTimeUnitSort() {
        this.storage.set('cleanTimeUnitSort', this.cleanTimeUnitSort);
    }

}
