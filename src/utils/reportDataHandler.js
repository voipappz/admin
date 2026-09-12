/**
 * Report Data Structure Handler
 * 
 * This utility handles different report data structures dynamically
 * and provides a consistent interface for the Reports component.
 */

export class ReportDataHandler {
  constructor(reportData, rawDataArray = null) {
    this.rawData = reportData;
    this.rawDataArray = rawDataArray; // Allow passing data array separately
    this.structure = this.analyzeStructure(reportData, rawDataArray);
  }

  analyzeStructure(data) {
    if (!data) {
      return null;
    }

    const structure = {
      type: data.type || 'unknown',
      hasTable: !!data.table,
      hasDirectData: !!data.data,
      hasDirectFields: !!data.fields,
      dataLocation: null,
      fieldsLocation: null,
      dataArray: [],
      fieldsArray: []
    };



    // Determine where the actual data is located
    if (data.table && data.table.data && Array.isArray(data.table.data)) {
      structure.dataLocation = 'table.data';
      structure.dataArray = data.table.data;
    } else if (data.data && Array.isArray(data.data)) {
      structure.dataLocation = 'data';
      structure.dataArray = data.data;
    }

    // Determine where the fields definition is located
    if (data.table && data.table.fields && Array.isArray(data.table.fields)) {
      structure.fieldsLocation = 'table.fields';
      structure.fieldsArray = data.table.fields;
    } else if (data.fields && Array.isArray(data.fields)) {
      structure.fieldsLocation = 'fields';
      structure.fieldsArray = data.fields;
    }

    // Analyze data structure patterns
    if (structure.dataArray.length > 0) {
      const sampleRow = structure.dataArray[0];
      structure.fieldPatterns = this.analyzeFieldPatterns(sampleRow);
    }
    return structure;
  }

  analyzeFieldPatterns(sampleRow) {
    const patterns = {};
    
    Object.keys(sampleRow).forEach(key => {
      const value = sampleRow[key];
      patterns[key] = {
        type: typeof value,
        isNested: this.isNestedDataStructure(value),
        hasDataProperty: value && typeof value === 'object' && 'data' in value,
        hasColorProperty: value && typeof value === 'object' && 'color' in value,
        hasMethodProperty: value && typeof value === 'object' && 'method' in value,
        hasParamsProperty: value && typeof value === 'object' && 'params' in value,
        hasIconProperty: value && typeof value === 'object' && 'icon' in value,
        extractionMethod: this.getExtractionMethod(value)
      };
    });

    return patterns;
  }

  isNestedDataStructure(value) {
    return value && 
           typeof value === 'object' && 
           value !== null && 
           'data' in value;
  }

  getExtractionMethod(value) {
    if (this.isNestedDataStructure(value)) {
      return 'nested'; // Extract from .data property
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return 'direct'; // Use value directly
    } else if (value === null || value === undefined) {
      return 'empty'; // Handle empty values
    } else {
      return 'stringify'; // Convert to string
    }
  }

  /**
   * Get processed fields for column definitions
   */
  getFields() {
    const fields = [];

    // Priority 1: Use defined fields if available
    if (this.structure.fieldsArray.length > 0) {
      return this.structure.fieldsArray.map(field => ({
        key: field.field || field.key || field.name,
        name: field.name || this.generateHeaderName(field.field || field.key || field.name),
        type: field.type || 'string'
      }));
    }

    // Priority 2: Derive fields from data structure
    if (this.structure.fieldPatterns) {
      return Object.keys(this.structure.fieldPatterns).map(key => ({
        key: key,
        name: this.generateHeaderName(key),
        type: this.structure.fieldPatterns[key].type,
        pattern: this.structure.fieldPatterns[key]
      }));
    }

    return fields;
  }

  /**
   * Get processed rows for table display
   */
  getRows() {
    if (!this.structure.dataArray || this.structure.dataArray.length === 0) {
      return [];
    }

    const processedRows = this.structure.dataArray.map((row, index) => {
      const processedRow = { id: index };

      Object.keys(row).forEach(key => {
        const value = row[key];
        const pattern = this.structure.fieldPatterns?.[key];

        processedRow[key] = this.extractValue(value, pattern);
      });

      return processedRow;
    });


    
    return processedRows;
  }

  /**
   * Extract value based on the field pattern
   */
  extractValue(value, pattern) {
    if (!pattern) {
      // Fallback: try to detect structure on the fly
      if (this.isNestedDataStructure(value)) {
        return value.data;
      }
      return value;
    }

    switch (pattern.extractionMethod) {
      case 'nested':
        return value?.data ?? '';
      case 'direct':
        return value;
      case 'empty':
        return '';
      case 'stringify':
        return String(value);
      default:
        return value;
    }
  }

  /**
   * Generate a readable header name from a field key
   */
  generateHeaderName(key) {
    if (!key) return 'Unknown';
    
    return key
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
      .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
  }

  /**
   * Get summary information about the data structure
   */
  getSummary() {
    return {
      totalRows: this.structure.dataArray.length,
      totalFields: this.getFields().length,
      dataLocation: this.structure.dataLocation,
      fieldsLocation: this.structure.fieldsLocation,
      type: this.structure.type,
      hasNestedData: Object.values(this.structure.fieldPatterns || {})
        .some(pattern => pattern.isNested),
      fieldPatterns: this.structure.fieldPatterns
    };
  }

