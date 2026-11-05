import { describe, expect, it } from 'vitest';
import { isIwxxmXml } from './useContentTypeDetection';

describe('isIwxxmXml', () => {
  it.each(['3.0', '2.1', '2021-2', '2023-1'])('recognises IWXXM %s by its namespace', version => {
    expect(isIwxxmXml(`<iwxxm:METAR xmlns:iwxxm="http://icao.int/iwxxm/${version}"/>`, 'application/xml')).toBe(true);
  });

  it.each(['<staff>STAFF</staff>', '<r>METAR</r>', '<r>SIGMET</r>'])("isn't fooled by the words in %s", xml => {
    expect(isIwxxmXml(xml, 'application/xml')).toBe(false);
  });

  it('only looks at XML', () => {
    expect(isIwxxmXml('{"href":"http://icao.int/iwxxm/3.0"}', 'application/json')).toBe(false);
  });

  it('is false without data or a content type', () => {
    expect(isIwxxmXml(null, 'application/xml')).toBe(false);
    expect(isIwxxmXml('<iwxxm xmlns="http://icao.int/iwxxm/3.0"/>', null)).toBe(false);
  });
});
