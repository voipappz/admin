import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { HandleRequest } from './handleRequest.service';

/**
 * AdminService — CRUD over the connectix box's own Ash/Mnesia resources,
 * served by the local Elixir backend at `/api/admin/*`:
 *
 *   GET    /api/admin/:resource?limit=&offset=   -> { "data": [row, ...] }  (newest first)
 *   POST   /api/admin/:resource                  -> 201 row | 422 { error }
 *   GET    /api/admin/:resource/:id              -> row | 404
 *   PATCH  /api/admin/:resource/:id              -> row | 404 | 422
 *   DELETE /api/admin/:resource/:id              -> 204 | 404 | 422
 *   GET    /api/admin/me/sip                     -> { username, password, display_name } | 404
 *
 * Two things this layer normalises for the rest of the app:
 *
 *  1. **`id` <-> `uuid`.** The local resources use `id` as the primary key; every
 *     page in this app reads `.uuid`. Rows coming back get a `uuid` mirror (and
 *     `bot_id` also appears as `bot_uuid`); payloads going out get the mirrors
 *     translated back and the server-owned fields stripped.
 *  2. **Absence is not an error.** A box without this API (404), an older build,
 *     or no network must leave the page usable: reads degrade to an empty
 *     list / null with a console warning. Writes still surface their error so a
 *     failed save is never reported as a success.
 */

export type AdminResource = 'users' | 'numbers' | 'bots' | 'statuses' | 'calls';

export interface AdminRow {
    /** Local primary key. */
    id?: string;
    /** Mirror of `id` — what the existing pages bind to. */
    uuid?: string;
    enabled?: boolean;
    inserted_at?: string;
    updated_at?: string;
    /** Mirror of `inserted_at` — what the existing list templates format. */
    created_at?: string;
    [key: string]: any;
}

/** `/api/admin/me/sip` — the caller's own SIP credentials from the box's Users table. */
export interface SipIdentity {
    username: string;
    password: string;
    display_name?: string;
}

export interface AdminListOptions {
    limit?: number;
    offset?: number;
}

/** Server-owned fields: never sent back on create/update. */
const READ_ONLY_KEYS = ['id', 'uuid', 'inserted_at', 'updated_at', 'created_at'];

@Injectable({ providedIn: 'root' })
export class AdminService {
    constructor(private handleRequest: HandleRequest) {}

    // ==================
    // CRUD
    // ==================

    /** A page of rows, newest first. Degrades to `[]`. */
    list<T extends AdminRow = AdminRow>(resource: AdminResource, opts: AdminListOptions = {}): Observable<T[]> {
        const params: string[] = [];
        if (opts.limit != null) { params.push('limit=' + opts.limit); }
        if (opts.offset != null) { params.push('offset=' + opts.offset); }
        const query = params.length ? '?' + params.join('&') : '';

        return this.handleRequest.getJson('/api/admin/' + resource + query).pipe(
            map((res: any) => ((res && res.data) || []).map((row: any) => AdminService.fromApi(row)) as T[]),
            catchError((err) => this.degrade(err, 'list ' + resource, [] as T[]))
        );
    }

    /** One row by id. Degrades to `null`. */
    get<T extends AdminRow = AdminRow>(resource: AdminResource, id: string): Observable<T | null> {
        return this.handleRequest.getJson('/api/admin/' + resource + '/' + encodeURIComponent(id)).pipe(
            map((row: any) => AdminService.fromApi(row) as T),
            catchError((err) => this.degrade(err, 'get ' + resource + '/' + id, null))
        );
    }

    /** Create. Errors propagate — a failed save must not look like a success. */
    create<T extends AdminRow = AdminRow>(resource: AdminResource, attrs: any): Observable<T> {
        return this.handleRequest.postJson('/api/admin/' + resource, AdminService.toApi(attrs)).pipe(
            map((row: any) => AdminService.fromApi(row) as T),
            catchError((err) => this.fail(err, 'create ' + resource))
        );
    }

    /** Update. Errors propagate. */
    update<T extends AdminRow = AdminRow>(resource: AdminResource, id: string, attrs: any): Observable<T> {
        return this.handleRequest
            .patchJson('/api/admin/' + resource + '/' + encodeURIComponent(id), AdminService.toApi(attrs))
            .pipe(
                map((row: any) => AdminService.fromApi(row) as T),
                catchError((err) => this.fail(err, 'update ' + resource + '/' + id))
            );
    }

