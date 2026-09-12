/**
 * Form validation utilities for handling both client-side and server-side validation
 */

/**
 * Parse server-side 406 validation errors into field-specific errors
 *
 * Server returns errors in format:
 * { id: "not_acceptable", message: "name is not present, email is invalid" }
 *
 * This function parses the message and returns an object with field-specific errors:
 * { name: "is not present", email: "is invalid" }
 *
 * @param {Object|string} error - The error response from the server
 * @returns {Object} - Object with field names as keys and error messages as values
 */
export const parseServerErrors = (error) => {
  const fieldErrors = {};

  // Extract message from various error formats
  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error?.response?.data?.message) {
    message = error.response.data.message;
  } else if (error?.message) {
    message = error.message;
  } else if (error?.data?.message) {
    message = error.data.message;
  }

  if (!message) return fieldErrors;

  // Known field names that might appear in error messages
  const knownFields = [
    'name', 'email', 'password', 'environment_uuid', 'environment',
    'acl_uuid', 'acl', 'status_uuid', 'status', 'tariff_uuid', 'tariff',
    'plan_uuid', 'plan', 'subscription_uuid', 'subscription',
    'number', 'bridge_type', 'bridge_uuid', 'enabled', 'balance',
    'type', 'scheme', 'period', 'interval', 'description', 'notes',
    'username', 'caller_id_number', 'caller_id_name',
    'announcement_uuid', 'announcement', 'ivr_uuid', 'ivr',
    'queue_uuid', 'queue', 'extension_uuid', 'extension',
    'call_condition_uuid', 'call_condition', 'vml_uuid', 'vml',
    'customer_uuid', 'customer', 'resources'
  ];

  // Split by comma to handle multiple errors
  const errorParts = message.split(',').map(part => part.trim());

  for (const part of errorParts) {
    // Try to match known field patterns
    // Pattern: "<field> <error message>" e.g., "name is not present"
    for (const field of knownFields) {
      const fieldPattern = new RegExp(`^${field}\\s+(.+)$`, 'i');
      const match = part.match(fieldPattern);
      if (match) {
        fieldErrors[field] = match[1];
        break;
      }

      // Also check for patterns like "field: error message"
      const colonPattern = new RegExp(`^${field}:\\s*(.+)$`, 'i');
      const colonMatch = part.match(colonPattern);
      if (colonMatch) {
        fieldErrors[field] = colonMatch[1];
        break;
      }
    }
  }

  return fieldErrors;
};

/**
 * Merge client-side errors with server-side errors
 * Server errors take precedence for the same field
 *
 * @param {Object} clientErrors - Client-side validation errors
 * @param {Object} serverErrors - Server-side validation errors
 * @returns {Object} - Merged errors object
 */
export const mergeErrors = (clientErrors, serverErrors) => {
  return { ...clientErrors, ...serverErrors };
};

/**
 * Check if error response is a 406 validation error
 *
 * @param {Object} error - Error object from API call
 * @returns {boolean} - True if it's a 406 validation error
 */
export const is406Error = (error) => {
  const status = error?.response?.status || error?.status;
  const id = error?.response?.data?.id || error?.data?.id || error?.id;
  return status === 406 || id === 'not_acceptable';
};

/**
 * Get human-readable error message for a field
 * Capitalizes field name and formats the error nicely
 *
 * @param {string} field - Field name
 * @param {string} errorMessage - Raw error message
 * @returns {string} - Formatted error message
 */
export const formatFieldError = (field, errorMessage) => {
  // Convert field_name to Field Name
  const fieldLabel = field
    .replace(/_uuid$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return `${fieldLabel} ${errorMessage}`;
};

/**
 * Standard required fields validation for common entities
 */
export const requiredFields = {
  user: ['name', 'email', 'environment_uuid'],
  environment: ['name'],
  provider: ['name', 'environment_uuid'],
  subscription: ['name', 'environment_uuid'],
  did: ['number', 'environment_uuid'],
  ivr: ['name', 'environment_uuid', 'announcement_uuid'],
  queue: ['name', 'environment_uuid'],
  account: ['name', 'email', 'acl_uuid'],
  acl: ['name', 'type'],
  plan: ['name'],
  tariff: ['name', 'scheme']
};

/**
 * Validate required fields for an entity
 *
 * @param {string} entityType - Type of entity (user, environment, etc.)
 * @param {Object} formData - Form data to validate
 * @param {Object} options - Additional options (isEdit, etc.)
 * @returns {Object} - Validation errors object
 */
export const validateRequiredFields = (entityType, formData, options = {}) => {
  const errors = {};
  const required = requiredFields[entityType] || [];

  for (const field of required) {
    const value = formData[field];
    if (value === undefined || value === null || value === '' ||
        (typeof value === 'string' && !value.trim())) {
      const fieldLabel = field
        .replace(/_uuid$/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      errors[field] = `${fieldLabel} is required`;
    }
  }

  // Special case: password required for new users
  if (entityType === 'user' && !options.isEdit && !formData.password) {
    errors.password = 'Password is required for new users';
  }

  // Special case: email validation
  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = 'Invalid email format';
  }

  return errors;
};
