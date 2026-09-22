import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AdminService, AdminRow } from './admin.service';

/** One row of the box's call log, plus the `meta` the list template renders. */
export interface CallLogEntry extends AdminRow {
    sid?: string;
    from_number?: string;
    to_number?: string;
    /** "inbound" | "outbound" | "webrtc" as written by the projector. */
    direction?: string;
    /** "ringing" | "answered" | "ended". */
    status?: string;
    hangup_cause?: string;
    started_at?: string;
    answered_at?: string;
    ended_at?: string;
    meta?: {
        _direction: 'incoming' | 'outgoing' | 'missed';
        _contact_number: string;
        _contact_fullname: string;
        _duration: string;
        _blacklisted: boolean;
    };
}

const PAGE_SIZE = 20;

/**
 * The call log — the connectix box's own `/api/admin/calls`, which is READ-ONLY
 * (the projector writes it; the API answers 405 to any mutation).
 *
 * Everything the mothership call API offered on top of a list — server-side
 * search/segments/columns/export, blacklisting, per-call "run" — has no local
 * equivalent, so those methods are gone rather than sending params the box
 * ignores. Type filtering is done client-side in the page, off `meta._direction`.
 */
@Injectable()
export class CallService {
    constructor(private admin: AdminService) {}

    /**
     * One page of calls, newest first, in the `{ body: rows }` envelope the
     * existing consumers already unwrap. Rows carry a `meta` block built from
     * the local fields.
     */
    getPage(page: number = 1, _filter: any = {}): Observable<{ body: CallLogEntry[] }> {
        const offset = Math.max(0, (page - 1)) * PAGE_SIZE;
        return this.admin.list<CallLogEntry>('calls', { limit: PAGE_SIZE, offset }).pipe(
            map((rows) => ({ body: rows.map((row) => CallService.decorate(row)) }))
        );
    }

    /** One call by id. */
    getByUuid(uuid: string): Observable<CallLogEntry | null> {
        return this.admin.get<CallLogEntry>('calls', uuid).pipe(
            map((row) => (row ? CallService.decorate(row) : null))
        );
    }

    // ==================
    // Field mapping
    // ==================

    /** Add the `meta` block the list/detail templates bind to. */
    static decorate(row: CallLogEntry): CallLogEntry {
        const direction = CallService.uiDirection(row);
        row.meta = {
            _direction: direction,
            _contact_number: direction === 'outgoing' ? (row.to_number || '') : (row.from_number || ''),
            _contact_fullname: 'unknown',
            _duration: CallService.duration(row),
            _blacklisted: false
        };
        // The list groups and formats by created_at; the call's own start time is
        // the meaningful one, not when the row was inserted.
        if (row.started_at) { row.created_at = row.started_at; }
        return row;
    }

    /**
     * "inbound"/"outbound"/"webrtc" -> the three icons the list knows. An inbound
     * call that ended without ever being answered is a missed call.
     */
    static uiDirection(row: CallLogEntry): 'incoming' | 'outgoing' | 'missed' {
        if (row.direction === 'inbound') {
            return (row.status === 'ended' && !row.answered_at) ? 'missed' : 'incoming';
        }
        return 'outgoing';
    }

    /** Talk time when answered, else ring time. Formatted "m:ss". */
    static duration(row: CallLogEntry): string {
        const from = row.answered_at || row.started_at;
        if (!from || !row.ended_at) { return '0:00'; }
        const seconds = Math.max(0, Math.round((Date.parse(row.ended_at) - Date.parse(from)) / 1000));
        if (isNaN(seconds)) { return '0:00'; }
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        return minutes + ':' + (rest < 10 ? '0' : '') + rest;
    }
}
