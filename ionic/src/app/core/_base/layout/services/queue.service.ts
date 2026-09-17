import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { Queue } from '../models/queue.model';
import { UserData } from '../../../providers/user-data';

/**
 * QueueService - Manages queue configuration
 *
 * API Endpoints:
 * - GET    /api/queues - List all queues
 * - GET    /api/queues/{uuid} - Get specific queue
 * - POST   /api/queues - Create new queue
 * - PATCH  /api/queues/{uuid} - Update queue
 * - DELETE /api/queues/{uuid} - Delete queue
 * - GET    /api/assets/queue_strategies - Get available strategies
 * - GET    /api/users - Get available agents
 */
@Injectable({
    providedIn: 'root'
})
export class QueueService {
    constructor(
        private handleRequest: HandleRequest,
        private userData: UserData
    ) {}

    /**
     * Get all queues
     */
    public getAll(): Observable<any> {
        return this.handleRequest.get('/api/queues');
    }

    /**
     * Get a specific queue by UUID
     */
    public get(uuid: string): Observable<any> {
        return this.handleRequest.get('/api/queues/' + uuid);
    }

    /**
     * Create a new queue
     */
    public create(data: Queue): Observable<any> {
        return this.handleRequest.post('/api/queues', this.preparePayload(data));
    }

    /**
     * Update a queue
     */
    public update(uuid: string, data: Queue): Observable<any> {
        return this.handleRequest.patch('/api/queues/' + uuid, this.preparePayload(data));
    }

    /**
     * Delete a queue
     */
    public delete(uuid: string): Observable<any> {
        return this.handleRequest.delete('/api/queues/' + uuid, {});
    }

    /**
     * Get available queue strategies
     */
    public getStrategies(): Observable<any> {
        return this.handleRequest.get('/api/assets/queue_strategies');
    }

    /**
     * Get available agents (users)
     */
    public getAgents(): Observable<any> {
        return this.handleRequest.get('/api/users');
    }

    /**
     * Get announcements for queue greeting/hold music
     */
    public getAnnouncements(): Observable<any> {
        return this.handleRequest.get('/api/announcements');
    }

    /**
     * Get bridge types for fallback destination
     */
    public getBridgeTypes(): Observable<any> {
        return this.handleRequest.get('/api/assets/bridge_types');
    }

    /**
     * Get bridge data by type
     */
    public getBridgeData(type: string): Observable<any> {
        if (type === 'que') type = 'queue';
        return this.handleRequest.get('/api/' + type + 's');
    }

    /**
     * Prepare payload for API
     * Formats data according to API expectations:
     * - enabled as string "true"/"false"
     * - max_wait_time as string
     * - agents as "agents[]" array
     * - adds environment_uuid
     */
    private preparePayload(data: Queue): any {
        const payload: any = {};

        // Add environment_uuid from logged-in user
        const user = this.userData.getUserData();
        if (user?.environment?.uuid) {
            payload.environment_uuid = user.environment.uuid;
        }

        // Basic fields
        payload.name = data.name;
        payload.strategy = data.strategy;
        payload.enabled = data.enabled ? 'true' : 'false';

        // Announcements
        if (data.intro_announcement_uuid) {
            payload.intro_announcement_uuid = data.intro_announcement_uuid;
        }
        if (data.hold_announcement_uuid) {
            payload.hold_announcement_uuid = data.hold_announcement_uuid;
        }

        // Max wait time as string
        if (data.max_wait_time) {
            payload.max_wait_time = String(data.max_wait_time);
        }

        // Fallback bridge
        if (data.max_wait_time_bridge_type) {
            payload.max_wait_time_bridge_type = data.max_wait_time_bridge_type;
        }
        if (data.max_wait_time_bridge_uuid) {
            payload.max_wait_time_bridge_uuid = data.max_wait_time_bridge_uuid;
        }

        // Agents - serialize() will convert array to agents[]=uuid1&agents[]=uuid2
        if (data.agents && Array.isArray(data.agents) && data.agents.length > 0) {
            payload.agents = data.agents;
        }

        return payload;
    }
}
