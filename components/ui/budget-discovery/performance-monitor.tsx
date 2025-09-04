import React, { useState, useEffect } from 'react';

interface PerformanceMetrics {
  searchTime: number;
  resultsCount: number;
  cacheHit: boolean;
  timestamp: Date;
}

interface PerformanceMonitorProps {
  isVisible?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ isVisible = false }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Listen for performance events
    const handlePerformanceEvent = (event: CustomEvent) => {
      const { searchTime, resultsCount, cacheHit } = event.detail;
      setMetrics(prev => [{
        searchTime,
        resultsCount,
        cacheHit,
        timestamp: new Date()
      }, ...prev.slice(0, 9)]); // Keep last 10 metrics
    };

    window.addEventListener('flight-search-performance', handlePerformanceEvent as EventListener);
    return () => {
      window.removeEventListener('flight-search-performance', handlePerformanceEvent as EventListener);
    };
  }, []);

  if (!isVisible || metrics.length === 0) {
    return null;
  }

  const avgSearchTime = metrics.reduce((sum, m) => sum + m.searchTime, 0) / metrics.length;
  const cacheHitRate = metrics.filter(m => m.cacheHit).length / metrics.length * 100;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-200"
      >
        <span>⚡ Performance</span>
        <span className="text-green-400">{avgSearchTime.toFixed(0)}ms avg</span>
        <span className="text-blue-400">{cacheHitRate.toFixed(0)}% cache</span>
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {metrics.map((metric, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className={metric.cacheHit ? 'text-green-400' : 'text-yellow-400'}>
                {metric.cacheHit ? '🎯' : '🔄'} {metric.resultsCount} results
              </span>
              <span className={metric.searchTime < 1000 ? 'text-green-400' : metric.searchTime < 3000 ? 'text-yellow-400' : 'text-red-400'}>
                {metric.searchTime}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to emit performance events
export const emitPerformanceEvent = (searchTime: number, resultsCount: number, cacheHit: boolean = false) => {
  const event = new CustomEvent('flight-search-performance', {
    detail: { searchTime, resultsCount, cacheHit }
  });
  window.dispatchEvent(event);
};
