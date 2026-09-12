import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { apiService } from '../../services/apiService';
// voipResourcesApi removed - resources are loaded on-demand in EnhancedSchemaForm

/**
 * Parse API error response to extract field-level errors
 * Based on legacy AngularJS pattern from handlerequest.js
 *
 * API error format: {"id":"not_acceptable","message":"field1 is required, field2 is already taken"}
 * Returns: { message: "...", errorsList: { field1: "field1 is required", field2: "field2 is already taken" } }
 */
const parseApiError = (errorMessage) => {
  const result = {
    message: '',
    errorsList: {}
  };

  // Try to extract JSON from the error message (format: "Failed X: HTTP 406: {...}")
  const jsonMatch = errorMessage.match(/\{.*\}/);
  if (jsonMatch) {
    try {
      const errorData = JSON.parse(jsonMatch[0]);
      result.message = errorData.message || errorMessage;

      // Parse comma-separated error messages into field -> error mapping
      // Format: "field1 is required, field2 is already taken"
      if (errorData.message) {
        const messageArr = errorData.message.split(',');
        messageArr.forEach(msg => {
          const trimmedMsg = msg.trim();
          // Extract field name (first word before space)
          const pos = trimmedMsg.indexOf(' ');
          if (pos > 0) {
            const fieldName = trimmedMsg.slice(0, pos);
            result.errorsList[fieldName] = trimmedMsg;
          }
        });
      }
    } catch {
      result.message = errorMessage;
    }
  } else {
    result.message = errorMessage;
  }

  return result;
};

