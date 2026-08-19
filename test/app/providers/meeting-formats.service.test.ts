import { HttpClient } from '@angular/common/http';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';

import { MeetingFormatsProvider, MEETING_FORMAT_COLORS } from 'src/app/providers/meeting-formats.service';

const CACHE_KEY = 'meeting_formats_v1';
const DANISH_URI = 'https://www.nadanmark.dk/main_server/client_interface/json/';
const FOREIGN_URI = 'https://tomato.bmltenabled.org/main_server/client_interface/json/';

// The BMLT GetFormats endpoint is queried twice: once for the server default
// language and once for Danish. Categories come from format_type_enum:
// ALERT -> alert, LANG -> language, O/C/FC3* -> audience, FC2* -> facility, else content.
// prettier-ignore
const EN_ROWS = [
  { id: '1', key_string: 'O',   name_string: 'Open',       description_string: 'Open meeting',      format_type_enum: 'O',     lang: 'en' },
  { id: '2', key_string: 'BT',  name_string: 'Basic Text', description_string: 'Basic Text study',  format_type_enum: 'FC1',   lang: 'en' },
  { id: '3', key_string: 'WC',  name_string: 'Wheelchair', description_string: 'Wheelchair access', format_type_enum: 'FC2',   lang: 'en' },
  { id: '4', key_string: 'DK',  name_string: 'Danish',     description_string: 'Danish speaking',   format_type_enum: 'LANG',  lang: 'en' },
  { id: '5', key_string: 'CAN', name_string: 'Cancelled',  description_string: 'Meeting cancelled', format_type_enum: 'ALERT', lang: 'en' },
  { id: '6', key_string: 'LIT', name_string: 'Literature', description_string: 'Literature study',  format_type_enum: 'FC1',   lang: 'en' },
];

// prettier-ignore
const DK_ROWS = [
  { id: '1', key_string: 'Å',   name_string: 'Åbent',      description_string: 'Åbent møde',        format_type_enum: 'O',     lang: 'dk' },
  { id: '2', key_string: 'BT',  name_string: 'Basic Text', description_string: 'Basic Text studie', format_type_enum: 'FC1',   lang: 'dk' },
  { id: '3', key_string: 'KS',  name_string: 'Kørestol',   description_string: 'Kørestolsadgang',   format_type_enum: 'FC2',   lang: 'dk' },
  { id: '4', key_string: 'DK',  name_string: 'Dansk',      description_string: 'Dansktalende',      format_type_enum: 'LANG',  lang: 'dk' },
  { id: '5', key_string: 'AFL', name_string: 'Aflyst',     description_string: 'Mødet er aflyst',   format_type_enum: 'ALERT', lang: 'dk' },
  { id: '6', key_string: 'LIT', name_string: 'Litteratur', description_string: 'Litteraturstudie',  format_type_enum: 'FC1',   lang: 'dk' },
];

const danishMeeting = (extra: any = {}) => ({ root_server_uri: DANISH_URI, ...extra });
const foreignMeeting = (extra: any = {}) => ({ root_server_uri: FOREIGN_URI, ...extra });

