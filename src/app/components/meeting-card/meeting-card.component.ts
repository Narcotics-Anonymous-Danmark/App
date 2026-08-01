import { Component, OnInit, Input, AfterContentInit } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { PopoverController } from '@ionic/angular';
import { MeetingFormatsComponent } from '../meeting-formats/meeting-formats.component';
import { MeetingFormat, MeetingFormatsProvider, MEETING_FORMAT_COLORS } from '../../providers/meeting-formats.service';

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
  formats: MeetingFormat[] = [];

  constructor(
    private iab: InAppBrowser,
    private meetingFormats: MeetingFormatsProvider,
    private popoverController: PopoverController) { }

  ngOnInit() {}

  ngAfterContentInit() {
    this.meeting = this.data;
    this.meetingType = this.MeetingType;
    this.meetingFormats.getFormatsForMeeting(this.meeting).then(formats => {
      this.formats = formats;
    });
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

  formatColor(format: MeetingFormat) {
    return MEETING_FORMAT_COLORS[format.category] || 'dark';
  }

  async showFormats(event: Event) {
    if (!this.formats.length) {
      return;
    }

    const popover = await this.popoverController.create({
      component: MeetingFormatsComponent,
      componentProps: {
        formats: this.formats,
        meetingName: this.meeting.meeting_name
      },
      cssClass: 'meeting-formats-popover',
      event,
      translucent: false
    });

    await popover.present();
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
