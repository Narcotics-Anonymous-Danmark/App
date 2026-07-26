/**
 * Normalises the raw WordPress /speaks feed into something the speaks page can
 * search, filter and group.
 *
 * The feed is hand-maintained, so the data is messy: years show up as "2015",
 * " 2015 ", "13-2-22" or "?", locations as "Kokna 27", "KOKNA 27" or
 * ".Vilborg trin 10-11-12", and the speaker name field sometimes holds the
 * speak type instead of a name ("Hovedspeak Sigi", "Åbningsspeaker Louise").
 * Everything user visible is derived here once, at load time, so the template
 * stays dumb and the list stays fast.
 */

export type SpeakLanguage = 'da' | 'en';
export type SpeakKind = 'opening' | 'main' | 'closing';

/** One playable talk. */
export interface Speak {
    /** The audio URL — also the media player playlist id and resume-point key. */
    id: string;
    audioUrl: string;
    /** Speaker name(s) if we could find one, else the speak type or location. */
    title: string;
    speaker: string | null;
    kind: SpeakKind | null;
    kindLabel: string | null;
    /** Avatar letter for named speakers, empty when we only have a type. */
    initial: string;
    conventionKey: string;
    conventionLabel: string;
    city: string | null;
    /** Raw feed group title, used as the player's second line. */
    eventTitle: string;
    /** Cleaned up location/edition, e.g. "KOKNA 30", "Aalborg". */
    edition: string | null;
    year: number | null;
    /** Full date when the feed had one (Viborg online meetings), dd-mm-yyyy. */
    dateLabel: string | null;
    /** Pre-rendered secondary line, e.g. "KOKNA 30 · 2026". */
    meta: string;
    /**
     * Like `meta` but self-contained — for places without a convention header
     * above the row, e.g. "Konvent-camp Skanderborg · 2025".
     */
    contextLabel: string;
    metaLine: string;
    metaLineWithConvention: string;
    language: SpeakLanguage;
    /** Descending-sortable yyyymmdd number, 0 when the date is unknown. */
    sortValue: number;
    /** Diacritic-folded haystack for the searchbar. */
    searchText: string;
}

export interface SpeakConvention {
    key: string;
    label: string;
    city: string | null;
    count: number;
}

export interface SpeakCatalog {
    speaks: Speak[];
    conventions: SpeakConvention[];
    /** Every year present in the feed, newest first. */
    years: number[];
}

/** A convention section in the list. */
export interface SpeakGroup {
    key: string;
    label: string;
    city: string | null;
    speaks: Speak[];
}

/** Translated labels, injected so this file stays i18n-free. */
export interface SpeakKindLabels {
    opening: string;
    main: string;
    closing: string;
    english: string;
}

export const EMPTY_SPEAK_CATALOG: SpeakCatalog = { speaks: [], conventions: [], years: [] };

