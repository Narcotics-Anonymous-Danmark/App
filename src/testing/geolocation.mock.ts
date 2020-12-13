import { of } from 'rxjs';

export class GeolocationMock {
    getCurrentPosition() {
        return new Promise(function (resolve: Function): void {
            of({
                "longitude": "-95.62532",
                "latitude": "36.3003274",
            });
        });
    }
}