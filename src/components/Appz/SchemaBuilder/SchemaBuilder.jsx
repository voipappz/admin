import { useEffect, useState } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { apiService } from '../../../services/apiService';
import EnhancedSchemaForm from '../EnhancedSchemaForm/EnhancedSchemaForm';

/**
 * SchemaBuilder — the exact same schema builder the Wizard uses, made embeddable.
 * It fetches the schema structure for `type` (optionally scoped to an existing
 * environment for edit) and renders the shared EnhancedSchemaForm, which
 * self-submits to /api/schemas. Reuses the existing schema API — no changes.
 */
const SchemaBuilder = ({ type = 'environment', environmentUuid = '' }) => {
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setStructure(null);
    const url = `/api/schemas?type=${type}${environmentUuid ? `&environment_uuid=${environmentUuid}` : ''}`;
    apiService.get(url, {}, `loading ${type} schema`, false)
      .then((d) => { if (alive) setStructure(d); })
      .catch((e) => { if (alive) setError(e?.message || 'Failed to load schema structure'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [type, environmentUuid]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>;
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }
  if (!structure) return null;

  return (
    <EnhancedSchemaForm
      schemaType={type}
      schemaStructure={structure}
      loading={false}
      error={null}
      errorsList={{}}
    />
  );
};

export default SchemaBuilder;
