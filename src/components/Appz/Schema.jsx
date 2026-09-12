import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Chip
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Upload as UploadIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  AutoFixHigh as AutoFixHighIcon
} from '@mui/icons-material';
import Papa from 'papaparse';
import { useSchema } from './Schema';
import SchemaTypeList from './SchemaTypeList/SchemaTypeList';
import EnhancedSchemaForm from './EnhancedSchemaForm/EnhancedSchemaForm';
import SchemaWizard from './SchemaWizard/SchemaWizard';
import SchemaGallery from './SchemaGallery/SchemaGallery';
import { apiService } from '../../services/apiService';
import { usePermissions } from '../../hooks/usePermissions';
import './Schema.css';

const Schema = () => {
  const { can } = usePermissions();
  const canWrite = can('schemas', 'write');

  // Sidebar visibility state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // CSV Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // Step-by-step wizard (catalog-driven, like the Services "New Service" wizard)
  const [wizardOpen, setWizardOpen] = useState(false);
  // When the wizard is opened from a gallery square, it starts pre-selected on
  // that catalog schema (skips the Type step).
  const [wizardSchema, setWizardSchema] = useState(null);

  const openWizard = (schema = null) => {
    setWizardSchema(schema);
    setWizardOpen(true);
  };
  const [importType, setImportType] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const [csvPreviewData, setCsvPreviewData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const fileInputRef = useRef(null);

  const {
    // Schema type and structure
    schemaTypes,
    schemaCatalog,
    selectedType,
    schemaStructure,
    fetchSchemaTypes,
    handleTypeChange,

    // Form state and actions
    customerList,
    addEntry,
    clearList,
    loading,
    error,
    errorsList,  // Field-level errors like { email: "email is already taken" }
    createdSchemas,
    createAllSchemas,    // For batch schema creation
    uploadCSV,
    downloadLog
  } = useSchema();

  // CSV Import handlers
  const handleOpenImportDialog = () => {
    setImportDialogOpen(true);
    // Auto-select the current schema type if one is selected
    setImportType(selectedType || '');
    setImportFile(null);
    setImportError(null);
    setImportSuccess(null);
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setImportType('');
    setImportFile(null);
    setImportError(null);
    setImportSuccess(null);
    setCsvPreviewData(null);
    setCsvHeaders([]);
    setShowPreview(false);
    setEditingCell(null);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        setImportError('Only CSV files are allowed');
        setImportFile(null);
        setCsvPreviewData(null);
        setCsvHeaders([]);
        setShowPreview(false);
        return;
      }
      setImportFile(file);
      setImportError(null);

      // Parse CSV file for preview
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setImportError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
            setCsvPreviewData(null);
            setCsvHeaders([]);
            setShowPreview(false);
            return;
          }

          // Get headers from first row
          const headers = results.meta.fields || [];
          setCsvHeaders(headers);
          setCsvPreviewData(results.data);
          setShowPreview(true);
          setImportError(null);
        },
        error: (error) => {
          setImportError(`Failed to parse CSV: ${error.message}`);
          setCsvPreviewData(null);
          setCsvHeaders([]);
          setShowPreview(false);
        }
      });
    }
  };

  const handleFileDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        setImportError('Only CSV files are allowed');
        setImportFile(null);
        setCsvPreviewData(null);
        setCsvHeaders([]);
        setShowPreview(false);
        return;
      }
      setImportFile(file);
      setImportError(null);

      // Parse CSV file for preview
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setImportError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
            setCsvPreviewData(null);
            setCsvHeaders([]);
            setShowPreview(false);
            return;
          }

          const headers = results.meta.fields || [];
          setCsvHeaders(headers);
          setCsvPreviewData(results.data);
          setShowPreview(true);
          setImportError(null);
        },
        error: (error) => {
          setImportError(`Failed to parse CSV: ${error.message}`);
          setCsvPreviewData(null);
          setCsvHeaders([]);
          setShowPreview(false);
        }
      });
    }
  };

  // Handle cell editing
  const handleCellEdit = (rowIndex, columnName, newValue) => {
    const updatedData = [...csvPreviewData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      [columnName]: newValue
    };
    setCsvPreviewData(updatedData);
  };

  const handleCellClick = (rowIndex, columnName) => {
    setEditingCell({ row: rowIndex, column: columnName });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleImportSubmit = async () => {
    if (!importType) {
      setImportError('Please select a schema type');
      return;
    }
    if (!importFile && !csvPreviewData) {
      setImportError('Please select a CSV file');
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      let fileToUpload = importFile;

      // If user edited the CSV data, convert it back to a CSV file
      if (csvPreviewData && showPreview) {
        const csvString = Papa.unparse(csvPreviewData, {
          header: true,
          columns: csvHeaders
        });
        const blob = new Blob([csvString], { type: 'text/csv' });
        fileToUpload = new File([blob], importFile.name, { type: 'text/csv' });
      }

      // Create FormData with type and file (matching legacy admin format)
      const formData = new FormData();
      formData.append('type', importType);
      formData.append('file', fileToUpload);

      // Use apiService for consistent authentication and error handling
      const result = await apiService.fetch('/api/schemas/import', {
        method: 'POST',
        body: formData
      }, 'CSV Import', false);

      setImportSuccess(`CSV imported successfully! ${result.message || result.name ? `Schema "${result.name}" created.` : ''}`);

      // Refresh schema types list after import
      fetchSchemaTypes();

      // Close dialog after 2 seconds on success
      setTimeout(() => {
        handleCloseImportDialog();
      }, 2000);

    } catch (err) {
      console.error('CSV import error:', err);
      setImportError(err.message || 'Failed to import CSV');
    } finally {
      setImportLoading(false);
    }
  };
  


  // Initialize schema types on mount (environments fetched on-demand)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await fetchSchemaTypes();
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);


  const renderMainContent = () => {
    // Default landing: the square gallery. Picking a square opens the wizard
    // pre-selected on that type. The sidebar remains for the legacy per-type
    // form (power users / SMS bulk).
    if (!selectedType) {
      return (
        <SchemaGallery
          catalog={schemaCatalog}
          canWrite={canWrite}
          onPick={(schema) => openWizard(schema)}
        />
      );
    }

    // All schema types (including SMS) render with the same EnhancedSchemaForm
    // so every wizard type is visually consistent.
    // For SMS, pass the bulk prop to enable batch creation UX.
    const bulkProps = selectedType === 'sms'
      ? { addEntry, customerList, clearList, uploadCSV, createAllSchemas, downloadLog, createdSchemas }
      : undefined;

    return (
      <EnhancedSchemaForm
        schemaType={selectedType}
        schemaStructure={schemaStructure}
        loading={loading}
        error={error}
        errorsList={errorsList}
        bulk={bulkProps}
        canWrite={canWrite}
      />
    );
  };

  return (
    <Box 
      className="schema-container"
      sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        p: { xs: 1, sm: 2, md: 3 }, 
        gap: 2, 
        height: '100%',
        width: '100%'
      }}
    >
      {/* Schema Type Sidebar with Toggle — always available. The gallery (New
          Schema / squares) opens the step-by-step WIZARD; picking a type here
          opens the classic per-type form (the fast "instant create" way we
          keep alongside the wizard). */}
      <Box sx={{ display: 'flex', flexShrink: 0 }}>
        <Paper
          className="schema-sidebar"
          elevation={3}
          sx={{
            width: sidebarOpen ? { xs: '100%', md: '250px' } : '0px',
            height: { xs: 'auto', md: '100%' },
            maxHeight: { xs: '200px', md: 'none' },
            p: sidebarOpen ? 2 : 0,
            overflow: { xs: 'hidden', md: 'auto' },
            transition: 'width 0.3s ease',
            display: sidebarOpen ? 'block' : 'none'
          }}
        >
          <SchemaTypeList
            schemaTypes={schemaTypes}
            schemaCatalog={schemaCatalog}
            selectedType={selectedType}
            onSelect={handleTypeChange}
            loading={loading}
            error={error}
            fetchSchemaTypes={fetchSchemaTypes}
          />
        </Paper>

        {/* Toggle Button */}
        <IconButton
          onClick={() => setSidebarOpen(!sidebarOpen)}
          sx={{
            alignSelf: 'flex-start',
            mt: 1,
            ml: sidebarOpen ? -1.5 : 0,
            bgcolor: 'grey.200',
            '&:hover': {
              bgcolor: 'grey.300'
            },
            width: 28,
            height: 28,
            zIndex: 1
          }}
          size="small"
          title={sidebarOpen ? 'Hide schema types' : 'Show schema types'}
        >
          {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Main Content */}
      <Paper
        className="schema-main-content"
        elevation={2}
        sx={{
          flexGrow: 1,
          height: { xs: 'auto', md: '100%' },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header with Import Button */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <Typography variant="h6" component="h2">
            {selectedType ? `Create ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1).replace(/_/g, ' ')} Schema` : 'Appz'}
          </Typography>
          {canWrite && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<AutoFixHighIcon />}
                onClick={() => openWizard(null)}
                color="success"
              >
                New Schema
              </Button>
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={handleOpenImportDialog}
                color="primary"
              >
                Import CSV
              </Button>
            </Box>
          )}
        </Box>

        {/* Schema Content */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
          {renderMainContent()}
        </Box>
      </Paper>

      {/* CSV Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={handleCloseImportDialog}
        maxWidth={showPreview ? "lg" : "sm"}
        fullWidth
      >
        <DialogTitle>
          {selectedType
            ? `Import ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1).replace(/_/g, ' ')} from CSV`
            : 'Import Schema from CSV'
          }
        </DialogTitle>
        <DialogContent>
          {importError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {importError}
            </Alert>
          )}
          {importSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {importSuccess}
            </Alert>
          )}

          {/* Schema Type Selection - only show if not on a specific schema screen */}
          {!selectedType && (
            <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
              <InputLabel>Schema Type</InputLabel>
              <Select
                value={importType}
                onChange={(e) => setImportType(e.target.value)}
                label="Schema Type"
                disabled={importLoading}
              >
                <MenuItem value="">Select Type...</MenuItem>
                {schemaTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* CSV Preview Section */}
          {showPreview && csvPreviewData && csvPreviewData.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  <VisibilityIcon sx={{ fontSize: 18, verticalAlign: 'text-bottom', mr: 0.5 }} />
                  CSV Preview
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={`${csvPreviewData.length} row${csvPreviewData.length !== 1 ? 's' : ''}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`${csvHeaders.length} column${csvHeaders.length !== 1 ? 's' : ''}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <EditIcon sx={{ fontSize: 12, verticalAlign: 'text-bottom' }} /> Click any cell to edit
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setShowPreview(false);
                    setCsvPreviewData(null);
                    setCsvHeaders([]);
                    setImportFile(null);
                  }}
                >
                  Change File
                </Button>
              </Box>

              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ maxHeight: 300, overflow: 'auto' }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100', minWidth: 50 }}>#</TableCell>
                      {csvHeaders.map((header, index) => (
                        <TableCell
                          key={index}
                          sx={{ fontWeight: 600, bgcolor: 'grey.100', minWidth: 120 }}
                        >
                          {header}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {csvPreviewData.map((row, rowIndex) => (
                      <TableRow key={rowIndex} hover>
                        <TableCell sx={{ bgcolor: 'grey.50', fontWeight: 500 }}>
                          {rowIndex + 1}
                        </TableCell>
                        {csvHeaders.map((header, colIndex) => {
                          const isEditing =
                            editingCell?.row === rowIndex &&
                            editingCell?.column === header;

                          return (
                            <TableCell
                              key={colIndex}
                              onClick={() => handleCellClick(rowIndex, header)}
                              sx={{
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' }
                              }}
                            >
                              {isEditing ? (
                                <TextField
                                  value={row[header] || ''}
                                  onChange={(e) => handleCellEdit(rowIndex, header, e.target.value)}
                                  onBlur={handleCellBlur}
                                  autoFocus
                                  size="small"
                                  fullWidth
                                  variant="standard"
                                />
                              ) : (
                                <Typography variant="body2">
                                  {row[header] || '-'}
                                </Typography>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* File Drop Zone */}
          {!showPreview && (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: importFile ? 'success.main' : 'grey.400',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: importLoading ? 'not-allowed' : 'pointer',
                backgroundColor: importFile ? 'success.lighter' : 'grey.50',
                '&:hover': {
                  borderColor: importLoading ? 'grey.400' : 'primary.main',
                  backgroundColor: importLoading ? 'grey.50' : 'primary.lighter'
                },
                transition: 'all 0.2s ease'
              }}
              onClick={() => !importLoading && fileInputRef.current?.click()}
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={importLoading}
              />
              <CloudUploadIcon sx={{ fontSize: 48, color: importFile ? 'success.main' : 'grey.500', mb: 1 }} />
              <Typography variant="body1" color={importFile ? 'success.main' : 'text.secondary'}>
                {importFile ? importFile.name : 'Drop CSV file here or click to select'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Allowed extensions: .csv
              </Typography>
            </Box>
          )}

          {/* Progress Indicator */}
          {importLoading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                Importing...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog} disabled={importLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleImportSubmit}
            disabled={!canWrite || !importType || !importFile || importLoading}
            startIcon={importLoading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {importLoading ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step-by-step schema wizard — fully driven by the YAML catalog */}
      <SchemaWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        catalog={schemaCatalog}
        canWrite={canWrite}
        initialSchema={wizardSchema}
      />
    </Box>
  );
};

export default Schema;