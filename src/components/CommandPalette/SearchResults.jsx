import { useEffect, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { RESOURCE_TYPES, PRIMARY_CHIP_COUNT } from './useGlobalSearchResults';
import { splitMatch } from '../../utils/searchText';
import './CommandPalette.css';

// Bold the matched part of a label (Algolia-style highlighting).
const Highlight = ({ text, query }) => {
  const parts = splitMatch(text, query);
  if (!parts) return text;
  return (
    <>
      {parts[0]}
      <b>{parts[1]}</b>
      {parts[2]}
    </>
  );
};

// Renderer for the global search results, in the CommandPalette dialog.
// All state/behavior comes from useGlobalSearchResults.
const SearchResults = ({ search }) => {
  const {
    query,
    groups, flatItems,
    highlightIndex, setHighlightIndex,
    resourceLoading,
    resourceType, setResourceType,
    showAllChips, setShowAllChips,
    answer,
    resourceSearch = true,
  } = search;
  const resultsRef = useRef(null);

  // Keep the keyboard-highlighted row in view
  useEffect(() => {
    const el = resultsRef.current?.querySelector('.command-palette-item.highlighted');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const hasQuery = query.trim().length > 0;
  const visibleChips = showAllChips ? RESOURCE_TYPES : RESOURCE_TYPES.slice(0, PRIMARY_CHIP_COUNT);
  const hiddenCount = RESOURCE_TYPES.length - PRIMARY_CHIP_COUNT;
  let itemIndex = -1;

  return (
    <>
      {/* Resource type filter chips — only shown when typing */}
      {hasQuery && resourceSearch && (
        <Box className="command-palette-chips">
          {visibleChips.map(rt => (
            <button
              key={rt.key}
              className={`command-palette-chip ${resourceType === rt.key ? 'active' : ''}`}
              onClick={() => setResourceType(prev => (prev === rt.key ? null : rt.key))}
            >
              {rt.label}
            </button>
          ))}
          {!showAllChips && hiddenCount > 0 && (
            <button className="command-palette-chip" onClick={() => setShowAllChips(true)}>
              +{hiddenCount} more
            </button>
          )}
        </Box>
      )}

      <Box className="command-palette-results" ref={resultsRef}>
        {/* Ask's answer, in place of a chat window: announced, because it
            arrives after the keystroke that asked for it. */}
        {answer && (
          <Box sx={{ px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }} data-testid="palette-answer">
            <Box className="command-palette-section-header" sx={{ px: 0 }}>{answer.question}</Box>
            {answer.pending
              ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}><CircularProgress size={14} /> Asking…</Box>
              : <Box role="status">{answer.text}</Box>}
          </Box>
        )}
        {groups.map((group) => (
          <Box key={group.label}>
            <Box className="command-palette-section-header">
              {group.label}
              {resourceLoading && group.isResource && (
                <CircularProgress size={10} sx={{ ml: 0.75, verticalAlign: 'middle' }} />
              )}
            </Box>
            {group.items.map((item) => {
              itemIndex++;
              const currentIndex = itemIndex;
              const IconComp = item.iconComponent;
              return (
                <Box
                  key={item.id}
                  className={`command-palette-item ${currentIndex === highlightIndex ? 'highlighted' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setHighlightIndex(currentIndex)}
                >
                  <Box className="command-palette-item-icon">
                    <IconComp sx={{ fontSize: 18 }} />
                  </Box>
                  <Box className="command-palette-item-content">
                    <Box className="command-palette-item-label">
                      <Highlight text={item.label} query={query} />
                    </Box>
                    {item.description && (
                      <Box className="command-palette-item-description">{item.description}</Box>
                    )}
                  </Box>
                  {item.badge && (
                    <Box className="command-palette-item-badge">{item.badge}</Box>
                  )}
                  {item.envName && (
                    <Box className="command-palette-item-env">{item.envName}</Box>
                  )}
                  {item.timeLabel && (
                    <Box className="command-palette-item-time">{item.timeLabel}</Box>
                  )}
                  {item.path && !item.badge && !item.timeLabel && (
                    <Box className="command-palette-item-path">{item.path}</Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}

        {resourceLoading && flatItems.length === 0 && (
          <Box className="command-palette-loading">
            <CircularProgress size={18} />
            Searching resources...
          </Box>
        )}

        {!resourceLoading && flatItems.length === 0 && hasQuery && (
          <Box className="command-palette-empty">
            No results for &ldquo;{query}&rdquo;
          </Box>
        )}
      </Box>

      <Box className="command-palette-footer">
        <span><kbd>Esc</kbd> close</span>
        <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
        <span><kbd>&crarr;</kbd> select</span>
      </Box>
    </>
  );
};

export default SearchResults;
