import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { AdminService } from './admin.service';
import { Extension } from '../models/extension.model';

/**
 * Extensions — the connectix box's own `/api/admin/users`. On this box a "user"
 * IS a SIP extension: username (9001), display name, password, register?.
 *
 * `password` is write-only server-side (always null in responses), so it is only
 * sent when the form actually set one — otherwise a blank field would wipe it.
 */
@Injectable({
    providedIn: 'root'
})
export class ExtensionService {
    constructor(private handleRequest: HandleRequest, private admin: AdminService) {}

    /** All extensions, newest first. */
    public getAll(): Observable<Extension[]> {
        return this.admin.list<Extension>('users', { limit: 100 });
    }

    /** First page of extensions. */
    public get(): Observable<Extension[]> {
        return this.admin.list<Extension>('users', { limit: 20 });
    }

    public getOne(uuid: string): Observable<Extension | null> {
        return this.admin.get<Extension>('users', uuid);
    }

    public create(data: Partial<Extension>): Observable<Extension> {
        return this.admin.create<Extension>('users', this.preparePayload(data));
    }

    public update(uuid: string, data: Partial<Extension>): Observable<Extension> {
        return this.admin.update<Extension>('users', uuid, this.preparePayload(data));
    }

    public delete(uuid: string): Observable<boolean> {
        return this.admin.delete('users', uuid);
    }

    public getByUuid(uuid: string): Observable<Extension | null> {
        return this.getOne(uuid);
    }

    /**
     * Only the fields the local Users resource owns. A blank password is dropped
     * so an edit never clears the stored credential.
     */
    private preparePayload(data: Partial<Extension>): any {
        const payload: any = {};
        if (data.username !== undefined) { payload.username = data.username; }
        if (data.display_name !== undefined) { payload.display_name = data.display_name; }
        if (data.enabled !== undefined) { payload.enabled = data.enabled; }
        if (data['register?'] !== undefined) { payload['register?'] = data['register?']; }
        if (data.server !== undefined) { payload.server = data.server; }
        if (data.port !== undefined) { payload.port = data.port; }
        if (data.domain !== undefined) { payload.domain = data.domain; }
        if (data.password) { payload.password = data.password; }
        return payload;
    }

    /**
     * Legacy mothership lookup (`/api/<type>s`) still used by the locations page
     * for entity pickers the local box does not model.
     */
    public getUuids(type: string): Observable<any> {
        return this.handleRequest.get('/api/' + type + 's');
    }
}
