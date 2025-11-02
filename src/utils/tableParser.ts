// Utility functions to detect and parse table data from AI responses

export interface TableData {
  headers: string[];
  rows: string[][];
  columnTypes?: ColumnType[];
}

export type ColumnType = 'currency' | 'percentage' | 'number' | 'date' | 'text' | 'boolean';

export function detectTableInText(text: string): TableData | null {
  // Look for common table patterns with enhanced detection
  const tablePatterns = [
    // Markdown table pattern (most common)
    /^\s*\|(.+)\|\s*\n\s*\|[-:\s|]+\|\s*\n((?:\s*\|.+\|\s*\n?)*)/gm,
    // Pipe-separated values (no separators)
    /^[^|\n]+\|[^|\n]+(?:\|[^|\n]+)*$/gm,
    // Tab-separated values
    /^[^\t\n]+\t[^\t\n]+(?:\t[^\t\n]+)*$/gm,
    // CSV-style (comma-separated)
    /^[^,\n]+,[^,\n]+(?:,[^,\n]+)*$/gm,
  ];

  for (const pattern of tablePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length >= 2) {
      const tableData = parseTableData(matches);
      if (tableData) {
        // Detect column types for smart formatting
        tableData.columnTypes = detectColumnTypes(tableData);
        return tableData;
      }
    }
  }

  // Look for structured data patterns (key-value pairs)
  const structuredPattern = /(\w+):\s*([^\n]+)(?:\n(\w+):\s*([^\n]+))*$/gm;
  const structuredMatches = text.match(structuredPattern);
  if (structuredMatches && structuredMatches.length >= 2) {
    const tableData = parseStructuredData(structuredMatches);
    if (tableData) {
      tableData.columnTypes = detectColumnTypes(tableData);
      return tableData;
    }
  }

  // Look for colon-separated key-value lists
  const colonPattern = /^[\w\s]+:\s*[^\n]+(?:\n[\w\s]+:\s*[^\n]+){1,}/gm;
  const colonMatches = text.match(colonPattern);
  if (colonMatches && colonMatches.length > 0) {
    const tableData = parseColonSeparatedData(colonMatches);
    if (tableData) {
      tableData.columnTypes = detectColumnTypes(tableData);
      return tableData;
    }
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

// Parse colon-separated data (new function)
function parseColonSeparatedData(matches: string[]): TableData | null {
  const headers: string[] = [];
  const rows: string[][] = [];

  for (const match of matches) {
    const lines = match.split('\n').filter(line => line.trim());
    if (lines.length < 2) continue;

    const row: string[] = [];
    const currentHeaders: string[] = [];

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

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

// Detect column types for smart formatting
export function detectColumnTypes(data: TableData): ColumnType[] {
  return data.headers.map((_, colIndex) => {
    const columnValues = data.rows
      .map(row => row[colIndex])
      .filter(val => val && val.trim());

    if (columnValues.length === 0) return 'text';

    return detectColumnType(columnValues);
  });
}

// Detect the type of a specific column
export function detectColumnType(values: string[]): ColumnType {
  if (values.length === 0) return 'text';

  const sample = values.slice(0, Math.min(10, values.length));
  
  // Check for currency (e.g., $100, $1,000.00, USD 100)
  if (sample.every(v => /^[\$€£¥]?[\d,]+(\.\d{1,2})?[\$€£¥]?$|^(USD|EUR|GBP|JPY)\s*[\d,]+(\.\d{1,2})?$/i.test(v.trim()))) {
    return 'currency';
  }
  
  // Check for percentage (e.g., 50%, 12.5%)
  if (sample.every(v => /^[\d,]+(\.\d+)?%$/.test(v.trim()))) {
    return 'percentage';
  }
  
  // Check for boolean (true/false, yes/no)
  if (sample.every(v => /^(true|false|yes|no|y|n)$/i.test(v.trim()))) {
    return 'boolean';
  }
  
  // Check for date (various formats)
  if (sample.every(v => isDate(v.trim()))) {
    return 'date';
  }
  
  // Check for numbers
  if (sample.every(v => !isNaN(Number(v.replace(/[,$]/g, ''))))) {
    return 'number';
  }
  
  return 'text';
}

// Check if string is a valid date
function isDate(str: string): boolean {
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,        // MM/DD/YYYY
    /^\d{4}-\d{2}-\d{2}$/,               // YYYY-MM-DD
    /^\d{1,2}-\d{1,2}-\d{4}$/,          // DD-MM-YYYY
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i, // Month DD, YYYY
  ];
  
  return datePatterns.some(pattern => pattern.test(str)) || !isNaN(Date.parse(str));
}

// Smart data formatting functions
export function formatTableData(data: TableData): TableData {
  if (!data.columnTypes) {
    data.columnTypes = detectColumnTypes(data);
  }

  const formattedRows = data.rows.map(row =>
    row.map((cell, index) => {
      const columnType = data.columnTypes![index];
      return formatCellValue(cell, columnType);
    })
  );

  return { ...data, rows: formattedRows };
}

export function formatCellValue(value: string, type: ColumnType): string {
  if (!value || !value.trim()) return value;
  
  const trimmedValue = value.trim();
  
  switch (type) {
    case 'currency':
      return formatCurrency(trimmedValue);
    case 'number':
      return formatNumber(trimmedValue);
    case 'percentage':
      return formatPercentage(trimmedValue);
    case 'date':
      return formatDate(trimmedValue);
    case 'boolean':
      return formatBoolean(trimmedValue);
    default:
      return value;
  }
}

function formatCurrency(value: string): string {
  // Extract number from various currency formats
  const cleanValue = value.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleanValue);
  
  if (isNaN(num)) return value;
  
  // Use Intl.NumberFormat for proper currency formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatNumber(value: string): string {
  const cleanValue = value.replace(/[,$]/g, '');
  const num = parseFloat(cleanValue);
  
  if (isNaN(num)) return value;
  
  // Format with thousand separators
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentage(value: string): string {
  const cleanValue = value.replace('%', '').trim();
  const num = parseFloat(cleanValue);
  
  if (isNaN(num)) return value;
  
  return `${num.toFixed(1)}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  
  if (isNaN(date.getTime())) return value;
  
  // Format as Month DD, YYYY
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatBoolean(value: string): string {
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'y') return '✓';
  if (lower === 'false' || lower === 'no' || lower === 'n') return '✗';
  return value;
}

export function createTableColumns(data: TableData): any[] {
  return data.headers.map((header, index) => {
    const columnType = data.columnTypes?.[index] || 'text';
    
    return {
      accessorKey: `col_${index}`,
      header: header,
      cell: ({ row }: any) => row.original[`col_${index}`] || '',
      meta: {
        type: columnType,
        align: columnType === 'number' || columnType === 'currency' || columnType === 'percentage' ? 'right' : 'left',
      },
    };
  });
}

export function createTableRows(data: TableData): any[] {
  // Apply smart formatting before creating rows
  const formattedData = formatTableData(data);
  
  return formattedData.rows.map((row, index) => {
    const rowData: any = { id: index };
    formattedData.headers.forEach((_, colIndex) => {
      rowData[`col_${colIndex}`] = row[colIndex] || '';
    });
    return rowData;
  });
}
