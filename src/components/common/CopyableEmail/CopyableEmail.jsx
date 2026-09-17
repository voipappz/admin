import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

// navigator.clipboard exists only in a secure context; an http:// deployment
// still needs copy to work, so fall back to the old execCommand path.
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(el);
  }
};

/**
 * An email with a copy button that appears on hover (always shown on touch
 * screens, which have no hover). Renders inline, so it drops into a
 * Typography, a table cell or a list item; the click never reaches the row.
 */
const CopyableEmail = ({ email, fallback = null, children }) => {
  const [copied, setCopied] = useState(false);

  if (!email) return fallback;

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await copyText(String(email));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied: leave the text selectable, nothing else to do.
    }
  };

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        maxWidth: '100%',
        verticalAlign: 'middle',
        '& .copy-email-btn': { opacity: copied ? 1 : 0, transition: 'opacity 0.15s ease' },
        '&:hover .copy-email-btn, & .copy-email-btn:focus-visible': { opacity: 1 },
        '@media (hover: none)': { '& .copy-email-btn': { opacity: 1 } },
      }}
    >
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {children ?? email}
      </Box>
      <Tooltip title={copied ? 'Copied' : 'Copy email'}>
        <IconButton
          className="copy-email-btn"
          size="small"
          aria-label="Copy email"
          onClick={handleCopy}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{ p: 0.25, flexShrink: 0, color: copied ? 'success.main' : 'text.secondary' }}
        >
          {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default CopyableEmail;
