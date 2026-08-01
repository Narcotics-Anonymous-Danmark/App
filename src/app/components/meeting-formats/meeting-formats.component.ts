import { Component } from '@angular/core';
import { NavParams, PopoverController } from '@ionic/angular';
import { MeetingFormat, MEETING_FORMAT_COLORS } from '../../providers/meeting-formats.service';

@Component({
  selector: 'app-meeting-formats',
  templateUrl: './meeting-formats.component.html',
  styleUrls: ['./meeting-formats.component.scss'],
})
export class MeetingFormatsComponent {

  formats: MeetingFormat[] = [];
  meetingName = '';

  constructor(
    navParams: NavParams,
    private popoverController: PopoverController
  ) {
    this.formats = navParams.get('formats') || [];
    this.meetingName = navParams.get('meetingName') || '';
  }

  colorFor(format: MeetingFormat) {
    return MEETING_FORMAT_COLORS[format.category] || 'dark';
  }

  async dismiss() {
    await this.popoverController.dismiss();
  }
}
