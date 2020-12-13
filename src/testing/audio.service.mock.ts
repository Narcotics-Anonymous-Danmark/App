import { of } from 'rxjs';

export class AudioServiceStub {
    load() {
        return of({
            "events": [
                {
                    "event_name": "Københavns Områdekonvent - KOKNA",
                    "event_type": "CONVENTION",
                    "recordings": [
                        {
                            "title": "Anders og Rick, KOKNA I - 1994",
                            "fileName": "https://www.nadanmark.dk/wp-content/uploads/Danske%20Speaks/anders_rick_ kokna1_1994.mp3",
                            "duration": "38:54",
                            "languages": [
                                { "name": "DANISH" },
                                { "name": "ENGLISH" }
                            ],
                            "speakers": [
                                {
                                    "name": "Anders"
                                },
                                {
                                    "name": "Rick"
                                }
                            ]
                        },
                        {
                            "title": "Keld og Anne-Grethe, KOKNA III - 1996",
                            "fileName": "https://www.nadanmark.dk/wp-content/uploads/Danske%20Speaks/keld_annegrethe_kokna3_1996.mp3",
                            "duration": "55:06",
                            "languages": [
                                {
                                    "name": "DANISH"
                                }
                            ],
                            "tags": [
                                {
                                    "name": "MAIN_SPEAKER"
                                },
                                {
                                    "name": "STEPS"
                                }
                            ],
                            "speakers": [
                                {
                                    "name": "Keld"
                                },
                                {
                                    "name": "Anne-Grethe"
                                }
                            ]
                        }
                    ]
                }]
        });
    }
}