import { Component } from '@angular/core';
import { ConferenceData } from '../../core/providers/conference-data';
import { Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';
import { FilterComponent } from '../../partials/filter/filter.component';

import { CallService } from '../../core/_base/layout';
import { TyCallFactory } from '../../core/_base/layout/models/ty-call.model';
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
  private useMockFallback = true;

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
  loadCalls(page=1){
    this.page = page;

    this.callSvc.getPage(page,this.filters).subscribe((res: any) => {
      console.log("res",res)
      if(page==1){
        this.calls=[];
      }
      res = res.body || [];
      res.map(record=>{
        const profile = record.profile || {};

        // Direction: derive "missed" from incoming + non-answer disposition
        let direction = profile.direction || 'outgoing';
        if (direction === 'incoming' && profile.disposition && profile.disposition !== 'answer') {
          direction = 'missed';
        }

        // Duration: convert seconds string to "m:ss"
        const totalSeconds = parseInt(profile.duration, 10) || 0;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedDuration = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

        // Populate meta from profile for template compatibility
        record.meta = {
          _direction: direction,
          _contact_number: profile.callee || '',
          _contact_fullname: 'unknown',
          _duration: formattedDuration,
          _blacklisted: false
        };

        return record;
      })
      this.calls = [...this.calls,...res];

      // Fall back to Hebrew-named mock calls if the server returned nothing
      if (page === 1 && this.useMockFallback && this.calls.length === 0) {
        this.calls = TyCallFactory.createMockListHebrew();
      }

      this.assignConversationVariants();
    });
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
  filter(type: string){
    console.log("filter", type, this.filters)
    this.filters.type = type;
    this.loadCalls();
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
  search(term: string) {
    this.filters.inline = (term || '').toLowerCase();
    this.loadCalls();
  }

  play(e,uuid,call){
    console.log("play",e,uuid,call)
    let previous_val =  call.play_audio 
   
    call.play_audio = !previous_val;
  }
  block(e,uuid,call){
    console.log("block",e,uuid,call)
    this.callSvc.block(uuid, call.blacklisted)
    .subscribe(res=>{
      call.blacklisted = !call.blacklisted
    })
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