/** Lowercases and folds Danish/accented characters so search is forgiving. */
export function foldText(value: string): string {
    let text = (value || '').toLowerCase();
    text = text
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a');
    if (typeof text.normalize === 'function') {
        // Strip combining marks, e.g. the decomposed "a" + ring in some URLs.
        text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return text.replace(/\s+/g, ' ').trim();
}

/** Collapses newlines/double spaces and trims stray punctuation. */
function tidy(value: any): string {
    return String(value === undefined || value === null ? '' : value)
        .replace(/\s+/g, ' ')
        .replace(/^[\s.,;:/-]+/, '')
        .replace(/[\s.,;:]+$/, '')
        .trim();
}

/** NA convention names are acronyms ending in -KNA/-CNA; keep those upper case. */
function isConventionAcronym(word: string): boolean {
    return /^[a-zæøå]*(kna|cna)$/i.test(word);
}

/** "BLANDEDE SPEAK" -> "Blandede speak", "kokna" -> "KOKNA". */
function prettyLabel(value: string): string {
    const text = value
        .split(' ')
        .map((word) => {
            if (!word || word.split('/').every((part) => isConventionAcronym(part))) {
                return word.toUpperCase();
            }
            // Shouty feed entries read better as a sentence; mixed case is kept.
            return word === word.toUpperCase() ? word.toLowerCase() : word;
        })
        .join(' ');
    return text.charAt(0).toUpperCase() + text.substring(1);
}

/** Upper-cases convention acronyms inside a location string, leaves the rest. */
function prettyEdition(value: string): string {
    const text = value
        .split(' ')
        .map((word) => {
            const bare = word.replace(/[^a-zæøå]/gi, '');
            return bare && isConventionAcronym(bare) ? word.toUpperCase() : word;
        })
        .join(' ');
    return text.charAt(0).toUpperCase() + text.substring(1);
}

interface ParsedConvention {
    key: string;
    label: string;
    city: string | null;
}

/**
 * "KOKNA - København" / "KOKNA - Udenlandske Speak" both belong to KOKNA; the
 * language is carried separately so both end up in one section.
 */
function parseConvention(eventTitle: string): ParsedConvention {
    const withoutLanguage = tidy(eventTitle).replace(/[\s-]*udenlandske\s+speaks?$/i, '');
    const split = withoutLanguage.match(/^(.*?)(?:\s+-\s*|\s*-\s+)(.*)$/);
    const base = tidy(split ? split[1] : withoutLanguage) || 'Speaks';
    const city = split ? tidy(split[2]) || null : null;
    return {
        key: foldText(base) || 'speaks',
        label: prettyLabel(base),
        city: city ? prettyLabel(city) : null
    };
}

interface ParsedDate {
    year: number | null;
    dateLabel: string | null;
    sortValue: number;
}

const NO_DATE: ParsedDate = { year: null, dateLabel: null, sortValue: 0 };

function pad2(value: number): string {
    return value < 10 ? '0' + value : String(value);
}

/**
 * Reads a year out of the feed's free-text year field. Handles "2015",
 * " 2015 ", "26/10-1998", "13-2-22" (Viborg online meeting dates) and "?".
 */
function parseDate(rawYear: string, fallback: string): ParsedDate {
    const text = tidy(rawYear);
    const full = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (full) {
        const day = parseInt(full[1], 10);
        const month = parseInt(full[2], 10);
        let year = parseInt(full[3], 10);
        if (year < 100) {
            year += 2000;
        }
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            return {
                year,
                dateLabel: `${pad2(day)}-${pad2(month)}-${year}`,
                sortValue: year * 10000 + month * 100 + day
            };
        }
    }
    const yearOnly = text.match(/(19|20)\d{2}/) || fallback.match(/(19|20)\d{2}/);
    if (yearOnly) {
        const year = parseInt(yearOnly[0], 10);
        return { year, dateLabel: null, sortValue: year * 10000 };
    }
    return NO_DATE;
}

const KIND_PREFIX = /^\s*(?:åbnings?|abnings?|opening|afslutnings?|closing|hoved|main)\s*speak(?:er)?\b[\s:,.-]*/i;

function detectKind(...candidates: string[]): SpeakKind | null {
    for (const candidate of candidates) {
        const folded = foldText(candidate);
        if (/abning|opening/.test(folded)) {
            return 'opening';
        }
        if (/afslutning|closing/.test(folded)) {
            return 'closing';
        }
        if (/hovedspeak|hoved speak|main speak/.test(folded)) {
            return 'main';
        }
    }
    return null;
}

/** The file name often carries the type ("KOKNA 30 2026 åbningsspeak.wav"). */
function fileNameOf(audioUrl: string): string {
    const withoutQuery = (audioUrl || '').split('?')[0];
    const last = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);
    try {
        return decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, '');
    } catch (e) {
        return last;
    }
}

function labelForKind(kind: SpeakKind | null, labels: SpeakKindLabels): string | null {
    if (kind === 'opening') {
        return labels.opening;
    }
    if (kind === 'main') {
        return labels.main;
    }
    if (kind === 'closing') {
        return labels.closing;
    }
    return null;
}

function initialOf(speaker: string | null): string {
    if (!speaker) {
        return '';
    }
    const match = speaker.match(/[a-zæøåA-ZÆØÅ]/);
    return match ? match[0].toUpperCase() : '';
}

/**
 * Drops a repeated convention prefix: "Konvent-camp Skanderborg 2015" -> "2015".
 * Only when what is left still says something on its own — the edition number
 * in "KOKNA 30" means nothing as a bare "30".
 */
function shortenEdition(edition: string | null, conventionLabel: string): string | null {
    if (!edition) {
        return null;
    }
    const lowerLabel = conventionLabel.toLowerCase();
    if (lowerLabel && edition.toLowerCase().indexOf(lowerLabel) === 0) {
        const rest = tidy(edition.substring(conventionLabel.length));
        if (/(19|20)\d{2}/.test(rest)) {
            return rest;
        }
    }
    return edition;
}

function buildMeta(edition: string | null, dateLabel: string | null, year: number | null): string {
    const timeLabel = dateLabel || (year ? String(year) : null);
    const parts: string[] = [];
    if (edition) {
        parts.push(edition);
    }
    if (timeLabel && (!edition || foldText(edition).indexOf(foldText(timeLabel)) < 0)) {
        parts.push(timeLabel);
    }
    return parts.join(' · ');
}