  /**
   * Detect column data types (Blazer-style)
   * Returns array of types: 'time', 'numeric', 'string', or null
   */
  detectColumnTypes() {
    const fields = this.getFields();
    const rows = this.getRows();

    if (fields.length === 0 || rows.length === 0) {
      return [];
    }

    return fields.map(field => {
      // Find first non-null value for this column
      const sampleRow = rows.find(row => row[field.key] != null);
      const value = sampleRow?.[field.key];

      if (value == null) {
        return null;
      }

      // Check if it's a time/date value
      if (this.isTimeValue(value)) {
        return 'time';
      }

      // Check if it's numeric
      if (this.isNumericValue(value)) {
        return 'numeric';
      }

      // Default to string
      return 'string';
    });
  }

  /**
   * Check if a value is a time/date value
   */
  isTimeValue(value) {
    if (value instanceof Date) {
      return true;
    }

    if (typeof value === 'string') {
      // Check for common date patterns
      // ISO format: 2024-01-15T10:30:00
      // Date only: 2024-01-15
      // Unix timestamp as string
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}/, // ISO date
        /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY
      ];

      if (datePatterns.some(pattern => pattern.test(value))) {
        const parsed = Date.parse(value);
        return !isNaN(parsed);
      }
    }

    // Check for Unix timestamps (numbers representing time)
    if (typeof value === 'number' && value > 1000000000 && value < 2000000000000) {
      // Looks like a Unix timestamp (seconds or milliseconds)
      return true;
    }

    return false;
  }

  /**
   * Check if a value is numeric
   */
  isNumericValue(value) {
    if (typeof value === 'number' && !isNaN(value)) {
      // Exclude likely timestamps
      if (value > 1000000000 && value < 2000000000000) {
        return false; // Likely a timestamp
      }
      return true;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Check if it's a numeric string (including decimals)
      const numericPattern = /^-?\d+(\.\d+)?$/;
      return numericPattern.test(trimmed);
    }

    return false;
  }

  /**
   * Detect chart type based on column patterns (Blazer-style)
   *
   * Patterns:
   * - [time, numeric+] -> 'line'
   * - [time, string, numeric] -> 'line2' (multi-series line)
   * - [string, numeric+] -> 'bar'
   * - [string, string, numeric] -> 'bar2' (grouped bar)
   * - [string, numeric] with column named 'pie' -> 'pie'
   * - [numeric, numeric] -> 'scatter'
   * - Default -> 'table'
   */
  detectChartType() {
    const fields = this.getFields();
    const fieldNames = fields.map(field => String(field.key).toLowerCase());

    // The API detects from native SQL values before it stringifies/wraps cells,
    // so it is authoritative when present. The local detector remains for old
    // responses and direct-data callers.
    const serverChart = this.rawData?.chart || this.rawData?.table?.chart;
    if (['line', 'bar', 'pie', 'scatter', 'map', 'table'].includes(serverChart)) {
      return serverChart;
    }

    // Geographic reports are defined by their column names and can therefore
    // keep map view even for an empty result set.
    const hasLongitude = ['longitude', 'lon', 'lng'].some(name => fieldNames.includes(name));
    if (fieldNames.includes('geojson') ||
        ((fieldNames.includes('latitude') || fieldNames.includes('lat')) && hasLongitude)) {
      return 'map';
    }

    const columnTypes = this.detectColumnTypes();

    if (columnTypes.length < 2) {
      return 'table';
    }

    // Filter out null types
    const compactTypes = columnTypes.filter(t => t !== null);

    if (compactTypes.length < 2) {
      return 'table';
    }

    // Check for pie chart (last column named 'pie')
    if (columnTypes.length === 2 &&
        columnTypes[0] === 'string' &&
        columnTypes[1] === 'numeric') {
      const lastField = fields[fields.length - 1];
      if (lastField && lastField.key.toLowerCase() === 'pie') {
        return 'pie';
      }
    }

    // [time, numeric+] -> line chart
    if (compactTypes[0] === 'time' &&
        compactTypes.slice(1).every(t => t === 'numeric')) {
      return 'line';
    }

    // [time, string, numeric] -> multi-series line
    if (compactTypes.length === 3 &&
        compactTypes[0] === 'time' &&
        compactTypes[1] === 'string' &&
        compactTypes[2] === 'numeric') {
      return 'line2';
    }

    // [string, numeric+] -> bar chart
    if (compactTypes[0] === 'string' &&
        compactTypes.slice(1).every(t => t === 'numeric')) {
      return 'bar';
    }

    // [string, string, numeric] -> grouped bar
    if (compactTypes.length === 3 &&
        compactTypes[0] === 'string' &&
        compactTypes[1] === 'string' &&
        compactTypes[2] === 'numeric') {
      return 'bar2';
    }

    // [numeric, numeric] -> scatter
    if (compactTypes.length === 2 &&
        compactTypes.every(t => t === 'numeric')) {
      return 'scatter';
    }

    return 'table';
  }

  /**
   * Get chart type suggestion with explanation
   */
  getChartSuggestion() {
    const chartType = this.detectChartType();
    const columnTypes = this.detectColumnTypes();
    const fields = this.getFields();

    const typeDescriptions = {
      line: 'Line chart recommended for time-series data',
      line2: 'Multi-series line chart recommended for grouped time-series',
      bar: 'Bar chart recommended for categorical comparisons',
      bar2: 'Grouped bar chart recommended for multi-category comparisons',
      pie: 'Pie chart recommended for part-to-whole relationships',
      scatter: 'Scatter plot recommended for correlation analysis',
      map: 'Geographic map recommended for latitude/longitude or GeoJSON data',
      table: 'Table view recommended for this data structure'
    };

    return {
      chartType,
      description: typeDescriptions[chartType] || 'Table view',
      columnTypes: fields.map((field, i) => ({
        name: field.name,
        key: field.key,
        detectedType: columnTypes[i]
      }))
    };
  }

  /**
   * Static method to create handler from report data
   */
  static fromReportData(reportData) {
    return new ReportDataHandler(reportData);
  }
}

export default ReportDataHandler;
