import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LoadingService } from 'src/app/providers/loading.service';
import { MeetingListProvider } from '../../providers/meeting-list.service';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Storage } from '@ionic/storage';

@Component({
  selector: 'app-virt-search',
  templateUrl: './virt-search.page.html',
  styleUrls: ['./virt-search.page.scss'],
})
export class VirtSearchPage implements OnInit {

  loader = null;
  allVirtMeetings: any = [];
  isLoaded = false;

  constructor(
    private meetingListProvider: MeetingListProvider,
    private loaderCtrl: LoadingService,
    private translate: TranslateService,
    private iab: InAppBrowser,
    private storage: Storage

  ) {

  }

  ngOnInit() {
    this.getAllVirtMeetings();
  }

  getAllVirtMeetings() {
    this.translate.get('FINDING_MTGS').subscribe(value => { this.presentLoader(value); });

    this.meetingListProvider.getAllVirtualMeetings().then((data) => {
      this.allVirtMeetings = data;
      this.isLoaded = true;
      this.dismissLoader();
    });
  }

  presentLoader(loaderText: any) {
    if (!this.loader) {
      this.loader = this.loaderCtrl.present(loaderText);
    }
  }

  dismissLoader() {
    if (this.loader) {
      this.loader = this.loaderCtrl.dismiss();
      this.loader = null;
    }
  }

}
