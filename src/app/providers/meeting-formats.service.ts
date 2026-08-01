import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';

export type MeetingFormatCategory = 'alert' | 'language' | 'audience' | 'facility' | 'content';

export interface MeetingFormat {
  key: string;
  name: string;
  description: string;
  category: MeetingFormatCategory;
}

interface RawFormat {
  id: string;
  key_string: string;
  name_string: string;
  description_string: string;
  format_type_enum: string;
  lang: string;
}

interface FormatIndex {
  byId: { [id: string]: MeetingFormat };
  byKey: { [key: string]: MeetingFormat };
  byLowerKey: { [key: string]: MeetingFormat };
  byEnglishKey: { [key: string]: MeetingFormat };
}

interface FormatCache {
  fetchedAt: number;
  formats: RawFormat[];
}

const CACHE_KEY = 'meeting_formats_v1';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
const DANISH_ROOT_SERVER = 'nadanmark.dk';
const DANISH_BMLT_LANG = 'dk';

const CATEGORY_ORDER: { [category: string]: number } = {
  alert: 0,
  language: 1,
  audience: 2,
  facility: 3,
  content: 4
};

export const MEETING_FORMAT_COLORS: { [category: string]: string } = {
  alert: 'danger',
  language: 'tertiary',
  audience: 'primary',
  facility: 'dark',
  content: 'dark'
};

@Injectable({ providedIn: 'root' })
export class MeetingFormatsProvider {

  formatsUrl = 'https://www.nadanmark.dk/main_server/client_interface/json/?switcher=GetFormats';

  private definitions: Promise<RawFormat[]> | null = null;
  private index: Promise<FormatIndex> | null = null;
  private indexLang: string | null = null;

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private translate: TranslateService
  ) {
    this.translate.onLangChange.subscribe(() => {
      this.index = null;
      this.indexLang = null;
    });
  }


  async getFormatsForMeeting(meeting: any): Promise<MeetingFormat[]> {
    const keys = this.splitList(meeting && meeting.formats);
    if (!keys.length) {
      return [];
    }

    const index = await this.getIndex();
    const ids = this.splitList(meeting.format_shared_id_list);
    const isDanish = this.isDanishRootServer(meeting);
    const idsMatchIndex = isDanish && !meeting.root_server_id && ids.length === keys.length;

    const formats: MeetingFormat[] = [];
    keys.forEach((key, i) => {
      const found = isDanish
        ? (idsMatchIndex ? index.byId[ids[i]] : undefined) || index.byKey[key] || index.byLowerKey[key.toLowerCase()]
        : index.byEnglishKey[key];

      const format = found
        || { key, name: key, description: '', category: 'content' as MeetingFormatCategory };

      if (!formats.some(existing => existing.key === format.key)) {
        formats.push(format);
      }
    });

    return formats.sort((a, b) =>
      (CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]) || a.name.localeCompare(b.name, 'da')
    );
  }


  private getIndex(): Promise<FormatIndex> {
    const lang = this.displayLang();

    if (!this.index || this.indexLang !== lang) {
      this.indexLang = lang;
      this.index = this.getDefinitions().then(formats => this.buildIndex(formats, lang));
    }

    return this.index;
  }


  private getDefinitions(): Promise<RawFormat[]> {
    if (!this.definitions) {
      this.definitions = this.load().then(formats => {
        if (!formats.length) {
          setTimeout(() => {
            this.definitions = null;
            this.index = null;
          }, RETRY_DELAY_MS);
        }
        return formats;
      });
    }

    return this.definitions;
  }


  private async load(): Promise<RawFormat[]> {
    const cached = await this.readCache();
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_MAX_AGE_MS) {
      return cached.formats;
    }

    try {
      const formats = await this.fetch();
      await this.writeCache(formats);
      return formats;
    } catch (error) {
      return cached ? cached.formats : [];
    }
  }


  private async fetch(): Promise<RawFormat[]> {
    const responses = await Promise.all([
      this.get(this.formatsUrl),
      this.get(this.formatsUrl + '&lang_enum=' + DANISH_BMLT_LANG)
    ]);

    return responses.reduce((all, response) => all.concat(response), []);
  }


  private get(url: string): Promise<RawFormat[]> {
    return this.http.get<RawFormat[]>(url).toPromise().then(formats => formats || []);
  }


  private buildIndex(formats: RawFormat[], lang: string): FormatIndex {
    const index: FormatIndex = { byId: {}, byKey: {}, byLowerKey: {}, byEnglishKey: {} };

    const rowsById: { [id: string]: RawFormat[] } = {};
    for (const format of formats) {
      if (!format || !format.key_string) {
        continue;
      }
      (rowsById[format.id] = rowsById[format.id] || []).push(format);
    }

    for (const id of Object.keys(rowsById)) {
      const rows = rowsById[id];
      const source = rows.filter(row => row.lang === lang)[0]
        || rows.filter(row => row.lang === 'en')[0]
        || rows[0];

      const format: MeetingFormat = {
        key: source.key_string,
        name: source.name_string || source.key_string,
        description: source.description_string || '',
        category: this.toCategory(source.format_type_enum)
      };

      index.byId[id] = format;
      for (const row of rows) {
        this.registerKey(index, row.key_string, format);
        if (row.lang === 'en' && !index.byEnglishKey[row.key_string]) {
          index.byEnglishKey[row.key_string] = format;
        }
      }
    }

    return index;
  }


  private registerKey(index: FormatIndex, key: string, format: MeetingFormat) {
    if (!index.byKey[key]) {
      index.byKey[key] = format;
    }

    const lowerKey = key.toLowerCase();
    if (!(lowerKey in index.byLowerKey)) {
      index.byLowerKey[lowerKey] = format;
    } else if (index.byLowerKey[lowerKey] && index.byLowerKey[lowerKey].key !== format.key) {
      delete index.byLowerKey[lowerKey];
    }
  }


  private toCategory(formatTypeEnum: string): MeetingFormatCategory {
    const type = formatTypeEnum || '';

    if (type === 'ALERT') {
      return 'alert';
    }
    if (type === 'LANG') {
      return 'language';
    }
    if (type.indexOf('FC3') === 0 || type.indexOf('O') === 0 || type.indexOf('C') === 0) {
      return 'audience';
    }
    if (type.indexOf('FC2') === 0) {
      return 'facility';
    }
    return 'content';
  }


  private isDanishRootServer(meeting: any): boolean {
    return !!meeting.root_server_uri && meeting.root_server_uri.indexOf(DANISH_ROOT_SERVER) > -1;
  }


  private splitList(value: any): string[] {
    if (!value) {
      return [];
    }
    return String(value).split(',').map(entry => entry.trim()).filter(entry => !!entry);
  }


  private displayLang(): string {
    const lang = this.translate.currentLang || this.translate.getDefaultLang();
    return lang === 'da' ? DANISH_BMLT_LANG : 'en';
  }


  private async readCache(): Promise<FormatCache | null> {
    try {
      await this.storage.ready();
      const cached: FormatCache = await this.storage.get(CACHE_KEY);
      if (cached && cached.formats && cached.formats.length) {
        return cached;
      }
    } catch (error) {
    }
    return null;
  }


  private async writeCache(formats: RawFormat[]) {
    if (!formats.length) {
      return;
    }
    try {
      await this.storage.ready();
      await this.storage.set(CACHE_KEY, { fetchedAt: Date.now(), formats });
    } catch (error) {
    }
  }
}