/** Prefixes the convention unless the line already names it. */
function buildContextLabel(meta: string, conventionLabel: string): string {
    if (!meta) {
        return conventionLabel;
    }
    return meta.toLowerCase().indexOf(conventionLabel.toLowerCase()) === 0
        ? meta
        : conventionLabel + ' · ' + meta;
}

/**
 * Builds the catalog from the raw feed (a list of `{ title, language, speaks }`
 * groups as returned by AudioService). Duplicate audio URLs are dropped — the
 * same file is sometimes listed under two groups and resume points are keyed
 * per file.
 */
export function buildSpeakCatalog(events: any[], labels: SpeakKindLabels): SpeakCatalog {
    const speaks: Speak[] = [];
    const conventions: SpeakConvention[] = [];
    const conventionIndex: { [key: string]: SpeakConvention } = {};
    const years: { [year: number]: true } = {};
    const seenUrls: { [url: string]: true } = {};

    (events || []).forEach((event: any) => {
        const eventTitle = tidy(event && event.title);
        const language: SpeakLanguage = event && event.language === 'en' ? 'en' : 'da';
        const convention = parseConvention(eventTitle);

        let group = conventionIndex[convention.key];
        if (!group) {
            group = { key: convention.key, label: convention.label, city: convention.city, count: 0 };
            conventionIndex[convention.key] = group;
            conventions.push(group);
        } else if (!group.city && convention.city) {
            group.city = convention.city;
        }

        ((event && event.speaks) || []).forEach((raw: any) => {
            const audioUrl = String((raw && raw.audioUrl) || '').trim();
            if (!audioUrl || seenUrls[audioUrl]) {
                return;
            }
            seenUrls[audioUrl] = true;

            const rawName = tidy(raw.name);
            const fileName = fileNameOf(audioUrl);
            const editionRaw = tidy(raw.location);
            const edition = editionRaw && editionRaw !== '?' ? prettyEdition(editionRaw) : null;

            const kind = detectKind(rawName, editionRaw, fileName);
            const speaker = tidy(rawName.replace(KIND_PREFIX, '')) || null;
            const kindLabel = labelForKind(kind, labels);
            const date = parseDate(raw.year, editionRaw + ' ' + fileName);
            const shortEdition = shortenEdition(edition, convention.label);
            const title = speaker || kindLabel || shortEdition || convention.label;
            const meta = buildMeta(shortEdition, date.dateLabel, date.year);
            const contextLabel = buildContextLabel(meta, convention.label);
            const languageLabel = language === 'en' ? labels.english : null;
            const typeLabel = speaker ? kindLabel : null;
            const metaLine = [typeLabel, meta, languageLabel]
                .filter((part) => !!part).join(' · ');
            const metaLineWithConvention = [typeLabel, contextLabel, languageLabel]
                .filter((part) => !!part).join(' · ');

            if (date.year) {
                years[date.year] = true;
            }
            group.count++;

            speaks.push({
                id: audioUrl,
                audioUrl,
                title,
                speaker,
                kind,
                kindLabel,
                initial: initialOf(speaker),
                conventionKey: convention.key,
                conventionLabel: convention.label,
                city: convention.city,
                eventTitle,
                edition: shortEdition,
                year: date.year,
                dateLabel: date.dateLabel,
                meta,
                contextLabel,
                metaLine,
                metaLineWithConvention,
                language,
                sortValue: date.sortValue,
                searchText: foldText([
                    title,
                    speaker || '',
                    kindLabel || '',
                    editionRaw,
                    eventTitle,
                    convention.label,
                    convention.city || '',
                    date.year ? String(date.year) : '',
                    date.dateLabel || '',
                    language === 'en' ? 'english engelsk udenlandske' : 'dansk danish',
                    fileName
                ].join(' '))
            });
        });
    });

    return {
        speaks,
        conventions: conventions.filter((convention) => convention.count > 0),
        years: Object.keys(years)
            .map((year) => parseInt(year, 10))
            .sort((a, b) => b - a)
    };
}

/** Splits an already sorted list into its convention sections. */
export function groupSpeaks(speaks: Speak[]): SpeakGroup[] {
    const groups: SpeakGroup[] = [];
    let current: SpeakGroup | null = null;
    speaks.forEach((speak) => {
        if (!current || current.key !== speak.conventionKey) {
            current = {
                key: speak.conventionKey,
                label: speak.conventionLabel,
                city: speak.city,
                speaks: []
            };
            groups.push(current);
        }
        current.speaks.push(speak);
    });
    return groups;
}

/** True when every whitespace-separated term of the query is in the haystack. */
export function matchesQuery(speak: Speak, foldedTerms: string[]): boolean {
    for (const term of foldedTerms) {
        if (speak.searchText.indexOf(term) < 0) {
            return false;
        }
    }
    return true;
}
