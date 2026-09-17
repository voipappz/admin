import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { Ivr, IvrEntry } from '../models/ivr.model';
import { UserData } from '../../../providers/user-data';

/**
 * IvrService - Manages IVR (Interactive Voice Response) menu configuration
 *
 * API Endpoints:
 * - GET    /api/ivrs - List all IVRs
 * - GET    /api/ivrs/{uuid} - Get specific IVR
 * - POST   /api/ivrs - Create new IVR
 * - PATCH  /api/ivrs/{uuid} - Update IVR
 * - DELETE /api/ivrs/{uuid} - Delete IVR
 * - GET    /api/announcements - Get available announcements
 * - GET    /api/assets/bridge_types - Get available bridge types
 */
@Injectable({
    providedIn: 'root'
})
export class IvrService {
    constructor(
        private handleRequest: HandleRequest,
        private userData: UserData
    ) {}

    /**
     * Get all IVRs with pagination
     */
    public getIvrs(): Observable<any> {
        return this.handleRequest.get("/api/ivrs?page=1&per_page=50&order_by=created_at&order_type=desc");

        /* MOCK DATA - uncomment for development without server
        return of(this.getMockIvrList());
        */
    }

    /**
     * Get a specific IVR by UUID
     * @param uuid - The IVR UUID
     */
    public getIvr(uuid: string): Observable<any> {
        return this.handleRequest.get("/api/ivrs/" + uuid);

        /* MOCK DATA - uncomment for development without server
        return of(this.getMockIvr(uuid));
        */
    }

    /**
     * Create a new IVR
     * @param data - The IVR data
     */
    public createIvr(data: Ivr): Observable<Ivr> {
        // Convert entries array to object format expected by API
        const payload = this.prepareIvrPayload(data);
        return this.handleRequest.post("/api/ivrs", payload);
    }

    /**
     * Update an IVR
     * @param uuid - The IVR UUID
     * @param data - The updated IVR data
     */
    public updateIvr(uuid: string, data: Ivr): Observable<Ivr> {
        // Convert entries array to object format expected by API
        const payload = this.prepareIvrPayload(data);
        return this.handleRequest.patch("/api/ivrs/" + uuid, payload);
    }

    /**
     * Delete an IVR
     * @param uuid - The IVR UUID
     */
    public deleteIvr(uuid: string): Observable<any> {
        return this.handleRequest.delete("/api/ivrs/" + uuid, {});
    }

    /**
     * Get available announcements for IVR greeting
     */
    public getAnnouncements(): Observable<any> {
        return this.handleRequest.get("/api/announcements");

        /* MOCK DATA - uncomment for development without server
        return of(this.getMockAnnouncements());
        */
    }

    /**
     * Get available bridge types (extension, queue, ivr, etc.)
     */
    public getBridgeTypes(): Observable<any> {
        return this.handleRequest.get("/api/assets/bridge_types");

        /* MOCK DATA - uncomment for development without server
        return of(['extension', 'queue', 'ivr', 'ring_group', 'voicemail', 'announcement', 'number']);
        */
    }

    /**
     * Get resources by type (for bridge selection)
     * @deprecated Use getBridgeData instead
     * @param type - The resource type (extension, ivr, number)
     */
    public getUuids(type: string): Observable<any[]> {
        return this.getBridgeData(type);
    }

    /**
     * Get resources by bridge type (for destination selection)
     * @param type - The bridge type (extension, queue, ivr, etc.)
     */
    public getBridgeData(type: string): Observable<any> {
        // Normalize queue type
        if (type === 'que') type = 'queue';

        return this.handleRequest.get("/api/" + type + "s");

        /* MOCK DATA - uncomment for development without server
        return of(this.getMockBridgeData(type));
        */
    }

    /**
     * Prepare IVR payload for API
     * Converts entries array to object format expected by backend
     */
    private prepareIvrPayload(data: Ivr): any {
        const payload: any = { ...data };

        // Add environment_uuid from logged-in user
        const user = this.userData.getUserData();
        if (user?.environment?.uuid) {
            payload.environment_uuid = user.environment.uuid;
        }

        // Convert entries array to object with entry as key
        if (data.entries && Array.isArray(data.entries)) {
            const entriesObj: { [key: string]: Omit<IvrEntry, 'entry'> } = {};
            for (const entry of data.entries) {
                if (entry.entry) {
                    entriesObj[entry.entry] = {
                        name: entry.name,
                        bridge_type: entry.bridge_type,
                        bridge_uuid: entry.bridge_uuid
                    };
                }
            }
            payload.entries = entriesObj as any;
        }

        return payload;
    }

