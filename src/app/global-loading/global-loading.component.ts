import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoadingService, LoadingState } from '../providers/loading.service';

@Component({
    selector: 'app-global-loading',
    templateUrl: './global-loading.component.html',
    styleUrls: ['./global-loading.component.scss']
})
export class GlobalLoadingComponent implements OnInit, OnDestroy {

    state: LoadingState = { visible: false, text: '' };
    private stateSub?: Subscription;

    constructor(private loading: LoadingService) { }

    ngOnInit() {
        this.stateSub = this.loading.state$.subscribe((state) => {
            this.state = state;
        });
    }

    ngOnDestroy() {
        if (this.stateSub) {
            this.stateSub.unsubscribe();
        }
    }
}
