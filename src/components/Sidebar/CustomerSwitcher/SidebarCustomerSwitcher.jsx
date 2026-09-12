import { useMemo, useRef, useState } from 'react';
import {
  Box, Popover, TextField, InputAdornment, Typography, Tooltip, Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { useAuth } from '../../../context/AuthContext';
import { customersApi } from '../../../services/api/customersApi';
import CustomerEditDialog from '../../Account/CustomerEditDialog/CustomerEditDialog.jsx';
import './SidebarCustomerSwitcher.css';

// Deterministic, pleasant avatar color from the customer name (no extra fetch).
const avatarColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 42%, 38%)`;
};
const initial = (name = '?') => (name.trim()[0] || '?').toUpperCase();

/**
 * Enterprise workspace-style customer switcher pinned at the top of the sidebar.
 * Root accounts get the full list + search + "Add customer"; non-root see their
 * own customer with "Manage". Mirrors the topbar switcher's data flow.
 */
const SidebarCustomerSwitcher = ({ expanded = false }) => {
  const { customers, selectedCustomer, selectCustomer, isRoot, fetchCustomers } = useCustomerEnvironment();
  const { user, accountCustomer } = useAuth();
  const triggerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('edit'); // 'edit' | 'create'
  const [saving, setSaving] = useState(false);

  const accountLabel = user?.fullName || user?.firstName || user?.email?.split('@')[0] || 'Account';
  const current = selectedCustomer || accountCustomer || null;
  const currentName = current?.name || 'No customer';

  const list = useMemo(() => {
    const base = (customers && customers.length ? customers : (accountCustomer ? [accountCustomer] : []))
      .filter(c => c && c.name && c.name.trim());
    const q = search.trim().toLowerCase();
    return q ? base.filter(c => c.name.toLowerCase().includes(q)) : base;
  }, [customers, accountCustomer, search]);

  const close = () => { setOpen(false); setSearch(''); };

  const handleSelect = async (c) => {
    close();
    if (c?.uuid && c.uuid !== selectedCustomer?.uuid) await selectCustomer(c);
  };

  const openDialog = (mode) => { setDialogMode(mode); setDialogOpen(true); close(); };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (dialogMode === 'create') {
        const created = await customersApi.createCustomer(formData);
        const fresh = (await fetchCustomers()) || [];
        const match = fresh.find(c => c.uuid === created?.uuid);
        if (match) await selectCustomer(match);
      } else if (current?.uuid) {
        await customersApi.updateCustomer(current.uuid, formData);
        await fetchCustomers();
      }
      setDialogOpen(false);
      setDialogMode('edit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box
        ref={triggerRef}
        className={`scs-trigger ${expanded ? 'expanded' : 'rail'} ${open ? 'open' : ''}`}
        onClick={() => setOpen(true)}
        role="button"
        aria-label="Switch customer"
      >
        {expanded ? (
          <>
            <Typography className="scs-name" noWrap>{currentName}</Typography>
            <UnfoldMoreIcon className="scs-chev" />
          </>
        ) : (
          <Tooltip title={currentName} placement="right" arrow>
            <Box className="scs-avatar" sx={{ bgcolor: avatarColor(currentName) }}>{initial(currentName)}</Box>
          </Tooltip>
        )}
      </Box>

      <Popover
        open={open}
        anchorEl={triggerRef.current}
        onClose={close}
        anchorOrigin={{ vertical: expanded ? 'bottom' : 'top', horizontal: expanded ? 'left' : 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { className: 'scs-panel' } }}
      >
        {isRoot && (
          <Box className="scs-search">
            <TextField
              autoFocus fullWidth size="small" variant="standard" placeholder="Search customers…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                disableUnderline: true,
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17, color: 'text.disabled' }} /></InputAdornment>
                )
              }}
            />
          </Box>
        )}

        <Typography className="scs-acct">{accountLabel}'s account</Typography>

        <Box className="scs-list">
          {list.length === 0 ? (
            <Typography className="scs-empty">No customers</Typography>
          ) : list.map(c => {
            const active = c.uuid === selectedCustomer?.uuid;
            return (
              <Box key={c.uuid} className={`scs-row ${active ? 'active' : ''}`} onClick={() => handleSelect(c)}>
                <Box className="scs-check-slot">{active && <CheckIcon className="scs-check" />}</Box>
                <Typography className="scs-row-name" noWrap>{c.name}</Typography>
              </Box>
            );
          })}
        </Box>

        <Divider className="scs-divider" />

        <Box className="scs-actions">
          {isRoot && (
            <Box className="scs-action primary" onClick={() => openDialog('create')}>
              <AddIcon className="scs-action-ic" /> Add customer
            </Box>
          )}
          {current && (
            <Box className="scs-action" onClick={() => openDialog('edit')}>
              <SettingsOutlinedIcon className="scs-action-ic" /> Manage customer
            </Box>
          )}
        </Box>
      </Popover>

      <CustomerEditDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogMode('edit'); }}
        onSave={handleSave}
        customerData={dialogMode === 'create' ? null : current}
        loading={saving}
      />
    </>
  );
};

export default SidebarCustomerSwitcher;
