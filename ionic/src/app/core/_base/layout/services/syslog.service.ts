import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HandleRequest } from './handleRequest.service';

export interface SyslogQuery {
  page?: number;
  per_page?: number;
  search?: string;
  event_type?: string;
  level?: string;
  from?: number;   // unix seconds
  to?: number;     // unix seconds
}

// Thin wrapper over the API's browse-all logs endpoint (GET /api/logs/).
// The endpoint is scoped to the current user's customer server-side and
// returns { data: [...], total_records }.
@Injectable({ providedIn: 'root' })
export class SyslogService {
  constructor(private handleRequest: HandleRequest) {}

  list(query: SyslogQuery = {}): Observable<any> {
    const params: string[] = [];
    params.push(`page=${query.page || 1}`);
    params.push(`per_page=${query.per_page || 50}`);
    if (query.search) { params.push(`search=${encodeURIComponent(query.search)}`); }
    if (query.event_type) { params.push(`event_type=${encodeURIComponent(query.event_type)}`); }
    if (query.level) { params.push(`level=${encodeURIComponent(query.level)}`); }
    if (query.from) { params.push(`from=${query.from}`); }
    if (query.to) { params.push(`to=${query.to}`); }
    return this.handleRequest.get(`/api/logs/?${params.join('&')}`);
  }

  // Distinct event types for the filter dropdown.
  eventTypes(): Observable<any> {
    return this.handleRequest.get('/api/logs/event_types');
  }
}
