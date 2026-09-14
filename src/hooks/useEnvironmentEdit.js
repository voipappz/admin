import { useState, useCallback } from 'react';
import { environmentsApi } from '../services/api/applicationsApi';
import { useCustomerEnvironment } from '../context/CustomerEnvironmentContext';

/**
 * Shared hook for editing environments from any screen.
 * Fetches full env data, opens EnvironmentDialog, saves, and refreshes context.
 */
const useEnvironmentEdit = () => {
  const { fetchSelectedEnvironments, selectedCustomer } = useCustomerEnvironment();

  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [envDialogEnvironment, setEnvDialogEnvironment] = useState(null);
  const [envDialogLoading, setEnvDialogLoading] = useState(false);

  const handleEnvEdit = useCallback(async (env) => {
    if (!env?.uuid) return;
    setEnvDialogLoading(true);
    setEnvDialogOpen(true);
    try {
      const fullEnv = await environmentsApi.getEnvironment(env.uuid);
      setEnvDialogEnvironment(fullEnv);
    } catch (err) {
      console.error('Failed to fetch environment for edit:', err);
      // Fallback to the partial data we already have
      setEnvDialogEnvironment(env);
    } finally {
      setEnvDialogLoading(false);
    }
  }, []);

  const handleEnvSave = useCallback(async (formData) => {
    if (!envDialogEnvironment?.uuid) return;
    setEnvDialogLoading(true);
    try {
      await environmentsApi.updateEnvironment(envDialogEnvironment.uuid, formData);
      // Refresh only the selected envs — avoid the slow action=all fetch.
      if (fetchSelectedEnvironments && selectedCustomer?.uuid) {
        fetchSelectedEnvironments(selectedCustomer.uuid);
      }
      setEnvDialogOpen(false);
      setEnvDialogEnvironment(null);
    } catch (err) {
      console.error('Failed to update environment:', err);
      throw err;
    } finally {
      setEnvDialogLoading(false);
    }
  }, [envDialogEnvironment, fetchSelectedEnvironments, selectedCustomer]);

  const handleEnvClose = useCallback(() => {
    setEnvDialogOpen(false);
    setEnvDialogEnvironment(null);
  }, []);

  return {
    envDialogOpen,
    envDialogEnvironment,
    envDialogLoading,
    handleEnvEdit,
    handleEnvSave,
    handleEnvClose,
  };
};

export default useEnvironmentEdit;
