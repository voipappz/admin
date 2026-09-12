import { Box } from '@mui/material';
import {
  NavigateNext as ChevronIcon
} from '@mui/icons-material';

/**
 * WizardBreadcrumb Component
 * AWS-style step pills with numbered badges.
 *
 * Example: [1 DID: JOEL EDRICK] > [2 IVR: main-menu] > [3 Queue: support]
 *          ─── past (clickable) ──   ─── past ──────────   ─── active ─────
 */
const WizardBreadcrumb = ({ viewStack, onNavigateTo }) => {
  return (
    <Box className="wizard-breadcrumb-bar">
      {viewStack.map((view, index) => {
        const isLast = index === viewStack.length - 1;
        const styleClass = isLast ? 'wizard-crumb--active' : 'wizard-crumb--past';

        return (
          <Box key={view.id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {index > 0 && (
              <ChevronIcon className="wizard-crumb-separator" fontSize="small" />
            )}
            <button
              className={`wizard-crumb ${styleClass}`}
              onClick={isLast ? undefined : () => onNavigateTo(index)}
              type="button"
            >
              <span className="wizard-crumb-number">{index + 1}</span>
              {view.label}
            </button>
          </Box>
        );
      })}
    </Box>
  );
};

export default WizardBreadcrumb;
