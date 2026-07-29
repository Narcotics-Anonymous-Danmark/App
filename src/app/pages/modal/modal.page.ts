import { Component } from '@angular/core';
import { NavParams, ModalController } from '@ionic/angular';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.page.html',
  styleUrls: ['./modal.page.scss'],
})
export class ModalPage {
  text!: string;
  title!: string;
  meetingList: any;

  constructor(
    private navParams: NavParams,
    private modalController: ModalController,
    private iab: InAppBrowser) {
      this.meetingList = this.navParams.data.data;
  }

  async dismiss() {
    await this.modalController.dismiss();
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
    if (meeting.formats.match(/TC/i)) {
      return 'TEMPCLOSED';
    } else {
      return 'NOT-TEMPCLOSED';
    }
  }

}
