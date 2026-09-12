import { Chip, Tooltip } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { getContrastTextColor } from '../../../services/api/skillsApi';

/**
 * SkillChip Component
 * Displays a single skill as a colored chip with auto-contrast text
 *
 * Props:
 * - skill: Object - Skill object with name, color, type, notes
 * - onDelete: Function - Optional delete handler (shows delete button if provided)
 * - onClick: Function - Optional click handler
 * - size: 'small' | 'medium' - Chip size (default: 'small')
 * - disabled: Boolean - Disable interactions
 * - showIcon: Boolean - Show skill icon (default: false)
 * - variant: 'filled' | 'outlined' - Chip variant (default: 'filled')
 */
const SkillChip = ({
  skill,
  onDelete,
  onClick,
  size = 'small',
  disabled = false,
  showIcon = false,
  variant = 'filled'
}) => {
  if (!skill) return null;

  const backgroundColor = skill.color || '#607D8B';
  const textColor = getContrastTextColor(backgroundColor);

  const chipStyle = variant === 'filled' ? {
    backgroundColor,
    color: textColor,
    '& .MuiChip-deleteIcon': {
      color: textColor,
      opacity: 0.7,
      '&:hover': {
        color: textColor,
        opacity: 1
      }
    },
    fontWeight: 500
  } : {
    borderColor: backgroundColor,
    color: backgroundColor,
    '& .MuiChip-deleteIcon': {
      color: backgroundColor,
      opacity: 0.7,
      '&:hover': {
        color: backgroundColor,
        opacity: 1
      }
    }
  };

  const chip = (
    <Chip
      label={skill.name}
      size={size}
      variant={variant}
      icon={showIcon ? <LocalOfferIcon sx={{ color: variant === 'filled' ? textColor : backgroundColor }} /> : undefined}
      onDelete={onDelete && !disabled ? () => onDelete(skill) : undefined}
      onClick={onClick && !disabled ? () => onClick(skill) : undefined}
      disabled={disabled}
      sx={{
        ...chipStyle,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick && !disabled ? {
          transform: 'scale(1.02)',
          boxShadow: 1
        } : {}
      }}
    />
  );

  // Show tooltip with notes if available
  if (skill.notes) {
    return (
      <Tooltip title={skill.notes} arrow placement="top">
        {chip}
      </Tooltip>
    );
  }

  return chip;
};

/**
 * SkillChipList Component
 * Displays a list of skills with optional "show more" truncation
 *
 * Props:
 * - skills: Array - Array of skill objects
 * - maxDisplay: Number - Max skills to display before truncating (default: 3)
 * - onDelete: Function - Optional delete handler for each skill
 * - onClick: Function - Optional click handler for each skill
 * - size: 'small' | 'medium' - Chip size
 * - disabled: Boolean - Disable interactions
 */
export const SkillChipList = ({
  skills = [],
  maxDisplay = 3,
  onDelete,
  onClick,
  size = 'small',
  disabled = false
}) => {
  if (!skills || skills.length === 0) {
    return null;
  }

  const displaySkills = skills.slice(0, maxDisplay);
  const remainingCount = skills.length - maxDisplay;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {displaySkills.map((skill) => (
        <SkillChip
          key={skill.uuid || skill.id}
          skill={skill}
          onDelete={onDelete}
          onClick={onClick}
          size={size}
          disabled={disabled}
        />
      ))}
      {remainingCount > 0 && (
        <Tooltip
          title={skills.slice(maxDisplay).map(s => s.name).join(', ')}
          arrow
          placement="top"
        >
          <Chip
            label={`+${remainingCount}`}
            size={size}
            variant="outlined"
            sx={{
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.75rem'
            }}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default SkillChip;
