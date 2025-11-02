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

interface ResponsiveTableProps {
  data: any[];
  columns: ColumnDef<any>[];
  className?: string;
  theme?: 'dark' | 'light';
}

export default function ResponsiveTable({ data, columns, className = '', theme = 'dark' }: ResponsiveTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

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

  // Helper function to get cell styling based on column type
  const getCellStyle = (columnType?: ColumnType) => {
    const baseStyle = 'px-4 py-3 text-sm';
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
    
    return `${baseStyle} ${alignment} ${colorStyle}`;
  };

  // Helper function to get row styling with alternating colors
  const getRowStyle = (index: number) => ({
    backgroundColor: index % 2 === 0 
      ? (theme === 'dark' ? '#1a1a19' : '#f9fafb')
      : (theme === 'dark' ? '#151514' : '#ffffff'),
    borderColor: theme === 'dark' ? '#2a2a29' : 'rgba(229, 231, 235, 0.6)',
  });

  return (
    <div className={`w-full ${className}`}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border transition-colors duration-300" style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b transition-colors duration-300" style={{ borderColor: theme === 'dark' ? '#2a2a29' : 'rgba(229, 231, 235, 0.6)' }}>
                {headerGroup.headers.map(header => {
                  const columnMeta = header.column.columnDef.meta as { type?: ColumnType; align?: string } | undefined;
                  const alignment = columnMeta?.align === 'right' ? 'text-right justify-end' : 'text-left justify-start';
                  
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-opacity-10 transition-all duration-300 ${alignment}`}
                      style={{ 
                        backgroundColor: theme === 'dark' ? '#1f1f1f' : '#f9fafb',
                        color: theme === 'dark' ? '#ffffff' : '#111827',
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={`flex items-center space-x-2 ${alignment}`}>
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
            {table.getRowModel().rows.map((row, rowIndex) => (
              <tr 
                key={row.id} 
                className="border-b hover:bg-opacity-80 transition-all duration-200" 
                style={getRowStyle(rowIndex)}
              >
                {row.getVisibleCells().map(cell => {
                  const columnMeta = cell.column.columnDef.meta as { type?: ColumnType } | undefined;
                  return (
                    <td key={cell.id} className={getCellStyle(columnMeta?.type)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows.map((row, index) => (
          <div
            key={row.id}
            className="rounded-lg p-4 border transition-colors duration-300"
            style={{ 
              backgroundColor: theme === 'dark' ? '#1a1a19' : '#f9fafb',
              borderColor: theme === 'dark' ? '#2a2a29' : 'rgba(229, 231, 235, 0.6)',
            }}
          >
            <div className="space-y-2">
              {row.getVisibleCells().map((cell, cellIndex) => {
                const columnMeta = cell.column.columnDef.meta as { type?: ColumnType } | undefined;
                const getCellColorClass = () => {
                  switch (columnMeta?.type) {
                    case 'currency':
                      return theme === 'dark' ? 'text-green-400 font-mono' : 'text-green-600 font-mono';
                    case 'percentage':
                      return theme === 'dark' ? 'text-blue-400 font-mono' : 'text-blue-600 font-mono';
                    case 'number':
                      return theme === 'dark' ? 'text-gray-200 font-mono' : 'text-gray-800 font-mono';
                    case 'boolean':
                      return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
                    default:
                      return theme === 'dark' ? 'text-gray-300' : 'text-gray-800';
                  }
                };
                
                return (
                  <div key={cell.id} className="flex flex-col sm:flex-row sm:items-center">
                    <div 
                      className="text-xs font-semibold uppercase tracking-wide mb-1 sm:mb-0 sm:w-1/3 transition-colors duration-300"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                    >
                      {table.getHeaderGroups()[0].headers[cellIndex].column.columnDef.header as string}
                    </div>
                    <div className={`text-sm sm:w-2/3 ${getCellColorClass()}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-4 px-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 text-sm rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-10 transition-colors"
              style={{ backgroundColor: '#1a1a19', borderColor: '#2a2a29', color: '#ffffff' }}
            >
              First
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 text-sm rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-10 transition-colors"
              style={{ backgroundColor: '#1a1a19', borderColor: '#2a2a29', color: '#ffffff' }}
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 text-sm rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-10 transition-colors"
              style={{ backgroundColor: '#1a1a19', borderColor: '#2a2a29', color: '#ffffff' }}
            >
              Next
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 text-sm rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-10 transition-colors"
              style={{ backgroundColor: '#1a1a19', borderColor: '#2a2a29', color: '#ffffff' }}
            >
              Last
            </button>
          </div>
          <div className="text-sm text-gray-400">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
        </div>
      )}
    </div>
  );
}
