import { Component, OnInit, Input, OnChanges } from '@angular/core';
import { firstBy } from 'thenby';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';
import { VirtFormatsProvider } from '../../providers/virt-formats.service';
import { TomatoFormatsService } from '../../providers/tomato-formats.service';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { LoadingService } from 'src/app/providers/loading.service';
import * as moment from 'moment';
import 'moment-timezone';

@Component({
  selector: 'app-meeting-list',
  templateUrl: './meeting-list.component.html',
  styleUrls: ['./meeting-list.component.scss'],
})
export class MeetingListComponent implements OnInit, OnChanges {

  @Input() data;
  @Input() meetingType;

  meetingList = [];
  savedList = [];
  meetingListGroupedByDay;
  shownDay = null;
  meetingsListGrouping = 'weekday_tinyint';
  timeDisplay;
  localMeetingType;
  dayCount = [0, 0, 0, 0, 0, 0, 0];
  formats;
  formatLanguage = 'en';
  language = 'english';
  selectedDay = 'WEEKDAYS';
  loader = null;
  isLoaded = false;

  days = ['WEEKDAYS', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  hourRangeValues = {
    upper: 23,
    lower: 0
  };

  displayUpper = '00:00 (12:00 am)';
  displayLower = '23:59 (11:59 pm)';

  constructor(
    private storage: Storage,
    private translate: TranslateService,
    private virtFormatsProvider: VirtFormatsProvider,
    private meetingListProvider: MeetingListProvider,
    private tomatoFormatsService: TomatoFormatsService,
    private loaderCtrl: LoadingService
    ) { }


  ngOnChanges() {
    this.ngOnInit();
  }


  ngOnInit() {
    this.storage.get('language').then((value) => {
      if (value) {
        this.formatLanguage = value;
      }
    });

    this.meetingList = this.data;
    this.localMeetingType = this.meetingType;

    if (this.localMeetingType === 'virt') {
      // Get the formats
      this.virtFormatsProvider.getAllVirtFormats().then((serviceGroupData) => {
        this.formats = serviceGroupData;
        this.formatMeetingList();
      });
    } else {
      this.formatMeetingList();
    }

  }


  formatMeetingList() {
    for (let i = 0; i < 7; i++) {
      this.dayCount[i] = this.meetingList.filter(list => parseInt(list.weekday_tinyint, 10) === i + 1).length;
    }
    this.meetingListGroupedByDay = this.meetingList.concat();
    this.explodeFormats();
    this.setRawStartTime();
    this.meetingListGroupedByDay.sort((a, b) => a.weekday_tinyint.localeCompare(b.weekday_tinyint));
    this.savedList = this.meetingListGroupedByDay;
    this.meetingListGroupedByDay = this.groupMeetingList(this.meetingListGroupedByDay, this.meetingsListGrouping);
    for (let i of this.meetingListGroupedByDay) {
      i.sort(firstBy('weekday_tinyint').thenBy('start_time_raw')
      );
    }
  }


  explodeFormats() {
    if (this.localMeetingType === 'virt') {

      for (let i of this.meetingListGroupedByDay) {
        const splitFormats = i.formats.split(',');
        i.formats_exploded = '';
        for (let j of splitFormats) {
          const longFormat = this.formats.filter(data => data.key_string === j);
          if (longFormat[0]) {
            i.formats_exploded += longFormat[0].name_string + '. ';
          } else {
            i.formats_exploded += j + '. ';
          }
        }
      }
    } else {
      if (this.localMeetingType === 'regular') {
        for (let meeting of this.meetingListGroupedByDay) {
          this.tomatoFormatsService.getFormatByID(meeting.format_shared_id_list, this.formatLanguage).then((formatData) => {
            meeting.formats_exploded = formatData;
          });
        }
      }
    }
  }


  private groupMeetingList(meetingList, groupingOption) {
    // A function to convert a flat json list to an javascript array
    const groupJSONList = function (inputArray, key) {
      return inputArray.reduce(function (ouputArray, currentValue) {
        (ouputArray[currentValue[key]] = ouputArray[currentValue[key]] || []).push(currentValue);
        return ouputArray;
      }, {});
    };
    // Convert the flat json to an array grouped by and indexed by the meetingsListGroupingOne field,
    const groupedByGroupingOne = groupJSONList(meetingList, groupingOption);

    // Make the array a proper javascript array, index by number
    const groupedByGroupingOneAsArray = Object.keys(groupedByGroupingOne).map(function (key) {
      return groupedByGroupingOne[key];
    });

    meetingList = groupedByGroupingOneAsArray;
    return meetingList;
  }


  toggleDay(dayGrouping) {
    if (this.isDayShown(dayGrouping)) {
      this.shownDay = null;
    } else {
      this.shownDay = dayGrouping;
    }
  }


  isDayShown(dayGrouping) {
    return this.shownDay === dayGrouping;
  }


  public isToday(dayOfWeek) {
    const d = new Date();
    const n = d.getDay();
    if (parseInt(dayOfWeek, 10) === (n + 1)) {
      return true;
    } else {
      return false;
    }
  }


  setRawStartTime() {
    for (let meeting of this.meetingListGroupedByDay) {
      if (this.localMeetingType === 'virt') {
        const startTimeRaw = this.getAdjustedDateTime(
          parseInt(meeting.weekday_tinyint, 10) === 1 ? 7 : parseInt(meeting.weekday_tinyint, 10) - 1,
          meeting.start_time,
          meeting.time_zone
        );

        meeting.start_time_moment = startTimeRaw;
        meeting.start_time_raw = startTimeRaw.format('HH:mm (h:mm a)');

        const timeZoneName = moment.tz.guess();
        meeting.start_time_raw += ' (' + timeZoneName + ' )';
      } else {
        meeting.start_time_moment = moment({
          hour: meeting.start_time.split(':')[0],
          minute: meeting.start_time.split(':')[1],
          second: 0
        }).isoWeekday(parseInt(meeting.weekday_tinyint, 10) === 1 ? 7 : parseInt(meeting.weekday_tinyint, 10) - 1);

        meeting.start_time_raw = this.convertTo12Hr(meeting.start_time);
      }
    }
  }


  getAdjustedDateTime(meetingDay, meetingTime, meetingTimeZone) {
    let meetingDateTimeObj;

    if (!meetingTimeZone) {
      meetingTimeZone = 'UTC';
    }

    // Get an object that represents the meeting in its time zone
    meetingDateTimeObj = moment.tz(meetingTimeZone).set({
      hour: meetingTime.split(':')[0],
      minute: meetingTime.split(':')[1],
      second: 0
    }).isoWeekday(meetingDay);

    // Convert meeting to target (local) time zone
    meetingDateTimeObj = meetingDateTimeObj.clone().tz(moment.tz.guess());

    const now = moment.tz(moment.tz.guess());
    if (now > meetingDateTimeObj || now.isoWeekday() === meetingDateTimeObj.isoWeekday()) {
      meetingDateTimeObj.add(1, 'weeks');
    }

    return meetingDateTimeObj;
  }


  public convertTo12Hr(timeString) {
    const H = +timeString.substr(0, 2);
    const h = H % 12 || 12;
    const ampm = (H < 12 || H === 24) ? ' am' : ' pm';
    timeString = h + timeString.substr(2, 3) + ampm;
    return timeString;
  }


  public setDay() {
    this.filterMeetings();
  }


  public setHourRangeValues() {

    const upperMoment = moment({
      hour: this.hourRangeValues.upper,
      minute: 59,
      second: 0
    });
    this.displayUpper = upperMoment.format('HH:mm (h:mm a)');

    const lowerMoment = moment({
      hour: this.hourRangeValues.lower,
      minute: 0,
      second: 0
    });
    this.displayLower = lowerMoment.format('HH:mm (h:mm a)');

    this.filterMeetings();
  }


  public filterMeetings() {
    let tempMeetingListGroupedByDay = [];
    tempMeetingListGroupedByDay = this.savedList;

    //  Filter by Day
    if (this.days.indexOf(this.selectedDay) > 0) {
       tempMeetingListGroupedByDay = tempMeetingListGroupedByDay.filter(
        meeting => parseInt(meeting.weekday_tinyint, 10) === this.days.indexOf(this.selectedDay)
      );
    }

    // Filter by hour
    let rangeLower = moment(this.hourRangeValues.lower, 'HH');
    let rangeUpper = moment(this.hourRangeValues.upper, 'HH');

    tempMeetingListGroupedByDay = tempMeetingListGroupedByDay.filter(
      meeting => meeting.start_time_moment.hour() >= rangeLower.hour() &&
                 meeting.start_time_moment.hour() <= rangeUpper.hour()
    );

    // Count the newly filtered list by day
    for (let i = 0; i < 7; i++) {
      this.dayCount[i] = tempMeetingListGroupedByDay.filter(list => parseInt(list.weekday_tinyint, 10) === i + 1).length;
    }

    // Arrange the list into an array by day
    tempMeetingListGroupedByDay = this.groupMeetingList(tempMeetingListGroupedByDay, this.meetingsListGrouping);

    // Sort each day in the array
    for (let i of tempMeetingListGroupedByDay) {
      i.sort(firstBy('weekday_tinyint').thenBy('start_time_raw'));
    }

    // Overwrite the display list with the newly filtered list
    this.meetingListGroupedByDay = tempMeetingListGroupedByDay;
  }

  public presentLoader(loaderText: any) {
    if (!this.loader) {
      this.loader = this.loaderCtrl.present(loaderText);
    }
  }


  public dismissLoader() {
    if (this.loader) {
      this.loader = this.loaderCtrl.dismiss();
      this.loader = null;
    }
  }

}