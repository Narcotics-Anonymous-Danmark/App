import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-grc',
    templateUrl: './grc.page.html',
    styleUrls: ['./grc.page.scss'],
})
export class GrcPage implements OnInit {
    constructor() { }

    readings: any[] = [
        { id: 0, fileName: './assets/pdf/01_DK_GRC_Hvem er en addict.pdf', title: 'Hvem er en addict?' },
        { id: 1, fileName: './assets/pdf/02_DK_GRC_Hvad er NA\'s program.pdf', title: 'Hvad er NA\'s program?' },
        { id: 2, fileName: './assets/pdf/03_DK_GRC_Hvorfor er vi her.pdf', title: 'Hvorfor er vi her?' },
        { id: 3, fileName: './assets/pdf/04_DK_GRC_Saadan virker det.pdf', title: 'Sådan virker det' },
        { id: 4, fileName: './assets/pdf/06_DK_GRC_NA\'s Tolv Traditioner.pdf', title: 'NA\'s Tolv Traditioner' },
        { id: 5, fileName: './assets/pdf/08_DK_GRC_Vi kommer i bedring.pdf', title: 'Vi kommer i bedring' },
        { id: 6, fileName: './assets/pdf/09_DK_GRC_Bare for i dag.pdf', title: 'Bare for i dag' },
    ];

    selectedReading = this.readings[0];

    ngOnInit() { }

    public showReading(reading) {
        this.selectedReading = reading;
    }
}
