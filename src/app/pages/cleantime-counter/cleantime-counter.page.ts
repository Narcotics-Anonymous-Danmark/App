import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import * as moment from 'moment';

@Component({
    selector: 'app-cleantime-counter',
    templateUrl: './cleantime-counter.page.html',
    styleUrls: ['./cleantime-counter.page.scss'],
})
export class CleantimeCounterPage implements OnInit {
    activeProfile = "0";
    profiles = [];
    refreshed = true;

    maxDate: any;

    cleanTimeInYears1 = 0;

    cleanTimeInMonths1 = 0;
    cleanTimeInMonths2 = 0;

    cleanTimeInDays1 = 0;
    cleanTimeInDays2 = 0;
    cleanTimeInDays3 = 0;

    years;
    months;
    days;
    tag;
    tagTime;
    keytagImage;
    wait = true;

    monthNames = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'];
    monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sept', 'Okt', 'Nov', 'Dec'];

    cleanTimeElements = [["years1", "months1", "days1"], ["months2", "days2"], ["days3"]];

    cancelText = "Annuller";
    doneText = "Ok";

    constructor(
        private storage: Storage,
        private alertController: AlertController
    ) { }

    ngOnInit() {
        this.maxDate = moment().tz(moment.tz.guess()).toISOString(true);
        this.storage.ready().then(() => {
            this.storage.get('cleanDateProfiles')
                .then(value => {
                    if (value) {
                        this.profiles = value;
                    } else {
                        this.ensureOneProfile();
                    }

                    this.tag = 'none';
                    this.years = 'YEARS'
                    this.months = 'MONTHS'
                    this.days = 'DAYS'
                    this.wait = false;
                    this.getCleanTime();
                });

            this.storage.get('activeProfile')
                .then(value => {
                    if (value) {
                        this.activeProfile = value;
                    } else {
                        this.activeProfile = "0";
                    }
                });

            this.storage.get('cleanTimeUnitSort')
                .then(value => {
                    if (value === "dmy") {
                        this.cleanTimeElements.forEach(e => e.reverse());
                    }
                });
        });
    }

