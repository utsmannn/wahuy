import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, PackageSearch, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/api';
import type { BusinessCatalog } from '../types';

interface BusinessCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

const CATALOG_PAGE_LIMIT = 10;

export function BusinessCatalogModal({ isOpen, onClose, sessionId }: BusinessCatalogModalProps) {
  const [catalog, setCatalog] = useState<BusinessCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const loadCatalog = async (refresh = false, targetCursor?: string, history = cursorHistory) => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);
    const startedAt = Date.now();

    try {
      const response = await api.getBusinessCatalog(sessionId, {
        limit: CATALOG_PAGE_LIMIT,
        cursor: targetCursor,
        refresh,
      });
      setCatalog(response.data);
      setCursor(targetCursor);
      setCursorHistory(history);
      setDurationMs(Date.now() - startedAt);
    } catch (err) {
      setError((err as Error).message);
      setDurationMs(Date.now() - startedAt);
    } finally {
      setLoading(false);
    }
  };

  const refreshCurrentPage = () => {
    void loadCatalog(true, cursor, cursorHistory);
  };

  const goNext = () => {
    if (!catalog?.nextPageCursor) return;
    void loadCatalog(false, catalog.nextPageCursor, [...cursorHistory, cursor || '']);
  };

  const goPrevious = () => {
    if (cursorHistory.length === 0) return;
    const previousHistory = cursorHistory.slice(0, -1);
    const previousCursor = cursorHistory[cursorHistory.length - 1] || undefined;
    void loadCatalog(false, previousCursor, previousHistory);
  };

  useEffect(() => {
    if (isOpen) {
      setCatalog(null);
      setError(null);
      setDurationMs(null);
      setCursor(undefined);
      setCursorHistory([]);
      void loadCatalog(false, undefined, []);
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const pageNumber = cursorHistory.length + 1;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><PackageSearch size={16} /> Business Catalog</h3>
            <p className="text-xs text-gray-400 mt-0.5">Session: <span className="font-mono">{sessionId}</span></p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={refreshCurrentPage} disabled={loading}
              className="flex items-center gap-1 px-2 py-1.5 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs font-medium disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh live
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading && !catalog && (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
              <RefreshCw size={16} className="animate-spin mr-2" /> Fetching catalog from WhatsApp...
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {catalog && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Products</div>
                  <div className="text-2xl font-bold">{catalog.count}</div>
                </div>
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Page</div>
                  <div className="text-sm font-medium">{pageNumber}</div>
                </div>
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Next page</div>
                  <div className="text-sm font-medium">{catalog.nextPageCursor ? 'Available' : 'None'}</div>
                </div>
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                  <div className="text-xs text-gray-400">Last fetch</div>
                  <div className="text-sm font-medium">{durationMs === null ? '-' : `${durationMs}ms`}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                <div className="text-xs text-gray-400">
                  Showing up to {CATALOG_PAGE_LIMIT} products per page{cursor ? ' after cursor' : ''}.
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={goPrevious} disabled={loading || cursorHistory.length === 0}
                    className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    <ChevronLeft size={13} /> Previous
                  </button>
                  <button onClick={goNext} disabled={loading || !catalog.nextPageCursor}
                    className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {catalog.products.length === 0 ? (
                <div className="rounded-lg border border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-700 dark:text-amber-300">
                  WhatsApp returned an empty catalog page for this session. This can mean no visible WhatsApp Web catalog products, a non-business catalog state, or a catalog owner mismatch.
                </div>
              ) : (
                <div className="space-y-2">
                  {catalog.products.map(product => (
                    <div key={product.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {(product.imageProxyUrls?.[0] ?? product.images[0]) && (
                            <img
                              src={product.imageProxyUrls?.[0] ?? product.images[0]}
                              alt={product.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="h-16 w-16 rounded-lg border border-gray-100 dark:border-gray-800 object-cover bg-gray-50 dark:bg-gray-800"
                            />
                          )}
                          <div>
                            <div className="font-medium text-sm">{product.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{product.id}</div>
                            {product.description && <div className="text-xs text-gray-500 mt-1">{product.description}</div>}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {product.currency || ''} {product.discountPrice ?? product.salePrice ?? product.price ?? '-'}
                          </div>
                          {(product.discountPrice ?? product.salePrice) !== undefined && product.price !== undefined && (
                            <div className="line-through text-gray-400">{product.currency || ''} {product.price}</div>
                          )}
                          <div>{product.availability || 'unknown'}</div>
                          {product.isHidden && <div className="text-amber-600">hidden</div>}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                        <span>{product.images.length} image(s)</span>
                        {product.url && <a href={product.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Product URL</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="text-xs font-semibold mb-1 text-gray-400">Raw response</div>
                <pre className="text-[11px] font-mono bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-72">{JSON.stringify(catalog, null, 2)}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
