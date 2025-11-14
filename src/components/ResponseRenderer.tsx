'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ResponsiveTable from './ResponsiveTable';
import { createTableColumns, createTableRows, formatTableData, TableData } from '../utils/tableParser';

interface ResponseRendererProps {
  content: string;
  className?: string;
  isLoading?: boolean;
  theme?: 'dark' | 'light';
}

export default function ResponseRenderer({ content, className = '', isLoading = false, theme = 'dark' }: ResponseRendererProps) {
  const [parsedContent, setParsedContent] = useState<Array<{ type: 'text' | 'thinking'; content: string; thinkingIndex?: number }>>([]);
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
      const parts: Array<{ type: 'text' | 'thinking'; content: string; thinkingIndex?: number }> = [];

      if (!displayedContent || displayedContent.trim().length === 0) {
        setParsedContent(parts);
        return;
      }

      const thinkTagRegex = /<think>([\s\S]*?)<\/think>/gi;
      const thinkingBlocks: string[] = [];
      const processedContent = displayedContent
        .replace(/\r\n/g, '\n')
        .replace(thinkTagRegex, (_, thinkingContent: string) => {
          thinkingBlocks.push(thinkingContent.trim());
          return `__THINKING_${thinkingBlocks.length - 1}__`;
        });

      const segments = processedContent.split(/(__THINKING_\d+__)/g);
      const placeholderRegex = /^__THINKING_(\d+)__$/;

      segments.forEach((segment) => {
        if (!segment) {
          return;
        }

        const trimmedSegment = segment.trim();
        if (!trimmedSegment) {
          return;
        }

        const placeholderMatch = placeholderRegex.exec(trimmedSegment);
        if (placeholderMatch) {
          const idx = Number(placeholderMatch[1]);
          parts.push({
            type: 'thinking',
            content: thinkingBlocks[idx] || '',
            thinkingIndex: idx,
          });
          return;
        }

        parts.push({ type: 'text', content: segment });
      });

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

  const renderText = (text: string) => {
    // Theme-aware color classes
    const headingColorClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
    const textColorClass = theme === 'dark' ? 'text-gray-200' : 'text-gray-900';
    const italicColorClass = theme === 'dark' ? 'text-gray-200' : 'text-gray-700';
    const borderColorClass = theme === 'dark' ? 'border-gray-700' : 'border-gray-300';
    const bgCodeClass = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100';
    const codeTextClass = theme === 'dark' ? 'text-gray-200' : 'text-gray-900';
    const blockquoteBgClass = theme === 'dark' ? 'bg-slate-900/60' : 'bg-slate-100';

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
              <blockquote
                className={`${borderColorClass} border-l-4 pl-4 my-3 py-2 ${blockquoteBgClass} italic`}
              >
                {children}
              </blockquote>
            ),
            ul: ({ children }) => <ul className="list-disc space-y-1.5 my-4 ml-6 marker:text-gray-400">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1.5 my-4 ml-6 marker:text-gray-400">{children}</ol>,
            li: ({ children }) => <li className="mb-1.5 leading-relaxed">{children}</li>,
            hr: () => <hr className={`${borderColorClass} border my-6`} />,
            table: ({ node, children }) => {
              const tableData = tableNodeToTableData(node);

              if (tableData) {
                const formattedTable = formatTableData(tableData);
                const columns = createTableColumns(formattedTable);
                const rows = createTableRows(formattedTable, { formatted: true });
                return (
                  <div className="my-6">
                    <ResponsiveTable
                      data={rows}
                      columns={columns}
                      theme={theme}
                      sourceTable={formattedTable}
                    />
                  </div>
                );
              }

              return (
                <div
                  className="my-6 overflow-x-auto rounded-lg border"
                  style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}
                >
                  <table className="min-w-full border-collapse">{children}</table>
                </div>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  };

  const renderThinking = (thinkingContent: string, index: number) => {
    const isRevealed = revealedThinking.has(index);
    const containerBorder = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
    const toggleText = theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800';
    const toggleBg = theme === 'dark' ? 'hover:bg-gray-800/30' : 'hover:bg-slate-100';
    const bodyText = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
    const bodyBg = theme === 'dark' ? 'bg-gray-900/30' : 'bg-slate-100';

    return (
      <div className={`my-3 border ${containerBorder} rounded-lg overflow-hidden`}>
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
          className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${toggleText} ${toggleBg}`}
        >
          <span>💭 Thinking process</span>
          <span>{isRevealed ? '▼' : '▶'}</span>
        </button>
        {isRevealed && (
          <div className={`px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${bodyText} ${bodyBg}`}>
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
          {part.type === 'thinking'
            ? renderThinking(part.content, part.thinkingIndex ?? index)
            : renderText(part.content)}
        </div>
      ))}
    </div>
  );
}

function tableNodeToTableData(node: any): TableData | null {
  if (!node || node.type !== 'table' || !Array.isArray(node.children) || node.children.length === 0) {
    return null;
  }

  const [headerRow, ...bodyRows] = node.children;
  if (!headerRow || !Array.isArray(headerRow.children)) {
    return null;
  }

  const headers = headerRow.children
    .map((cell: any) => extractPlainTextFromNode(cell))
    .filter((text: string) => text.length > 0);

  if (headers.length === 0) {
    return null;
  }

  const rows = bodyRows
    .filter((row: any) => Array.isArray(row.children))
    .map((row: any) =>
      row.children
        .map((cell: any) => extractPlainTextFromNode(cell))
        .filter((_text: string, idx: number) => idx < headers.length),
    )
    .filter((row: string[]) => row.length === headers.length);

  return rows.length > 0 ? { headers, rows } : null;
}

function extractPlainTextFromNode(node: any): string {
  if (!node) {
    return '';
  }

  if (typeof node.value === 'string') {
    return node.value.trim();
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    return node.children
      .map((child: any) => extractPlainTextFromNode(child))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return '';
}
