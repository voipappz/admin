import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket — an ActionCable client over the native WebSocket API.
 *
 * `identifier` names the channel to subscribe to. Omit it and the original
 * DashboardLive shape is used, so existing callers are unaffected; pass one to
 * subscribe to any channel — LiveChannel, for instance, which serves the
 * materialised live state the node keeps in JetStream KV.
 *
 * `loginAction` is DashboardLive's handshake: it expects a `login` message
 * after the subscription is confirmed. Channels that stream on subscribe —
 * LiveChannel does, via a KV watch — pass false and receive data immediately.
 */
export const useWebSocket = (url, accountUuid, { identifier = null, loginAction = true } = {}) => {
  const [data, setData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!accountUuid || !url) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      setConnectionStatus('Connecting');
      setError(null);

      // The subprotocol is REQUIRED. Cable negotiates `actioncable-v1-json`
      // (settings.disable_sec_websocket_protocol_header = false), and a client
      // that does not request it is closed by the browser with "Server sent a
      // subprotocol but none was requested" — before `welcome`, so it looks
      // exactly like a refused token.
      wsRef.current = new WebSocket(url, ['actioncable-v1-json']);

      wsRef.current.onopen = () => {
        setConnectionStatus('Connected');
        reconnectAttempts.current = 0;
      };

      const channelIdentifier = identifier || {
        account_uuid: accountUuid,
        Live_uuid: "live",
        channel: "DashboardLive"
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'welcome') {
            const subscribeMessage = {
              command: "subscribe",
              identifier: JSON.stringify(channelIdentifier)
            };
            wsRef.current.send(JSON.stringify(subscribeMessage));
          } else if (message.type === 'reject_subscription') {
            // The channel refused us — a token that carries no tenant, or an
            // environment this session may not see. Reconnecting would refuse
            // again, so say so instead of looping.
            setError('Subscription rejected');
            setConnectionStatus('Rejected');
          } else if (message.type === 'confirm_subscription' && loginAction) {
            const loginMessage = {
              command: "message",
              identifier: JSON.stringify(channelIdentifier),
              data: JSON.stringify({
                account_uuid: accountUuid,
                Live_uuid: "live",
                action: "login"
              })
            };
            wsRef.current.send(JSON.stringify(loginMessage));
          } else if (message.message) {
            setData(message.message);
          }
        } catch {
          setError('Error parsing message');
        }
      };

      wsRef.current.onclose = (event) => {
        setConnectionStatus('Disconnected');

        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectAttempts.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, timeout);
        }
      };

      wsRef.current.onerror = () => {
        setError('WebSocket connection error');
        setConnectionStatus('Error');
      };

    } catch {
      setError('Failed to create WebSocket connection');
      setConnectionStatus('Error');
    }
  }, [url, accountUuid, identifier, loginAction]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    setConnectionStatus('Disconnected');
  }, []);

  useEffect(() => {
    if (accountUuid) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [accountUuid, connect, disconnect]);

  return {
    data,
    connectionStatus,
    error,
    connect,
    disconnect
  };
};
