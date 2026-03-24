import React, { useMemo, useEffect, useRef } from 'react';
import { List } from 'react-window';
import type { ListImperativeAPI } from 'react-window';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';

const LINE_HEIGHT = 20;
const LINE_NUMBER_WIDTH = 55;
const PADDING = 16;

interface VirtualizedCodeViewProps {
  code: string;
  language: 'json' | 'xml' | 'text';
  isDark: boolean;
  errorLines: Set<number>;
  gutterRanges: { start: number; end: number }[];
  errorColor: string;
  scrollToLine?: number;
}

function getPrismGrammar(language: string) {
  switch (language) {
    case 'json': return Prism.languages.json;
    case 'xml': return Prism.languages.markup;
    default: return undefined;
  }
}

function getTokenColor(tokenType: string, isDark: boolean): string {
  const dark: Record<string, string> = {
    property: '#9cdcfe',
    string: '#ce9178',
    number: '#b5cea8',
    boolean: '#569cd6',
    null: '#569cd6',
    keyword: '#569cd6',
    operator: '#d4d4d4',
    punctuation: '#d4d4d4',
    tag: '#569cd6',
    'attr-name': '#9cdcfe',
    'attr-value': '#ce9178',
    comment: '#6a9955',
  };
  const light: Record<string, string> = {
    property: '#0451a5',
    string: '#a31515',
    number: '#098658',
    boolean: '#0000ff',
    null: '#0000ff',
    keyword: '#0000ff',
    operator: '#000000',
    punctuation: '#000000',
    tag: '#800000',
    'attr-name': '#ff0000',
    'attr-value': '#0000ff',
    comment: '#008000',
  };
  const palette = isDark ? dark : light;
  for (const t of tokenType.split(' ')) {
    if (palette[t]) return palette[t];
  }
  return isDark ? '#d4d4d4' : '#000000';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tokensToHtml(tokens: (string | Prism.Token)[], isDark: boolean): string {
  let html = '';
  for (const token of tokens) {
    if (typeof token === 'string') {
      html += escapeHtml(token);
    } else {
      const color = getTokenColor(token.type, isDark);
      const content = typeof token.content === 'string'
        ? escapeHtml(token.content)
        : Array.isArray(token.content)
          ? tokensToHtml(token.content as (string | Prism.Token)[], isDark)
          : escapeHtml(String(token.content));
      html += `<span style="color:${color}">${content}</span>`;
    }
  }
  return html;
}

function tokenizeToLines(code: string, language: string, isDark: boolean): string[] {
  const grammar = getPrismGrammar(language);
  if (!grammar) {
    return code.split('\n').map(line => escapeHtml(line));
  }

  const tokens = Prism.tokenize(code, grammar);
  const lines: string[] = [];
  let currentLine = '';

  function processToken(token: string | Prism.Token) {
    if (typeof token === 'string') {
      const parts = token.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push(currentLine);
          currentLine = '';
        }
        currentLine += escapeHtml(parts[i]);
      }
    } else if (typeof token.content === 'string' && token.content.includes('\n')) {
      const color = getTokenColor(token.type, isDark);
      const parts = token.content.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push(currentLine);
          currentLine = '';
        }
        currentLine += `<span style="color:${color}">${escapeHtml(parts[i])}</span>`;
      }
    } else {
      currentLine += tokensToHtml([token], isDark);
    }
  }

  for (const token of tokens) {
    processToken(token);
  }
  lines.push(currentLine);
  return lines;
}

// Row component for react-window v2 — receives props via closure over highlightedLines etc.
function createRowComponent(
  highlightedLines: string[],
  errorLines: Set<number>,
  gutterRanges: { start: number; end: number }[],
  isDark: boolean,
  errorColor: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function Row({ index, style }: any) {
    const lineNumber = index + 1;
    const isError = errorLines.has(lineNumber);
    const isInGutter = gutterRanges.some(r => lineNumber >= r.start && lineNumber <= r.end);

    const lineStyle: React.CSSProperties = {
      ...style,
      display: 'flex',
      alignItems: 'flex-start',
      paddingRight: PADDING,
    };

    if (isError) {
      lineStyle.backgroundColor = isDark ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.12)';
      lineStyle.borderLeft = `3px solid ${errorColor}`;
    } else if (isInGutter) {
      lineStyle.borderLeft = `3px solid ${isDark ? 'rgba(255, 152, 0, 0.4)' : 'rgba(255, 152, 0, 0.5)'}`;
    }

    return (
      <div style={lineStyle} data-line-number={lineNumber}>
        <span style={{
          display: 'inline-block',
          width: LINE_NUMBER_WIDTH,
          minWidth: LINE_NUMBER_WIDTH,
          paddingRight: 12,
          textAlign: 'right',
          color: isDark ? '#858585' : '#999',
          userSelect: 'none',
          flexShrink: 0,
        }}>
          {lineNumber}
        </span>
        <span
          dangerouslySetInnerHTML={{ __html: highlightedLines[index] || '' }}
          style={{ whiteSpace: 'pre', flex: 1 }}
        />
      </div>
    );
  };
}

const VirtualizedCodeView: React.FC<VirtualizedCodeViewProps> = ({
  code,
  language,
  isDark,
  errorLines,
  gutterRanges,
  errorColor,
  scrollToLine,
}) => {
  const listRef = useRef<ListImperativeAPI>(null);

  const highlightedLines = useMemo(
    () => tokenizeToLines(code, language, isDark),
    [code, language, isDark]
  );

  const RowComponent = useMemo(
    () => createRowComponent(highlightedLines, errorLines, gutterRanges, isDark, errorColor),
    [highlightedLines, errorLines, gutterRanges, isDark, errorColor]
  );

  // Scroll to target line on mount or when scrollToLine changes
  useEffect(() => {
    if (scrollToLine && listRef.current) {
      listRef.current.scrollToRow({ index: scrollToLine - 1, align: 'center' });
    }
  }, [scrollToLine, listRef]);

  return (
    <List<Record<string, never>>
      listRef={listRef}
      rowComponent={RowComponent}
      rowProps={{} as never}
      rowCount={highlightedLines.length}
      rowHeight={LINE_HEIGHT}
      overscanCount={20}
      style={{
        width: '100%',
        height: '100%',
        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
        fontSize: '0.875rem',
        lineHeight: `${LINE_HEIGHT}px`,
      }}
    />
  );
};

export default VirtualizedCodeView;
