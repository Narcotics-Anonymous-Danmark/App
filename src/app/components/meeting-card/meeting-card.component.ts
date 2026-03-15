import { Component, OnInit, Input, AfterContentInit } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-meeting-card',
  templateUrl: './meeting-card.component.html',
  styleUrls: ['./meeting-card.component.scss'],
})
export class MeetingCardComponent implements OnInit, AfterContentInit {

  @Input() data;
  @Input() MeetingType;

  meeting;
  meetingType;

  constructor(
    private iab: InAppBrowser) { }

  ngOnInit() {}

  ngAfterContentInit() {
    this.meeting = this.data;
    this.meetingType = this.MeetingType;
  }
  public openMapsLink(destLatitude, destLongitude) {
    const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');
  }

  public openLink(url) {
    const browser = this.iab.create(url, '_system');
  }

  public dialNum(url) {
    const telUrl = 'tel:' + url;
    const browser = this.iab.create(telUrl, '_system');
  }

  isHybrid(meeting) {
    if (meeting.formats.match(/HY/i)) {
      return 'HYBRID';
    } else {
      return 'NOT-HYBRID';
    }
  }

  isTempClosed(meeting) {
    if (meeting.formats.match(/TC/i)  && ( !(meeting.virtual_meeting_link || meeting.virtual_meeting_link))  ) {
      return 'TEMPCLOSED';
    } else {
      return 'NOT-TEMPCLOSED';
    }
  }

}
