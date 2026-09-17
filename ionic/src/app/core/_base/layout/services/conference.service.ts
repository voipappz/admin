import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HandleRequest } from './handleRequest.service';

// Conferences are scoped to the current user server-side (GET /api/conferences
// returns the user's conferences). The :list serializer yields
// { uuid, name, status, schedule_at, members_count_current, user_pin, moderator_pin, did }.
@Injectable({ providedIn: 'root' })
export class ConferenceService {
  constructor(private handleRequest: HandleRequest) {}

  list(): Observable<any> {
    return this.handleRequest.get('/api/conferences');
  }

  get(uuid: string): Observable<any> {
    return this.handleRequest.get(`/api/conferences/${uuid}`);
  }
}
