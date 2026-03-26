// Global type declarations for polyfills and global variables

declare module 'react-native/Libraries/TurboModule/TurboModuleRegistry' {
  import { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';
  
  export function get<T extends TurboModule>(name: string): T | null;
  export function getEnforcing<T extends TurboModule>(name: string): T;
}

declare global {
  // Extend the global object type
  interface Global {
    RN$Bridgeless?: boolean;
    idb?: {
      openDB: (name: string, version: number, options?: any) => Promise<any>;
      deleteDB: (name: string) => Promise<void>;
      wrap: (db: any) => any;
      unwrap: (db: any) => any;
    };
    'use-latest-callback'?: <T extends (...args: any[]) => any>(callback: T) => T;
  }

  // Extend the NodeJS.Process interface
  namespace NodeJS {
    interface Process {
      env: {
        NODE_ENV?: 'development' | 'production' | 'test';
        [key: string]: string | undefined;
      };
      platform: string;
      versions: {
        node: string;
        [key: string]: string;
      };
      cwd: () => string;
    }
  }

  // Make process available globally
  const process: NodeJS.Process;
  
  // Make Buffer available globally
  interface Buffer extends Uint8Array {
    // Add Buffer methods here as needed
    toString(encoding?: string): string;
  }
  const Buffer: {
    new (str: string, encoding?: string): Buffer;
    from(str: string, encoding?: string): Buffer;
    isBuffer(obj: any): obj is Buffer;
    // Add other Buffer methods as needed
  };
}

export {}; // This file needs to be a module
