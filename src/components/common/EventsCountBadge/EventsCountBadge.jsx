import { Badge } from '@mui/material';
import EventNoteIcon from '@mui/icons-material/EventNote';

/**
 * EventsCountBadge — the "View Events" icon with a per-row event-count badge.
 * Feed it the count for this row's subject (from useEventCounts). Shows a plain
 * icon when the count is 0/absent. Used across the object lists so every row
 * tells you how many events it has at a glance.
 */
const EventsCountBadge = ({ count = 0 }) => (
  <Badge
    badgeContent={count || 0}
    color="primary"
    max={999}
    sx={{ '& .MuiBadge-badge': { fontSize: '0.55rem', height: 14, minWidth: 14 } }}
  >
    <EventNoteIcon fontSize="small" />
  </Badge>
);

export default EventsCountBadge;
