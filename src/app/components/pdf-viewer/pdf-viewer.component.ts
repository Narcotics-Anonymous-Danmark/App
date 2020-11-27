import { Component, OnInit, Input } from '@angular/core';
import { NoSanitizePipe } from '../../pipes/no-sanitize.pipe'

//import { Document } from 'pdfjs';

@Component({
    selector: 'app-pdf-viewer',
    templateUrl: './pdf-viewer.component.html',
    styleUrls: ['./pdf-viewer.component.scss'],
    
})
export class PdfViewerComponent implements OnInit {
    @Input() pdfPath;
    
    constructor() { }

    ngOnInit() {
        
    }

}
