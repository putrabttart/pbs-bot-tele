// src/utils/metrics.js
// Prometheus-style metrics collector

class MetricsCollector {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.startTime = Date.now();
  }

  /**
   * Counter: monotonically increasing value
   */
  incCounter(name, labels = {}, value = 1) {
    const key = this._makeKey(name, labels);
    const current = this.counters.get(key) || { name, labels, value: 0 };
    current.value += value;
    this.counters.set(key, current);
  }

  /**
   * Gauge: value that can go up or down
   */
  setGauge(name, labels = {}, value) {
    const key = this._makeKey(name, labels);
    this.gauges.set(key, { name, labels, value, timestamp: Date.now() });
  }

  incGauge(name, labels = {}, delta = 1) {
    const key = this._makeKey(name, labels);
    const current = this.gauges.get(key) || { name, labels, value: 0 };
    current.value += delta;
    current.timestamp = Date.now();
    this.gauges.set(key, current);
  }

  /**
   * Histogram: track distribution of values
   */
  observe(name, labels = {}, value) {
    const key = this._makeKey(name, labels);
    const histogram = this.histograms.get(key) || {
      name,
      labels,
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      buckets: new Map()
    };

    histogram.count++;
    histogram.sum += value;
    histogram.min = Math.min(histogram.min, value);
    histogram.max = Math.max(histogram.max, value);

    // Add to buckets (configurable)
    const bucketBoundaries = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    for (const boundary of bucketBoundaries) {
      if (value <= boundary) {
        histogram.buckets.set(boundary, (histogram.buckets.get(boundary) || 0) + 1);
      }
    }

    this.histograms.set(key, histogram);
  }

  /**
   * Timing helper
   */
  startTimer(name, labels = {}) {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.observe(name, labels, duration);
      return duration;
    };
  }

  /**
   * Generate unique key for metric
   */
  _makeKey(name, labels) {
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(k => `${k}="${labels[k]}"`)
      .join(',');
    return sortedLabels ? `${name}{${sortedLabels}}` : name;
  }

  /**
   * Get all metrics as Prometheus text format
   */
  toPrometheusFormat() {
    const lines = [];

    // Counters
    for (const [_, metric] of this.counters) {
      const labels = this._formatLabels(metric.labels);
      lines.push(`${metric.name}${labels} ${metric.value}`);
    }

    // Gauges
    for (const [_, metric] of this.gauges) {
      const labels = this._formatLabels(metric.labels);
      lines.push(`${metric.name}${labels} ${metric.value}`);
    }

    // Histograms
    for (const [_, histogram] of this.histograms) {
      const labels = this._formatLabels(histogram.labels);
      lines.push(`${histogram.name}_count${labels} ${histogram.count}`);
      lines.push(`${histogram.name}_sum${labels} ${histogram.sum}`);
      
      for (const [boundary, count] of histogram.buckets) {
        const bucketLabels = this._formatLabels({ ...histogram.labels, le: boundary });
        lines.push(`${histogram.name}_bucket${bucketLabels} ${count}`);
      }
      
      const infLabels = this._formatLabels({ ...histogram.labels, le: '+Inf' });
      lines.push(`${histogram.name}_bucket${infLabels} ${histogram.count}`);
    }

    // Add uptime
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    lines.push(`process_uptime_seconds ${uptime}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Get all metrics as JSON
   */
  toJSON() {
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: Array.from(this.histograms.entries()).map(([_, h]) => ({
        name: h.name,
        labels: h.labels,
        count: h.count,
        sum: h.sum,
        min: h.min,
        max: h.max,
        avg: h.count > 0 ? h.sum / h.count : 0,
        buckets: Object.fromEntries(h.buckets)
      }))
    };
  }

  /**
   * Format labels for Prometheus
   */
  _formatLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) return '';
    
    const pairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
    
    return `{${pairs.join(',')}}`;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Get summary stats
   */
  getSummary() {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      uptime: Date.now() - this.startTime
    };
  }
}

// Create default metrics instance
export const metrics = new MetricsCollector();

// Bot-specific metric names
export const MetricNames = {
  // Commands
  COMMAND_RECEIVED: 'bot_commands_received_total',
  COMMAND_DURATION: 'bot_command_duration_ms',
  COMMAND_ERRORS: 'bot_command_errors_total',
  
  // Callbacks
  CALLBACK_RECEIVED: 'bot_callbacks_received_total',
  CALLBACK_DURATION: 'bot_callback_duration_ms',
  CALLBACK_ERRORS: 'bot_callback_errors_total',
  
  // Messages
  MESSAGE_RECEIVED: 'bot_messages_received_total',
  MESSAGE_SENT: 'bot_messages_sent_total',
  
  // Payments
  PAYMENT_CREATED: 'bot_payments_created_total',
  PAYMENT_SUCCESS: 'bot_payments_success_total',
  PAYMENT_FAILED: 'bot_payments_failed_total',
  
  // Products
  PRODUCT_VIEWS: 'bot_product_views_total',
  PRODUCT_PURCHASES: 'bot_product_purchases_total',
  
  // Webhooks
  WEBHOOK_RECEIVED: 'bot_webhooks_received_total',
  WEBHOOK_DURATION: 'bot_webhook_duration_ms',
  WEBHOOK_ERRORS: 'bot_webhook_errors_total',
  
  // Rate limiting
  RATE_LIMIT_HITS: 'bot_rate_limit_hits_total',
  
  // Active users
  ACTIVE_USERS: 'bot_active_users',
  
  // HTTP
  HTTP_REQUESTS: 'http_requests_total',
  HTTP_DURATION: 'http_request_duration_ms',
  HTTP_ERRORS: 'http_errors_total'
};

/**
 * Middleware for tracking command metrics
 */
export function createCommandMetricsMiddleware() {
  return async (ctx, next) => {
    const command = ctx.message?.text?.split(' ')[0]?.replace('/', '') || 'unknown';
    const endTimer = metrics.startTimer(MetricNames.COMMAND_DURATION, { command });
    
    metrics.incCounter(MetricNames.COMMAND_RECEIVED, { command });
    
    try {
      await next();
    } catch (error) {
      metrics.incCounter(MetricNames.COMMAND_ERRORS, { command, error: error.name });
      throw error;
    } finally {
      endTimer();
    }
  };
}

/**
 * Middleware for tracking callback metrics
 */
export function createCallbackMetricsMiddleware() {
  return async (ctx, next) => {
    const action = ctx.callbackQuery?.data?.split(':')[0] || 'unknown';
    const endTimer = metrics.startTimer(MetricNames.CALLBACK_DURATION, { action });
    
    metrics.incCounter(MetricNames.CALLBACK_RECEIVED, { action });
    
    try {
      await next();
    } catch (error) {
      metrics.incCounter(MetricNames.CALLBACK_ERRORS, { action, error: error.name });
      throw error;
    } finally {
      endTimer();
    }
  };
}

/**
 * Express middleware for HTTP metrics
 */
export function createHttpMetricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    const route = req.path;
    
    metrics.incCounter(MetricNames.HTTP_REQUESTS, { method: req.method, route });
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      metrics.observe(MetricNames.HTTP_DURATION, { 
        method: req.method, 
        route, 
        status: res.statusCode 
      }, duration);
      
      if (res.statusCode >= 400) {
        metrics.incCounter(MetricNames.HTTP_ERRORS, { 
          method: req.method, 
          route, 
          status: res.statusCode 
        });
      }
    });
    
    next();
  };
}

export default MetricsCollector;
