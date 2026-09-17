export const ITEMS_PER_PAGE = 20;
export const PAGE_OPTIONS = [
  // { title: 'MENU.HOME', component: 'page-start', icon: "ios-home" },
//   { title: 'MENU.Profile', component: 'page-user', icon: "person",name:"dashboard" },
  { title: 'MENU.DASHBOARD', component: 'page-dashboard', icon: "speedometer",name:"dashboard" },
  { title: 'MENU.CALL', component: 'page-calls-list', icon: "call",name:"call" },
  { title: 'MENU.CAMPAIGNS', component: 'page-campaigns', icon: "paper-plane",name:"campaign"  },
  { title: 'MENU.CONTACT', component: 'page-contacts', icon: "contacts" ,name:"contact" },
  { title: 'MENU.REPORTS', component: 'page-reports', icon: "stats",name:"report"  },
  { title: 'MENU.CONFERENCE', component: 'page-conferences', icon: "globe",name:"conference" },
  { title: 'MENU.ANNOUNCEMENT', component: 'page-announcements', icon: "headset",name:"announcement" },
  { title: 'MENU.QUEUE', component: 'page-queues', icon: "logo-buffer",name:"queue" },
  { title: 'MENU.IVR', component: 'page-ivrs', icon: "git-merge",name:"ivr" },
  // { title: 'MENU.CALL', component: CallsListPage, icon: "call" },
  
  { title: 'MENU.BLACKLIST', component: 'page-blacklist', icon: "paper",name:"blacklist" },
  // { title: 'MENU.ANNOUNCEMENT', component: 'page-announcements', icon: "md-megaphone",name:"voicemail" },
  { title: 'MENU.VOICEMAIL', component: 'page-show-messages', icon: "recording",name:"voicemail",multiple_voicemails_component:'page-voicemails' },
  // { title: 'MENU.PHONE', component: 'page-phone', icon: "keypad" },
  // { title: 'MENU.AGENT', component: 'page-agent', icon: "contact" },

//   { title: 'MENU.LOG', component: 'page-logs', icon: "stats",name:"log"  },
  { title: 'MENU.RULE', component: 'page-rules', icon: "warning",name:"rule"  },
//   { title: 'MENU.SEGMENT', component: 'page-segments', icon: "options",name:"segment"  },
  { title: 'MENU.WORKFLOW', component: 'page-workflows', icon: "pulse",name:"workflow"  },
  { title: 'MENU.NUMBER_GROUP', component: 'page-number-groups', icon: "folder",name:"number_group"  },
  { title: 'MENU.TIME_GROUP', component: 'page-time-groups', icon: "timer",name:"time_group"  },

  { title: 'MENU.TICKET', component: 'page-tickets', icon: "contacts" ,name:"ticket" },
  { title: 'Agent Call', component: 'page-agent-call', icon: "contacts" ,name:"agent_call" },
  { title: 'Agent in a Call', component: 'page-answer', icon: "contacts" ,name:"answer" },
  { title: 'Agent Call- Feedback', component: 'page-feedback', icon: "contacts" ,name:"feedback" },
  { title: 'MENU.SETTINGS',component: 'page-user', icon: "settings" ,name:"setting" },
];
 /**
 * Returns a deep copy of the object
 */
export class DeepCopy{
  constractor(){}
  public static duplicate(oldObj: any) {
      var newObj = oldObj;
      if (oldObj && typeof oldObj === "object") {
          newObj = Object.prototype.toString.call(oldObj) === "[object Array]" ? [] : {};
          for (var i in oldObj) {
              newObj[i] = this.duplicate(oldObj[i]);
          }
      }
      return newObj;
  }
  public static my_duplicate (oldObject:any){  //TODO test
    return JSON.parse(JSON.stringify(oldObject));
  }
}

export class Helper {
    /*private _recursiveProperties: string[] = ['RecursiveProperty', ...];

    public equals(obj1: any, obj2: any): boolean {*/
    public static equals(obj1: any, obj2: any): boolean {
        if (typeof obj1 !== typeof obj2) {
            return false;
        }
        if ((obj1 === undefined && obj2 !== undefined) ||
            (obj2 === undefined && obj1 !== undefined) ||
            (obj1 === null && obj2 !== null) ||
            (obj2 === null && obj1 !== null)) {
            return false;
        }
        if (typeof obj1 === 'object') {
            if (Array.isArray(obj1)) {
                if (!Array.isArray(obj2) || obj1.length !== obj2.length) {
                    return false;
                }
                for (let i = 0; i < obj1.length; i++) {
                    if (!this.equals(obj1[i], obj2[i])) {
                        return false;
                    }
                }
            } else {
                for (let prop in obj1) {
                    if (obj1.hasOwnProperty(prop)) {
                        if (!obj2.hasOwnProperty(prop)) {
                            return false;
                        }
                        //Endless loop fix for recursive properties
                        /*if (this._recursiveProperties.indexOf(prop) >= 0) {
                            if (obj1[prop] !== obj2[prop]) {
                                return false;
                            }
                        } else */
                        if (!this.equals(obj1[prop], obj2[prop])) {
                            return false;
                        }
                    }
                }
                for (let prop in obj2) {
                    if (obj2.hasOwnProperty(prop)) {
                        if (!obj1.hasOwnProperty(prop)) {
                            return false;
                        }
                    }
                }
            }
            return true;
        }
        return obj1 === obj2;
    }
}
