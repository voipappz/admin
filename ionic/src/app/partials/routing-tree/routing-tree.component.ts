import { Component, Input, OnChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IvrService } from '../../core/_base/layout/services/ivr.service';
import { TimeConditionService } from '../../core/_base/layout/services/time-condition.service';
import { QueueService } from '../../core/_base/layout/services/queue.service';

interface TreeNode {
  branch?: string;   // edge label, e.g. "Press 1", "Mon", "Otherwise"
  icon: string;
  color: string;
  label: string;     // destination name / type
}

// Simple, read-only, mobile routing tree: shows the active number's destination
// and (for branching types) its immediate branches. Depth = 2, no recursion.
@Component({
  selector: 'app-routing-tree',
  templateUrl: './routing-tree.component.html',
  styleUrls: ['./routing-tree.component.scss'],
  standalone: false,
  providers: [IvrService, TimeConditionService, QueueService]
})
export class RoutingTreeComponent implements OnChanges {
  @Input() bridgeType = '';
  @Input() bridgeUuid = '';
  @Input() rootLabel = '';   // the number/DID

  loading = false;
  children: TreeNode[] = [];

  constructor(
    private translate: TranslateService,
    private ivrService: IvrService,
    private tcService: TimeConditionService,
    private queueService: QueueService
  ) {}

  ngOnChanges() {
    this.children = [];
    if (this.bridgeType && this.bridgeUuid) { this.load(); }
  }

  get rootNode(): TreeNode {
    return { icon: this.iconFor(this.bridgeType), color: this.colorFor(this.bridgeType), label: this.typeLabel(this.bridgeType) };
  }

  private load() {
    if (this.bridgeType === 'ivr') {
      this.loading = true;
      this.ivrService.getIvr(this.bridgeUuid).subscribe({
        next: (ivr: any) => { this.children = this.fromIvr(ivr); this.loading = false; },
        error: () => { this.loading = false; }
      });
    } else if (this.bridgeType === 'call_condition' || this.bridgeType === 'time_condition') {
      this.loading = true;
      this.tcService.getByUuid(this.bridgeUuid).subscribe({
        next: (tc: any) => { this.children = this.fromTc(tc); this.loading = false; },
        error: () => { this.loading = false; }
      });
    } else if (this.bridgeType === 'queue') {
      this.loading = true;
      this.queueService.get(this.bridgeUuid).subscribe({
        next: (q: any) => { this.children = this.fromQueue(q); this.loading = false; },
        error: () => { this.loading = false; }
      });
    }
    // extension / number / announcement: terminal — no children.
  }

  private node(branch: string, type: string, label?: string): TreeNode {
    return { branch, icon: this.iconFor(type), color: this.colorFor(type), label: label || this.typeLabel(type) };
  }

  private fromIvr(ivr: any): TreeNode[] {
    const nodes: TreeNode[] = [];
    (ivr?.entries || []).forEach((e: any) => {
      if (e?.bridge_type) {
        nodes.push(this.node(this.translate.instant('ACTIONS.TREE.PRESS', { key: e.entry }), e.bridge_type, e.name || this.typeLabel(e.bridge_type)));
      }
    });
    if (ivr?.timeout_bridge_type) { nodes.push(this.node(this.translate.instant('ACTIONS.TREE.TIMEOUT'), ivr.timeout_bridge_type)); }
    if (ivr?.invalid_bridge_type) { nodes.push(this.node(this.translate.instant('ACTIONS.TREE.INVALID'), ivr.invalid_bridge_type)); }
    return nodes;
  }

  private fromTc(tc: any): TreeNode[] {
    const nodes: TreeNode[] = [];
    (tc?.resources || []).forEach((r: any) => {
      if (r?.bridge_type) { nodes.push(this.node(this.dayLabel(r.week_day), r.bridge_type)); }
    });
    if (tc?.fallback_bridge_type) { nodes.push(this.node(this.translate.instant('ACTIONS.TREE.OTHERWISE'), tc.fallback_bridge_type)); }
    return nodes;
  }

  private fromQueue(q: any): TreeNode[] {
    const nodes: TreeNode[] = [];
    if (q?.max_wait_time_bridge_type) { nodes.push(this.node(this.translate.instant('ACTIONS.TREE.FALLBACK'), q.max_wait_time_bridge_type)); }
    return nodes;
  }

  private dayLabel(wd: any): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const n = parseInt(wd, 10);
    return isNaN(n) ? (wd || '') + '' : (days[n] ?? (wd + ''));
  }

  typeLabel(type: string): string {
    const key = `IVR.BRIDGE_TYPES.${type}`;
    const t = this.translate.instant(key);
    return t !== key ? t : type;
  }

  iconFor(type: string): string {
    switch (type) {
      case 'ivr': return 'keypad-outline';
      case 'queue': return 'people-outline';
      case 'extension': return 'call-outline';
      case 'number': return 'phone-portrait-outline';
      case 'call_condition':
      case 'time_condition': return 'time-outline';
      case 'announcement': return 'megaphone-outline';
      case 'voicemail': return 'recording-outline';
      default: return 'git-branch-outline';
    }
  }

  colorFor(type: string): string {
    switch (type) {
      case 'ivr': return 'tertiary';
      case 'queue': return 'success';
      case 'extension': return 'primary';
      case 'number': return 'warning';
      case 'call_condition':
      case 'time_condition': return 'secondary';
      default: return 'medium';
    }
  }
}
