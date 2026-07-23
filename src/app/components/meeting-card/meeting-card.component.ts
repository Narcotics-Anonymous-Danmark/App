import { Component, OnInit, Input, AfterContentInit } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

@Component({
  selector: 'app-meeting-card',
  templateUrl: './meeting-card.component.html',
  styleUrls: ['./meeting-card.component.scss'],
})
export class MeetingCardComponent implements OnInit, AfterContentInit {

  @Input() data: any;
  @Input() MeetingType: any;

  meeting: any;
  meetingType: any;

  constructor(
    private iab: InAppBrowser) { }

  ngOnInit() {}

  ngAfterContentInit() {
    this.meeting = this.data;
    this.meetingType = this.MeetingType;
  }
  public openMapsLink(destLatitude: any, destLongitude: any) {
    this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');
  }

  public openLink(url: any) {
    this.iab.create(url, '_system');
  }

  public dialNum(url: any) {
    const telUrl = 'tel:' + url;
    this.iab.create(telUrl, '_system');
  }

  isHybrid(meeting: any) {
    if (meeting.formats.match(/HY/i)) {
      return 'HYBRID';
    } else {
      return 'NOT-HYBRID';
    }
  }

  isTempClosed(meeting: any) {
    if (meeting.formats.match(/TC/i)  && ( !(meeting.virtual_meeting_link || meeting.virtual_meeting_link))  ) {
      return 'TEMPCLOSED';
    } else {
      return 'NOT-TEMPCLOSED';
    }
  }

}
