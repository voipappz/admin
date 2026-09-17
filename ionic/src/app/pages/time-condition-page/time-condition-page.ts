import { ChangeDetectorRef, Component, Input, ViewChild } from '@angular/core';
import { TranslationService } from '../../core/_base/layout/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserData } from '../../core/providers/user-data';
import { Events } from '../../core/providers/events';
import { Subscription } from 'rxjs';

import { IonModal, LoadingController, ModalController, NavController, PopoverController } from '@ionic/angular';
import { OverlayEventDetail } from '@ionic/core/components';
import { CallsPage } from '../calls/calls';
import { SetHoursPage } from './set-hours/set-hours';
import { LocationsService, TimeConditionService } from '../../core/_base/layout';
import { LocationsPage } from '../locations-page/locations-page';

@Component({
    selector: 'time-condition-page',
    templateUrl: 'time-condition-page.html',
    styleUrls: ['./time-condition-page.scss'],
    standalone: false
})
export class TimeConditionPage {
  // Modal/embedded inputs
  @Input() isNew = false;
  @Input() isModal = false;
  @Input() embedded = false;
  @Input() callCondition: any = null;
  @Input() timeConditionUuid: string = '';

  src:string='assets/img/logo.png';
  dataAvailable:boolean=false;
  user:any={language:''}
  time_condition:any=
  {
    type:'always',
    options:{
      sunday:{time:true,bridge:null},
      monday:{time:true,bridge:null},
      tuesday:{time:true,bridge:null},
      wednesday:{time:true,bridge:null},
      thursday:{time:true,bridge:null},
      friday:{time:true,bridge:null},
      saturday:{time:true,bridge:null},
    },
    fallback_bridge:'home'
  }
  selected_hours_default_value:any=[]
  type_options:any=[
    ]
  bridge_types_array=["number","ivr","extension"]
  week_day_array=['',"sunday" ,"monday" ,"tuesday" ,"wednesday" ,"thursday" ,"friday" ,"saturday" ]
  mode:string = '';
  uuid:string = "tc_uuid";
  user_locations_map:any={}
  locations:any[]=[]
  loading;
  // [
  //   {
  //     default:true,
  //     key:"home",
  //     icon:"home",
  //     bridge_type:"number",
  //     bridge_uuid:""
  //   },
  //   {
  //     default:false,
  //     key:"work",
  //     icon:"briefcase-outline",
  //     bridge_type:"number",
  //     bridge_uuid:""
  //   }
  // ]
  _data:any={};
  msg:string=''
  private userReloadSub: Subscription;
  constructor(private translateSvc:TranslationService, private changeDetectorRef: ChangeDetectorRef,
    public popoverController: PopoverController,
    private modalCtrl: ModalController,
    private events: Events,
    private loadingCtrl: LoadingController,
    private locationsSvc:LocationsService,
    private userData:UserData,
    public router: Router,
    private route: ActivatedRoute,
    private timeConditionSvc:TimeConditionService,
    private translate: TranslateService) {
      let today = new Date();
      // this.selected_hours_default_value=[{from:new Date(today.setHours(9,0)), to:new Date(today.setHours(18,0))}]
      this.selected_hours_default_value=[{from:"2024-09-17T09:00:00+03:00",to:"2024-09-17T18:00:00+03:00"}]
      // console.log("this.selected_hours_default_value",today.getTimezoneOffset(), this.selected_hours_default_value,this.selected_hours_default_value[0].from)
      
      this.type_options = [
        {key:"sunday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value},
        {key:"monday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value},
        {key:"tuesday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value},
        {key:"wednesday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value},
        {key:"thursday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value},
        {key:"friday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value},
        {key:"saturday", always_default_value:true, selected_hours_default_value:this.selected_hours_default_value}

      ]
  }
  private timer;
  handleSelectChange(value){
    // console.log("handleSelectChange",value,type,field,init)
    // if(field=='bridge_type'){
    //   if(!init) this.user_locations_map[type].bridge_uuid = '';
    //   this.user_locations_map[type].bridge_type = value;
    //   if(value!='number'){
    //     this.loadData(value);
    //   }
    // }else if(field=='bridge_uuid'){
    //   if(value!=''){
    //     clearTimeout(this.timer)
    //     if(this.user_locations_map[type].bridge_type=='number'){
    //       this.user_locations_map[type].bridge_number = value
    //     }else{
    //       this.user_locations_map[type].bridge_uuid = value
    //     }
    //     this.timer = setTimeout((()=>{
    //       // console.log("this", this)
    //       this.updateUserData()
    //     }),1500)
    //   }
      
    // }
    // this.changeDetectorRef.detectChanges();
  }
  loadData(type){
    this.timeConditionSvc.getUuids(type).subscribe(res=>{
      this._data[type] = res
    })
  }
  // updateUserData(){

  //   let resources:any = [];
  //   let r = {name:'work', type:this.user_locations_map['work'].bridge_type, type_uuid:(this.user_locations_map['work'].bridge_type=='number')? this.user_locations_map['work'].bridge_number : this.user_locations_map['work'].bridge_uuid};
  //   resources.push(r)
  //   r = {name:'home', type:this.user_locations_map['home'].bridge_type, type_uuid:(this.user_locations_map['home'].bridge_type=='number')? this.user_locations_map['home'].bridge_number : this.user_locations_map['home'].bridge_uuid};
  //   resources.push(r)

  //   this.userData.saveUserData({resources:resources}, 'resources')
  //   // // console.log(this)

  //   // let work = this.user.resources.filter(resource=>resource.name=='work');
  //   // if(work[0]){
  //   //   work[0].type = this.user_locations_map['work'].bridge_type;
  //   //   work[0].type_uuid = (this.user_locations_map['work'].bridge_type=='number')? this.user_locations_map['work'].bridge_number : this.user_locations_map['work'].bridge_uuid;
  //   // }else {
  //   //   let r = {name:'work', type:this.user_locations_map['work'].bridge_type, type_uuid:(this.user_locations_map['work'].bridge_type=='number')? this.user_locations_map['work'].bridge_number : this.user_locations_map['work'].bridge_uuid};
  //   //   this.user.resources.push(r)
  //   // }

  //   // let home = this.user.resources.filter(resource=>resource.name=='home');
  //   // if(home[0]){
  //   //   home[0].type = this.user_locations_map['home'].bridge_type;
  //   //   home[0].type_uuid = (this.user_locations_map['home'].bridge_type=='number')? this.user_locations_map['home'].bridge_number : this.user_locations_map['home'].bridge_uuid;
  //   // }else{
  //   //   let r = {name:'home', type:this.user_locations_map['home'].bridge_type, type_uuid:(this.user_locations_map['home'].bridge_type=='number')? this.user_locations_map['home'].bridge_number : this.user_locations_map['home'].bridge_uuid};
  //   //   this.user.resources.push(r)
  //   // }
    
  //   // this.userData.saveUserData(this.user, 'resources')
  // }
  ngOnInit(){
    // Modal mode uses ngOnInit (ionViewWillEnter doesn't fire for modals)
    if (this.isModal) {
      this.initializeComponent();
    }
  }
  compareFn(e1 , e2): boolean {
    return e1 && e2 ? e1 == e2 : false;
  }
  getData(event){
    this.user = this.userData.getUserData()
    this.user.language = this.userData.getUserLanguage()
  }
  languageChanged(event){
    this.user.language = event.detail.value
    this.userData.setUserData(event.detail.value,'language')
    this.translateSvc.setLanguage(event.detail.value)
  }
  setLocations(initial=false){
    let locations = this.locationsSvc.getLocations()
    this.locations = locations

    // Auto-select if only one location exists
    if (this.locations.length === 1 && !this.time_condition.fallback_bridge?.type_uuid) {
      this.time_condition.fallback_bridge = this.locations[0];
    }
  }
  async showLoading() {
    this.loading = await this.loadingCtrl.create({
      // message: 'Dismissing after 3 seconds...',
      // duration: 3000,
    });

    this.loading.present();
  }
  stopLoading() {
    if(this.loading)this.loading.dismiss()
    this.loading=null;
  }
  add_location_prevent_bug = 0

  ionViewWillEnter() {
    // Routed page mode uses ionViewWillEnter (reloads on tab switch)
    if (!this.isModal) {
      this.initializeComponent();
    }
  }

  /**
   * Shared initialization logic for both modal and routed page modes
   */
  private initializeComponent() {
    console.log("initializeComponent", { isNew: this.isNew, isModal: this.isModal });

    // Create mode - use defaults, skip loading
    if (this.isNew) {
      this.time_condition = {
        name: '',
        type: 'always',
        options: {
          sunday: { time: true, bridge: null },
          monday: { time: true, bridge: null },
          tuesday: { time: true, bridge: null },
          wednesday: { time: true, bridge: null },
          thursday: { time: true, bridge: null },
          friday: { time: true, bridge: null },
          saturday: { time: true, bridge: null },
        },
        fallback_bridge: null
      };
      this.user = this.userData.getUserData();
      this.setLocations();
      this.dataAvailable = true;
      return;
    }

    // Edit mode - load existing data
    this.userReloadSub?.unsubscribe();
    this.add_location_prevent_bug = 0;
    this.userReloadSub = this.events.subscribe('user:reload', data => {
      this.dataAvailable = false;
      console.log("initializeComponent user:reload");
      this.user = data.user;
      this.setLocations();
      if (this.time_condition && this.time_condition.fallback_bridge_type && this.time_condition.fallback_bridge_uuid) {
        let default_location = this.locations.filter(loc => {
          return loc.type == this.time_condition.fallback_bridge_type && loc.type_uuid == this.time_condition.fallback_bridge_uuid
        });
        if (default_location[0]) {
          this.time_condition.fallback_bridge = default_location[0];
        } else if (this.add_location_prevent_bug < 2) {
          this.time_condition.fallback_bridge = { type: '', type_uuid: '', meta: { icon: '' } };
        }
      }
      setTimeout(() => {
        this.dataAvailable = true;
      }, 10);
    });

    this.dataAvailable = false;
    this.showLoading();
    this.user = this.userData.getUserData();
    this.setLocations();
    this.user.language = this.userData.getUserLanguage();
    this.uuid = '';

    // Check for UUID from route params first (edit via navigation)
    const routeUuid = this.route.snapshot.paramMap.get('uuid');
    if (routeUuid) {
      this.uuid = routeUuid;
      console.log("initializeComponent using route param uuid:", this.uuid);
      this.loadCallCondition(this.uuid);
      return;
    }

    // If callCondition passed as input, use its UUID
    if (this.callCondition?.uuid) {
      this.uuid = this.callCondition.uuid;
      this.loadCallCondition(this.uuid);
      return;
    }

    // First try to get call_condition from user resources
    if (this.user && this.user.resources) {
      let r = this.user.resources.filter(res => { return res.type == 'call_condition' });
      this.uuid = (r && r[0] && r[0].type_uuid) ? r[0].type_uuid : '';
    }

    // If no UUID from user resources, fetch all call conditions from API
    if (this.uuid == '') {
      this.timeConditionSvc.get().subscribe((res) => {
        console.log("call_conditions list", res);
        if (res && res.length > 0 && res[0].uuid) {
          this.uuid = res[0].uuid;
          this.loadCallCondition(this.uuid);
        } else {
          console.log("no call_conditions in the list", res, this.loading);
          this.msg = this.translate.instant('TIME_CONDITION.ERRORS.NO_CALL_CONDITIONS');
          this.dataAvailable = true;
          this.stopLoading();
        }
      }, err => {
        console.error('Error fetching call conditions:', err);
        this.msg = this.translate.instant('TIME_CONDITION.ERRORS.LOADING_CALL_CONDITIONS');
        this.stopLoading();
      });
    } else {
      this.loadCallCondition(this.uuid);
    }
  }
  /**
   * Load a specific call condition by UUID
   */
  loadCallCondition(uuid: string) {
    this.timeConditionSvc.getByUuid(uuid).subscribe((t_con) => {
      // Get type from API response meta, default to 'always' if not set
      t_con.type = t_con.meta?.type || (t_con.resources?.length > 0 ? 'selected_hours' : 'always');

      this.time_condition = t_con;
      // Set fallback_bridge from location if available
      if (this.time_condition && this.time_condition.fallback_bridge_type && this.time_condition.fallback_bridge_uuid) {
        let default_location = this.locations.filter(loc => {
          return loc.type == this.time_condition.fallback_bridge_type && loc.type_uuid == this.time_condition.fallback_bridge_uuid
        });
        if (default_location[0]) {
          this.time_condition.fallback_bridge = default_location[0];
        } else {
          this.time_condition.fallback_bridge = { type: '', type_uuid: '', meta: { icon: '' } };
        }
      }

      // Auto-select if only one location exists and no fallback is set
      if (this.locations.length === 1 && !this.time_condition.fallback_bridge?.type_uuid) {
        this.time_condition.fallback_bridge = this.locations[0];
      }

      this.typeChanged(t_con.type, this.time_condition.resources);
    }, err => {
      console.error('Error loading call condition:', err);
      this.msg = this.translate.instant('TIME_CONDITION.ERRORS.LOADING_CALL_CONDITION');
      this.stopLoading();
    }, () => {
      console.log("call condition loaded");
      this.timer = setTimeout(() => {
        this.dataAvailable = true;
        this.stopLoading();
      }, 1000);
    });
  }

  close(){
    this.modalCtrl.dismiss()
  }
  saving = false;
  success = false;
  saveError = '';

  save() {
    console.log("save", this.time_condition, { isNew: this.isNew, isModal: this.isModal });
    this.saving = true;
    this.saveError = '';

    const dataToSave = this.getDataToServer();

    // Add name for create mode
    if (this.isNew && this.time_condition.name) {
      dataToSave.name = this.time_condition.name;
    }

    const saveObservable = this.isNew
      ? this.timeConditionSvc.create(dataToSave)
      : this.timeConditionSvc.update(this.uuid, dataToSave);

    saveObservable.subscribe(
      (res) => {
        this.saving = false;
        console.log('Call condition saved:', res);

        // Modal mode - dismiss with saved data
        if (this.isModal) {
          const savedData = { ...this.time_condition, ...res };
          this.modalCtrl.dismiss(savedData, 'save');
          return;
        }

        // Routed page mode - show success message
        this.success = true;
        setTimeout(() => {
          this.success = false;
        }, 2000);
      },
      (err) => {
        this.saving = false;
        this.saveError = err?.error?.message || err?.message || this.translate.instant('TIME_CONDITION.ERRORS.SAVE_FAILED');
        console.error('Error saving call condition:', err);
        setTimeout(() => {
          this.saveError = '';
        }, 5000);
      }
    );
  }
  reset(){

  }
  async openLocations(){
    const modal = await this.modalCtrl.create({
      component: LocationsPage,
      componentProps: {
        
      },
    });
    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'save') {
      console.log("save",data, role)
      this.setLocations();
    }
  }
  updateFallbackbridge(bridge){
    console.log("updateFallbackbridge bridge", bridge)
    this.time_condition.fallback_bridge = bridge;
  }
  private getDataToServer(){
    let obj:any = {};
    obj.meta={type:this.time_condition.type}
    // obj.type = this.time_condition.type
    // let def_bridge = this.user_locations_map.filter((loc)=>{return loc.key==this.time_condition.fallback_bridge})
    let def_bridge = this.time_condition.fallback_bridge
    // console.log("tttttttttttttttt",def_bridge, this.time_condition.fallback_bridge)
    if(def_bridge){
      obj.fallback_bridge_type = def_bridge.type//'number';
      obj.fallback_bridge_uuid = def_bridge.type_uuid//this.time_condition.fallback_bridge;
    }
    
    obj.resources = []
    for(let key in this.time_condition.options){
      let resource:any={}
      resource.name = key
      resource.week_day = this.week_day_array.indexOf(key)+"-"+this.week_day_array.indexOf(key);
      if(this.time_condition.options[key].bridge){
        // let _bridge = this.user_locations_map[this.time_condition.options[key].bridge]//.filter((loc)=>{return loc.key==this.time_condition.fallback_bridge})
        // if(_bridge){
        //   resource.bridge_type = _bridge.bridge_type;
        //   resource.bridge_uuid = (_bridge.bridge_type=='number')?_bridge.bridge_number : _bridge.bridge_uuid;
        // }
        resource.bridge_type = this.time_condition.options[key].bridge.type
        resource.bridge_uuid = this.time_condition.options[key].bridge.type_uuid
        // resource.bridge_type = 'number';
        // resource.bridge_uuid = this.time_condition.options[key].bridge
      }
      if(obj.meta.type=='always'){
        if(this.time_condition.options[key].time==true){
          resource.time = "00:00-23:59"
        }else{
          resource.disabled = true;
        }
      }else if(obj.meta.type=='selected_hours'){
        resource.time = this.dateToString(this.time_condition.options[key].time)
      }
      if(!resource.disabled){
        obj.resources.push(resource);
      }
    }

    return obj;
  }
  typeChanged(event, initial_value=null){
    console.log("typeChanged",event,initial_value)
    console.log("typeChanged",this.selected_hours_default_value,event, this.time_condition,this.type_options[0].selected_hours_default_value,JSON.parse(JSON.stringify(this.type_options[0].selected_hours_default_value)))
    this.time_condition.type = event
    if(this.time_condition.type=='always'){
      this.time_condition.options = {
                                      sunday:{time:true,bridge:null},
                                      monday:{time:true,bridge:null},
                                      tuesday:{time:true,bridge:null},
                                      wednesday:{time:true,bridge:null},
                                      thursday:{time:true,bridge:null},
                                      friday:{time:true,bridge:null},
                                      saturday:{time:true,bridge:null},
                                    }
      if(initial_value){
        //TODO
      }
    }else{//type=='selected_hours'
      this.time_condition.options = {
        sunday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
        monday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
        tuesday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
        wednesday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
        thursday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
        friday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
        saturday:{time:JSON.parse(JSON.stringify(this.selected_hours_default_value)),bridge:this.time_condition.fallback_bridge||''},
      }
      if(initial_value){
        // initial_value=[{
        //   "bridge_type": "number",
        //   "bridge_uuid": "0a57b841-d0ce-49e6-bdf4-7f955b55f0bd",
        //   "force": false,
        //   "week_day": "1-1",
        //   "time": "09:00-18:00",
        //   "month": null,
        //   "month_day": null,
        //   "year": null
        // },...]
        for(let i=0;i<initial_value.length;i++){
          let resource=initial_value[i];
          if(resource.week_day && resource.week_day.length==3 && this.week_day_array[resource.week_day[0]] && this.week_day_array[resource.week_day[0]].length>3 ){
            let time:any={}
            time.from = new Date(new Date(this.time_condition.options[this.week_day_array[+resource.week_day[0]]].time[0].from).setHours(+resource.time.slice(0,2),+resource.time.slice(3,5)))
            time.to = new Date(new Date(this.time_condition.options[this.week_day_array[+resource.week_day[0]]].time[0].to).setHours(+resource.time.slice(6,8),+resource.time.slice(9)))
            this.time_condition.options[this.week_day_array[+resource.week_day[0]]].time = [time]
          }
          if(resource.bridge_type && resource.bridge_uuid){
            let resource_default_location = this.locations.filter(loc=>{return loc.type==resource.bridge_type && loc.type_uuid==resource.bridge_uuid})
            // console.log("resource_default_location", resource_default_location, resource)
            if(resource_default_location[0]){
              this.time_condition.options[this.week_day_array[+resource.week_day[0]]].bridge = resource_default_location[0];
            }else{
              // console.warn("resource_default_location", resource_default_location, resource)
            }
          }
          
        }
      }
    }
  }
  changeOptionValue(type,key){
    this.time_condition.options[key].time = !this.time_condition.options[key].time
  }
  async setHours(type, key){
    this.mode = "set_hours";
    let time_array;
    console.log("ggggggggggggggg", this.time_condition.options[key] )
    time_array = this.time_condition.options[key].time 
    const modal = await this.modalCtrl.create({
      component: SetHoursPage,
      componentProps: {
        type: type,
        key:key ,
        bridge:this.time_condition.options[key].bridge,
        timeArray:time_array,
        locations:this.locations
      },
    });
    modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'save') {
      console.log("save",data, role, this.time_condition.options['sunday'], this.time_condition.options['monday'])
      this.time_condition.options[data.key] = {time:data.time, bridge:data.bridge}

      // Refresh locations if user added new ones
      if (data.locationsChanged) {
        this.setLocations();
      }
    }
  }
  dateToString(data:{from:any,to:any}[]){
    if(!data || !data[0]) return '';
    let from = new Date(data[0].from)
    let to = new Date(data[0].to)
    return from.getHours()+':'+(from.getMinutes() < 10 ? '0' : '') +from.getMinutes()+'-'+to.getHours()+':'+(to.getMinutes() < 10 ? '0' : '')+to.getMinutes()
  }
  onWillDismiss(event: Event) {
    // const ev = event as CustomEvent<OverlayEventDetail<string>>;
    // if (ev.detail.role === 'confirm') {
    //   this.user = `Hello, ${ev.detail.data}!`;
    // }
  }
  ngOnDestroy(){
    this.userReloadSub?.unsubscribe();
  }
}
