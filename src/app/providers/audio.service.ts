import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

const SPEAKS_ENDPOINT = 'https://www.nadanmark.dk/wp-json/wp/v2/speaks';

const FEEDS: Array<{ excerpt: string, language: 'da' | 'en' }> = [
    { excerpt: 'NA-SPEAKS-DK', language: 'da' },
    { excerpt: 'NA-SPEAKS-EN', language: 'en' }
];

@Injectable({
    providedIn: 'root'
})
export class AudioService {
    private data: any[] | null = null;

    constructor(private http: HttpClient) { }

    load(forceReload: boolean = false): Observable<any[]> {
        if (forceReload) {
            this.data = null;
        }
        if (this.data) {
            return of(this.data);
        }
        return forkJoin(FEEDS.map((feed) => this.loadFeed(feed.excerpt, feed.language))).pipe(
            map((results) => {
                if (results.every((result) => result === null)) {
                    throw new Error('Could not load speaks');
                }
                return results.reduce((all: any[], result) => all.concat(result || []), []);
            }),
            tap((events) => this.data = events),
            catchError((error) => throwError(error))
        );
    }

    private loadFeed(excerpt: string, language: 'da' | 'en'): Observable<any[] | null> {
        return this.http
            .get<any[]>(`${SPEAKS_ENDPOINT}?excerpt[]=${excerpt}`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + btoa("na.app_api:Wt3QTExAaKqXJx")
                }
            })
            .pipe(
                map((events) => (events || []).map((event: any) => ({ ...event, language }))),
                catchError((error) => {
                    console.error(`AudioService: could not load ${excerpt}`, error);
                    return of(null);
                })
            );
    }
}
