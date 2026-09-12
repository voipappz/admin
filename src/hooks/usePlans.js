import { useState, useEffect, useCallback } from 'react';
import { plansApi } from '../services/api/plansApi';
import { useNotification } from '../context/NotificationContext';
import { useCustomerEnvironment } from '../context/CustomerEnvironmentContext';

/**
 * Custom hook for Plans management
 */
export const usePlans = (subscriptionId) => { // Accept subscriptionId as a parameter
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { showSuccess, showError } = useNotification();
  const { selectedCustomer } = useCustomerEnvironment();

  const fetchPlans = useCallback(async () => {
    if (!selectedCustomer || !subscriptionId) { // Check for subscriptionId
      setPlans([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // Filter plans by customer_uuid AND subscription_uuid
      const params = { 
        customer_uuid: selectedCustomer.uuid,
        subscription_uuid: subscriptionId 
      };
      const fetchedPlans = await plansApi.getPlans(params);
      setPlans(fetchedPlans.data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to load plans.');
      showError('Failed to load plans.');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, subscriptionId, showError]); // Add subscriptionId to dependencies

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleOpenDialog = (plan = null) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setSelectedPlan(null);
    setDialogOpen(false);
  };

  const handleSavePlan = async (planData) => {
    const planId = selectedPlan?.id || selectedPlan?.uuid;

    try {
      setLoading(true);

      // Tariffs are managed as plan items, not plan columns — pull them out.
      const { tariffs, ...planFields } = planData;

      const dataToSave = {
        ...planFields,
        customer_uuid: selectedCustomer?.uuid,
        subscription_uuid: subscriptionId, // Ensure subscription_uuid is included
      };

      let saved;
      if (planId) {
        saved = await plansApi.updatePlan(planId, dataToSave);
        showSuccess('Plan updated successfully');
      } else {
        saved = await plansApi.createPlan(dataToSave);
        showSuccess('Plan created successfully');
      }

      // Reconcile the plan's tariffs (stored as items: val = tariff uuid).
      const savedId = saved?.uuid || saved?.id || planId;
      if (Array.isArray(tariffs) && savedId) {
        await plansApi.setItems(savedId, tariffs.map((t) => ({ name: t.name, val: t.uuid })));
      }

      handleCloseDialog();
      await fetchPlans();
      return true; // Indicate success
    } catch (err) {
      console.error('Error saving plan:', err);
      const errorMessage = err.response?.data?.message || (planId ? 'Failed to update plan' : 'Failed to create plan');
      showError(errorMessage);
      return false; // Indicate failure
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteDialog = (plan) => {
    setSelectedPlan(plan);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setSelectedPlan(null);
    setDeleteDialogOpen(false);
  };

  const handleDeletePlan = async () => {
    const planToDel = selectedPlan;
    if (!planToDel) return;

    try {
      setLoading(true);
      await plansApi.deletePlan(planToDel.id || planToDel.uuid);
      showSuccess('Plan deleted successfully');
      handleCloseDeleteDialog();
      await fetchPlans();
    } catch (err) {
      console.error('Error deleting plan:', err);
      showError(err.response?.data?.message || 'Failed to delete plan');
    } finally {
      setLoading(false);
    }
  };

  return {
    plans,
    loading,
    error,
    selectedPlan,
    dialogOpen,
    deleteDialogOpen,
    fetchPlans,
    handleOpenDialog,
    handleCloseDialog,
    handleSavePlan,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeletePlan,
  };
};
