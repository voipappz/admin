import React, { useEffect } from 'react';
import { List, ListItem, ListItemButton, ListItemText, CircularProgress, Alert, Typography, Box, Tooltip } from '@mui/material';
import './SchemaTypeList.css';

const typeButtonSx = {
  borderRadius: 1,
  mb: 0.5,
  '&.Mui-selected': {
    backgroundColor: 'primary.main',
    color: 'white',
    '& .MuiListItemText-secondary': { color: 'rgba(255,255,255,0.75)' },
    '&:hover': {
      backgroundColor: 'primary.dark',
    }
  }
};

const SchemaTypeList = ({
  schemaTypes,
  schemaCatalog,
  selectedType,
  onSelect,
  loading,
  fetchSchemaTypes
}) => {
  useEffect(() => {
    if (!schemaTypes || schemaTypes.length === 0) {
      fetchSchemaTypes();
    }
  }, [schemaTypes, fetchSchemaTypes]);

  const formatTypeName = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
  };

  const hasCatalog = Array.isArray(schemaCatalog) && schemaCatalog.length > 0;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Appz
      </Typography>

      {loading && <CircularProgress sx={{ m: 2 }} />}


      {!loading && (!schemaTypes || schemaTypes.length === 0) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No app types available
        </Alert>
      )}

      {/* Catalog mode — schemas from the API's config/schemas.yaml, grouped by category */}
      {!loading && hasCatalog && (
        <List className="schema-type-list">
          {schemaCatalog.map((group) => (
            <Box key={group.category} sx={{ mb: 1 }}>
              <Typography sx={{ px: 1, py: 0.5, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
                {group.category}
              </Typography>
              {group.schemas.map((schema) => (
                <ListItem key={schema.name} disablePadding>
                  <Tooltip title={schema.description || ''} placement="right" arrow>
                    <ListItemButton
                      selected={selectedType === schema.name}
                      onClick={() => onSelect(schema.name)}
                      sx={typeButtonSx}
                    >
                      <ListItemText
                        primary={schema.label || formatTypeName(schema.name)}
                        primaryTypographyProps={{ fontSize: '0.85rem', noWrap: true }}
                      />
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              ))}
            </Box>
          ))}
        </List>
      )}

      {/* Legacy mode — flat action=types list on backends without the catalog */}
      {!loading && !hasCatalog && schemaTypes && schemaTypes.length > 0 && (
        <List className="schema-type-list">
          {schemaTypes.map(type => (
            <ListItem key={type} disablePadding>
              <ListItemButton
                selected={selectedType === type}
                onClick={() => onSelect(type)}
                sx={typeButtonSx}
              >
                <ListItemText primary={formatTypeName(type)} primaryTypographyProps={{ noWrap: true }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default SchemaTypeList;
