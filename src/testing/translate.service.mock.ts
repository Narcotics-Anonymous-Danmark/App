import { of } from 'rxjs';

export class TranslateServiceMock {
	get() {
		return of('Finding-Meetings');
	}
}