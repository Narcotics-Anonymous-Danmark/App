import { Component, OnInit } from '@angular/core';
import { Storage } from '@ionic/storage';

@Component({
    selector: 'app-cleantime-counter',
    templateUrl: './cleantime-counter.page.html',
    styleUrls: ['./cleantime-counter.page.scss'],
})
export class CleantimeCounterPage implements OnInit {
    myDate: any;

    todayInMilliseconds: any;
    todayDate;
    todayDay;
    todayMonth;
    todayYear;

    cleanTimeDate;
    cleanTimeInMilliseconds = 0;

    cleanDay;
    cleanMonth;
    cleanYear;
    cleanTimeInDays = 0;
    cleanTimeInWeeks = 0;
    cleanTimeInYears = 0;

    tag;
    tagTime;
    keytagImage;
    wait = true;

    monthNames = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'];
    monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sept', 'Okt', 'Nov', 'Dec'];

    cancelText = "Annuller";
    doneText = "Ok";

    constructor(private storage: Storage) { }

    ngOnInit() {
        console.log('ngOnInit');
        let cleanDate;
        this.storage.ready().then(() => {
            this.storage.get('cleanDate')
                .then(value => {
                    if (value) {
                        cleanDate = new Date(value).toISOString();
                    } else {
                        cleanDate = new Date().toISOString();
                    }

                    this.todayDate = new Date();
                    this.todayDate.setHours(0, 0, 0, 0);

                    this.todayInMilliseconds = Date.parse(this.todayDate);
                    this.todayDay = this.todayDate.getDate();
                    this.todayMonth = this.todayDate.getMonth();
                    this.todayYear = this.todayDate.getFullYear();

                    this.myDate = cleanDate.substring(0, 10);

                    this.tag = 'none';
                    this.wait = false;
                    this.getCleanTime();
                });
        });

        //this.monthNames = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'];
        //this.translate.get('JANUARY').subscribe(value1 => {
        //    this.monthNames.push(value1);
        //    this.translate.get('FEBRUARY').subscribe(value2 => {
        //        this.monthNames.push(value2);
        //        this.translate.get('MARCH').subscribe(value3 => {
        //            this.monthNames.push(value3);
        //            this.translate.get('APRIL').subscribe(value4 => {
        //                this.monthNames.push(value4);
        //                this.translate.get('MAYL').subscribe(value5 => {
        //                    this.monthNames.push(value5);
        //                    this.translate.get('JUNE').subscribe(value6 => {
        //                        this.monthNames.push(value6);
        //                        this.translate.get('JULY').subscribe(value7 => {
        //                            this.monthNames.push(value7);
        //                            this.translate.get('AUGUST').subscribe(value8 => {
        //                                this.monthNames.push(value8);
        //                                this.translate.get('SPETEMBER').subscribe(value9 => {
        //                                    this.monthNames.push(value9);
        //                                    this.translate.get('OCTOBER').subscribe(value10 => {
        //                                        this.monthNames.push(value10);
        //                                        this.translate.get('NOVEMBER').subscribe(value11 => {
        //                                            this.monthNames.push(value11);
        //                                            this.translate.get('DECEMBER').subscribe(value12 => {
        //                                                this.monthNames.push(value12);
        //                                            });
        //                                        });
        //                                    });
        //                                });
        //                            });
        //                        });
        //                    });
        //                });
        //            });
        //        });
        //    });
        //});

        console.log(this.monthNames);

        //this.translate.get('JAN').subscribe(value1 => {
        //    this.monthShortNames.push(value1);
        //    this.translate.get('FEB').subscribe(value2 => {
        //        this.monthShortNames.push(value2);
        //        this.translate.get('MAR').subscribe(value3 => {
        //            this.monthShortNames.push(value3);
        //            this.translate.get('APR').subscribe(value4 => {
        //                this.monthShortNames.push(value4);
        //                this.translate.get('MAYS').subscribe(value5 => {
        //                    this.monthShortNames.push(value5);
        //                    this.translate.get('JUN').subscribe(value6 => {
        //                        this.monthShortNames.push(value6);
        //                        this.translate.get('JUL').subscribe(value7 => {
        //                            this.monthShortNames.push(value7);
        //                            this.translate.get('AUG').subscribe(value8 => {
        //                                this.monthShortNames.push(value8);
        //                                this.translate.get('SEP').subscribe(value9 => {
        //                                    this.monthShortNames.push(value9);
        //                                    this.translate.get('OCT').subscribe(value10 => {
        //                                        this.monthShortNames.push(value10);
        //                                        this.translate.get('NOV').subscribe(value11 => {
        //                                            this.monthShortNames.push(value11);
        //                                            this.translate.get('DEC').subscribe(value12 => {
        //                                                this.monthShortNames.push(value12);
        //                                            });
        //                                        });
        //                                    });
        //                                });
        //                            });
        //                        });
        //                    });
        //                });
        //            });
        //        });
        //    });
        //});
        console.log(this.monthShortNames);

        //this.translate.get('CANCEL').subscribe(value => {
        //    this.cancelText = value;
        //});

        //this.translate.get('DONE').subscribe(value => {
        //    this.doneText = value;
        //});
    }

