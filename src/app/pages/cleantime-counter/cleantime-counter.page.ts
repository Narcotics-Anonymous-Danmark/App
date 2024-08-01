import { Component, OnInit } from '@angular/core';
import { Storage } from '@ionic/storage';
import * as moment from 'moment';

@Component({
    selector: 'app-cleantime-counter',
    templateUrl: './cleantime-counter.page.html',
    styleUrls: ['./cleantime-counter.page.scss'],
})
export class CleantimeCounterPage implements OnInit {
    myDate: any;
    maxDate: any;

    todayInMilliseconds: any;
    todayDate;
    todayDay;
    todayMonth;
    todayYear;

    cleanTimeDate;

    cleanDay;
    cleanMonth;
    cleanYear;
    cleanTimeInDays = 0;
    cleanTimeInWeeks = 0;
    cleanTimeInMonths = 0;
    cleanTimeInMonthsPrecise = 0;
    cleanTimeInYears = 0;
    cleanTimeInYearsPrecise = 0;

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

    constructor(private storage: Storage) { }

    ngOnInit() {
        let cleanDateMoment;
        this.maxDate = moment().toISOString();
        this.storage.ready().then(() => {
            this.storage.get('cleanDate')
                .then(value => {
                    if (value) {
                        cleanDateMoment = moment(value, "YYYY-MM-DD");
                    }

                    if(!cleanDateMoment.isValid()){
                        cleanDateMoment = moment();
                    }

                    this.todayDate = new Date();
                    this.todayDate.setHours(0, 0, 0, 0);

                    this.todayInMilliseconds = Date.parse(this.todayDate);
                    this.todayDay = this.todayDate.getDate();
                    this.todayMonth = this.todayDate.getMonth();
                    this.todayYear = this.todayDate.getFullYear();

                    this.myDate = cleanDateMoment.format("MM-DD-YYYY");

                    this.tag = 'none';
                    this.years = 'YEARS'
                    this.months = 'MONTHS'
                    this.days = 'DAYS'
                    this.wait = false;
                    this.getCleanTime();
                });

            this.storage.get('cleanTimeUnitSort')
                .then(value => {
                    if (value === "dmy") {
                        this.cleanTimeElements.forEach(e => e.reverse());
                    }
                });
        });
    }

    getCleanTime() {
        if (!this.wait) {
            const cleanDateInMilliseconds = Date.parse(this.myDate);
            const cleanDateStr = moment(cleanDateInMilliseconds).format("YYYY-MM-DD");
            this.storage.set('cleanDate', cleanDateStr);

            this.cleanTimeDate = new Date(cleanDateInMilliseconds);
            this.cleanDay = this.cleanTimeDate.getDate();
            this.cleanMonth = this.cleanTimeDate.getMonth();
            this.cleanYear = this.cleanTimeDate.getFullYear();

            let todayMoment = moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD");
            let cleanDayMoment = moment(cleanDateInMilliseconds);

            this.cleanTimeInDays = Math.floor(todayMoment.diff(cleanDayMoment, 'days', true));
            this.cleanTimeInWeeks = Math.floor(todayMoment.diff(cleanDayMoment, 'weeks', true));
            this.cleanTimeInMonthsPrecise = todayMoment.diff(cleanDayMoment, 'months', true);
            this.cleanTimeInMonths = Math.floor(this.cleanTimeInMonthsPrecise);
            this.cleanTimeInYearsPrecise = todayMoment.diff(cleanDayMoment, 'years', true);
            this.cleanTimeInYears = Math.floor(this.cleanTimeInYearsPrecise);

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
            this.cleanTimeInDays3 = this.cleanTimeInDays;


            if (this.cleanTimeInDays !== 0) {
                this.cleanTimeTag();
                if(this.cleanTimeInDays === 1){
                    this.days = 'DAY';
                }
                if(this.cleanTimeInDays === 1){
                    this.days = 'DAY';
                }
                if(this.cleanTimeInDays === 1){
                    this.days = 'DAY';
                }
            }
        }
    }

    cleanTimeTag() {
        // One day
        if (this.cleanTimeInDays === 1) {
            this.tagTime = '1';
            this.tag = 'DAYCLEAN';
            this.keytagImage = './assets/keytags/1-day.png';

            // 30 days
        } else if (this.cleanTimeInDays === 30) {
            this.tagTime = '30';
            this.tag = 'DAYSCLEAN';
            this.keytagImage = './assets/keytags/30-days.png';

            // 60 days
        } else if (this.cleanTimeInDays === 60) {
            this.tagTime = '60';
            this.tag = 'DAYSCLEAN';
            this.keytagImage = './assets/keytags/60-days.png';

            // 90 days
        } else if (this.cleanTimeInDays === 90) {
            this.tagTime = '90';
            this.tag = 'DAYSCLEAN';
            this.keytagImage = './assets/keytags/90-days.png';

            // 6 months
        } else if (this.cleanTimeInMonthsPrecise === 6) {
            this.tagTime = '6';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/6-months.png';

            // 9 months
        } else if (this.cleanTimeInMonthsPrecise === 9) {
            this.tagTime = '9';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/9-months.png';

            // 1 year
        } else if (this.cleanTimeInYearsPrecise === 1) {
            this.tagTime = '1';
            this.tag = 'YEARCLEAN';
            this.keytagImage = './assets/keytags/1-year.png';

            // 18 months
        } else if (this.cleanTimeInMonthsPrecise === 18) {
            this.tagTime = '18';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/18-months.png';

            // Multiple years
        } else if (this.cleanTimeInYearsPrecise === this.cleanTimeInYears && this.cleanTimeInYears > 1) {
            this.tagTime = this.cleanTimeInYears;
            this.tag = 'YEARSCLEAN';
            this.keytagImage = './assets/keytags/x-years.png';

        } else {
            // Not a clean time anniversary today :(
            this.tag = 'none';
        }
        return this.tag;
    }

}
