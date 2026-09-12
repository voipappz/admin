import { useState, useCallback } from 'react';
import { extractCountryFromPhone } from '../../../utils/phoneUtils';
import { saveFilterParameters } from '../../../services/callsService';
import { config } from '../../../config.js';

// Utility functions for time conversion
const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  
  // If it's already a number (seconds), return it
  if (!isNaN(timeStr) && !timeStr.includes(':')) {
    return parseInt(timeStr) || 0;
  }
  
  // Handle HH:MM:SS format
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // Handle MM:SS format
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  
  // If it's not a valid time format, try to parse as number
  return parseInt(timeStr) || 0;
};


const useFilterHandlers = (allRows, setCurrentSearchParams, syncUrl, fetchCalls, dateRange, authToken) => {
  // State for client-side filtered results
  const [filteredRows, setFilteredRows] = useState([]);
  const [isClientFiltered, setIsClientFiltered] = useState(false);
  
  // State for individual filter editing
  const [editingFilter, setEditingFilter] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editOperator, setEditOperator] = useState('gte');

  // Client-side filtering function
  const filterClientData = useCallback((searchParams) => {
    if (!allRows.length) return [];

    return allRows.filter(row => {
      // Check caller (agent name)
      if (searchParams['search[call.caller][IS][]']) {
        const caller = row.profile?.caller || '';
        if (!caller.toLowerCase().includes(searchParams['search[call.caller][IS][]'].toLowerCase())) {
          return false;
        }
      }

      // Check callee (phone number)
      if (searchParams['search[call.callee][IS][]']) {
        const callee = row.profile?.callee || '';
        const searchPhone = searchParams['search[call.callee][IS][]'];
        if (!callee.includes(searchPhone)) {
          return false;
        }
      }

      // Check direction
      if (searchParams['search[call.direction][IS]']) {
        const direction = row.profile?.direction || '';
        if (direction !== searchParams['search[call.direction][IS]'][0]) {
          return false;
        }
      }

      // Check country
      if (searchParams['search[call.country][IS][]']) {
        const phoneNumber = row.profile?.callee || '';
        if (phoneNumber) {
          const countryInfo = extractCountryFromPhone(phoneNumber);
          const countryCode = countryInfo.code || '';
          if (countryCode !== searchParams['search[call.country][IS][]']) {
            return false;
          }
        } else {
          return false;
        }
      }

      // Check environment (handle multiple environments)
      if (searchParams['search[call.environment_uuid][]'] && searchParams['search[call.environment_uuid][]'].length > 0) {
        const environmentUuid = row.environment?.uuid || '';
        if (!searchParams['search[call.environment_uuid][]'].includes(environmentUuid)) {
          return false;
        }
      }

      // Check talk duration - handle both seconds and HH:MM:SS format
      if (searchParams['search[call.talk_duration][GTE][]']) {
        const duration = timeToSeconds(row.profile?.talk_duration);
        const minDuration = timeToSeconds(searchParams['search[call.talk_duration][GTE][]']);
        if (duration < minDuration) return false;
      }
      if (searchParams['search[call.talk_duration][LTE][]']) {
        const duration = timeToSeconds(row.profile?.talk_duration);
        const maxDuration = timeToSeconds(searchParams['search[call.talk_duration][LTE][]']);
        if (duration > maxDuration) return false;
      }
      if (searchParams['search[call.talk_duration][IS][]']) {
        const duration = timeToSeconds(row.profile?.talk_duration);
        const exactDuration = timeToSeconds(searchParams['search[call.talk_duration][IS][]']);
        if (duration !== exactDuration) return false;
      }

      // Check cause
      if (searchParams['search[call.cause][IS][]']) {
        const cause = row.profile?.cause || '';
        if (cause !== searchParams['search[call.cause][IS][]']) {
          return false;
        }
      }

      // Check CID
      if (searchParams['search[call.cid][IS][]']) {
        const cid = row.profile?.cid || '';
        if (!cid.toLowerCase().includes(searchParams['search[call.cid][IS][]'].toLowerCase())) {
          return false;
        }
      }

      // Check contact name
      if (searchParams['search[call.contact_name][IS][]']) {
        const contactName = row.profile?.contact_name || '';
        if (!contactName.toLowerCase().includes(searchParams['search[call.contact_name][IS][]'].toLowerCase())) {
          return false;
        }
      }

      // Check provider name
      if (searchParams['search[call.provider_name][IS][]']) {
        const providerName = row.profile?.provider_name || '';
        if (!providerName.toLowerCase().includes(searchParams['search[call.provider_name][IS][]'].toLowerCase())) {
          return false;
        }
      }

      // Check hangup disposition
      if (searchParams['search[call.hangup_disposition][IS][]']) {
        const hangupDisposition = row.profile?.hangup_disposition || '';
        if (hangupDisposition !== searchParams['search[call.hangup_disposition][IS][]']) {
          return false;
        }
      }

      // Check leg A type
      if (searchParams['search[call.leg_a_type][IS][]']) {
        const legAType = row.leg_a_type || '';
        if (legAType !== searchParams['search[call.leg_a_type][IS][]']) {
          return false;
        }
      }

      // Check leg B type
      if (searchParams['search[call.leg_b_type][IS][]']) {
        const legBType = row.leg_b_type || '';
        if (legBType !== searchParams['search[call.leg_b_type][IS][]']) {
          return false;
        }
      }

      // Check type
      if (searchParams['search[call.type][IS][]']) {
        const type = row.profile?.type || '';
        if (type !== searchParams['search[call.type][IS][]']) {
          return false;
        }
      }

      // Check environment by name (if not using UUID)
      if (searchParams['search[call.environment][IS][]']) {
        const environmentName = row.environment?.name || '';
        if (!environmentName.toLowerCase().includes(searchParams['search[call.environment][IS][]'].toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [allRows]);

  // Search dialog handling
  const handleSearch = async (searchParams, filterMode = false) => {

    console.log('handleSearch called with:', { searchParams, filterMode });
    
    // Store current search parameters for filter bar display
    setCurrentSearchParams(searchParams);
    const urlObj = { ...searchParams };
    if (filterMode) urlObj['_client'] = '1';
    syncUrl(urlObj);
    
    if (filterMode) {
      // Client-side filtering
      const filtered = filterClientData(searchParams);
      setFilteredRows(filtered);
      setIsClientFiltered(true);
    } else {
      // Server-side search (replace)

      setIsClientFiltered(false);
      setFilteredRows([]);
      fetchCalls(dateRange, searchParams)
        .catch(error => {
          console.error('Search failed:', error);
        });
    }

    // Automatically save the search parameters (including when no parameters remain)
    if (authToken) {
      try {
        if (searchParams && Object.keys(searchParams).length > 0) {
          await saveFilterParameters(searchParams, authToken);
          console.log('Filter parameters automatically saved');
        } else {
          // Save empty state when no parameters
          const response = await fetch(`${config.apiBaseUrl}/calls?action=save_params`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
            body: new FormData() // Empty form data
          });
          
          if (response.ok) {
            console.log('Empty filter state automatically saved');
          }
        }
      } catch (error) {
        console.warn('Failed to automatically save filter parameters:', error);
      }
    }
  };

  // Clear all filters
  const handleClearAllFilters = async (setSearchParams) => {
    const emptyParams = {};
    setCurrentSearchParams(emptyParams);
    setIsClientFiltered(false);
    setFilteredRows([]);
    syncUrl(emptyParams);
    setSearchParams({
      agent: '',
      client: '',
      date_range: '',
      direction: '',
      talk_duration: '',
      talk_duration_operator: 'gte',
      cause: '',
    });

    // Automatically save the cleared state (empty parameters)
    if (authToken) {
      try {
        // Save an empty state by sending a request with no parameters
        // This effectively clears the saved filters on the server
        const response = await fetch(`${config.apiBaseUrl}/calls?action=save_params`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: new FormData() // Empty form data
        });
        
        if (response.ok) {
          console.log('Filter reset automatically saved (cleared on server)');
        }
      } catch (error) {
        console.warn('Failed to automatically save filter reset:', error);
      }
    }
  };

  // Remove individual filter
  const handleRemoveFilter = async (paramKey, currentSearchParams) => {
    const newParams = { ...currentSearchParams };
    delete newParams[paramKey];
    setCurrentSearchParams(newParams);
    
    // Re-apply filters with updated parameters
    if (Object.keys(newParams).length === 0) {
      handleClearAllFilters();
    } else {
      handleSearch(newParams, isClientFiltered);
    }
  };

  // Convert API parameter back to search dialog format
  const mapApiParamToDialogParam = (paramKey, paramValue) => {
    switch (paramKey) {
      case 'search[call.caller][IS][]':
        return { field: 'caller', value: paramValue };
      case 'search[call.callee][IS][]':
        return { field: 'callee', value: paramValue };
      case 'search[call.country][IS][]':
        return { field: 'country', value: paramValue };
      case 'search[call.direction][IS]':
        return { field: 'direction', value: Array.isArray(paramValue) ? paramValue[0] : paramValue };
      case 'search[call.environment_uuid][]':
        return { field: 'environment', value: Array.isArray(paramValue) ? paramValue : [paramValue] };
      case 'search[call.talk_duration][GTE][]':
        return { field: 'talk_duration', value: paramValue, operator: 'gte' };
      case 'search[call.talk_duration][LTE][]':
        return { field: 'talk_duration', value: paramValue, operator: 'lte' };
      case 'search[call.talk_duration][IS][]':
        return { field: 'talk_duration', value: paramValue, operator: 'eq' };
      case 'search[call.cause][IS][]':
        return { field: 'cause', value: paramValue };
      case 'search[call.cid][IS][]':
        return { field: 'cid', value: paramValue };
      case 'search[call.contact_name][IS][]':
        return { field: 'contact_name', value: paramValue };
      case 'search[call.provider_name][IS][]':
        return { field: 'provider_name', value: paramValue };
      case 'search[call.hangup_disposition][IS][]':
        return { field: 'hangup_disposition', value: paramValue };
      case 'search[call.leg_a_type][IS][]':
        return { field: 'leg_a_type', value: paramValue };
      case 'search[call.leg_b_type][IS][]':
        return { field: 'leg_b_type', value: paramValue };
      case 'search[call.type][IS][]':
        return { field: 'type', value: paramValue };
      case 'search[call.environment][IS][]':
        return { field: 'environment', value: paramValue };
      default:
        return null;
    }
  };

  // Handle clicking on a filter chip to edit that specific filter
  const handleEditSingleFilter = (paramKey, paramValue) => {
    const dialogParam = mapApiParamToDialogParam(paramKey, paramValue);
    if (!dialogParam) return;

    setEditingFilter({ key: paramKey, type: dialogParam.field });
    setEditValue(dialogParam.value);
    if (dialogParam.operator) {
      setEditOperator(dialogParam.operator);
    }
    setEditDialogOpen(true);
  };

  // Handle saving the edited filter
  const handleSaveEditedFilter = (currentSearchParams) => {
    if (!editingFilter || !editValue.trim()) return;

    // Create new search params with the updated value
    const newParams = { ...currentSearchParams };
    
    // Remove the old parameter
    delete newParams[editingFilter.key];
    
    // Add the new parameter based on filter type
    switch (editingFilter.type) {
      case 'caller':
        newParams['search[call.caller][IS][]'] = editValue;
        break;
      case 'callee': {
        const phoneNumber = editValue.replace(/[^\d+]/g, '');
        if (phoneNumber) {
          newParams['search[call.callee][IS][]'] = phoneNumber;
        }
        break;
      }
      case 'country':
        newParams['search[call.country][IS][]'] = editValue;
        break;
      case 'direction':
        newParams['search[call.direction][IS]'] = [editValue];
        break;
      case 'environment':
        // Handle multiple environments - editValue should be an array
        if (Array.isArray(editValue) && editValue.length > 0) {
          newParams['search[call.environment_uuid][]'] = editValue;
        }
        break;
      case 'talk_duration':
        if (editOperator === 'gte') {
          newParams['search[call.talk_duration][GTE][]'] = editValue;
        } else if (editOperator === 'lte') {
          newParams['search[call.talk_duration][LTE][]'] = editValue;
        } else if (editOperator === 'eq') {
          newParams['search[call.talk_duration][IS][]'] = editValue;
        }
        break;
      case 'cause':
        newParams['search[call.cause][IS][]'] = editValue;
        break;
      case 'cid':
        newParams['search[call.cid][IS][]'] = editValue;
        break;
      case 'contact_name':
        newParams['search[call.contact_name][IS][]'] = editValue;
        break;
      case 'provider_name':
        newParams['search[call.provider_name][IS][]'] = editValue;
        break;
      case 'hangup_disposition':
        newParams['search[call.hangup_disposition][IS][]'] = editValue;
        break;
      case 'leg_a_type':
        newParams['search[call.leg_a_type][IS][]'] = editValue;
        break;
      case 'leg_b_type':
        newParams['search[call.leg_b_type][IS][]'] = editValue;
        break;
      case 'type':
        newParams['search[call.type][IS][]'] = editValue;
        break;
    }

    // Apply the updated filters
    handleSearch(newParams, isClientFiltered);
    
    // Close the dialog
    setEditDialogOpen(false);
    setEditingFilter(null);
    setEditValue('');
    setEditOperator('gte');
  };

  // Handle canceling the edit
  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingFilter(null);
    setEditValue('');
    setEditOperator('gte');
  };


  return {
    filteredRows,
    isClientFiltered,
    editingFilter,
    editDialogOpen,
    editValue,
    editOperator,
    filterClientData,
    handleSearch,
    handleClearAllFilters,
    handleRemoveFilter,
    mapApiParamToDialogParam,
    handleEditSingleFilter,
    handleSaveEditedFilter,
    handleCancelEdit,
    setEditDialogOpen,
    setEditValue,
    setEditOperator
  };
};

export default useFilterHandlers;
