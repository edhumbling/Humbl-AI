'use client';

import React, { useState, useEffect } from 'react';
import ResponsiveTable from './ResponsiveTable';
import { detectTableInText, createTableColumns, createTableRows, TableData } from '../utils/tableParser';

interface ResponseRendererProps {
  content: string;
  className?: string;
}

export default function ResponseRenderer({ content, className = '' }: ResponseRendererProps) {
  const [parsedContent, setParsedContent] = useState<Array<{ type: 'text' | 'table', content: string | TableData }>>([]);

  useEffect(() => {
    const parseContent = () => {
      const parts: Array<{ type: 'text' | 'table', content: string | TableData }> = [];
      let currentText = '';
      let textIndex = 0;

      // Split content by potential table boundaries
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        
        // Check if this line might be the start of a table
        if (isPotentialTableStart(line, nextLine)) {
          // Save current text if any
          if (currentText.trim()) {
            parts.push({ type: 'text', content: currentText.trim() });
            currentText = '';
          }
          
          // Try to extract table from this point
          const tableData = extractTableFromLines(lines, i);
          if (tableData) {
            parts.push({ type: 'table', content: tableData });
            // Skip lines that were part of the table
            i += getTableLineCount(tableData) - 1;
          } else {
            currentText += line + '\n';
          }
        } else {
          currentText += line + '\n';
        }
      }
      
      // Add remaining text
      if (currentText.trim()) {
        parts.push({ type: 'text', content: currentText.trim() });
      }
      
      setParsedContent(parts);
    };

    parseContent();

    // Trigger MathJax typesetting for LaTeX after content changes
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
        // @ts-ignore
        window.MathJax.typesetPromise();
      }
    } catch {}
  }, [content]);

  const isPotentialTableStart = (line: string, nextLine?: string): boolean => {
    // Check for markdown table pattern
    if (line.includes('|') && line.split('|').length >= 3) return true;
    
    // Check for tab-separated values
    if (line.includes('\t') && line.split('\t').length >= 2) return true;
    
    // Check for structured data pattern
    if (line.includes(':') && nextLine && nextLine.includes(':')) return true;
    
    return false;
  };

  const extractTableFromLines = (lines: string[], startIndex: number): TableData | null => {
    const tableLines: string[] = [];
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Stop if we hit an empty line or non-table line
      if (!line.trim() || (!line.includes('|') && !line.includes('\t') && !line.includes(':'))) {
        break;
      }
      
      tableLines.push(line);
    }
    
    if (tableLines.length < 2) return null;
    
    return detectTableInText(tableLines.join('\n'));
  };

  const getTableLineCount = (tableData: TableData): number => {
    return tableData.rows.length + 1; // +1 for header
  };

  const renderText = (text: string) => {
    // Convert markdown-like formatting to HTML
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-gray-200 italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-sm text-gray-200">$1</code>')
      .replace(/\n\n/g, '</p><p class="text-gray-300 leading-relaxed">')
      .replace(/\n/g, '<br>');

    return (
      <div 
        className="text-gray-300 leading-relaxed text-sm sm:text-base"
        dangerouslySetInnerHTML={{ __html: `<p class="text-gray-300 leading-relaxed">${formattedText}</p>` }}
      />
    );
  };

  const renderTable = (tableData: TableData) => {
    const columns = createTableColumns(tableData);
    const rows = createTableRows(tableData);

    return (
      <div className="my-4">
        <ResponsiveTable data={rows} columns={columns} />
      </div>
    );
  };

  if (parsedContent.length === 0) {
    return <div className={className}>Loading...</div>;
  }

  return (
    <div className={className}>
      {parsedContent.map((part, index) => (
        <div key={index} className="mb-4 last:mb-0">
          {part.type === 'text' ? (
            renderText(part.content as string)
          ) : (
            renderTable(part.content as TableData)
          )}
        </div>
      ))}
    </div>
  );
}
