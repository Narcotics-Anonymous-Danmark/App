import { Component, OnInit } from '@angular/core';

import { Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { TranslateService } from '@ngx-translate/core';
import { Storage } from '@ionic/storage';
import { environment } from '../environments/environment';
import { Router } from '@angular/router';

//import { AppVersion } from '@ionic-native/app-version/ngx';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {

    public app_version = environment.currentVersion;

    public appPages = [
        {
            title: 'HOME',
            url: 'home',
            icon: 'home'
        },
        {
         title: 'MAP_SEARCH',
         url: 'map-search',
         icon: 'map'
        },
        {
            title: 'LOCATIONSEARCH',
            url: 'location-search',
            icon: 'search'
        },
        {
            title: 'LISTFULL',
            url: 'listfull',
            icon: 'list'
        },
        {
            title: 'JFT',
            url: 'jft',
            icon: 'albums'
        },
        {
            title: 'NACC',
            url: 'cleantime-counter',
            icon: 'hourglass'
        },
        //{
        //  title: 'VIRTUAL_MEETINGS',
        //  url: 'virt-tabs',
        //  icon: 'globe-outline'
        //},
        // {
        //     title: 'NEWS',
        //     url: 'coming-soon',
        //     icon: 'bulb'
        // },
        {
            title: 'EVENTS',
            url: 'events',
            icon: 'calendar'
        },
        {
            title: 'BASIC_TEXT',
            url: 'basic-text',
            icon: 'book'
        },
        {
            title: 'HOW_AND_WHY',
            url: 'how-and-why',
            icon: 'book'
        },
        {
            title: 'STEP_WORKING_GUIDES',
            url: 'step-working-guides',
            icon: 'book'
        },
        //{
        //    title: 'AUDIOBOOKS',
        //    url: 'audiobooks',
        //    icon: 'book'
        //},
        {
            title: 'SPEAKS',
            url: 'speaks',
            icon: 'chatbox-ellipses'
        },
        {
            title: 'GRC',
            url: 'grc',
            icon: 'reader'
        },
        {
            title: 'SETTINGS',
            url: 'settings',
            icon: 'settings'
        },
        {
            title: 'CONTACT',
            url: 'contact',
            icon: 'person'
        }
    ];

    constructor(
        private platform: Platform,
        private splashScreen: SplashScreen,
        private statusBar: StatusBar,
        private translate: TranslateService,
        private storage: Storage,
        private router: Router
        
        //private appVersion: AppVersion
    ) {
        this.initializeApp();
        this.translate.setDefaultLang('da');
        this.storage.get('language').then((value) => {
            if (value) {
                this.translate.use(value);
            } else {
                this.translate.use('da');
                storage.set('language', 'da');
            }
        });
    }

    initializeApp() {
        this.platform.ready().then(() => {
            this.statusBar.styleDefault();

            //console.log(this.appVersion);

            //var appName = this.appVersion.getAppName();
            //var packageName = this.appVersion.getPackageName();
            //var versionCode = this.appVersion.getVersionCode();
            //var versionNumber = this.appVersion.getVersionNumber();
            //console.log(versionCode);

            //this.appVersion.getVersionNumber().then(
            //    (versionNumber) => {
            //        this.app_version = versionNumber;
            //    },
            //    (error) => {
            //        console.log(error);
            //    });

            this.splashScreen.hide();

            this.platform.backButton.subscribeWithPriority(0, () => {
                this.router.navigate(['/home']);
            });
        });
    }

    ngOnInit() {

    }
}