    ensureOneProfile() {
        if (this.profiles.length < 1){
            this.profiles.push({
                name: "Profil 1",
                cleandate: moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess()).toISOString(true)
            });
            this.activeProfile = "0";
        }
    }

    async addProfile() {
        const alert = await this.alertController.create({
            header: 'Ny profil',
            inputs: [
                {
                    name: 'name',
                    type: 'text',
                    placeholder: 'Ny profilnavn her'
                }
            ],
            buttons: [
                {
                    text: 'Afbryd',
                    role: 'cancel',
                    cssClass: 'primary'
                },
                {
                    text: 'Opret',
                    cssClass: 'primary',
                    handler: (data) => {
                        this.profiles.push({
                            name: data.name,
                            cleandate: moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess()).toISOString(true)
                        });
                        this.activeProfile = (this.profiles.length - 1).toString();
                        this.getCleanTime();
                    }
                }
            ]
        });
        await alert.present();
    }

    async editProfile() {
        const alert = await this.alertController.create({
            header: 'Omdøb profil',
            inputs: [
                {
                    name: 'name',
                    type: 'text',
                    placeholder: this.profiles[parseInt(this.activeProfile)].name
                }
            ],
            buttons: [
                {
                    text: 'Afbryd',
                    role: 'cancel',
                    cssClass: 'primary'
                },
                {
                    text: 'Omdøb',
                    cssClass: 'primary',
                    handler: (data) => {
                        this.profiles[parseInt(this.activeProfile)].name = data.name;
                        this.getCleanTime();
                        this.refreshed = false;
                        setTimeout(()=>{
                            this.refreshed = true;
                        });
                    }
                }
            ]
        });
        await alert.present();
    }

    async deleteProfile() {
        const alert = await this.alertController.create({
            header: 'Er du sikker?',
            buttons: [
                {
                    text: 'Afbryd',
                    role: 'cancel',
                    cssClass: 'primary'
                },
                {
                    text: 'Slet',
                    cssClass: 'danger',
                    handler: () => {
                        this.profiles.splice(parseInt(this.activeProfile), 1);
                        this.activeProfile = "0";
                        this.ensureOneProfile();
                        this.getCleanTime();
                        this.refreshed = false;
                        setTimeout(()=>{
                            this.refreshed = true;
                        });
                    }
                }
            ]
        });
        await alert.present();
    }

    getCleanTime() {
        if (!this.wait) {
            this.storage.set('cleanDateProfiles', this.profiles);
            this.storage.set('activeProfile', this.activeProfile);
            let cleanDayMoment = moment(this.profiles[parseInt(this.activeProfile)].cleandate);
            let todayMoment = moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess());

            let cleanTimeInDays = Math.floor(todayMoment.diff(cleanDayMoment, 'days', true));
            let cleanTimeInMonthsPrecise = todayMoment.diff(cleanDayMoment, 'months', true);
            let cleanTimeInYearsPrecise = todayMoment.diff(cleanDayMoment, 'years', true);
            let cleanTimeInYears = Math.floor(cleanTimeInYearsPrecise);

            // View 1 - days / months/ years
            let viewDate1 = moment(cleanDayMoment);
            this.cleanTimeInYears1 = Math.floor(todayMoment.diff(viewDate1, 'years', true));
            viewDate1.add(this.cleanTimeInYears1, "years");
            this.cleanTimeInMonths1 = Math.floor(todayMoment.diff(viewDate1, 'months', true));
            viewDate1.add(this.cleanTimeInMonths1, "months");
            this.cleanTimeInDays1 = Math.floor(todayMoment.diff(viewDate1, 'days', true));

            // View 2 - days / months
            let viewDate2 = moment(cleanDayMoment);
            this.cleanTimeInMonths2 = Math.floor(todayMoment.diff(viewDate2, 'months', true));
            viewDate2.add(this.cleanTimeInMonths2, "months");
            this.cleanTimeInDays2 = Math.floor(todayMoment.diff(viewDate2, 'days', true));

            // View 3 - days
            this.cleanTimeInDays3 = cleanTimeInDays;


            this.cleanTimeTag(cleanTimeInDays, cleanTimeInMonthsPrecise, cleanTimeInYears, cleanTimeInYearsPrecise);
            if(cleanTimeInDays === 1){
                this.days = 'DAY';
            }
            if(cleanTimeInDays === 1){
                this.days = 'DAY';
            }
            if(cleanTimeInDays === 1){
                this.days = 'DAY';
            }
        }
    }

    cleanTimeTag(cleanTimeInDays, cleanTimeInMonthsPrecise, cleanTimeInYears, cleanTimeInYearsPrecise) {
        // One day
        if (cleanTimeInDays === 1) {
            this.tagTime = '1';
            this.tag = 'DAYCLEAN';
            this.keytagImage = './assets/keytags/1-day.png';

            // 30 days
        } else if (cleanTimeInDays === 30) {
            this.tagTime = '30';
            this.tag = 'DAYSCLEAN';
            this.keytagImage = './assets/keytags/30-days.png';

            // 60 days
        } else if (cleanTimeInDays === 60) {
            this.tagTime = '60';
            this.tag = 'DAYSCLEAN';
            this.keytagImage = './assets/keytags/60-days.png';

            // 90 days
        } else if (cleanTimeInDays === 90) {
            this.tagTime = '90';
            this.tag = 'DAYSCLEAN';
            this.keytagImage = './assets/keytags/90-days.png';

            // 6 months
        } else if (cleanTimeInMonthsPrecise === 6) {
            this.tagTime = '6';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/6-months.png';

            // 9 months
        } else if (cleanTimeInMonthsPrecise === 9) {
            this.tagTime = '9';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/9-months.png';

            // 1 year
        } else if (cleanTimeInYearsPrecise === 1) {
            this.tagTime = '1';
            this.tag = 'YEARCLEAN';
            this.keytagImage = './assets/keytags/1-year.png';

            // 18 months
        } else if (cleanTimeInMonthsPrecise === 18) {
            this.tagTime = '18';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/18-months.png';

            // Multiple years
        } else if (cleanTimeInYearsPrecise === cleanTimeInYears && cleanTimeInYears > 1) {
            this.tagTime = cleanTimeInYears;
            this.tag = 'YEARSCLEAN';
            this.keytagImage = './assets/keytags/x-years.png';

        } else {
            // Not a clean time anniversary today :(
            this.tag = 'none';
        }
        return this.tag;
    }

    parseInt(value){
        return parseInt(value);
    }

}
