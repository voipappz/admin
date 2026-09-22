import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HandleRequest } from './handleRequest.service';
import { AdminService } from './admin.service';
import { NumberEntity } from '../models/number.model';

/**
 * Numbers — the connectix box's own `/api/admin/numbers`.
 *
 * A number here is: the digits, a note, and the bot that answers it. The
 * mothership's bridge/destination tree has no local equivalent, so it is not
 * sent. Reads degrade to empty (AdminService); writes surface their error.
 */
@Injectable({
    providedIn: 'root'
})
export class NumberService {
    constructor(private handleRequest: HandleRequest, private admin: AdminService) {}

    /** All numbers, newest first. */
    public getAll(): Observable<NumberEntity[]> {
        return this.admin.list<NumberEntity>('numbers', { limit: 100 });
    }

    /** First page of numbers. */
    public get(): Observable<NumberEntity[]> {
        return this.admin.list<NumberEntity>('numbers', { limit: 20 });
    }

    public getOne(uuid: string): Observable<NumberEntity | null> {
        return this.admin.get<NumberEntity>('numbers', uuid);
    }

    public update(uuid: string, data: Partial<NumberEntity>): Observable<NumberEntity> {
        return this.admin.update<NumberEntity>('numbers', uuid, data);
    }

    public create(data: Partial<NumberEntity>): Observable<NumberEntity> {
        return this.admin.create<NumberEntity>('numbers', data);
    }

    public delete(uuid: string): Observable<boolean> {
        return this.admin.delete('numbers', uuid);
    }

    public getByUuid(uuid: string): Observable<NumberEntity | null> {
        return this.getOne(uuid);
    }

    public getNumber(uuid: string): Observable<NumberEntity | null> {
        return this.getOne(uuid);
    }

    /**
     * Legacy mothership lookup (`/api/<type>s`) still used by the locations page
     * for entity pickers the local box does not model.
     */
    public getUuids(type: string): Observable<any> {
        return this.handleRequest.get('/api/' + type + 's');
    }
}
