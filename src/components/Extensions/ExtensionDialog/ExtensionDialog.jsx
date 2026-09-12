/**
 * ExtensionDialog Component
 * Re-exports the shared ExtensionBridge component for use in Extensions screen
 *
 * This ensures all extension editing (DIDs, Users, Extensions list) uses the same component.
 */
export { ExtensionBridge as default, ExtensionBridge } from '../../Bridges/ExtensionBridge/ExtensionBridge';
