'use client';

import React, { useState, useEffect, useRef } from 'react';
import ResponsiveTable from './ResponsiveTable';
import { detectTableInText, createTableColumns, createTableRows, TableData } from '../utils/tableParser';

interface ResponseRendererProps {
  content: string;
  className?: string;
  isLoading?: boolean;
}

export default function ResponseRenderer({ content, className = '', isLoading = false }: ResponseRendererProps) {
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

  // Typewriter effect for streaming content
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

    // When streaming, progressively reveal content word by word
    const typewriterInterval = setInterval(() => {
      const currentPos = displayIndexRef.current;
      
      if (currentPos < content.length) {
        // Add 2-3 words at a time for smoother, book-like writing
        const remaining = content.slice(currentPos);
        const wordsRemaining = remaining.split(/(\s+)/);
        const wordsToAdd = Math.min(2 + Math.floor(Math.random() * 2), Math.max(1, wordsRemaining.length - 1));
        
        let newPos = currentPos;
        for (let i = 0; i < wordsToAdd && newPos < content.length && wordsRemaining[i]; i++) {
          newPos += wordsRemaining[i].length;
        }
        
        if (newPos > currentPos) {
          displayIndexRef.current = newPos;
          setDisplayedContent(content.slice(0, newPos));
        }
      } else {
        clearInterval(typewriterInterval);
        intervalRef.current = null;
      }
    }, 50); // 50ms per batch (2-3 words) = smooth reading pace

    intervalRef.current = typewriterInterval;
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
    // Process markdown with better structure and formatting
    let formattedText = text;
    const codeBlockPlaceholders: string[] = [];
    
    // Code blocks (triple backticks) - process first and replace with placeholders
    formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlockPlaceholders.length}__`;
      codeBlockPlaceholders.push(`<pre class="bg-gray-900 border border-gray-700 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-gray-200 text-sm font-mono whitespace-pre">${code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
      return placeholder;
    });
    
    // Headings (h1-h6)
    formattedText = formattedText.replace(/^### (.*$)/gm, '<h3 class="text-white font-semibold text-lg mt-6 mb-3">$1</h3>');
    formattedText = formattedText.replace(/^## (.*$)/gm, '<h2 class="text-white font-semibold text-xl mt-6 mb-4">$1</h2>');
    formattedText = formattedText.replace(/^# (.*$)/gm, '<h1 class="text-white font-bold text-2xl mt-6 mb-4">$1</h1>');
    
    // Inline code (single backticks)
    formattedText = formattedText.replace(/`([^`\n]+)`/g, '<code class="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-gray-200 font-mono">$1</code>');
    
    // Restore code blocks
    codeBlockPlaceholders.forEach((replacement, index) => {
      formattedText = formattedText.replace(`__CODE_BLOCK_${index}__`, replacement);
    });
    
    // Blockquotes
    formattedText = formattedText.replace(/^&gt; (.*$)/gm, '<blockquote class="border-l-4 border-gray-600 pl-4 my-3 italic text-gray-400">$1</blockquote>');
    formattedText = formattedText.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-gray-600 pl-4 my-3 italic text-gray-400">$1</blockquote>');
    
    // Process lists - simple approach: wrap consecutive list items
    type ListState = { items: string[], isOrdered: boolean };
    const lines = formattedText.split('\n');
    const processedLines: string[] = [];
    let currentList: ListState | null = null;
    
    const renderList = (list: ListState): string => {
      const tag = list.isOrdered ? 'ol' : 'ul';
      const className = list.isOrdered 
        ? 'list-decimal space-y-1.5 my-4 ml-6 marker:text-gray-400' 
        : 'list-disc space-y-1.5 my-4 ml-6 marker:text-gray-400';
      return `<${tag} class="${className}">${list.items.join('\n')}</${tag}>`;
    };
    
    lines.forEach(line => {
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
      
      if (orderedMatch || unorderedMatch) {
        const isOrdered = !!orderedMatch;
        const content = orderedMatch ? orderedMatch[2] : unorderedMatch![1];
        const item = `<li class="mb-1.5 text-gray-300 leading-relaxed">${content}</li>`;
        
        if (currentList && currentList.isOrdered === isOrdered) {
          currentList.items.push(item);
        } else {
          if (currentList) {
            processedLines.push(renderList(currentList));
          }
          currentList = { items: [item], isOrdered };
        }
      } else {
        if (currentList) {
          processedLines.push(renderList(currentList));
          currentList = null;
        }
        processedLines.push(line);
      }
    });
    
    if (currentList) {
      processedLines.push(renderList(currentList));
    }
    
    formattedText = processedLines.join('\n');
    
    // Bold text
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    
    // Italic text
    formattedText = formattedText.replace(/\*(.*?)\*/g, (match, content) => {
      // Skip if it's part of **bold**
      if (match.includes('**')) return match;
      return `<em class="text-gray-200 italic">${content}</em>`;
    });
    
    // Horizontal rules
    formattedText = formattedText.replace(/^---$/gm, '<hr class="border-gray-700 my-6" />');
    formattedText = formattedText.replace(/^___$/gm, '<hr class="border-gray-700 my-6" />');
    
    // Split into paragraphs (double newlines)
    const paragraphs = formattedText.split(/\n\n+/);
    const htmlParagraphs = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      
      // Don't wrap if it's already a block element (heading, pre, blockquote, list, hr)
      if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || 
          trimmed.startsWith('<blockquote') || trimmed.startsWith('<ul') || 
          trimmed.startsWith('<ol') || trimmed.startsWith('<hr') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      
      // Regular paragraphs with proper spacing
      return `<p class="text-gray-300 leading-relaxed mb-4">${trimmed}</p>`;
    }).filter(p => p).join('\n');

    return (
      <div 
        className="text-gray-300 leading-relaxed text-sm sm:text-base"
        dangerouslySetInnerHTML={{ __html: htmlParagraphs }}
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
