// Utility functions to detect and parse table data from AI responses

export interface TableData {
  headers: string[];
  rows: string[][];
}

export function detectTableInText(text: string): TableData | null {
  // Look for common table patterns
  const tablePatterns = [
    // Markdown table pattern
    /^\s*\|(.+)\|\s*\n\s*\|[-:\s|]+\|\s*\n((?:\s*\|.+\|\s*\n?)*)/gm,
    // Pipe-separated values
    /^[^|\n]+\|[^|\n]+(?:\|[^|\n]+)*$/gm,
    // Tab-separated values
    /^[^\t\n]+\t[^\t\n]+(?:\t[^\t\n]+)*$/gm,
  ];

  for (const pattern of tablePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length >= 2) {
      return parseTableData(matches);
    }
  }

  // Look for structured data patterns
  const structuredPattern = /(\w+):\s*([^\n]+)(?:\n(\w+):\s*([^\n]+))*$/gm;
  const structuredMatches = text.match(structuredPattern);
  if (structuredMatches && structuredMatches.length >= 2) {
    return parseStructuredData(structuredMatches);
  }

  return null;
}

function parseTableData(matches: string[]): TableData | null {
  if (matches.length < 2) return null;

  const lines = matches.map(line => line.trim());
  const headerLine = lines[0];
  
  // Skip separator line if it exists
  const dataStartIndex = lines[1].includes('---') || lines[1].includes('===') ? 2 : 1;
  
  const headers = parseTableRow(headerLine);
  const rows: string[][] = [];

  for (let i = dataStartIndex; i < lines.length; i++) {
    const row = parseTableRow(lines[i]);
    if (row.length === headers.length) {
      rows.push(row);
    }
  }

  return rows.length > 0 ? { headers, rows } : null;
}

function parseTableRow(line: string): string[] {
  // Remove leading/trailing pipes and split by pipe
  const cleanLine = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
  return cleanLine.split('|').map(cell => cell.trim());
}

function parseStructuredData(matches: string[]): TableData | null {
  const headers: string[] = [];
  const rows: string[][] = [];

  for (const match of matches) {
    const pairs = match.split('\n').filter(line => line.trim());
    if (pairs.length === 0) continue;

    const row: string[] = [];
    const currentHeaders: string[] = [];

    for (const pair of pairs) {
      const [key, value] = pair.split(':').map(s => s.trim());
      if (key && value) {
        currentHeaders.push(key);
        row.push(value);
      }
    }

    if (currentHeaders.length > 0) {
      if (headers.length === 0) {
        headers.push(...currentHeaders);
      }
      if (row.length === headers.length) {
        rows.push(row);
      }
    }
  }

  return rows.length > 0 ? { headers, rows } : null;
}

export function createTableColumns(data: TableData): any[] {
  return data.headers.map((header, index) => ({
    accessorKey: `col_${index}`,
    header: header,
    cell: ({ row }: any) => row.original[`col_${index}`] || '',
  }));
}

export function createTableRows(data: TableData): any[] {
  return data.rows.map((row, index) => {
    const rowData: any = { id: index };
    data.headers.forEach((_, colIndex) => {
      rowData[`col_${colIndex}`] = row[colIndex] || '';
    });
    return rowData;
  });
}
