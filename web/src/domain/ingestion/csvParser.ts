/**
 * SERP-302: Universal RFC-4180 Streaming CSV Parser
 * Zero external dependencies, memory-safe, auto-delimiter detecting.
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  delimiter: string;
}

export interface CsvParseOptions {
  delimiter?: string;
  maxRows?: number;
  trimValues?: boolean;
}

/**
 * Auto-detect the best delimiter for a text file from the candidate set: , ; \t |
 */
export function detectDelimiter(sampleText: string): string {
  const candidates = [',', ';', '\t', '|'];
  const firstLines = sampleText.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0).slice(0, 5);
  if (firstLines.length === 0) return ',';

  let bestDelimiter = ',';
  let maxCount = -1;

  for (const delim of candidates) {
    const counts = firstLines.map((line) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (line[i] === delim && !inQuotes) count++;
      }
      return count;
    });

    const isConsistent = counts.length > 1 ? counts.every((c) => c === counts[0] && c > 0) : counts[0] > 0;
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

    if (isConsistent && avgCount > maxCount) {
      maxCount = avgCount;
      bestDelimiter = delim;
    } else if (maxCount <= 0 && avgCount > maxCount) {
      maxCount = avgCount;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Parses raw CSV text into headers and row string arrays according to RFC-4180.
 * Handles embedded quotes, embedded newlines, multiline fields, and empty fields.
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): ParsedCsvResult {
  if (!text || text.length === 0) {
    return { headers: [], rows: [], totalRows: 0, delimiter: ',' };
  }

  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const delimiter = options.delimiter || detectDelimiter(cleanText);
  const maxRows = options.maxRows ?? 50000;
  const trim = options.trimValues ?? true;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const len = cleanText.length;

  for (let i = 0; i < len; i++) {
    const char = cleanText[i];
    const nextChar = i + 1 < len ? cleanText[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        if (currentField.length === 0) {
          // Opening quote must be at start of field per RFC-4180
          inQuotes = true;
        } else {
          // Mid-field quote is literal data (e.g. 5" pipe)
          currentField += '"';
        }
      } else if (char === delimiter) {
        currentRow.push(trim ? currentField.trim() : currentField);
        currentField = '';
      } else if (char === '\r' || char === '\n') {
        // Handle \r\n as a single newline
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(trim ? currentField.trim() : currentField);
        currentField = '';

        // Only add non-empty rows
        const hasContent = currentRow.some((val) => val.length > 0);
        if (hasContent) {
          rows.push(currentRow);
          if (rows.length > 1 && rows.length - 1 >= maxRows) break;
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  // Flush remaining field/row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(trim ? currentField.trim() : currentField);
    const hasContent = currentRow.some((val) => val.length > 0);
    if (hasContent) {
      if (rows.length === 0 || rows.length - 1 < maxRows) {
        rows.push(currentRow);
      }
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], totalRows: 0, delimiter };
  }

  const headers = rows[0];
  let dataRows = rows.slice(1);
  if (dataRows.length > maxRows) {
    dataRows = dataRows.slice(0, maxRows);
  }

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length,
    delimiter,
  };
}

/**
 * Convert parsed rows back to a CSV string (e.g. for error exports or template downloads).
 */
export function exportToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}
