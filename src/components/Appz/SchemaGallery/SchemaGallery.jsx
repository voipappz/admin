import { Box, Typography, Card, CardActionArea } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import GroupsIcon from '@mui/icons-material/Groups';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HubIcon from '@mui/icons-material/Hub';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import SmsIcon from '@mui/icons-material/Sms';
import WidgetsIcon from '@mui/icons-material/Widgets';

// Each catalog schema maps to a recognizable glyph; unknown types fall back to
// the generic widget mark so a new YAML entry still renders cleanly.
const ICONS = {
  environment: LanguageIcon,
  extension: HeadsetMicIcon,
  did: CallSplitIcon,
  queue: GroupsIcon,
  ivr: AccountTreeIcon,
  plan: WorkspacesIcon,
  subscription: LoyaltyIcon,
  account: AdminPanelSettingsIcon,
  powerlink: HubIcon,
  freshdesk: SupportAgentIcon,
  sms: SmsIcon,
};

/**
 * SchemaGallery — the front door of the Appz screen. A grouped grid of squares,
 * one per catalog schema (GET /api/schemas?action=catalog). Picking a square
 * opens the wizard already on that type. Catalog-driven: add a YAML entry, get
 * a square, no code change.
 */
const SchemaGallery = ({ catalog, onPick, canWrite = true }) => {
  const groups = Array.isArray(catalog) ? catalog : [];

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          What do you want to create?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Pick a building block — the wizard walks you through the rest and provisions it in one step.
        </Typography>
      </Box>

      {groups.map((group) => (
        <Box key={group.category} sx={{ mb: 3.5 }}>
          <Typography
            sx={{
              fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'text.secondary', mb: 1.25,
            }}
          >
            {group.category}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {(group.schemas || []).map((schema) => {
              const Icon = ICONS[schema.name] || WidgetsIcon;
              return (
                <Card
                  key={schema.name}
                  variant="outlined"
                  sx={{
                    borderColor: 'var(--theme-border)',
                    transition: 'border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-2px)',
                      boxShadow: 3,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => canWrite && onPick(schema)}
                    disabled={!canWrite}
                    sx={{ height: '100%', p: 1.75, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}
                  >
                    <Box
                      sx={{
                        width: 38, height: 38, borderRadius: 1.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'var(--theme-bg-secondary)', color: 'primary.main',
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {schema.label || schema.name}
                    </Typography>
                    {schema.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}
                      >
                        {schema.description}
                      </Typography>
                    )}
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default SchemaGallery;
