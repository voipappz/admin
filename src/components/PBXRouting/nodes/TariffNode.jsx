import { memo } from 'react';
import { Typography, Chip, Box } from '@mui/material';
import PBXBaseNode from './PBXBaseNode';

const TariffNode = memo(({ data, selected }) => {
  const rateCount = data.rates?.length || data.items?.length || 0;

  return (
    <PBXBaseNode type="tariff" width={240} selected={selected}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
        {data.name || 'Unnamed Tariff'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {data.scheme && (
          <Chip
            label={data.scheme}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.6rem', textTransform: 'capitalize' }}
          />
        )}
        {rateCount > 0 && (
          <Chip
            label={`${rateCount} rate${rateCount !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.6rem' }}
          />
        )}
        <Chip
          label={data.enabled !== false ? 'Active' : 'Inactive'}
          size="small"
          color={data.enabled !== false ? 'success' : 'default'}
          sx={{ height: 20, fontSize: '0.6rem' }}
        />
      </Box>
    </PBXBaseNode>
  );
});

TariffNode.displayName = 'TariffNode';

export default TariffNode;
