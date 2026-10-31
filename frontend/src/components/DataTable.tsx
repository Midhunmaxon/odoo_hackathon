import React from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Inbox, Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (newPage: number) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  keyExtractor?: (item: T, index: number) => string | number;
  className?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  error = null,
  onRetry,
  page = 1,
  limit = 10,
  total = 0,
  onPageChange,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items to display right now.',
  emptyAction,
  keyExtractor,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPagination = Boolean(onPageChange && total > 0);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const getRowKey = (item: T, index: number): string | number => {
    if (keyExtractor) return keyExtractor(item, index);
    if (item && item.id !== undefined) return item.id;
    return index;
  };

  const getAlignmentClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ${className}`}>
      {/* Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3.5 whitespace-nowrap ${getAlignmentClass(col.align)} ${
                    col.headerClassName || col.className || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: Math.min(limit, 5) }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={`skeleton-col-${col.key}`} className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              // Error State
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-rose-600 max-w-sm mx-auto">
                    <AlertCircle className="w-8 h-8" />
                    <p className="font-semibold text-sm">Failed to load data</p>
                    <p className="text-xs text-slate-500">
                      {typeof error === 'string' ? error : error?.message || 'An unexpected error occurred.'}
                    </p>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="mt-2 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-slate-400 max-w-sm mx-auto">
                    <Inbox className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                    <p className="font-semibold text-slate-700 text-sm">{emptyTitle}</p>
                    <p className="text-xs text-slate-500">{emptyMessage}</p>
                    {emptyAction && <div className="mt-2">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((item, index) => {
                const key = getRowKey(item, index);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${key}-${col.key}`}
                        className={`px-6 py-4 whitespace-nowrap ${getAlignmentClass(col.align)} ${
                          col.className || ''
                        }`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : item[col.key] !== undefined && item[col.key] !== null
                          ? String(item[col.key])
                          : '—'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {hasPagination && !isLoading && !error && (
        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{startItem}</span> to{' '}
            <span className="font-semibold text-slate-700">{endItem}</span> of{' '}
            <span className="font-semibold text-slate-700">{total}</span> records
          </div>

          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600 shadow-sm"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-slate-600 font-medium">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange && onPageChange(page + 1)}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600 shadow-sm"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
