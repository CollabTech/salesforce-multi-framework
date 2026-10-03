/**
 * Chooses the Files transport. The mock is available only on a localhost origin with
 * ?transport=mock, so a deployed Salesforce build can never silently run against it.
 */
import { createMockTransport, type MockFault, type MockTransport } from './mockTransport';
import { salesforceTransport } from './salesforceTransport';
import type { FilesTransport } from './transport';

const MOCK_FAULTS: MockFault[] = ['upload-fail-once', 'link-fail-once', 'link-lost-once'];

export function isLocalhostOrigin(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

let mockSingleton: MockTransport | null = null;

declare global {
  interface Window {
    __SMF_MOCK_FILES__?: MockTransport;
  }
}

export function parseFaults(value: string | null): MockFault[] {
  if (!value) return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter((v): v is MockFault => (MOCK_FAULTS as string[]).includes(v));
}

export function selectFilesTransport(win: Window = window): FilesTransport {
  const params = new URLSearchParams(win.location.search);
  if (params.get('transport') === 'mock' && isLocalhostOrigin(win.location.hostname)) {
    if (!mockSingleton) {
      mockSingleton = createMockTransport({ faults: parseFaults(params.get('faults')) });
      win.__SMF_MOCK_FILES__ = mockSingleton;
    }
    return mockSingleton;
  }
  return salesforceTransport;
}
