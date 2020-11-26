import { Component } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';

@Component({
    selector: 'app-contact',
    templateUrl: './contact.page.html',
    styleUrls: ['./contact.page.scss'],
})
export class ContactPage {

    sourceCodeLink = 'https://github.com/JonasServicekonto/BMLTSearch3DK';
    sourceBugs = 'https://github.com/JonasServicekonto/BMLTSearch3DK/issues';
    bmltLink = 'https://bmlt.app/';
    fbGroupLink = 'https://www.facebook.com/groups/149214049107349/';
    meetinglistServantLink = 'mailto:modelisteansvarlig@nadanmark.dk';
    constructor(private iab: InAppBrowser) {

    }
    public openLink(url) {
        const browser = this.iab.create(url, '_system');
    }
}