    /** Delete. A real failure propagates; see confirmDeleted for the caveat. */
    delete(resource: AdminResource, id: string): Observable<boolean> {
        const path = '/api/admin/' + resource + '/' + encodeURIComponent(id);
        return this.handleRequest.deleteJson(path).pipe(
            map(() => true),
            catchError((err) => this.confirmDeleted(path, err))
        );
    }

    /**
     * A DELETE that errored is not necessarily a DELETE that failed.
     *
     * Verified against a live box (2026-08): a successful delete removes the row
     * and *then* fails to send its response — `AdminApiPlug` answers 204 with a
     * JSON body, which cowboy rejects ("204 and 304 responses must not include a
     * body", RFC 7230 3.3), so the client sees a 500 for work that landed.
     *
     * So we don't guess: read the row back. Gone (404) = deleted. Still there =
     * a genuine failure, and the original error propagates.
     */
    private confirmDeleted(path: string, err: any): Observable<boolean> {
        return this.handleRequest.getJson(path).pipe(
            map(() => 'present'),
            catchError((probe) => of(probe && probe.status === 404 ? 'gone' : 'present')),
            switchMap((state) => {
                if (state === 'gone') {
                    console.warn('[AdminService] DELETE ' + path + ' reported ' + (err?.status ?? 'an error') + ' but the row is gone — treating as deleted');
                    return of(true);
                }
                return this.fail(err, 'delete ' + path);
            })
        );
    }

    // ==================
    // Identity
    // ==================

    /**
     * The caller's SIP identity straight from the box's Users table.
     * `null` when the box has no matching user (404) or no local API at all —
     * the caller then falls back to whatever the login payload carried.
     */
    meSip(): Observable<SipIdentity | null> {
        return this.handleRequest.getJson('/api/admin/me/sip').pipe(
            map((row: any) => (row && row.username ? (row as SipIdentity) : null)),
            catchError((err) => this.degrade(err, 'me/sip', null))
        );
    }

    // ==================
    // id <-> uuid mapping
    // ==================

    /**
     * Server row -> app row: mirror `id` as `uuid`, `<rel>_id` as `<rel>_uuid`,
     * `inserted_at` as `created_at`, and map embedded rows (e.g. a number's
     * `bot`) the same way.
     */
    static fromApi(row: any): AdminRow | null {
        if (!row || typeof row !== 'object') { return row; }

        const mapped: AdminRow = {};
        Object.keys(row).forEach((key) => {
            const value = row[key];
            mapped[key] = value && typeof value === 'object' && !Array.isArray(value)
                ? AdminService.fromApi(value)
                : value;

            if (key === 'id') {
                mapped.uuid = value;
            } else if (key.length > 3 && key.slice(-3) === '_id') {
                mapped[key.slice(0, -3) + '_uuid'] = value;
            }
        });

        if (mapped['inserted_at'] && !mapped['created_at']) {
            mapped['created_at'] = mapped['inserted_at'];
        }
        return mapped;
    }

    /**
     * App payload -> server payload: drop the server-owned fields and the
     * embedded rows, and translate `<rel>_uuid` back to `<rel>_id`.
     */
    static toApi(attrs: any): any {
        if (!attrs || typeof attrs !== 'object') { return attrs; }

        const payload: any = {};
        Object.keys(attrs).forEach((key) => {
            const value = attrs[key];
            if (READ_ONLY_KEYS.indexOf(key) !== -1) { return; }
            // Embedded rows (number.bot) and arrays are read-only projections.
            if (value && typeof value === 'object') { return; }
            if (value === undefined) { return; }

            if (key.length > 5 && key.slice(-5) === '_uuid') {
                payload[key.slice(0, -5) + '_id'] = value;
            } else {
                payload[key] = value;
            }
        });
        return payload;
    }

    // ==================
    // Failure handling
    // ==================

    /** Reads: warn and hand back a usable empty value. */
    private degrade<T>(err: any, what: string, fallback: T): Observable<T> {
        console.warn('[AdminService] ' + what + ' unavailable (' + (err?.status ?? 'error') + ') — degrading', err?.error || err?.message || err);
        return of(fallback);
    }

    /** Writes: warn and re-throw so callers can show the failure. */
    private fail(err: any, what: string): Observable<never> {
        const message = err?.error?.error || err?.error?.message || err?.message || 'request failed';
        console.warn('[AdminService] ' + what + ' failed (' + (err?.status ?? 'error') + '): ' + message);
        return throwError(() => err);
    }
}
