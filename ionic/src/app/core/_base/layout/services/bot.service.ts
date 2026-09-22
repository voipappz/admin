import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminService } from './admin.service';
import { Bot } from '../models/bot.model';

/**
 * Bots — the connectix box's own `/api/admin/bots`. A bot is what answers a
 * number: a name, a model, a system prompt, a greeting, and a keyword script.
 */
@Injectable({
    providedIn: 'root'
})
export class BotService {
    constructor(private admin: AdminService) {}

    /** All bots, newest first. Degrades to `[]`. */
    public getAll(): Observable<Bot[]> {
        return this.admin.list<Bot>('bots', { limit: 100 });
    }

    public getOne(uuid: string): Observable<Bot | null> {
        return this.admin.get<Bot>('bots', uuid);
    }

    public create(data: Partial<Bot>): Observable<Bot> {
        return this.admin.create<Bot>('bots', data);
    }

    public update(uuid: string, data: Partial<Bot>): Observable<Bot> {
        return this.admin.update<Bot>('bots', uuid, data);
    }

    public delete(uuid: string): Observable<boolean> {
        return this.admin.delete('bots', uuid);
    }
}
