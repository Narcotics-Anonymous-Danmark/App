import { Component, OnInit, Input, OnChanges } from '@angular/core';

@Component({
    selector: 'app-pdf-viewer',
    templateUrl: './pdf-viewer.component.html',
    styleUrls: ['./pdf-viewer.component.scss'],

})
export class PdfViewerComponent implements OnInit, OnChanges {
    @Input() pdfPath;

    constructor() { }

    ngOnInit() { }

    ngOnChanges() {
    }
}
