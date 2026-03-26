import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { db } from '../config/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

export interface WebDataRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  retries?: number;
}

export interface WebDataResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timestamp: Date;
  source: 'web' | 'cache';
}

export interface DataCollectionConfig {
  enableCaching?: boolean;
  cacheTimeout?: number; // in milliseconds
  enableLogging?: boolean;
  enableRetries?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

class WebDataService {
  private axiosInstance: AxiosInstance;
  private config: DataCollectionConfig;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  constructor(config: DataCollectionConfig = {}) {
    this.config = {
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes default
      enableLogging: true,
      enableRetries: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.cache = new Map();

    this.axiosInstance = axios.create({
      timeout: 30000, // 30 seconds default timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CobyPicks-WebDataCollector/1.0'
      }
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.config.enableLogging) {
          console.log(`[WebDataService] Making request to: ${config.url}`);
        }
        return config;
      },
      (error) => {
        console.error('[WebDataService] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        if (this.config.enableLogging) {
          console.log(`[WebDataService] Response from ${response.config.url}: ${response.status}`);
        }
        return response;
      },
      (error) => {
        console.error('[WebDataService] Response error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch data from web with caching and retry logic
   */
  async fetchData<T = any>(request: WebDataRequest): Promise<WebDataResponse<T>> {
    const cacheKey = this.generateCacheKey(request);
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          data: cached.data,
          status: 200,
          statusText: 'OK',
          headers: {},
          timestamp: new Date(cached.timestamp),
          source: 'cache'
        };
      }
    }

    let lastError: any;
    const maxRetries = this.config.enableRetries ? (this.config.maxRetries || 3) : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const axiosConfig: AxiosRequestConfig = {
          method: request.method || 'GET',
          url: request.url,
          headers: request.headers,
          data: request.data,
          timeout: request.timeout || 30000
        };

        const response: AxiosResponse<T> = await this.axiosInstance.request(axiosConfig);
        
        const result: WebDataResponse<T> = {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers as Record<string, string>,
          timestamp: new Date(),
          source: 'web'
        };

        // Cache the result
        if (this.config.enableCaching && response.status === 200) {
          this.setCache(cacheKey, result.data, this.config.cacheTimeout || 300000);
        }

        // Log successful fetch to Firebase
        if (this.config.enableLogging) {
          await this.logDataCollection({
            url: request.url,
            method: request.method || 'GET',
            status: response.status,
            timestamp: serverTimestamp(),
            attempt,
            success: true
          });
        }

        return result;

      } catch (error: any) {
        lastError = error;
        console.error(`[WebDataService] Attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries) {
          await this.delay(this.config.retryDelay || 1000);
        }
      }
    }

    // Log failed fetch to Firebase
    if (this.config.enableLogging) {
      await this.logDataCollection({
        url: request.url,
        method: request.method || 'GET',
        status: lastError?.response?.status || 0,
        error: lastError?.message || 'Unknown error',
        timestamp: serverTimestamp(),
        attempt: maxRetries,
        success: false
      });
    }

    throw new Error(`Failed to fetch data after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Fetch multiple URLs concurrently
   */
  async fetchMultiple<T = any>(requests: WebDataRequest[]): Promise<Array<WebDataResponse<T> | (WebDataResponse<T> & { error: string })>> {
    const promises = requests.map(request => 
      this.fetchData<T>(request).catch(error => ({
        // Cast to any to satisfy generic constraint; callers must handle error property
        data: null as any,
        status: 0,
        statusText: 'Error',
        headers: {},
        timestamp: new Date(),
        source: 'web' as const,
        error: error.message
      }))
    );

    return Promise.all(promises);
  }

  /**
   * Stream data from a URL (for real-time data)
   */
  async streamData(url: string, onData: (data: any) => void, onError?: (error: any) => void): Promise<void> {
    try {
      const response = await this.axiosInstance.get(url, {
        responseType: 'stream'
      });

      response.data.on('data', (chunk: Buffer) => {
        try {
          const data = JSON.parse(chunk.toString());
          onData(data);
        } catch (error) {
          // Handle non-JSON data
          onData(chunk.toString());
        }
      });

      response.data.on('error', (error: any) => {
        console.error('[WebDataService] Stream error:', error);
        if (onError) onError(error);
      });

    } catch (error) {
      console.error('[WebDataService] Failed to start stream:', error);
      if (onError) onError(error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  private generateCacheKey(request: WebDataRequest): string {
    return `${request.method || 'GET'}_${request.url}_${JSON.stringify(request.data || {})}`;
  }

  private getFromCache(key: string): { data: any; timestamp: number } | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return { data: cached.data, timestamp: cached.timestamp };
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async logDataCollection(logData: any): Promise<void> {
    try {
      await addDoc(collection(db, 'webDataLogs'), logData);
    } catch (error) {
      console.error('[WebDataService] Failed to log data collection:', error);
    }
  }
}

// Export singleton instance
export const webDataService = new WebDataService({
  enableCaching: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  enableLogging: true,
  enableRetries: true,
  maxRetries: 3,
  retryDelay: 1000
});

export default WebDataService;
