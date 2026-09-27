/**
 * SERP-302: Universal Zero-Dependency XLSX Parser
 * Unpacks OpenXML Spreadsheet (.xlsx) packages in browser and Node.js environments
 * using standard PKZip parsing and DecompressionStream ('deflate-raw').
 */

import { ParsedCsvResult } from './csvParser';

export interface ParsedXlsxResult extends ParsedCsvResult {
  sheetName: string;
  sheetNames: string[];
}

/**
 * Extracts raw uncompressed and deflate-compressed entries from a PKZip buffer.
 */
async function extractZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entries = new Map<string, Uint8Array>();
  let offset = 0;

  // Scan local file headers: signature 0x04034b50
  while (offset + 30 <= buffer.byteLength) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLength);
    const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

    const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
    if (dataOffset + compressedSize > buffer.byteLength) {
      break;
    }

    const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);

    if (compressionMethod === 0) {
      // Stored (no compression)
      entries.set(fileName, compressedData);
    } else if (compressionMethod === 8) {
      // Deflate
      try {
        if (typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const response = new Response(ds.readable);
          const decompressedBuffer = await response.arrayBuffer();
          entries.set(fileName, new Uint8Array(decompressedBuffer));
        } else {
          // If DecompressionStream is unavailable (e.g. older environment), record as raw
          entries.set(fileName, compressedData);
        }
      } catch {
        // Fallback: store whatever was read
        entries.set(fileName, compressedData);
      }
    }

    offset = dataOffset + compressedSize;
  }

  return entries;
}

/**
 * Convert Excel column letters (A, B, ..., Z, AA, AB) to 0-based index.
 */
export function columnLetterToIndex(columnLetters: string): number {
  let index = 0;
  const upper = columnLetters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parses shared strings table from xl/sharedStrings.xml
 */
export function parseSharedStrings(xmlText: string): string[] {
  const strings: string[] = [];
  // Match each <si> ... </si> block
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let siMatch: RegExpExecArray | null;

  while ((siMatch = siRegex.exec(xmlText)) !== null) {
    const siContent = siMatch[1];
    // Collect all <t> ... </t> occurrences within this <si>
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tMatch: RegExpExecArray | null;
    let text = '';
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      text += tMatch[1];
    }
    // Decode XML entities: &amp;, &lt;, &gt;, &quot;, &apos;
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    strings.push(text);
  }

  return strings;
}

/**
 * Parses worksheet XML into a 2D string grid.
 */
export function parseWorksheetXml(xmlText: string, sharedStrings: string[]): string[][] {
  const grid: string[][] = [];

  // Match rows: <row r="1" ...> ... </row>
  const rowRegex = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xmlText)) !== null) {
    const rowIndex = parseInt(rowMatch[1], 10) - 1; // 0-based
    const rowContent = rowMatch[2];
    const currentRow: string[] = [];

    // Match cells: <c ...> ... </c> regardless of attribute ordering
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellAttrs = cellMatch[1];
      const cellBody = cellMatch[2];

      const rMatch = /\br="([A-Z]+)(\d+)"/i.exec(cellAttrs);
      if (!rMatch) continue;
      const colLetters = rMatch[1];
      const colIndex = columnLetterToIndex(colLetters);

      const tAttrMatch = /\bt="([^"]*)"/i.exec(cellAttrs);
      const cellType = tAttrMatch ? tAttrMatch[1] : '';

      let cellValue = '';

      if (cellType === 's') {
        // Shared string index
        const vMatch = /<v\b[^>]*>(\d+)<\/v>/i.exec(cellBody);
        if (vMatch) {
          const sIndex = parseInt(vMatch[1], 10);
          cellValue = sharedStrings[sIndex] ?? '';
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(cellBody);
        if (tMatch) cellValue = tMatch[1];
      } else {
        // Direct value (number, date, boolean)
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellBody);
        if (vMatch) {
          cellValue = vMatch[1];
        }
      }

      // Ensure array has enough elements
      while (currentRow.length < colIndex) {
        currentRow.push('');
      }
      currentRow[colIndex] = cellValue;
    }

    if (currentRow.some((val) => val && val.trim().length > 0)) {
      grid[rowIndex] = currentRow;
    }
  }

  // Filter out empty rows and normalize row lengths
  const denseRows = grid.filter((r) => r !== undefined && r.length > 0);
  const maxCols = denseRows.reduce((max, r) => Math.max(max, r.length), 0);

  return denseRows.map((r) => {
    while (r.length < maxCols) r.push('');
    return r.map((c) => (c ?? '').trim());
  });
}

/**
 * Universal entry point: Parses an XLSX binary buffer into tabular rows.
 */
export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedXlsxResult> {
  const entries = await extractZipEntries(buffer);
  if (entries.size === 0) {
    throw new Error('Invalid or corrupted XLSX file: unable to read zip structure');
  }

  // 1. Shared Strings
  let sharedStrings: string[] = [];
  const sstEntry = entries.get('xl/sharedStrings.xml');
  if (sstEntry) {
    const sstXml = new TextDecoder('utf-8').decode(sstEntry);
    sharedStrings = parseSharedStrings(sstXml);
  }

  // 2. Discover sheets (xl/worksheets/sheet1.xml)
  let sheet1Entry = entries.get('xl/worksheets/sheet1.xml');
  let sheetName = 'Sheet1';
  const sheetNames = ['Sheet1'];

  // Look for other sheet entries if sheet1.xml is missing
  if (!sheet1Entry) {
    for (const [name, entry] of entries.entries()) {
      if (name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml')) {
        sheet1Entry = entry;
        sheetName = name.replace('xl/worksheets/', '').replace('.xml', '');
        break;
      }
    }
  }

  if (!sheet1Entry) {
    throw new Error('No worksheets found in XLSX file');
  }

  const sheetXml = new TextDecoder('utf-8').decode(sheet1Entry);
  const rows = parseWorksheetXml(sheetXml, sharedStrings);

  if (rows.length === 0) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      delimiter: ',',
      sheetName,
      sheetNames,
    };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length,
    delimiter: ',',
    sheetName,
    sheetNames,
  };
}
