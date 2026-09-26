import { describe, it, expect } from 'vitest';
import { sipSettingsFromDevice, sipSettingsFromUser } from './sipSettings';

// A device as GET /api/devices/:uuid returns it (Serializers::Extension
// :default): its own SIP secret, and its environment's domain and wss server.
const device = {
  uuid: 'dev-1', name: 'Reception', username: '201', password: 's3cret',
  environment: { uuid: 'env-1', domain: '6174.nimbusip.com', wss_server: 'sbc.voipappz.io:7443' },
};

describe('sipSettingsFromDevice', () => {
  it('registers as the device, on its environment', () => {
    const s = sipSettingsFromDevice(device, { wssUrl: '', domain: '', username: '', password: '', displayName: '', autoConnect: false });
    expect(s).toMatchObject({
      username: '201', password: 's3cret', domain: '6174.nimbusip.com',
      wssUrl: 'wss://sbc.voipappz.io:7443', displayName: 'Reception', autoConnect: true,
    });
  });
});

describe('sipSettingsFromUser', () => {
  it('registers the extension belonging to the logged-in user environment', () => {
    const s = sipSettingsFromUser({
      fullname: 'Dana Example',
      extension: { username: '305', password: 'extension-secret' },
      environment: { domain: 'd.example', wss_server: 'sbc.example:7443' },
    }, '', { wssUrl: '', domain: '', username: '', password: '', displayName: '', autoConnect: false });

    expect(s).toMatchObject({
      username: '305', password: 'extension-secret', domain: 'd.example',
      wssUrl: 'wss://sbc.example:7443', displayName: 'Dana Example', autoConnect: true,
    });
  });
});
