import { Component } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';
import { FilterComponent } from '../../partials/filter/filter.component';

import { CallService } from '../../core/_base/layout';
import { ConversationFactory } from '../../core/_base/layout/models/conversation.model';
import { InfiniteScrollCustomEvent, MenuController, ModalController, PopoverController } from '@ionic/angular';

@Component({
    selector: 'page-calls',
    templateUrl: 'calls.html',
    styleUrls: ['./calls.scss'],
    standalone: false
})
export class CallsPage {
  calls: any[] = [];
  /** `calls` after the type filter — what the list renders. */
  visibleCalls: any[] = [];
  filters:any= {
    type:'all'
  }
  page=0;
  callTypes=["all","missed","rejected","outgoing","incoming"]

  // Audio playback
  activeCallUuid: string | null = null;
  isPlaying = false;
  audioProgress = 0;
  audioDuration = 0;
  currentTime = 0;
  waveformBars = new Array(30).fill(0);
  private audio: HTMLAudioElement | null = null;

  /** Fall back to Hebrew-named mock calls when the server returns an empty list */

  constructor(private modalCtrl: ModalController,
              private events: Events,
              private popoverCtrl:PopoverController,
              private userData:UserData,
              public callSvc: CallService,
              public router: Router,
              private menu: MenuController) {}

  ionViewDidEnter() {
    this.loadCalls()
  }
  /**
   * Load a page of the box's call log (`/api/admin/calls`, read-only).
   * CallService already maps the local fields (from_number/to_number/direction/
   * status/started_at/…) into the `meta` block this list renders, so the page
   * only pages and filters.
   */
  loadCalls(page=1){
    this.page = page;

    this.callSvc.getPage(page,this.filters).subscribe((res: any) => {
      if(page==1){
        this.calls=[];
      }
      const rows = (res && res.body) || [];
      this.calls = [...this.calls, ...rows];

      // No mock fallback: an empty call log must LOOK empty. Filling it with
      // invented calls made a working box indistinguishable from a broken one.
      this.assignConversationVariants();
      this.applyFilter();
    });
  }

  /**
   * The local call log has no server-side filtering, so the type tabs filter the
   * loaded rows here rather than sending params the box would ignore. Recomputed
   * on load/filter only — a getter would hand the template a fresh array on
   * every change-detection pass and re-render the whole list.
   */
  private applyFilter() {
    const type = this.filters.type || 'all';
    const term = (this.filters.inline || '').trim();
    let rows = this.calls;

    if (type !== 'all') {
      // No local "rejected" disposition — an unanswered inbound call is the
      // closest thing the box records.
      const wanted = type === 'rejected' ? 'missed' : type;
      rows = rows.filter(c => c && c.meta && c.meta._direction === wanted);
    }

    if (term) {
      rows = rows.filter(c => {
        const meta = (c && c.meta) || {};
        return ((meta._contact_number || '') + ' ' + (meta._contact_fullname || ''))
            .toLowerCase().indexOf(term) > -1;
      });
    }

    this.visibleCalls = rows;
  }

  /**
   * Assign mocked conversation variants by position so the first call shows the
   * Hebrew billing transcript, the second shows the Hebrew internet transcript,
   * and the rest fall back to the default English transcript.
   */
  private assignConversationVariants() {
    this.calls.forEach((call, i) => {
      let variant: 'hebrew-billing' | 'hebrew-internet' | 'english' = 'english';
      if (i === 0) variant = 'hebrew-billing';
      else if (i === 1) variant = 'hebrew-internet';
      ConversationFactory.registerMockVariant(call.uuid, variant);
    });
  }

