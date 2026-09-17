import { Component } from '@angular/core';
import { WorkflowService } from '../../core/_base/layout/services/workflow.service';

@Component({
  selector: 'page-automations',
  templateUrl: 'automations-page.html',
  styleUrls: ['./automations-page.scss'],
  standalone: false
})
export class AutomationsPage {
  workflows: any[] = [];
  loading = true;
  errored = false;

  // Per-workflow expanded flow state: uuid -> { loading, nodes, error }
  flows: { [uuid: string]: { loading: boolean; nodes: any[]; error: boolean } } = {};
  expanded: { [uuid: string]: boolean } = {};

  constructor(private workflowSvc: WorkflowService) {}

  ionViewWillEnter() {
    if (!this.workflows.length) { this.load(); }
  }

  load(event?: any) {
    if (!event) { this.loading = true; }
    this.errored = false;
    this.workflowSvc.list().subscribe({
      next: (res: any) => {
        this.workflows = Array.isArray(res) ? res : (res?.data || res?.workflows || []);
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.errored = true;
        this.loading = false;
        this.workflows = [];
        event?.target?.complete();
      }
    });
  }

  // Tap a workflow -> toggle its flow view, lazy-loading the graph the first time.
  toggle(wf: any) {
    const id = wf?.uuid;
    if (!id) { return; }
    this.expanded[id] = !this.expanded[id];
    if (this.expanded[id] && !this.flows[id]) {
      this.flows[id] = { loading: true, nodes: [], error: false };
      this.workflowSvc.getFlow(id).subscribe({
        next: (res: any) => {
          this.flows[id] = { loading: false, nodes: this.extractNodes(res), error: false };
        },
        error: () => { this.flows[id] = { loading: false, nodes: [], error: true }; }
      });
    }
  }

  isExpanded(wf: any): boolean { return !!this.expanded[wf?.uuid]; }
  flowState(wf: any) { return this.flows[wf?.uuid]; }

  // flow_data is { nodes:[{id,type,data:{label,...}}], edges:[...] }.
  private extractNodes(res: any): any[] {
    const nodes = res?.nodes || res?.flow_data?.nodes || [];
    return (Array.isArray(nodes) ? nodes : []).map((n: any) => ({
      id: n?.id,
      type: n?.type,
      label: n?.data?.label || n?.label || n?.type || 'node'
    }));
  }

  typeColor(wf: any): string {
    switch ((wf?.type || '') + '') {
      case 'event': return 'primary';
      case 'schedule': case 'cron': return 'tertiary';
      case 'webhook': return 'secondary';
      default: return 'medium';
    }
  }
  nodeIcon(node: any): string {
    switch ((node?.type || '') + '') {
      case 'start': return 'play-circle-outline';
      case 'webhook': return 'globe-outline';
      case 'condition': case 'branch': return 'git-branch-outline';
      case 'dial': case 'call': return 'call-outline';
      case 'notification': return 'notifications-outline';
      case 'cog': case 'ai': return 'sparkles-outline';
      default: return 'ellipse-outline';
    }
  }
}
