import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-grc',
    templateUrl: './grc.page.html',
    styleUrls: ['./grc.page.scss'],
})
export class GrcPage implements OnInit {
    constructor() { }

    readings: any[] = [
        { id: 0, title: 'Hvem er en addict?' },
        { id: 1, title: 'Hvad er NA\'s program?' },
        { id: 2, title: 'Hvorfor er vi her?' },
        { id: 3, title: 'Sådan virker det' },
        { id: 4, title: 'NA\'s Tolv Traditioner' },
        { id: 5, title: 'Vi kommer i bedring' },
        { id: 6, title: 'Bare for i dag' },
    ];

    selectedReading = this.readings[0];

    ngOnInit() { }

    public showReading(reading) {
        this.selectedReading = reading;
    }
}
