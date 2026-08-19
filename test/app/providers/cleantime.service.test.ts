import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CleantimeService } from 'src/app/providers/cleantime.service';

// All "today" maths in the service goes through moment(), which reads Date.now().
// Freezing Date.now therefore pins the service's notion of today.
const TODAY = new Date(2026, 7, 19); // 19 Aug 2026, local (TZ pinned in jest.config.js)

describe('CleantimeService', () => {
  let storage: { ready: jest.Mock; get: jest.Mock };
  let translate: { get: jest.Mock };
  let service: CleantimeService;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(TODAY.getTime());

    storage = {
      ready: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(undefined),
    };
    translate = {
      get: jest.fn().mockReturnValue(of('translated-tag')),
    };

    service = new CleantimeService(storage as unknown as Storage, translate as unknown as TranslateService);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe('getCleanYearsMonthsDays', () => {
    it('breaks a multi-year cleantime into years, months and days', () => {
      expect(service.getCleanYearsMonthsDays('2020-01-15', TODAY)).toEqual([6, 7, 4]);
    });

    it('returns all zeroes on the clean date itself', () => {
      expect(service.getCleanYearsMonthsDays('2026-08-19', TODAY)).toEqual([0, 0, 0]);
    });

    it('counts a single day clean', () => {
      expect(service.getCleanYearsMonthsDays('2026-08-18', TODAY)).toEqual([0, 0, 1]);
    });

    it('handles a 29 February clean date without overflowing', () => {
      expect(service.getCleanYearsMonthsDays('2024-02-29', TODAY)).toEqual([2, 5, 22]);
    });

    it('never reports a negative component for a past clean date', () => {
      const [years, months, days] = service.getCleanYearsMonthsDays('2015-06-30', TODAY);
      expect(years).toBeGreaterThanOrEqual(0);
      expect(months).toBeGreaterThanOrEqual(0);
      expect(days).toBeGreaterThanOrEqual(0);
      expect(months).toBeLessThan(12);
      expect(days).toBeLessThan(31);
    });

    it('defaults to today when no reference date is given', () => {
      expect(service.getCleanYearsMonthsDays('2020-01-15')).toEqual([6, 7, 4]);
    });
  });

  describe('getCleanMonthsDays', () => {
    it('reports whole months with no remainder', () => {
      expect(service.getCleanMonthsDays('2026-05-19', TODAY)).toEqual([3, 0]);
    });

    it('returns zeroes on the clean date itself', () => {
      expect(service.getCleanMonthsDays('2026-08-19', TODAY)).toEqual([0, 0]);
    });

    it('does not roll months over into years', () => {
      expect(service.getCleanMonthsDays('2020-01-15', TODAY)).toEqual([79, 4]);
    });
  });

  describe('getCleanTimes', () => {
    it('returns days, precise months, precise years and whole years', () => {
      const [days, monthsPrecise, yearsPrecise, years] = service.getCleanTimes('2026-07-20');

      expect(days).toBe(30);
      expect(monthsPrecise).toBeGreaterThan(0.9);
      expect(monthsPrecise).toBeLessThan(1);
      expect(yearsPrecise).toBeGreaterThan(0);
      expect(yearsPrecise).toBeLessThan(1);
      expect(years).toBe(0);
    });

    it('floors whole years for a long cleantime', () => {
      const [days, , , years] = service.getCleanTimes('2020-01-15');

      expect(days).toBe(2408);
      expect(years).toBe(6);
    });

    it('reports zero days on the clean date itself', () => {
      const [days, , , years] = service.getCleanTimes('2026-08-19');

      expect(days).toBe(0);
      expect(years).toBe(0);
    });
  });

  describe('getAnniversaryDefinitions', () => {
    it('defines the standard NA milestones', () => {
      const defs: any = service.getAnniversaryDefinitions();

      expect(Object.keys(defs)).toEqual([
        '1-day',
        '30-days',
        '60-days',
        '90-days',
        '6-months',
        '9-months',
        '1-year',
        '18-months',
        'x-years',
      ]);
    });

    it('tags day, month and year milestones distinctly', () => {
      const defs: any = service.getAnniversaryDefinitions();

      expect(defs['1-day'].tag).toBe('DAYCLEAN');
      expect(defs['30-days'].tag).toBe('DAYSCLEAN');
      expect(defs['6-months'].tag).toBe('MONTHSCLEAN');
      expect(defs['1-year'].tag).toBe('YEARCLEAN');
      expect(defs['x-years'].tag).toBe('YEARSCLEAN');
    });

    it('matches x-years only on an exact whole-year boundary', () => {
      const defs: any = service.getAnniversaryDefinitions();
      const matches = defs['x-years'].cleanTimeInYearsPrecise;

      // cleanTimes = [days, monthsPrecise, yearsPrecise, wholeYears]
      expect(matches(5, [0, 0, 0, 5])).toBe(true);
      expect(matches(4, [0, 0, 0, 5])).toBe(false);
    });

    it('treats x-years as applying only beyond the first year', () => {
      const defs: any = service.getAnniversaryDefinitions();
      const applies = defs['x-years'].cleanTimeInYears;

      expect(applies(1)).toBe(false);
      expect(applies(2)).toBe(true);
    });

    it('builds an x-years offset in years and reads its tag time', () => {
      const defs: any = service.getAnniversaryDefinitions();

      expect(defs['x-years'].nextDateArg(7)).toEqual([0, 0, 7]);
      expect(defs['x-years'].tagTime([0, 0, 0, 7])).toBe(7);
    });
  });

  describe('getAnniversaries', () => {
    it('lists the milestones in chronological order', () => {
      const anniversaries = service.getAnniversaries();
      const defs: any = service.getAnniversaryDefinitions();

      expect(anniversaries).toHaveLength(9);
      expect(anniversaries[0].tag).toBe(defs['1-day'].tag);
      expect(anniversaries[8].tag).toBe(defs['x-years'].tag);
    });
  });

  describe('getNextAnniversaries', () => {
    it('returns only milestones between today and the horizon', () => {
      const next = service.getNextAnniversaries('2026-08-01', { days: 30 });

      expect(next).toHaveLength(1);
      expect(next[0].name).toBe('30-days');
      expect(next[0].tagTime).toBe(30);
      expect(next[0].date).toEqual(new Date(2026, 7, 31));
    });

    it('excludes milestones already in the past', () => {
      const next = service.getNextAnniversaries('2026-08-01', { days: 30 });

      expect(next.map(a => a.name)).not.toContain('1-day');
    });

    it('returns every milestone inside a wider horizon, in order', () => {
      const next = service.getNextAnniversaries('2026-08-01', { months: 6 });

      expect(next.map(a => a.name)).toEqual(['30-days', '60-days', '90-days', '6-months']);
    });

    it('generates the repeating x-years milestone for a long-time member', () => {
      const next = service.getNextAnniversaries('2006-09-01', { days: 30 });

      expect(next).toHaveLength(1);
      expect(next[0].name).toBe('x-years');
      expect(next[0].tagTime).toBe(20);
      expect(next[0].date).toEqual(new Date(2026, 8, 1));
    });

    it('returns nothing when no milestone falls inside the horizon', () => {
      expect(service.getNextAnniversaries('2026-08-05', { days: 3 })).toEqual([]);
    });

    it('does not emit duplicate dates', () => {
      const next = service.getNextAnniversaries('2006-09-01', { years: 3 });
      const times = next.map(a => a.date.getTime());

      expect(new Set(times).size).toBe(times.length);
    });
  });

  describe('getAnniversaryString', () => {
    it('combines the tag time with the translated tag', async () => {
      const text = await service.getAnniversaryString({ name: '30-days', tagTime: 30 });

      expect(translate.get).toHaveBeenCalledWith('DAYSCLEAN');
      expect(text).toBe('30 translated-tag');
    });

    it('uses the singular day tag for the first day', async () => {
      await service.getAnniversaryString({ name: '1-day', tagTime: 1 });

      expect(translate.get).toHaveBeenCalledWith('DAYCLEAN');
    });

    it('uses the plural year tag for x-years', async () => {
      const text = await service.getAnniversaryString({ name: 'x-years', tagTime: 20 });

      expect(translate.get).toHaveBeenCalledWith('YEARSCLEAN');
      expect(text).toBe('20 translated-tag');
    });
  });

  describe('getProfiles', () => {
    it('returns the stored profiles', async () => {
      const profiles = [{ cleandate: '2020-01-15' }];
      storage.get.mockResolvedValue(profiles);

      await expect(service.getProfiles()).resolves.toEqual(profiles);
      expect(storage.ready).toHaveBeenCalled();
      expect(storage.get).toHaveBeenCalledWith('cleanDateProfiles');
    });

    it('returns an empty list when nothing is stored', async () => {
      storage.get.mockResolvedValue(null);

      await expect(service.getProfiles()).resolves.toEqual([]);
    });
  });

  describe('getCleanDay', () => {
    it('reads the clean date of the profile at the given index', async () => {
      storage.get.mockResolvedValue([{ cleandate: '2020-01-15' }, { cleandate: '2021-02-02' }]);

      await expect(service.getCleanDay('1')).resolves.toBe('2021-02-02');
    });

    it('accepts the index as a string or a number', async () => {
      storage.get.mockResolvedValue([{ cleandate: '2020-01-15' }]);

      await expect(service.getCleanDay(0)).resolves.toBe('2020-01-15');
      await expect(service.getCleanDay('0')).resolves.toBe('2020-01-15');
    });
  });

  describe('getProfileCleanDay', () => {
    it('reads the clean date off a profile', () => {
      expect(service.getProfileCleanDay({ cleandate: '2020-01-15' })).toBe('2020-01-15');
    });
  });
});
