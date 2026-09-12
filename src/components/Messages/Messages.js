import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = '/api';

const useMessages = () => {
  const { access } = useAuth();

  const [columns, setColumns] = useState([]);
  const [messages, setMessages] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorColumns, setErrorColumns] = useState(null);
  const [errorMessages, setErrorMessages] = useState(null);

  // Initialize with today's date range
  const getTodayRange = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return [startOfToday, endOfToday];
  };

  const [dateRange, setDateRange] = useState(getTodayRange());
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortModel, setSortModel] = useState([]);
  const [sortParams, setSortParams] = useState({ order_by: null, order_type: null });

  // Segments for filter sidebar
  const [segments, setSegments] = useState([]);
  const [loadingSegments, setLoadingSegments] = useState(false);

  const commonHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Authorization': access ? `Bearer ${access}` : '',
  };

  // Fetch columns configuration
  useEffect(() => {
    const fetchColumns = async () => {
      setLoadingColumns(true);
      setErrorColumns(null);
      try {
        const response = await fetch(`${API_BASE_URL}/messages?action=columns`, {
          method: 'GET',
          headers: commonHeaders,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setColumns(data || []);
      } catch (error) {
        console.error('Failed to fetch message columns:', error);
        setErrorColumns(error.message);
        setColumns([]);
      } finally {
        setLoadingColumns(false);
      }
    };

    if (access) {
      fetchColumns();
    }
  }, [access]);

  // Fetch segments for filter sidebar
  useEffect(() => {
    const fetchSegments = async () => {
      setLoadingSegments(true);
      try {
        const response = await fetch(`${API_BASE_URL}/messages?action=segments`, {
          method: 'GET',
          headers: commonHeaders,
        });
        if (response.ok) {
          const data = await response.json();
          const apiSegments = data || [];
          // Append meta tag filter segment
          setSegments([...apiSegments, { name: 'meta', label: 'Tag', type: 'tag', url: '/api/messages?action=meta_keys' }]);
        }
      } catch (error) {
        console.error('Failed to fetch message segments:', error);
        setSegments([]);
      } finally {
        setLoadingSegments(false);
      }
    };

    if (access) {
      fetchSegments();
    }
  }, [access]);

  // Helper function to build search query parameters
  const buildSearchQueryParams = useCallback((range, searchParams) => {
    const searchQueryParams = {};
    const [startDate, endDate] = range;

    if (startDate && endDate) {
      const startTimestamp = Math.floor(new Date(startDate).setHours(0, 0, 0, 0) / 1000);
      const endTimestamp = Math.floor(new Date(endDate).setHours(23, 59, 59, 999) / 1000);
      searchQueryParams[`search[created_at]`] = `${startTimestamp} - ${endTimestamp}`;
    } else {
      const now = new Date();
      const startTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime() / 1000);
      searchQueryParams[`search[created_at]`] = `${startTimestamp} - ${endTimestamp}`;
    }

    if (searchParams && typeof searchParams === 'object') {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          // Handle meta tag filters passed as nested object
          if (key === 'meta' && typeof value === 'object' && !Array.isArray(value)) {
            Object.entries(value).forEach(([metaKey, metaValue]) => {
              searchQueryParams[`search[meta][${metaKey}]`] = metaValue;
            });
            return;
          }
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (item !== null && item !== undefined && item !== '') {
                searchQueryParams[key] = searchQueryParams[key] || [];
                if (Array.isArray(searchQueryParams[key])) {
                  searchQueryParams[key].push(item);
                } else {
                  searchQueryParams[key] = [searchQueryParams[key], item];
                }
              }
            });
          } else {
            searchQueryParams[key] = value;
          }
        }
      });
    }

    const orderBy = searchParams?.order_by || sortParams.order_by;
    const orderType = searchParams?.order_type || sortParams.order_type;

    if (orderBy && orderType) {
      searchQueryParams['order_by'] = orderBy;
      searchQueryParams['order_type'] = orderType;
    }

    return searchQueryParams;
  }, [sortParams]);

  // Fetch messages data with pagination support
  const fetchMessages = useCallback(async (range = dateRange, searchParams = null, resetData = true, pageOverride = null) => {
    const pageToFetch = pageOverride || 1;

    if (resetData) {
      setLoadingMessages(true);
      setErrorMessages(null);
      setAllRows([]);
      setHasNextPage(true);
      setLastSearchParams(searchParams);
    }

    setCurrentPage(pageToFetch);

    const searchQueryParams = buildSearchQueryParams(range, searchParams);

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch);
    queryParams.append('per_page', perPage);

    Object.entries(searchQueryParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const finalKey = key.endsWith('[]') ? key : `${key}[]`;
        value.forEach(item => {
          queryParams.append(finalKey, item);
        });
      } else {
        queryParams.append(key, value);
      }
    });

    const url = `${API_BASE_URL}/messages?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: commonHeaders,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      const xTotalRaw = response.headers.get('x-total')
        || response.headers.get('X-Total')
        || response.headers.get('X-TOTAL');
      const totalRecordsFromHeader = parseInt(xTotalRaw || '0', 10);
      setTotalRecords(totalRecordsFromHeader);
      const calculatedTotalPages = totalRecordsFromHeader > 0 ? Math.ceil(totalRecordsFromHeader / perPage) : 0;
      setTotalPages(calculatedTotalPages);

      const data = await response.json();

      let actualData = data;
      if (!Array.isArray(data)) {
        if (data.data && Array.isArray(data.data)) {
          actualData = data.data;
        } else if (data.results && Array.isArray(data.results)) {
          actualData = data.results;
        } else if (data.items && Array.isArray(data.items)) {
          actualData = data.items;
        } else {
          actualData = [];
        }
      }

      const morePages = calculatedTotalPages > 0
        ? pageToFetch < calculatedTotalPages
        : actualData.length === perPage;

      if (resetData) {
        setMessages(data);
        if (Array.isArray(actualData)) {
          setAllRows(actualData);
          setHasNextPage(morePages);
        } else {
          setAllRows([]);
          setHasNextPage(false);
        }
      } else {
        if (Array.isArray(actualData)) {
          setAllRows(prev => {
            const existingIds = new Set(prev.map(row => row.uuid));
            const newRows = actualData.filter(row => !existingIds.has(row.uuid));
            return [...prev, ...newRows];
          });
          setHasNextPage(morePages);
        } else {
          setHasNextPage(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setErrorMessages(error.message);
    } finally {
      setLoadingMessages(false);
      setLoadingMore(false);
    }
  }, [dateRange, access, perPage, buildSearchQueryParams]);

  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Load more messages for infinite scroll
  const loadMoreMessages = useCallback(async (range = dateRange, searchParams = null) => {
    if (!hasNextPage || loadingMore) return;

    const nextPage = currentPageRef.current + 1;
    setLoadingMore(true);

    const paramsToUse = searchParams || lastSearchParams;

    try {
      await fetchMessages(range, paramsToUse, false, nextPage);
    } catch (error) {
      console.error('Failed to load more messages:', error);
      setErrorMessages(error.message);
      setLoadingMore(false);
    }
  }, [dateRange, hasNextPage, loadingMore, lastSearchParams, fetchMessages]);

  // Navigate to a specific page
  const goToPage = useCallback(async (page, range = dateRange) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    if (loadingMessages) return;
    await fetchMessages(range, lastSearchParams, true, page);
  }, [dateRange, totalPages, lastSearchParams, fetchMessages, loadingMessages]);

  // Handle sort model changes
  const handleSortModelChange = useCallback((newSortModel) => {
    setSortModel(newSortModel);

    let newSortParams;
    if (newSortModel.length > 0) {
      const { field, sort } = newSortModel[0];
      const fieldMapping = {
        'environment': 'environment_name',
        'environment_name': 'environment_name',
        'direction': 'message.direction',
        'status': 'message.status',
        'type': 'message.type',
        'subject': 'message.subject',
        'body': 'message.body',
      };
      const apiField = fieldMapping[field] || field;
      newSortParams = { order_by: apiField, order_type: sort };
      setSortParams(newSortParams);
    } else {
      newSortParams = { order_by: null, order_type: null };
      setSortParams(newSortParams);
    }

    const updatedSearchParams = { ...lastSearchParams };
    if (newSortParams.order_by && newSortParams.order_type) {
      updatedSearchParams.order_by = newSortParams.order_by;
      updatedSearchParams.order_type = newSortParams.order_type;
    } else {
      delete updatedSearchParams.order_by;
      delete updatedSearchParams.order_type;
    }

    fetchMessages(dateRange, updatedSearchParams, true);
  }, [dateRange, lastSearchParams, fetchMessages]);

  // Track if initial fetch has been performed
  const initialFetchRef = useRef(false);

  // Auto-fetch messages when columns are loaded
  useEffect(() => {
    if (!loadingColumns && !initialFetchRef.current && allRows.length === 0 && !lastSearchParams) {
      initialFetchRef.current = true;
      fetchMessages(dateRange);
    }
  }, [loadingColumns, dateRange, lastSearchParams, allRows.length, fetchMessages]);

  return {
    columns,
    messages,
    allRows,
    hasNextPage,
    currentPage,
    totalPages,
    totalRecords,
    loadingColumns,
    loadingMessages,
    loadingMore,
    errorColumns,
    errorMessages,
    fetchMessages,
    loadMoreMessages,
    goToPage,
    dateRange,
    setDateRange,
    sortModel,
    handleSortModelChange,
    segments,
    loadingSegments,
  };
};

export default useMessages;
