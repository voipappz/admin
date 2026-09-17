import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HandleRequest } from './handleRequest.service';

// Read-only client over the existing /api/workflows endpoint (automations /
// call-flow rules). The list serializer returns
// { uuid, name, type, enabled, notes, created_at, updated_at }.
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  constructor(private handleRequest: HandleRequest) {}

  list(): Observable<any> {
    return this.handleRequest.get('/api/workflows');
  }

  // Flow graph for one workflow: { nodes: [...], edges: [...] }.
  getFlow(uuid: string): Observable<any> {
    return this.handleRequest.get(`/api/workflows/${uuid}/flow?format=json`);
  }
}