    // filter(e) {
  //   const popover = this.popoverCtrl.create({
  //     component: FilterComponent,
  //     animated:true,
  //     backdropDismiss:true,
  //     dismissOnSelect:true
  //   }).then(p=>{
  //     p.present()
  //     p.onDidDismiss().then(
  //       res=>{
  //         console.log("filter",res)
  //         if (res.role === 'filter') {
  //           console.log("filter",res)
  //           // this.filters = data;
  //           // this.loadCalls();
  //         }
  //       }
  //     )
  //   });
  //   // const { data, role } = await popover.onWillDismiss();
  //   // if (role === 'filter') {
  //   //   console.log("filter",data, role)
  //   //   this.filters = data;
  //   //   this.loadCalls();
  //   // }
  // }
  filter(type: any){
    // Called both with a plain type string and with an ion-change event.
    const value = (type && type.detail) ? type.detail.value : type;
    this.filters.type = value || 'all';
    this.applyFilter();
  }
  // async search(){
  //   const modal = await this.modalCtrl.create({
  //     component: FilterComponent,
  //   });
  //   modal.present();
  //   const { data, role } = await modal.onWillDismiss();
  //   if (role === 'filter') {
  //     console.log("filter",data, role)
  //     this.filters.inline = data.inline;
  //     this.loadCalls();
  //   }
  // }
  /** Client-side too — the box's call log takes no search params. */
  search(term: string) {
    this.filters.inline = (term || '').toLowerCase();
    this.applyFilter();
  }

  play(e,uuid,call){
    console.log("play",e,uuid,call)
    let previous_val =  call.play_audio 
   
    call.play_audio = !previous_val;
  }
  /**
   * Blacklisting is a mothership feature — the local call log is read-only
   * (the API answers 405 to any write), so the control is hidden in the
   * template and this stays a no-op rather than firing a call that can't land.
   */
  block(e,uuid,call){
    console.warn('[calls] blacklist is not available on the local call log');
  }
  showCall(e,uuid,call){
    console.log("showCall",e,uuid,call)
  }
  /**
   * Navigate to conversation/transcript page for a call
   */
  openConversation(callUuid: string): void {
    this.router.navigate(['/app/conversation', callUuid]);
  }
  moreBtnPressed(e,uuid,call){
    console.log("moreBtnPressed",e,uuid,call)
    let previous_val =  call.show_notes
    this.calls.map(c=>{
      c.show_notes = false;
    })
    call.show_notes = !previous_val;
    if (!call.show_notes) {
      this.stopAudio();
    }
  }

  // Audio playback methods
  playRecording(call: any) {
    if (this.isPlaying && this.activeCallUuid === call.uuid) {
      this.stopAudio();
      return;
    }

    this.stopAudio();
    const url = call.recording?.url;
    if (!url) return;

    this.activeCallUuid = call.uuid;
    this.audio = new Audio(url);

    this.audio.onloadedmetadata = () => {
      this.audioDuration = this.audio?.duration || 0;
    };

    this.audio.ontimeupdate = () => {
      if (this.audio) {
        this.currentTime = this.audio.currentTime;
        this.audioProgress = (this.audio.currentTime / this.audio.duration) * 100;
      }
    };

    this.audio.onended = () => {
      this.isPlaying = false;
      this.audioProgress = 0;
      this.currentTime = 0;
    };

    this.audio.onerror = () => {
      this.isPlaying = false;
      console.error('Error playing recording');
    };

    this.audio.play();
    this.isPlaying = true;
  }

  seekAudio(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;

    if (this.audio && this.audioDuration) {
      this.audio.currentTime = percentage * this.audioDuration;
      this.currentTime = this.audio.currentTime;
      this.audioProgress = percentage * 100;

      if (!this.isPlaying) {
        this.audio.play();
        this.isPlaying = true;
      }
    }
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
      this.isPlaying = false;
      this.audioProgress = 0;
      this.currentTime = 0;
      this.activeCallUuid = null;
    }
  }

  logout(){
    this.events.publish("app-logout")
  }
  onIonInfinite(ev) {
    this.loadCalls(this.page+1)
    setTimeout(() => {
      (ev as InfiniteScrollCustomEvent).target.complete();
    }, 500);
  }

  async togglePhoneMenu() {
    await this.menu.enable(true, 'phone-sidebar');
    await this.menu.toggle('phone-sidebar');
  }
}