export const useSchema = () => {
  // Get CustomerEnvironment context for refreshing environment list
  const { selectedCustomer, fetchEnvironments: refreshGlobalEnvironments } = useCustomerEnvironment();
  // Schema type and structure state
  const [schemaTypes, setSchemaTypes] = useState([]);
  // Catalog from the API's config/schemas.yaml — null on legacy backends
  const [schemaCatalog, setSchemaCatalog] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [schemaStructure, setSchemaStructure] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');

  // Form state
  const [currentEntry, setCurrentEntry] = useState({
    name: ''
  });

  const [customerList, setCustomerList] = useState([]);
  const [createdSchemas, setCreatedSchemas] = useState([]);
  const [loading, setLoading] = useState(false);
  // Error state now includes both message and field-level errors (like old admin ApiErrors)
  const [error, setError] = useState(null);
  const [errorsList, setErrorsList] = useState({});
  const [success, setSuccess] = useState(null);

  const { access } = useAuth();

  // Fetch the schema catalog (config/schemas.yaml on the API, served by
  // /api/schemas?action=catalog as [{category, schemas: [{name, label,
  // description, fields, example}]}]). Falls back to the legacy flat
  // action=types list on backends that don't serve the catalog yet.
  const fetchSchemaTypes = async () => {
    try {
      const catalog = await apiService.get(`/api/schemas?action=catalog`, {}, 'fetching schema catalog', false);
      // Older backends fall through action=catalog to the schema search and
      // return schema records — only accept a real catalog shape.
      const isCatalog = Array.isArray(catalog) && catalog.length > 0 &&
        catalog.every((c) => c && typeof c === 'object' && 'category' in c && Array.isArray(c.schemas));
      if (isCatalog) {
        setSchemaCatalog(catalog);
        const types = catalog.flatMap((c) => c.schemas.map((s) => s.name));
        setSchemaTypes(types);
        return types;
      }
    } catch (err) {
      console.warn('Schema catalog unavailable, falling back to action=types:', err?.message);
    }
    try {
      const types = await apiService.get(`/api/schemas?action=types`, {}, 'fetching schema types', false);
      setSchemaCatalog(null);
      setSchemaTypes(types || []);
      return types;
    } catch (err) {
      console.error('Error fetching schema types:', err);
      setSchemaTypes([]);
      setError(`Failed to load schema types: ${err.message}`);
      return [];
    }
  };

  // Fetch environments
  const fetchEnvironments = async () => {
    try {
      const response = await fetch(`/api/schemas?type=environment`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch environments: ${response.status}`);
      }

      const envs = await response.json();
      setEnvironments(Array.isArray(envs) ? envs : []);
      return envs;
    } catch (err) {
      console.error('Error fetching environments:', err);
      setEnvironments([]); // Ensure environments is always an array
      setError(`Failed to load applications: ${err.message}`);
      return [];
    }
  };

  // Build a form structure from a catalog entry's YAML fields
  // ({key,type,required,default,options,help} → the vml-style field shape the
  // form renders). Used when the server has no ?type=X structure mediator.
  const structureFromCatalog = (type) => {
    const entry = (schemaCatalog || [])
      .flatMap((c) => c.schemas)
      .find((s) => s.name === type);
    if (!entry || !Array.isArray(entry.fields) || entry.fields.length === 0) return null;
    const inputOf = (t) => (
      t === 'select' ? 'select' :
      t === 'number' ? 'numeric' :
      t === 'textarea' ? 'textarea' :
      // add-your-own key/value rows (meta); the form posts <section>[i][meta][k]
      t === 'keyvalue' ? 'keyvalue' :
      'string'
    );
    // The section key is the one the API reads, which the catalog states in its
    // example payload (sms -> "vml", extension -> "extension"). Keying by the
    // type name instead posted sms[0][...] for an SMS schema, which
    // Schema::Create cannot see at all — it reads data['vml'].
    const sectionKey = Object.keys(entry.example || {})
      .find((k) => !['environment_name', 'profile'].includes(k)) || type;
    return {
      [sectionKey]: {
        fields: entry.fields.map((f) => ({
          name: (f.key || '').replace(/_/g, ' '),
          key: f.key,
          value: f.type === 'keyvalue' ? (f.default ?? {}) : (f.default != null ? String(f.default) : ''),
          input: inputOf(f.type),
          notes: f.help || '',
          required: f.required === true,
          ...(Array.isArray(f.options) ? { select_options: f.options } : {}),
        })),
      },
    };
  };

  // Fetch schema structure for selected type
  const fetchSchemaStructure = async (type, environmentUuid = '') => {
    try {
      setLoading(true);
      let url = `/api/schemas?type=${type}`;
      if (environmentUuid) {
        url += `&environment_uuid=${environmentUuid}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schema structure: ${response.status}`);
      }

      const structure = await response.json();
      setSchemaStructure(structure);
      
      // Reset form when type changes - initialize with fields from structure
      const fields = { name: '' }; // Always include name field
      if (structure && structure.vml && structure.vml.fields) {
        structure.vml.fields.forEach(field => {
          fields[field.key] = field.value || '';
        });
      }
      setCurrentEntry(fields);

      return structure;
    } catch (err) {
      // No server-side structure for this type — fall back to the catalog's
      // YAML field definitions so YAML-only types are still creatable.
      const fromCatalog = structureFromCatalog(type);
      if (fromCatalog) {
        setSchemaStructure(fromCatalog);
        const fields = { name: '' };
        fromCatalog[type].fields.forEach(field => { fields[field.key] = field.value || ''; });
        setCurrentEntry(fields);
        return fromCatalog;
      }
      console.error('Error fetching schema structure:', err);
      setSchemaStructure(null);
      setCurrentEntry({ name: '' });
      setError(`Failed to load schema structure: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Handle schema type change
  const handleTypeChange = async (newType) => {
    setSelectedType(newType);
    await fetchSchemaStructure(newType, selectedEnvironment);
  };

  // Handle environment change  
  const handleEnvironmentChange = async (envUuid) => {
    setSelectedEnvironment(envUuid);
    if (selectedType !== 'sms') {
      await fetchSchemaStructure(selectedType, envUuid);
    }
  };

  // Add current entry to the list
  const addToList = () => {
    if (!currentEntry.name) {
      setError('Schema name is required');
      return;
    }

    setCustomerList(prev => [...prev, { ...currentEntry }]);
    clearInputs();
    setError(null);
    setSuccess('Entry added to list successfully!');

    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(null), 3000);
  };

  // Add a pre-built flat entry object directly (avoids setCurrentEntry → addToList timing issue)
  const addEntry = (entryData) => {
    setCustomerList(prev => [...prev, { ...entryData }]);
  };

  // Clear current input fields
  const clearInputs = () => {
    const fields = { name: '' }; // Always include name field
    if (schemaStructure && schemaStructure.vml && schemaStructure.vml.fields) {
      schemaStructure.vml.fields.forEach(field => {
        fields[field.key] = field.value || '';
      });
    }
    setCurrentEntry(fields);
  };

  // Clear the entire customer list
  const clearList = () => {
    setCustomerList([]);
    setError(null);
  };

  // Parse CSV content
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const customers = [];

    // Validate that name header exists
    if (!headers.includes('name')) {
      throw new Error('Missing required CSV column: name');
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      if (values.length !== headers.length) continue;

      const customer = {};
      headers.forEach((header, index) => {
        customer[header] = values[index] || '';
      });

      // Ensure required fields exist
      if (customer.name) {
        customers.push(customer);
      }
    }

    return customers;
  };

  // Upload and process CSV file
  const uploadCSV = async (file) => {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const text = await file.text();
      const customers = parseCSV(text);
      
      if (customers.length === 0) {
        throw new Error('No valid customer records found in CSV');
      }

      setCustomerList(prev => [...prev, ...customers]);
      setSuccess(`${customers.length} entries imported from CSV successfully!`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);

    } catch (err) {
      console.error('CSV upload error:', err);
      setError(`CSV upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Alternative: Upload CSV to server for processing
  const uploadCSVToServer = async (file) => {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/schemas/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error: ${response.status}. ${errorData}`);
      }

      const result = await response.json();
      setSuccess(`CSV uploaded successfully! Job ID: ${result.jid}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);

    } catch (err) {
      console.error('CSV upload to server failed:', err);
      setError(`CSV upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create a single schema (used by DynamicSchemaForm)
  const createSingleSchema = async (entryData) => {
    const environmentName = entryData?.environment_name || entryData?.name;

    if (!environmentName) {
      setError('Application name is required');
      return null;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Create URLSearchParams following AngularJS pattern (API requires x-www-form-urlencoded)
      // Use section keys matching schema type (e.g., extension[0][...] for extension)
      const formData = new URLSearchParams();
      formData.append('type', selectedType);
      formData.append('environment_name', environmentName);

      // Get the section key - typically matches the schema type
      // or is the first writable section from schemaStructure
      const sectionKey = selectedType.toLowerCase();

      // Add all entry data fields using the correct section key
      // Pattern: extension[0][username], extension[0][name], etc.
      Object.entries(entryData).forEach(([fieldKey, value]) => {
        // Skip environment_name since we already added it above
        if (fieldKey === 'environment_name' || fieldKey === 'name') return;
        if (value !== undefined && value !== null && value !== '') {
          formData.append(`${sectionKey}[0][${fieldKey}]`, value);
        }
      });

      // Use extended timeout (180 seconds) for schema creation to avoid timeouts
      const result = await apiService.post(
        `/api/schemas`,
        formData,
        { timeout: 180000 }, // 3 minutes timeout for schema creation
        `creating ${selectedType}`
      );

      setSuccess(`✅ ${selectedType} created successfully!`);
      setTimeout(() => setSuccess(null), 5000);

      // If we just created an environment, refresh the global environment list
      if (selectedType === 'environment' && refreshGlobalEnvironments && selectedCustomer) {
        console.log('Refreshing global environments after creating environment schema');
        await refreshGlobalEnvironments(selectedCustomer.uuid);
      }

      // Clear the form
      clearInputs();

      return result;

    } catch (err) {
      console.error(`Failed to create ${selectedType}:`, err);
      // Parse API error to extract field-level errors (like old admin ApiErrors)
      const parsedError = parseApiError(err.message);
      setError(parsedError.message);
      setErrorsList(parsedError.errorsList);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Clear errors helper
  const clearErrors = () => {
    setError(null);
    setErrorsList({});
  };

  // Create all schemas in the list (batch mode)
  const createAllSchemas = async () => {
    if (customerList.length === 0) {
      setError('No customers in the list to create');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const results = [];
    const errors = [];

    // Get the section key - typically matches the schema type
    const sectionKey = selectedType.toLowerCase();

    try {
      for (let i = 0; i < customerList.length; i++) {
        const customer = customerList[i];

        try {
          // Create URLSearchParams for this customer (API requires x-www-form-urlencoded)
          // Following AngularJS pattern: type + environment + section data
          const formData = new URLSearchParams();
          formData.append('type', selectedType);
          formData.append('environment_name', customer.name); // Use name as environment_name

          // Add environment UUID if selected
          if (selectedEnvironment) {
            formData.append('environment_uuid', selectedEnvironment);
          }

          // Add data using correct section key (e.g., extension[0][...] for extension)
          // instead of always using vml[0][...]
          const schemaFields = schemaStructure?.[sectionKey]?.fields || schemaStructure?.vml?.fields || [];
          schemaFields.forEach((field) => {
            const fieldKey = field.key || field.name;
            const fieldValue = customer[fieldKey] || field.value || '';
            formData.append(`${sectionKey}[0][${fieldKey}]`, fieldValue);
          });

          // Use extended timeout (180 seconds) for schema creation to avoid timeouts
          const result = await apiService.post(
            `/api/schemas`,
            formData,
            { timeout: 180000 }, // 3 minutes timeout for schema creation
            `creating schema for ${customer.name}`
          );

          results.push({ ...customer, id: result.id || 'created' });

          // Small delay between requests to avoid overwhelming the server
          if (i < customerList.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (err) {
          console.error(`Failed to create schema for ${customer.name}:`, err);
          // Parse API error to show actual error message
          const parsedError = parseApiError(err.message);
          errors.push(`${customer.name}: ${parsedError.message}`);
        }
      }

      // Update created schemas list
      setCreatedSchemas(prev => [...prev, ...results]);

      // Clear the customer list after successful creation
      setCustomerList([]);

      // If we just created environments, refresh the global environment list
      if (selectedType === 'environment' && results.length > 0 && refreshGlobalEnvironments && selectedCustomer) {
        console.log('Refreshing global environments after batch creating environment schemas');
        await refreshGlobalEnvironments(selectedCustomer.uuid);
      }

      // Show final summary
      if (results.length > 0) {
        const message = `✅ Successfully created ${results.length} ${selectedType} schemas!`;
        setSuccess(errors.length > 0 ? `${message} ${errors.length} failed.` : message);
      }

      if (errors.length > 0) {
        setError(`Failed to create ${errors.length} schemas:\n${errors.join('\n')}`);
      }

    } catch (err) {
      console.error('Batch creation failed:', err);
      setError(`Batch creation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Download creation log
  const downloadLog = () => {
    if (createdSchemas.length === 0) return;

    // Generate dynamic headers based on schema fields
    const sampleSchema = createdSchemas[0];
    const fieldKeys = Object.keys(sampleSchema).filter(key => key !== 'id');
    const headers = [...fieldKeys, 'Status'].join(',');
    
    const csvContent = [
      // Header
      headers,
      // Data rows
      ...createdSchemas.map(schema => {
        const values = fieldKeys.map(key => `"${schema[key] || ''}"`).join(',');
        return `${values},"Created"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedType}_schemas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    // Schema type and structure
    schemaTypes,
    schemaCatalog,
    selectedType,
    schemaStructure,
    environments,
    selectedEnvironment,
    fetchSchemaTypes,
    fetchEnvironments,
    fetchSchemaStructure,
    handleTypeChange,
    handleEnvironmentChange,

    // Form state and actions
    currentEntry,
    setCurrentEntry,
    customerList,
    createdSchemas,
    loading,
    error,
    errorsList,  // Field-level errors like { email: "email is already taken" }
    success,
    addToList,
    addEntry,
    clearInputs,
    clearList,
    clearErrors, // Clear both error and errorsList
    uploadCSV,
    uploadCSVToServer,
    createSingleSchema,  // For single schema creation (DynamicSchemaForm)
    createAllSchemas,    // For batch schema creation (SMSCreator)
    downloadLog
  };
};