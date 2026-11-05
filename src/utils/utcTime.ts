// Times in a response are read in UTC, the zone they're mostly written in, so that what's shown can be
// found in the raw text. Written out here rather than by the browser's locale, for "Nov 8 06:00" and
// a 24-hour clock everywhere, in the app's one language.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const twoDigits = (value: number) => String(value).padStart(2, '0');

export const utcClock = (time: number | Date) => {
  const date = new Date(time);
  return `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`;
};

export const utcDay = (time: number | Date) => {
  const date = new Date(time);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
};

export const utcMoment = (time: number | Date) => `${utcDay(time)} ${utcClock(time)}`;

// A time as an API writes it. Without a zone it's taken as UTC, not the browser's zone, and digits past
// milliseconds (pygeoapi sends nanoseconds) are dropped, since not every browser can read them.
export function parseTime(text: unknown): number {
  if (typeof text !== 'string') return NaN;
  const match = text.trim().match(/^(\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(?:[Zz]|([+-]\d{2}):?(\d{2})?)?$/);
  if (!match) return Date.parse(text);
  const [, whole, fraction = '', hours, minutes = '00'] = match;
  return Date.parse(`${whole.toUpperCase()}${fraction.slice(0, 4)}${hours ? `${hours}:${minutes}` : 'Z'}`);
}
