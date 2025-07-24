import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CleantimeService } from 'src/app/providers/cleantime.service';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage';
import * as moment from 'moment';
import 'moment-timezone';

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

    newProfile = "";
    newProfileNameHere = "";
    cancelButton = "";
    addButton = "";
    renameProfile = "";
    rename = "";
    areYouSure = "";
    delete = "";

    constructor(

        private storage: Storage,
        private cleantime: CleantimeService,
        private translate: TranslateService,
        private alertController: AlertController
    ) { }

    ngOnInit() {
        this.maxDate = moment().tz(moment.tz.guess()).toISOString(true);
        this.tag = 'none';
        this.years = 'YEARS'
        this.months = 'MONTHS'
        this.days = 'DAYS'

        this.cleantime.getProfiles().then(existingProfiles => {
            this.profiles = existingProfiles.length ? existingProfiles : [this.createDefaultProfile()];
            this.wait = false;
        });
        
        this.getCleanTime();

        this.storage.ready().then(() => {
            this.storage.get('activeProfile')
                .then(value => {
                    if (value) {
                        this.activeProfile = value;
                    } else {
                        this.activeProfile = "0";
                    }
                    this.getCleanTime();
                    this.refreshed = false;
                    setTimeout(()=>{
                        this.refreshed = true;
                    });
                });

            this.storage.get('cleanTimeUnitSort')
                .then(value => {
                    if (value === "dmy") {
                        this.cleanTimeElements.forEach(e => e.reverse());
                    }
                });

            this.translate.get('NEWPROFILE').subscribe(value => { this.newProfile = value; });
            this.translate.get('NEWPROFILENAMEHERE').subscribe(value => { this.newProfileNameHere = value; });
            this.translate.get('CANCELBUTTON').subscribe(value => { this.cancelButton = value; });
            this.translate.get('ADDBUTTON').subscribe(value => { this.addButton = value; });
            this.translate.get('RENAMEPROFILE').subscribe(value => { this.renameProfile = value; });
            this.translate.get('RENAME').subscribe(value => { this.rename = value; });
            this.translate.get('AREYOUSURE').subscribe(value => { this.areYouSure = value; });
            this.translate.get('DELETE').subscribe(value => { this.delete = value; });
        });
    }

    ensureOneProfile() {
        if (this.profiles.length < 1){
            this.profiles.push(this.createDefaultProfile());
            this.activeProfile = "0";
        }
    }

    createDefaultProfile() {
        return {
            name: "Profil 1",
            cleandate: moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess()).toISOString(true)
        };
    }

    async addProfile() {
        const alert = await this.alertController.create({
            header: '',
            inputs: [
                {
                    name: 'name',
                    type: 'text',
                    placeholder: this.newProfileNameHere
                }
            ],
            buttons: [
                {
                    text: this.cancelButton,
                    role: 'cancel',
                    cssClass: 'primary'
                },
                {
                    text: this.addButton,
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
            header: this.renameProfile,
            inputs: [
                {
                    name: 'name',
                    type: 'text',
                    placeholder: this.profiles[parseInt(this.activeProfile)].name
                }
            ],
            buttons: [
                {
                    text: this.cancelButton,
                    role: 'cancel',
                    cssClass: 'primary'
                },
                {
                    text: this.rename,
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
            header: this.areYouSure,
            buttons: [
                {
                    text: this.cancelButton,
                    role: 'cancel',
                    cssClass: 'primary'
                },
                {
                    text: this.delete,
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

            let todayMoment = moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess());

            let cleanDay = this.cleantime.getProfileCleanDay(this.profiles[parseInt(this.activeProfile)]);
            let cleanTimes = this.cleantime.getCleanTimes(cleanDay);
            let [cleanTimeInDays,,,] = cleanTimes;

            // View 1 - days / months/ years
            let viewDate1 = moment(cleanDay);
            this.cleanTimeInYears1 = Math.floor(todayMoment.diff(viewDate1, 'years', true));
            viewDate1.add(this.cleanTimeInYears1, "years");
            this.cleanTimeInMonths1 = Math.floor(todayMoment.diff(viewDate1, 'months', true));
            viewDate1.add(this.cleanTimeInMonths1, "months");
            this.cleanTimeInDays1 = Math.floor(todayMoment.diff(viewDate1, 'days', true));

            // View 2 - days / months
            let viewDate2 = moment(cleanDay);
            this.cleanTimeInMonths2 = Math.floor(todayMoment.diff(viewDate2, 'months', true));
            viewDate2.add(this.cleanTimeInMonths2, "months");
            this.cleanTimeInDays2 = Math.floor(todayMoment.diff(viewDate2, 'days', true));

            // View 3 - days
            this.cleanTimeInDays3 = cleanTimeInDays;


            this.cleanTimeTag(cleanTimes);
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

    cleanTimeTag(cleanTimes) {
        let [cleanTimeInDays, cleanTimeInMonthsPrecise, cleanTimeInYearsPrecise, cleanTimeInYears] = cleanTimes;
        let anniversaryName = "";
        let anniversariesDef = this.cleantime.getAnniversaryDefinitions();
        let properties = {
            "cleanTimeInDays": cleanTimeInDays,
            "cleanTimeInMonthsPrecise": cleanTimeInMonthsPrecise,
            "cleanTimeInYearsPrecise": cleanTimeInYearsPrecise,
            "cleanTimeInYears": cleanTimeInYears
        };
        Object.keys(anniversariesDef).forEach(name => {
            let anniversaryDef = anniversariesDef[name];
            let anniversaryValid = Object.keys(properties).every(key => {
                let value = properties[key];
                if(anniversaryDef.hasOwnProperty(key)){
                    let propertyValue = anniversaryDef[key];
                    if(typeof propertyValue === "function"){
                        const func: Function = propertyValue;
                        let result = func(value, cleanTimes);
                        if(!result){
                            return false;
                        }
                    } else if(typeof propertyValue === "number"){
                        if(value !== propertyValue){
                            return false;
                        }
                    }
                }
                return true;
            });
            if(!anniversaryValid){
                return true;
            }
            anniversaryName = name;
            return false;
        });

        if(anniversaryName){
            let anniversaryDef = anniversariesDef[anniversaryName];
            this.tag = anniversaryDef["tag"];
            this.keytagImage = "./assets/keytags/da/" + anniversaryName + ".png";
            let tagTime = anniversaryDef["tagTime"];
            if(typeof tagTime === "function"){
                const func: Function = tagTime;
                this.tagTime = tagTime(cleanTimes);
            } else if(typeof tagTime === "number"){
                this.tagTime = tagTime;
            }
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
