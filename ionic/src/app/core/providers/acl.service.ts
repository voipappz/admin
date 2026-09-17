import { Injectable } from '@angular/core';

/**
 * Role-based access control, ported from va-voipbox-portal.
 * Abilities come from the logged-in user's acl.data (set via setAbilities on
 * login / user:reload). Use in templates/guards: aclSvc.can('go_to_page', 'calls').
 */
@Injectable({ providedIn: 'root' })
export class AclService {
  private aclData: any = {};

  setAbilities(abilities: any) {
    this.aclData = abilities || {};
  }

  can(ability: string, key: string, action?: string, component?: string): boolean {
    if (!this.aclData) { return false; }

    if (ability === 'go_to_page') {
      return !!(this.aclData[key] && this.aclData[key]['main'] &&
                this.aclData[key]['main'].indexOf('read') > -1);
    }

    if (ability === 'access_in_page') {
      return !!(this.aclData[key] && component && this.aclData[key][component] &&
                this.aclData[key][component].indexOf(action) > -1);
    }

    return false;
  }

  hasAbilities(): boolean {
    return !!this.aclData && Object.keys(this.aclData).length > 0;
  }

  // Page-visibility check that stays open for accounts with no ACL configured
  // (legacy users whose login response carries no acl.data).
  canGoToPage(key: string): boolean {
    if (!this.hasAbilities()) { return true; }
    return this.can('go_to_page', key);
  }
}