    /**
     * Parse IVR response from API
     * Converts entries object to array format for easier manipulation
     */
    public parseIvrResponse(ivr: any): Ivr {
        const parsed = { ...ivr };

        // Convert entries object to array
        if (ivr.entries && typeof ivr.entries === 'object' && !Array.isArray(ivr.entries)) {
            const entriesArray: IvrEntry[] = [];
            for (const key in ivr.entries) {
                if (ivr.entries.hasOwnProperty(key)) {
                    entriesArray.push({
                        entry: key,
                        name: ivr.entries[key].name || '',
                        bridge_type: ivr.entries[key].bridge_type || '',
                        bridge_uuid: ivr.entries[key].bridge_uuid || ''
                    });
                }
            }
            parsed.entries = entriesArray;
        }

        return parsed;
    }

    // =====================
    // Mock Data for Development
    // =====================

    private getMockIvrList(): Ivr[] {
        return [
            {
                uuid: 'mock-ivr-001',
                name: 'Main Menu',
                enabled: true,
                profile: { direct_dial: 'true' },
                announcement_uuid: 'mock-ann-001',
                entries: [
                    { entry: '1', name: 'Sales', bridge_type: 'queue', bridge_uuid: 'mock-queue-sales' },
                    { entry: '2', name: 'Support', bridge_type: 'queue', bridge_uuid: 'mock-queue-support' },
                    { entry: '0', name: 'Operator', bridge_type: 'extension', bridge_uuid: 'mock-ext-100' }
                ],
                timeout: 5,
                timeout_bridge_type: 'ivr',
                timeout_bridge_uuid: 'mock-ivr-001',
                invalid: 3,
                invalid_bridge_type: 'voicemail',
                invalid_bridge_uuid: 'mock-vm-001'
            },
            {
                uuid: 'mock-ivr-002',
                name: 'After Hours',
                enabled: false,
                profile: { direct_dial: 'false' },
                announcement_uuid: 'mock-ann-002',
                entries: [
                    { entry: '1', name: 'Leave Message', bridge_type: 'voicemail', bridge_uuid: 'mock-vm-001' }
                ],
                timeout: 10,
                timeout_bridge_type: 'voicemail',
                timeout_bridge_uuid: 'mock-vm-001',
                invalid: 2,
                invalid_bridge_type: 'voicemail',
                invalid_bridge_uuid: 'mock-vm-001',
                notes: 'Used for after-hours calls'
            }
        ];
    }

    private getMockIvr(uuid: string): Ivr {
        const list = this.getMockIvrList();
        return list.find(ivr => ivr.uuid === uuid) || list[0];
    }

    private getMockAnnouncements(): any[] {
        return [
            { uuid: 'mock-ann-001', name: 'Welcome Message' },
            { uuid: 'mock-ann-002', name: 'After Hours Greeting' },
            { uuid: 'mock-ann-003', name: 'Holiday Message' }
        ];
    }

    private getMockBridgeData(type: string): any[] {
        const mockData: { [key: string]: any[] } = {
            extension: [
                { uuid: 'mock-ext-100', name: 'Reception (100)' },
                { uuid: 'mock-ext-101', name: 'Sales Manager (101)' },
                { uuid: 'mock-ext-102', name: 'Support Lead (102)' }
            ],
            queue: [
                { uuid: 'mock-queue-sales', name: 'Sales Queue' },
                { uuid: 'mock-queue-support', name: 'Support Queue' }
            ],
            ivr: [
                { uuid: 'mock-ivr-001', name: 'Main Menu' },
                { uuid: 'mock-ivr-002', name: 'After Hours' }
            ],
            ring_group: [
                { uuid: 'mock-rg-001', name: 'Sales Team' },
                { uuid: 'mock-rg-002', name: 'Support Team' }
            ],
            voicemail: [
                { uuid: 'mock-vm-001', name: 'General Voicemail' },
                { uuid: 'mock-vm-002', name: 'Sales Voicemail' }
            ],
            announcement: [
                { uuid: 'mock-ann-001', name: 'Welcome Message' },
                { uuid: 'mock-ann-002', name: 'After Hours Greeting' }
            ]
        };

        return mockData[type] || [];
    }
}
