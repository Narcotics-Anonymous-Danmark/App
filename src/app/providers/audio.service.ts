import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AudioService {
    data: any;

    constructor(private http: HttpClient) { }

    load(): any {
        if (this.data) {
            return of(this.data);
        } else {
            return this.http
                .get('assets/data/dk-speaks.json')
                .pipe(map(this.processData, this));
        }
    }

    processData(data: any) {
        // just some good 'ol JS fun with objects and arrays
        // build up the data by linking speakers to sessions
        this.data = data;

        // loop through each event in list of events
        //this.data.events.forEach((event: any) => {
        //    event.recordings.forEach((recording: any) => {
        //        recording.tags = [];
        //        if (recording.tags) {
        //            recording.tags.forEach((tagName: any) => {
        //                const tag = this.data.tags.find(
        //                    (t: any) => t.name === tagName
        //                );
        //                if (tag) {
        //                    recording.tags.push(tag);
        //                    tag.recordings = tag.recordings || [];
        //                    tag.recordings.push(recording);
        //                }
        //            });
        //        }
        //    });
        //});

        return this.data;
    }

    //processData(data: any) {
    //    // just some good 'ol JS fun with objects and arrays
    //    // build up the data by linking speakers to sessions
    //    this.data = data;

    //    // loop through each day in the schedule
    //    this.data.schedule.forEach((day: any) => {
    //        // loop through each timeline group in the day
    //        day.groups.forEach((group: any) => {
    //            // loop through each session in the timeline group
    //            group.sessions.forEach((session: any) => {
    //                session.speakers = [];
    //                if (session.speakerNames) {
    //                    session.speakerNames.forEach((speakerName: any) => {
    //                        const speaker = this.data.speakers.find(
    //                            (s: any) => s.name === speakerName
    //                        );
    //                        if (speaker) {
    //                            session.speakers.push(speaker);
    //                            speaker.sessions = speaker.sessions || [];
    //                            speaker.sessions.push(session);
    //                        }
    //                    });
    //                }
    //            });
    //        });
    //    });

    //    return this.data;
    //}

    //async getConventions() {
    //    const speakersApiUrl = "https://android.nasouth.ie/conventions.json";
    //    //const speakersApiUrl = environment.speakersApiUrl;
    //    const data = this.http.get(speakersApiUrl);
    //    //const data = await this.httpCors.get(speakersApiUrl, {}, {});
    //    //const data = [];
    //    //const data = '{    "Conventions": [      {        "convention_name": "SACNA 2018",        "speakers": [          {            "fileName": "https://www.nasouth.ie/docs/mp3/SACNA2018/Charlie_MainSpeaker.mp3",            "Title": "Charlie - Main Speaker",            "Duration": "3:40"          }        ]      }    ]  }';
    //    console.log(data);
    //    //return JSON.parse(data.data);
    //    //return JSON.parse(data);
    //    return data;
    //}
}
