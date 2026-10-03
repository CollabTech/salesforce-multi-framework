/** Public interface of the SMF-11 markup library (SMF-12 builds on it). */
import { selectFilesTransport, type FilesTransport } from '../../files/lib';
import { createFilesMarkupApi } from './filesMarkupApi';
import type { MarkupApi } from './markupApi';
import { createSalesforceMarkupApi } from './salesforceMarkupApi';

export * from './markupApi';
export * from './document';
export * from './license';
export { createFilesMarkupApi } from './filesMarkupApi';
export { createSalesforceMarkupApi } from './salesforceMarkupApi';

/** Markup API matching the Files transport (mock only on localhost with ?transport=mock). */
export function selectMarkupApi(transport: FilesTransport = selectFilesTransport()): MarkupApi {
  return transport.kind === 'mock' ? createFilesMarkupApi(transport) : createSalesforceMarkupApi(transport);
}
