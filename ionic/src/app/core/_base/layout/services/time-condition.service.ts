import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { UserData } from '../../../providers/user-data';

/**
 * TimeConditionService - Manages call condition (time-based routing) configuration
 *
 * API Endpoints:
 * - GET  /api/call_conditions - List all call conditions
 * - GET  /api/call_conditions/{uuid}?action=load - Get specific call condition
 * - PATCH /api/call_conditions/{uuid} - Update call condition
 */
@Injectable({
    providedIn: 'root'
})
export class TimeConditionService {
    constructor(
        private handleRequest: HandleRequest,
        private userData: UserData
    ) {}

    /**
     * Get all call conditions with pagination
     */
    public get(): Observable<any> {
        return this.handleRequest.get("/api/call_conditions?page=1&per_page=20&order_by=created_at&order_type=desc");

        /* DEV MODE - mock data:
        return of(this.getMockTimeConditionList());
        */
    }

    /**
     * Get a specific call condition by UUID
     * @param uuid - The call condition UUID
     */
    public getByUuid(uuid: string): Observable<any> {
        return this.handleRequest.get("/api/call_conditions/" + uuid + '?action=load');

        /* DEV MODE - mock data:
        return of(this.getMockTimeCondition());
        */
    }

    /**
     * Create a new call condition
     * @param data - The call condition data
     */
    public create(data: any): Observable<any> {
        // Add environment_uuid from user data
        const user = this.userData.getUserData();
        if (user?.environment?.uuid) {
            data.environment_uuid = user.environment.uuid;
        }
        return this.handleRequest.post("/api/call_conditions", data);
    }

    /**
     * Update a call condition
     * @param uuid - The call condition UUID
     * @param data - The updated call condition data
     */
    public update(uuid: string, data: any): Observable<any> {
        // Add environment_uuid from user data
        const user = this.userData.getUserData();
        if (user?.environment?.uuid) {
            data.environment_uuid = user.environment.uuid;
        }
        return this.handleRequest.patch("/api/call_conditions/" + uuid, data);
    }

    /**
     * Get resources by type (extensions, ivrs, numbers)
     * @param type - The resource type (extension, ivr, number)
     */
    public getUuids(type: string): Observable<any> {
        return this.handleRequest.get("/api/" + type + 's');
    }

    /**
     * Get a specific number by UUID
     * @param uuid - The number UUID
     */
    public getNumber(uuid: string): Observable<any> {
        return this.handleRequest.get("/api/numbers/" + uuid);
    }

    /**
     * Returns mock time condition list for development/testing.
     */
    private getMockTimeConditionList(): any[] {
        return [{ uuid: 'mock-tc-uuid-001', name: 'Mock Time Condition' }];
    }

    /**
     * Returns mock time condition data for development/testing.
     * - Sunday-Wednesday: 9:00-17:00, bridge = work
     * - Thursday-Saturday: 8:00-18:30, bridge = home
     * - Fallback bridge: mobile
     */
    private getMockTimeCondition(): any {
        return {
            uuid: 'mock-tc-uuid-001',
            name: 'Mock Time Condition',
            meta: { type: 'selected_hours' },
            fallback_bridge_type: 'number',
            fallback_bridge_uuid: 'mock-mobile-uuid-003',
            resources: [
                // Sunday-Wednesday: 9:00-17:00, work (extension)
                { week_day: '1-1', time: '09:00-17:00', bridge_type: 'extension', bridge_uuid: 'mock-work-uuid-002' },
                { week_day: '2-2', time: '09:00-17:00', bridge_type: 'extension', bridge_uuid: 'mock-work-uuid-002' },
                { week_day: '3-3', time: '09:00-17:00', bridge_type: 'extension', bridge_uuid: 'mock-work-uuid-002' },
                { week_day: '4-4', time: '09:00-17:00', bridge_type: 'extension', bridge_uuid: 'mock-work-uuid-002' },
                // Thursday-Saturday: 8:00-18:30, home (number)
                { week_day: '5-5', time: '08:00-18:30', bridge_type: 'number', bridge_uuid: 'mock-home-uuid-001' },
                { week_day: '6-6', time: '08:00-18:30', bridge_type: 'number', bridge_uuid: 'mock-home-uuid-001' },
                { week_day: '7-7', time: '08:00-18:30', bridge_type: 'number', bridge_uuid: 'mock-home-uuid-001' }
            ]
        };
    }
}
