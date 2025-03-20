import { Component } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-contact',
    templateUrl: './contact.page.html',
    styleUrls: ['./contact.page.scss'],
})

export class ContactPage {

    sourceCodeLink = 'https://github.com/Narcotics-Anonymous-Danmark/App';
    sourceBugs = 'mailto:app@nadanmark.dk';
    bmltLink = 'https://na.org/';
    fbGroupLink = 'https://nadanmark.dk/';
    meetinglistServantLink = 'mailto:modelisteansvarlig@nadanmark.dk';

    currentVersion = environment.currentVersion;
    currentConfiguration = environment.configuration;
    naApproved = environment.na_approved;

    //appName = this.appVersion.getAppName();
    //packageName = this.appVersion.getPackageName();
    //versionCode = this.appVersion.getVersionCode();
    //versionNumber = this.appVersion.getVersionNumber();

    constructor(private iab: InAppBrowser) {

    }
    public openLink(url) {
        const browser = this.iab.create(url, '_system');
    }
}
