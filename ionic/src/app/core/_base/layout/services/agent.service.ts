import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HandleRequest } from './handleRequest.service';
import { UserData } from '../../../providers/user-data';

@Injectable({
  providedIn: 'root'
})
export class AgentService {

  constructor(
    private handleRequest: HandleRequest,
    private userData: UserData
  ) {}

  getAgentStatuses(): Promise<any[]> {
    // Static list matching server-side statuses
    return Promise.resolve([
      { title: 'logged_out', icon: 'log-out' },
      { title: 'available', icon: 'checkmark-circle' },
      { title: 'available_on_demand', icon: 'home' },
      { title: 'on_break', icon: 'time' }
    ]);
  }

  getStates(): Observable<any> {
    return this.handleRequest.get('/api/agents?type=states');
  }

  getAgent(agentUuid: string): Observable<any> {
    return this.handleRequest.get('/api/agents/' + agentUuid);
  }

  updateState(state: string): Observable<any> {
    const uuid = this.userData.getUserData('uuid');
    if (!uuid) return new Observable(sub => sub.error('No user UUID'));
    return this.handleRequest.patch('/api/agents/' + uuid + '?action=state&state=' + state, {});
  }

  update(body: any): Observable<any> {
    const uuid = this.userData.getUserData('uuid');
    if (!uuid) return new Observable(sub => sub.error('No user UUID'));
    return this.handleRequest.patch('/api/users/' + uuid, body);
  }
}
