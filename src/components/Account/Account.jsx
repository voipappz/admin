import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import AccountEditDialog from './AccountEditDialog/AccountEditDialog.jsx';
import { useAccount } from './Account.js';

const Account = () => {
  const navigate = useNavigate();
  const { saving, loading, detailedAccountData, fetchAccountDetails, updateAccountData } = useAccount();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetchAccountDetails();
  }, [fetchAccountDetails]);

  const handleSave = async (formData) => {
    await updateAccountData(formData);
    setOpen(false);
    navigate('/users');
  };

  const handleClose = () => {
    setOpen(false);
    navigate('/users');
  };

  return (
    <AccountEditDialog
      open={open}
      onClose={handleClose}
      onSave={handleSave}
      accountData={detailedAccountData}
      loading={saving || loading}
    />
  );
};

export default Account;
