'use client';

import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { ColumnType } from '../utils/tableParser';
import type { TableData } from '../utils/tableParser';

interface ResponsiveTableProps {
  data: any[];
  columns: ColumnDef<any>[];
  className?: string;
  theme?: 'dark' | 'light';
  sourceTable?: TableData;
}

export default function ResponsiveTable({
  data,
  columns,
  className = '',
  theme = 'dark',
  sourceTable,
}: ResponsiveTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const isDark = theme === 'dark';
  const palette = {
    border: isDark ? 'rgba(71, 85, 105, 0.35)' : 'rgba(203, 213, 225, 0.6)',
    headerBg: isDark ? 'rgba(17, 24, 39, 0.92)' : '#f1f5f9',
    headerText: isDark ? '#f8fafc' : '#0f172a',
    rowEven: isDark ? 'rgba(17, 24, 39, 0.85)' : '#ffffff',
    rowOdd: isDark ? 'rgba(15, 23, 42, 0.78)' : '#f8fafc',
    copyButton: isDark
      ? 'inline-flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700'
      : 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100',
    copyIcon: isDark ? '#cbd5f5' : '#475569',
    paginationButton: isDark
      ? 'px-3 py-1 text-xs rounded-lg border border-slate-600/60 bg-slate-800 text-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700'
      : 'px-3 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100',
    paginationText: isDark ? 'text-slate-400' : 'text-slate-600',
  };

  const copyButtonLabel =
    copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy table';

  const handleCopyTable = async () => {
    if (!sourceTable || typeof window === 'undefined') {
      return;
    }

    const markdown = tableDataToMarkdown(sourceTable);

    const tryClipboardWrite = async () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(markdown);
        return true;
      }
      return false;
    };

    const fallbackCopy = () => {
      if (typeof document === 'undefined') {
        return false;
      }
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    };

    try {
      const success = (await tryClipboardWrite()) || fallbackCopy();
      setCopyState(success ? 'copied' : 'error');
    } catch (error) {
      console.error('Failed to copy table:', error);
      const success = fallbackCopy();
      setCopyState(success ? 'copied' : 'error');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // Helper function to get cell styling based on column type
  const getCellStyle = (columnType?: ColumnType) => {
    const baseStyle = 'px-5 py-3 text-[13px] leading-[1.35] align-middle';
    const alignment = columnType === 'number' || columnType === 'currency' || columnType === 'percentage' ? 'text-right' : 'text-left';
    
    let colorStyle = '';
    switch (columnType) {
      case 'currency':
        colorStyle = theme === 'dark' ? 'text-green-400 font-mono' : 'text-green-600 font-mono';
        break;
      case 'percentage':
        colorStyle = theme === 'dark' ? 'text-blue-400 font-mono' : 'text-blue-600 font-mono';
        break;
      case 'number':
        colorStyle = theme === 'dark' ? 'text-gray-200 font-mono' : 'text-gray-800 font-mono';
        break;
      case 'boolean':
        colorStyle = theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
        break;
      default:
        colorStyle = theme === 'dark' ? 'text-gray-300' : 'text-gray-800';
    }
    
    return `${baseStyle} ${alignment} ${colorStyle} whitespace-nowrap md:whitespace-normal`;
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {data.length} {data.length === 1 ? 'row' : 'rows'}
        </div>
        {sourceTable && (
          <button
            type="button"
            onClick={handleCopyTable}
            className={palette.copyButton}
            aria-label="Copy table as markdown"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
            >
              <path
                d="M8 9C8 7.34315 9.34315 6 11 6H18C19.6569 6 21 7.34315 21 9V18C21 19.6569 19.6569 21 18 21H11C9.34315 21 8 19.6569 8 18V9Z"
                stroke={palette.copyIcon}
                strokeWidth="1.5"
              />
              <path
                d="M3 6C3 4.34315 4.34315 3 6 3H13"
                stroke={palette.copyIcon}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M3 10V6"
                stroke={palette.copyIcon}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M13 3H17C18.6569 3 20 4.34315 20 6V7"
                stroke={palette.copyIcon}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span>{copyButtonLabel}</span>
          </button>
        )}
      </div>

      <div
        className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div
          className="inline-block min-w-full rounded-2xl border shadow-sm transition-colors duration-300"
        style={{
          borderColor: palette.border,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(248, 250, 252, 0.85)',
        }}
      >
        <table className="w-full min-w-[640px] border-separate border-spacing-y-3 border-spacing-x-0">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr
                key={headerGroup.id}
                className="transition-colors duration-300"
                style={{ backgroundColor: palette.headerBg }}
              >
                {headerGroup.headers.map(header => {
                  const columnMeta = header.column.columnDef.meta as { type?: ColumnType; align?: string } | undefined;
                  const alignment = columnMeta?.align === 'right' ? 'text-right justify-end' : 'text-left justify-start';
                  
                  return (
                    <th
                      key={header.id}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide ${alignment} align-middle select-none first:rounded-l-xl last:rounded-r-xl`}
                      style={{
                        color: palette.headerText,
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={`flex items-center gap-2 ${alignment}`}>
                        <span>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getIsSorted() === 'asc' && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                        {header.column.getIsSorted() === 'desc' && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => {
              const rowBackground = rowIndex % 2 === 0 ? palette.rowEven : palette.rowOdd;
              return (
              <tr 
                key={row.id} 
                className="transition-all duration-200 shadow-sm hover:shadow-md"
                style={{
                  backgroundColor: rowBackground,
                  boxShadow: isDark
                    ? '0 8px 24px rgba(15, 23, 42, 0.45)'
                    : '0 8px 20px rgba(148, 163, 184, 0.25)',
                }}
              >
                {row.getVisibleCells().map(cell => {
                  const columnMeta = cell.column.columnDef.meta as { type?: ColumnType } | undefined;
                  return (
                    <td
                      key={cell.id}
                      className={`${getCellStyle(columnMeta?.type)} first:rounded-l-xl last:rounded-r-xl`}
                      style={{
                        backgroundColor: rowBackground,
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </span>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className={palette.paginationButton}
            >
              First
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={palette.paginationButton}
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={palette.paginationButton}
            >
              Next
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className={palette.paginationButton}
            >
              Last
            </button>
          </div>
          <div className={`text-xs font-medium ${palette.paginationText}`}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
        </div>
      )}
    </div>
  );
}

function tableDataToMarkdown(table: TableData): string {
  const escapeCell = (value: string) =>
    (value ?? '')
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();

  const headerRow = `| ${table.headers.map(escapeCell).join(' | ')} |`;
  const separatorRow = `| ${table.headers.map(() => '---').join(' | ')} |`;
  const rows = table.rows
    .map(row => `| ${row.map(cell => escapeCell(cell)).join(' | ')} |`)
    .join('\n');

  return `${headerRow}\n${separatorRow}\n${rows}`;
}