describe('MeetingFormatsProvider', () => {
  let http: { get: jest.Mock };
  let storage: { ready: jest.Mock; get: jest.Mock; set: jest.Mock };
  let translate: { currentLang: string | undefined; getDefaultLang: jest.Mock; onLangChange: Subject<any> };
  let service: MeetingFormatsProvider;

  const build = () =>
    new MeetingFormatsProvider(http as unknown as HttpClient, storage as unknown as Storage, translate as unknown as TranslateService);

  beforeEach(() => {
    http = {
      get: jest.fn().mockImplementation((url: string) => of(url.indexOf('lang_enum=dk') > -1 ? DK_ROWS : EN_ROWS)),
    };
    storage = {
      ready: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    translate = {
      currentLang: 'da',
      getDefaultLang: jest.fn().mockReturnValue('da'),
      onLangChange: new Subject<any>(),
    };

    service = build();
  });

  describe('meetings without formats', () => {
    it('returns an empty list and never hits the network', async () => {
      await expect(service.getFormatsForMeeting(danishMeeting())).resolves.toEqual([]);
      expect(http.get).not.toHaveBeenCalled();
    });

    it('tolerates an empty format string', async () => {
      await expect(service.getFormatsForMeeting(danishMeeting({ formats: '' }))).resolves.toEqual([]);
    });

    it('tolerates a null meeting', async () => {
      await expect(service.getFormatsForMeeting(null)).resolves.toEqual([]);
    });
  });

  describe('fetching the format definitions', () => {
    it('requests both the default and the Danish format lists', async () => {
      await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(http.get).toHaveBeenCalledTimes(2);
      expect(http.get).toHaveBeenCalledWith(service.formatsUrl);
      expect(http.get).toHaveBeenCalledWith(service.formatsUrl + '&lang_enum=dk');
    });

    it('caches the fetched definitions in storage', async () => {
      await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(storage.set).toHaveBeenCalledWith(
        CACHE_KEY,
        expect.objectContaining({
          fetchedAt: expect.any(Number),
          formats: expect.any(Array),
        })
      );
    });

    it('serves a fresh cache without hitting the network', async () => {
      storage.get.mockResolvedValue({ fetchedAt: Date.now(), formats: EN_ROWS.concat(DK_ROWS) });
      service = build();

      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(http.get).not.toHaveBeenCalled();
      expect(formats[0].name).toBe('Åbent');
    });

    it('refetches when the cache is older than a week', async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      storage.get.mockResolvedValue({ fetchedAt: eightDaysAgo, formats: EN_ROWS });
      service = build();

      await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('fetches the definitions only once across many meetings', async () => {
      await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));
      await service.getFormatsForMeeting(danishMeeting({ formats: 'AFL' }));
      await service.getFormatsForMeeting(foreignMeeting({ formats: 'O' }));

      expect(http.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the network fails', () => {
    it('falls back to a stale cache', async () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      storage.get.mockResolvedValue({ fetchedAt: eightDaysAgo, formats: EN_ROWS.concat(DK_ROWS) });
      http.get.mockReturnValue(throwError(new Error('offline')));
      service = build();

      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(formats[0].name).toBe('Åbent');
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('degrades to the raw format keys when there is no cache at all', async () => {
      jest.useFakeTimers();
      http.get.mockReturnValue(throwError(new Error('offline')));
      service = build();

      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(formats).toEqual([{ key: 'Å', name: 'Å', description: '', category: 'content' }]);

      jest.clearAllTimers();
      jest.useRealTimers();
    });
  });

  describe('Danish meetings', () => {
    it('resolves formats by shared id when the id list lines up', async () => {
      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'Å,AFL',
          format_shared_id_list: '2,3',
        })
      );

      // The ids win over the keys: 2 = Basic Text (content), 3 = Kørestol (facility).
      expect(formats.map(f => f.name)).toEqual(['Kørestol', 'Basic Text']);
    });

    it('ignores the id list when the meeting comes from an aggregated root server', async () => {
      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'Å,AFL',
          format_shared_id_list: '2,3',
          root_server_id: '3',
        })
      );

      expect(formats.map(f => f.name)).toEqual(['Aflyst', 'Åbent']);
    });

    it('ignores the id list when it does not line up with the keys', async () => {
      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'Å,AFL',
          format_shared_id_list: '2',
        })
      );

      expect(formats.map(f => f.name)).toEqual(['Aflyst', 'Åbent']);
    });

    it('falls back to the key when the shared id is unknown', async () => {
      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'Å',
          format_shared_id_list: '999',
        })
      );

      expect(formats.map(f => f.name)).toEqual(['Åbent']);
    });

    it('resolves formats by key when there is no id list', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'Å' }));

      expect(formats).toEqual([{ key: 'Å', name: 'Åbent', description: 'Åbent møde', category: 'audience' }]);
    });

    it('matches a key case-insensitively', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'å' }));

      expect(formats.map(f => f.name)).toEqual(['Åbent']);
    });

    it('resolves an English key that also exists on the Danish server', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'O' }));

      expect(formats.map(f => f.name)).toEqual(['Åbent']);
    });
  });

  describe('foreign meetings', () => {
    it('resolves formats through the English keys', async () => {
      const formats = await service.getFormatsForMeeting(foreignMeeting({ formats: 'O' }));

      expect(formats.map(f => f.key)).toEqual(['Å']);
      expect(formats.map(f => f.name)).toEqual(['Åbent']);
    });

    it('does not use the Danish keys', async () => {
      const formats = await service.getFormatsForMeeting(foreignMeeting({ formats: 'Å' }));

      expect(formats).toEqual([{ key: 'Å', name: 'Å', description: '', category: 'content' }]);
    });

    it('treats a meeting with no root server uri as foreign', async () => {
      const formats = await service.getFormatsForMeeting({ formats: 'O' });

      expect(formats.map(f => f.name)).toEqual(['Åbent']);
    });
  });

  describe('unknown formats', () => {
    it('keeps the raw key as a content format', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'ZZZ' }));

      expect(formats).toEqual([{ key: 'ZZZ', name: 'ZZZ', description: '', category: 'content' }]);
    });

    it('mixes known and unknown formats', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'ZZZ,AFL' }));

      expect(formats.map(f => f.name)).toEqual(['Aflyst', 'ZZZ']);
    });
  });

  describe('ordering and de-duplication', () => {
    it('orders formats alert, language, audience, facility, then content', async () => {
      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'BT,KS,Å,DK,AFL',
        })
      );

      expect(formats.map(f => f.category)).toEqual(['alert', 'language', 'audience', 'facility', 'content']);
      expect(formats.map(f => f.name)).toEqual(['Aflyst', 'Dansk', 'Åbent', 'Kørestol', 'Basic Text']);
    });

    it('orders formats alphabetically inside a category', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'LIT,BT' }));

      expect(formats.map(f => f.name)).toEqual(['Basic Text', 'Litteratur']);
    });

    it('drops a format repeated in the meeting record', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'Å,Å' }));

      expect(formats).toHaveLength(1);
    });

    it('drops a duplicate reached through two different keys', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'Å,O' }));

      expect(formats).toHaveLength(1);
      expect(formats[0].key).toBe('Å');
    });

    it('trims whitespace and skips empty entries in the format list', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: ' Å , ,AFL ' }));

      expect(formats.map(f => f.name)).toEqual(['Aflyst', 'Åbent']);
    });
  });

  describe('display language', () => {
    it('labels formats in Danish when the app is in Danish', async () => {
      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'O' }));

      expect(formats[0].name).toBe('Åbent');
      expect(formats[0].description).toBe('Åbent møde');
    });

    it('labels formats in English when the app is in English', async () => {
      translate.currentLang = 'en';
      service = build();

      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'O' }));

      expect(formats[0].name).toBe('Open');
      expect(formats[0].description).toBe('Open meeting');
    });

    it('falls back to the default language when no language is active', async () => {
      translate.currentLang = undefined;
      service = build();

      const formats = await service.getFormatsForMeeting(danishMeeting({ formats: 'O' }));

      expect(formats[0].name).toBe('Åbent');
      expect(translate.getDefaultLang).toHaveBeenCalled();
    });

    it('relabels formats when the language changes, without refetching', async () => {
      const danish = await service.getFormatsForMeeting(danishMeeting({ formats: 'O' }));
      expect(danish[0].name).toBe('Åbent');

      translate.currentLang = 'en';
      translate.onLangChange.next({ lang: 'en' });

      const english = await service.getFormatsForMeeting(danishMeeting({ formats: 'O' }));
      expect(english[0].name).toBe('Open');
      expect(http.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('categories', () => {
    it('maps every BMLT format type to a category', async () => {
      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'AFL,DK,Å,KS,BT',
        })
      );

      const byName: { [name: string]: string } = {};
      formats.forEach(f => (byName[f.name] = f.category));

      expect(byName).toEqual({
        Aflyst: 'alert',
        Dansk: 'language',
        Åbent: 'audience',
        Kørestol: 'facility',
        'Basic Text': 'content',
      });
    });

    it('has a colour for every category it can produce', () => {
      ['alert', 'language', 'audience', 'facility', 'content'].forEach(category => {
        expect(MEETING_FORMAT_COLORS[category]).toBeTruthy();
      });
    });
  });

  describe('rows with no key', () => {
    it('skips definition rows that have no key string', async () => {
      http.get.mockImplementation((url: string) =>
        of(
          (url.indexOf('lang_enum=dk') > -1 ? DK_ROWS : EN_ROWS).concat([
            { id: '99', key_string: '', name_string: 'Broken', description_string: '', format_type_enum: 'O', lang: 'dk' },
          ])
        )
      );
      service = build();

      const formats = await service.getFormatsForMeeting(
        danishMeeting({
          formats: 'Å',
          format_shared_id_list: '99',
        })
      );

      expect(formats.map(f => f.name)).toEqual(['Åbent']);
    });
  });
});
