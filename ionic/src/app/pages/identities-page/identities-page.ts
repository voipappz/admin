
import { Component, Input } from '@angular/core';
import { Config, ModalController, NavParams, PopoverController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Events } from '../../core/providers/events';
import { UserData } from '../../core/providers/user-data';
import { DidService } from '../../core/_base/layout/services/did.service';
import { IdentitiesService } from '../../core/_base/layout/services/identities.service';



@Component({
    selector: 'page-identities',
    templateUrl: 'identities-page.html',
    styleUrls: ['./identities-page.scss'],
    providers: [IdentitiesService, DidService],
    standalone: false
})
export class IdentitiesPage {
  dataAvailable:boolean = false;
  identities:any[]=[]
  user:any={};
  private userReloadSub: Subscription;
  constructor(
    private config: Config,
    private identitiesSvc: IdentitiesService,
    private didsSvc: DidService,
    public modalCtrl: ModalController,
    public navParams: NavParams,
    public popoverCtrl:PopoverController,
    private userData:UserData,
    private events:Events
  ) {
     this.userReloadSub = this.events.subscribe('user:reload', data=>{
      this.user = data.user;
      this.setIdentities()
     })
  }
  ngOnDestroy(){
    this.userReloadSub?.unsubscribe();
  }
  setIdentities(init=false){
    // Fetch DIDs directly from API
    this.dataAvailable = false;
    this.didsSvc.get().subscribe({
      next: (data) => {
        this.identities = data;
        this.setActiveIdentity();
        this.dataAvailable = true;
      },
      error: (err) => {
        console.error('Error loading identities:', err);
        this.identities = [];
        this.dataAvailable = true;
      }
    });

    /* OLD APPROACH - Get DIDs from user.resources
    if(this.user && this.user.resources){
      let identities = this.user.resources.filter(r=>{return r.type=='did'})
      let observables = []
      for(let i=0;i<identities.length;i++){
        if(identities[i].meta && (identities[i].meta.default_identity=='true' || identities[i].meta.default_identity==true)){
          this.user.active_id = identities[i].type_uuid
        }
        observables.push(this.didsSvc.getByUuid(identities[i].type_uuid))
      }

      // Handle empty observables array - forkJoin doesn't emit for empty arrays
      if (observables.length === 0) {
        this.identities = [];
        this.dataAvailable = true;
        return;
      }

      forkJoin(observables).subscribe({
        next: (dataGroup) => {
          this.identities = dataGroup;
          this.dataAvailable = true;
        },
        error: (err) => {
          console.error('Error loading identities:', err);
          this.identities = [];
          this.dataAvailable = true;
        }
      });
    }else{
      this.identities = [];
      this.dataAvailable=true
    }
    */
  }

  /**
   * Set active identity from user.meta.default_identity
   */
  private setActiveIdentity() {
    if (this.user?.meta?.default_identity) {
      this.user.active_id = this.user.meta.default_identity;
      // Move default identity to top
      const idx = this.identities.findIndex(i => i.uuid === this.user.active_id);
      if (idx > 0) {
        const defaultId = this.identities.splice(idx, 1)[0];
        this.identities.unshift(defaultId);
      }
    }
  }
  ionViewWillEnter() {
    this.user = this.userData.getUserData()
    console.log(this.user)
    this.setIdentities(true)
    
  }

  updateActiveId(uuid){
    // this.didsSvc.update(uuid,{active:true})
    console.log("updateActiveId",uuid);
    this.userData.updateUserResource('default_identity', 'did', uuid)
  }
  dismiss() {
    // using the injected ModalController this page
    // can "dismiss" itself and pass back data
    this.modalCtrl.dismiss({key:"this.key", time:"this.time_array",bridge:"this.bridge"},'save');
  }
}
