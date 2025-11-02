'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ResponsiveTable from './ResponsiveTable';
import { detectTableInText, createTableColumns, createTableRows, TableData } from '../utils/tableParser';

interface ResponseRendererProps {
  content: string;
  className?: string;
  isLoading?: boolean;
  theme?: 'dark' | 'light';
}

export default function ResponseRenderer({ content, className = '', isLoading = false, theme = 'dark' }: ResponseRendererProps) {
  const [parsedContent, setParsedContent] = useState<Array<{ type: 'text' | 'table' | 'thinking', content: string | TableData, thinkingIndex?: number }>>([]);
  const [revealedThinking, setRevealedThinking] = useState<Set<number>>(new Set());
  const [displayedContent, setDisplayedContent] = useState(content);

  const displayIndexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef('');

  // Initialize displayedContent when content changes
  useEffect(() => {
    if (content !== lastContentRef.current) {
      if (!isLoading) {
        setDisplayedContent(content);
        displayIndexRef.current = content.length;
      } else if (content.length === 0) {
        setDisplayedContent('');
        displayIndexRef.current = 0;
      }
      lastContentRef.current = content;
    }
  }, [content, isLoading]);

  // Direct streaming without typewriter effect
  useEffect(() => {
    if (!isLoading) {
      // When loading stops, immediately show all content
      if (displayedContent !== content) {
        setDisplayedContent(content);
        displayIndexRef.current = content.length;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current!);
    }

    // Show content immediately as it streams in - no artificial delay
    setDisplayedContent(content);
    displayIndexRef.current = content.length;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [content, isLoading]);

  useEffect(() => {
    const parseContent = () => {
      const parts: Array<{ type: 'text' | 'table' | 'thinking', content: string | TableData, thinkingIndex?: number }> = [];
      let currentText = '';
      let textIndex = 0;
      let thinkingIndex = 0;

      // Extract thinking tags first (Qwen parse mode outputs <think>...</think>)
      const thinkTagRegex = /<think>([\s\S]*?)<\/think>/gi;
      const thinkingBlocks: string[] = [];
      let processedContent = displayedContent.replace(thinkTagRegex, (match, thinkingContent) => {
        thinkingBlocks.push(thinkingContent.trim());
        return `__THINKING_${thinkingBlocks.length - 1}__`;
      });

      // Split content by potential table boundaries and thinking placeholders
      const lines = processedContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1];
        
        // Check for thinking placeholder
        const thinkingMatch = line.match(/__THINKING_(\d+)__/);
        if (thinkingMatch) {
          // Save current text if any
          if (currentText.trim()) {
            parts.push({ type: 'text', content: currentText.trim() });
            currentText = '';
          }
          const idx = parseInt(thinkingMatch[1]);
          parts.push({ type: 'thinking', content: thinkingBlocks[idx] || '', thinkingIndex: idx });
          continue;
        }
        
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
  }, [displayedContent]);

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
    // Theme-aware color classes
    const headingColorClass = theme === 'dark' ? 'text-white' : 'text-black';
    const textColorClass = theme === 'dark' ? 'text-gray-300' : 'text-black';
    const italicColorClass = theme === 'dark' ? 'text-gray-200' : 'text-black';
    const borderColorClass = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';
    const bgCodeClass = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100';
    const codeTextClass = theme === 'dark' ? 'text-gray-200' : 'text-gray-900';
    
    return (
      <div className={`${textColorClass} leading-relaxed text-sm sm:text-base transition-colors duration-300`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className={`${headingColorClass} font-bold text-2xl mt-6 mb-4`}>{children}</h1>,
            h2: ({ children }) => <h2 className={`${headingColorClass} font-semibold text-xl mt-6 mb-4`}>{children}</h2>,
            h3: ({ children }) => <h3 className={`${headingColorClass} font-semibold text-lg mt-6 mb-3`}>{children}</h3>,
            p: ({ children }) => <p className="mb-4">{children}</p>,
            strong: ({ children }) => <strong className={`${headingColorClass} font-semibold`}>{children}</strong>,
            em: ({ children }) => <em className={`${italicColorClass} italic`}>{children}</em>,
            code: ({ className, children }) => {
              const isInline = !className;
              return isInline ? (
                <code className={`${bgCodeClass} ${codeTextClass} px-1.5 py-0.5 rounded text-sm font-mono`}>{children}</code>
              ) : (
                <code className={`${codeTextClass} text-sm font-mono whitespace-pre`}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre className={`${bgCodeClass} ${borderColorClass} border rounded-lg p-4 my-4 overflow-x-auto`}>
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className={`border-l-4 ${borderColorClass} pl-4 my-3 italic text-gray-400`}>
                {children}
              </blockquote>
            ),
            ul: ({ children }) => <ul className="list-disc space-y-1.5 my-4 ml-6 marker:text-gray-400">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1.5 my-4 ml-6 marker:text-gray-400">{children}</ol>,
            li: ({ children }) => <li className="mb-1.5 leading-relaxed">{children}</li>,
            hr: () => <hr className={`${borderColorClass} border my-6`} />,
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto">
                <table className={`min-w-full border-collapse ${borderColorClass} border`}>
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => <thead className={bgCodeClass}>{children}</thead>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => <tr className={`${borderColorClass} border-b`}>{children}</tr>,
            th: ({ children }) => <th className={`${headingColorClass} font-semibold px-4 py-2 text-left ${borderColorClass} border-r last:border-r-0`}>{children}</th>,
            td: ({ children }) => <td className="px-4 py-2 border-r last:border-r-0">{children}</td>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
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

  const renderThinking = (thinkingContent: string, index: number) => {
    const isRevealed = revealedThinking.has(index);
    return (
      <div className="my-3 border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => {
            const newSet = new Set(revealedThinking);
            if (isRevealed) {
              newSet.delete(index);
            } else {
              newSet.add(index);
            }
            setRevealedThinking(newSet);
          }}
          className="w-full px-3 py-2 text-left text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800/30 transition-colors flex items-center justify-between"
        >
          <span>💭 Thinking process</span>
          <span>{isRevealed ? '▼' : '▶'}</span>
        </button>
        {isRevealed && (
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-900/30 leading-relaxed whitespace-pre-wrap">
            {thinkingContent}
          </div>
        )}
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
          ) : part.type === 'thinking' ? (
            renderThinking(part.content as string, part.thinkingIndex ?? index)
          ) : (
            renderTable(part.content as TableData)
          )}
        </div>
      ))}
    </div>
  );
}