    getCleanTime() {
        if (!this.wait) {
            console.log('Calling getCleanTime');
            const oneDay = 1000 * 60 * 60 * 24;
            const oneWeek = oneDay * 7;
            const oneYear = oneDay * 365;

            const cleanDateInMilliseconds = Date.parse(this.myDate);
            console.log('Setting cleanDate in storage to ', cleanDateInMilliseconds);
            this.storage.set('cleanDate', cleanDateInMilliseconds);

            this.cleanTimeDate = new Date(cleanDateInMilliseconds);
            this.cleanDay = this.cleanTimeDate.getDate();
            this.cleanMonth = this.cleanTimeDate.getMonth();
            this.cleanYear = this.cleanTimeDate.getFullYear();

            this.cleanTimeInMilliseconds = (this.todayInMilliseconds - cleanDateInMilliseconds) + oneDay; // ??
            this.cleanTimeInDays = Math.floor(this.cleanTimeInMilliseconds / oneDay);
            this.cleanTimeInWeeks = Math.floor(this.cleanTimeInMilliseconds / oneWeek);
            this.cleanTimeInYears = Math.floor(this.cleanTimeInMilliseconds / oneYear);

            if (this.cleanTimeInDays !== 0) {
                this.cleanTimeTag();
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
            // TODO: FIX THIS
        } else if (this.cleanTimeInDays === 182) {
            this.tagTime = '6';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/6-months.png';

            // 9 months
            // TODO: FIX THIS
        } else if (this.cleanTimeInDays === 274) {
            this.tagTime = '9';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/9-months.png';

            // 1 year
        } else if ((this.todayDay === this.cleanDay) &&
            (this.todayMonth === this.cleanMonth) &&
            ((this.todayYear - 1) === this.cleanYear)) {
            this.tagTime = '1';
            this.tag = 'YEARCLEAN';
            this.keytagImage = './assets/keytags/1-year.png';

            // 18 months
            // TODO: Fix this
        } else if (this.cleanTimeInDays === 547) {
            this.tagTime = '18';
            this.tag = 'MONTHSCLEAN';
            this.keytagImage = './assets/keytags/18-months.png';

            // Multiple years
        } else if ((this.todayDay === this.cleanDay) &&
            (this.todayMonth === this.cleanMonth) &&
            (this.cleanYear !== this.todayYear) &&
            ((this.todayYear - this.cleanYear) > 1)) {
            this.tagTime = this.cleanTimeInYears;
            this.tag = 'YEARSCLEAN';
            this.keytagImage = './assets/keytags/x-years.png';

        } else {
            // Not a clean time anniversary today
            this.tag = 'none';
        }
        return this.tag;
    }

}
