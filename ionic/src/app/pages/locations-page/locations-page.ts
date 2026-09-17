
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { Config, ModalController, NavParams, PopoverController } from '@ionic/angular';
import { forkJoin, Subscription } from 'rxjs';
import { Events } from '../../core/providers/events';
import { UserData } from '../../core/providers/user-data';
import { ExtensionService } from '../../core/_base/layout/services/extension.service';
import { IvrService } from '../../core/_base/layout/services/ivr.service';
import { LocationsService } from '../../core/_base/layout/services/locations.service';
import { NumberService } from '../../core/_base/layout/services/number.service';
import { TimeConditionService } from '../../core/_base/layout/services/time-condition.service';
import { AddLocationPage } from './add-location/add-location';



@Component({
    selector: 'page-locations',
    templateUrl: 'locations-page.html',
    styleUrls: ['./locations-page.scss'],
    providers: [LocationsService, TimeConditionService, NumberService, ExtensionService, IvrService],
    standalone: false
})
export class LocationsPage {
  dataAvailable:boolean = false;
  locations:any[]=[]
  user:any={};
  bridge_types_array=["number","ivr","extension"]
  _data:any={};
  private userReloadSub: Subscription;
  constructor(
    private config: Config,
    private locationsSvc: LocationsService,
    private timeConditionSvc: TimeConditionService,
    private numberSvc: NumberService,
    private extensionSvc: ExtensionService,
    private ivrSvc: IvrService,
    public modalCtrl: ModalController,
    public navParams: NavParams,
    public popoverCtrl:PopoverController, 
    private changeDetectorRef: ChangeDetectorRef,
    private userData:UserData,
    private events:Events
  ) {
     this.userReloadSub = this.events.subscribe('user:reload', data=>{
      // console.log('user:reload',data)
      this.dataAvailable=false
      this.user = data.user;
      this.setLocations()
     })
  }
  ngOnDestroy(){
    this.userReloadSub?.unsubscribe();
  }
  getDataObservable(type){
    if(type=='extension'){
      return this.extensionSvc.getUuids(type)
    }else if(type=='ivr'){
      return this.ivrSvc.getUuids(type)
    }
  }
  loadData(type){
    if(type=='extension'){
      this.getDataObservable(type).subscribe(res=>{
        this._data[type] = res
        console.log("loadData", type,this._data)
      })
    }else if(type=='ivr'){
      this.getDataObservable(type).subscribe(res=>{
        this._data[type] = res
      })
    }
    
  }
private timer;
handleSelectChange(value,location, field, init=false){
  console.log("handleSelectChange",value,location,field,init)
  if(field=='bridge_type'){
    if(!init) location.bridge_uuid = '';
    location.bridge_type = value;
    if(value!='number'){
      this.loadData(value);
    }
  }else if(field=='bridge_uuid'){
    if(value!=''){
      clearTimeout(this.timer)
      if(location.bridge_type=='number'){
        location.bridge_number = value
      }else{
        location.bridge_uuid = value
      }
      this.timer = setTimeout((()=>{
        // console.log("this", this)
        if(location.bridge_type=='number' && this.user.environment && this.user.environment.uuid){
          this.numberSvc.create({number:location.bridge_number, environment_uuid:this.user.environment.uuid}).subscribe((number)=>{
            console.log("gggggg",location,number)
            location.type_uuid = location.bridge_uuid = number.uuid;
            this.updateUserData()
            this.changeDetectorRef.detectChanges();
          })
        }else{
          this.updateUserData()
        }
        
      }),1000)
    }
    
  }
  this.changeDetectorRef.detectChanges();
}
async add(){
  if(!this._data.extension)this.loadData('extension')//default type
  
  const modal = await this.modalCtrl.create({
    component: AddLocationPage,
    componentProps: {
      bridge_types_array:this.bridge_types_array,
      location:{bridge_type:'extension',bridge_uuid:'',name:''},
      _data:this._data,
      user:this.user,
      icons:this.locationsSvc.getAvailableIcons()
    },
  });
  modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'save') {
    console.log("save",data, role)
    if(data && data.location){
      console.log("save",data,data.location.bridge_type,data.location.bridge_uuid, data.location.type,data.location.type_uuid)
      data.location.type= data.location.bridge_type
      data.location.type_uuid= data.location.bridge_uuid
      console.log("save",data,data.location.bridge_type,data.location.bridge_uuid, data.location.type,data.location.type_uuid)
      // this.locations.push(data.location)//this.dateToString(data.data)
      // this.updateUserData()
      this.locationsSvc.addLocation(data.location)
    }
    
  }
}
remove(index, location){
  this.locations.splice(index,1)
  this.updateUserData();
}
updateUserData(){
  this.locationsSvc.updateLocations(this.locations)
  // let resources = this.locations.map(loc=>{return {name:loc.name, meta:loc.meta, type:loc.bridge_type, type_uuid:loc.bridge_uuid,  }});
  // let not_location_resources = this.locationsSvc.getNonLocationResources()
  // resources = [...resources, ...not_location_resources]
  // this.userData.saveUserData({resources:resources}, 'resources')
  
}
  setLocations(init=false){
    if(this.user && this.user.resources){
      let locations = this.locationsSvc.getLocations()
      console.log("didddddddddddd",locations);
      let observables = []
      let types_array=[]
      this.user.active_id=''
      for(let i=0;i<locations.length;i++){
        locations[i].name=locations[i].name?locations[i].name:'location_'+i
        // locations[i].icon= locations[i].icon?locations[i].icon :"home"
        locations[i].bridge_type=locations[i].type
        locations[i].bridge_uuid = locations[i].type_uuid
        locations[i].bridge_number = "";

        if(locations[i].meta && (locations[i].meta.default_location=='true'|| locations[i].meta.default_location==true)){//TODO
          console.log("didddddddddddd 2222",locations[i].name);
          this.user.active_id = locations[i].name

        }

        // if(locations[i].type=='extension'){
        //   // observables.push(this.extensionSvc.getByUuid(locations[i].type_uuid))
        // }else if(locations[i].type=='ivr'){
        //   // observables.push(this.ivrSvc.getByUuid(locations[i].type_uuid))
        // }else 
        if(locations[i].type=='number'){
          observables.push(this.numberSvc.getByUuid(locations[i].type_uuid))
          // this.numberSvc.getByUuid(locations[i].type_uuid).subscribe(number=>{
          //   locations[i].bridge_number = number.number
          // })

        }else{
          if(types_array.indexOf(locations[i].type)==-1){
            types_array.push(locations[i].type)
          }
        }
      }
      if(this.user.active_id=='' && locations.length>0){
        this.user.active_id = locations[0].name;
        // this.updateActiveId(locations[0].name)//TODO - update server
        
      }
      for(let k=0;k<types_array.length;k++){
        // this.loadData(types_array[k])
        observables.push(this.getDataObservable(types_array[k]))
      }
      if(observables.length>0){
        forkJoin(...observables).subscribe((dataGroup: any[]) => {
          console.log("diddddddddddd3333333",dataGroup);
          let i=0
          for(; i<dataGroup.length-types_array.length;i++){
            // if(Array.isArray(dataGroup[i])){

            // }else{
            let loc = locations.filter(l=>{return (l.type=='number'&&l.type_uuid==dataGroup[i].uuid)})
            if(loc[0]){
              loc[0].bridge_number = dataGroup[i].number
            }
            // }
          };
          for(let types_array_index=0;i<dataGroup.length;i++){
            this._data[types_array[types_array_index]]=dataGroup[i]//TODO BUGGGGGG
            types_array_index++
          }
          this.locations = locations;
          this.dataAvailable=true;
        });
      }else{
        this.locations = locations;
        this.dataAvailable=true;
      }
      
      
    }else{
      this.locations = [];
      this.dataAvailable=true
    }
  }
  ionViewWillEnter() {
    this.user = this.userData.getUserData()
    // console.log("locations - ionViewWillEnter",this.user)
    this.setLocations(true)
    
  }

  updateActiveId(location_key){ 
    // this.didsSvc.update(uuid,{active:true})
    
    let loc= this.locations.filter(l=>{return (l.name==location_key)})
    console.log("updateActiveId",location_key, loc);
    if(loc[0]){
      if(!loc[0].meta) loc[0].meta={}
      loc[0].meta.default_location =true;

      // this.userData.updateUserLocation('default_location',{name:loc[0].name, meta:loc[0].meta, type:loc[0].bridge_type, type_uuid:loc[0].bridge_uuid,  })
      this.locationsSvc.updateDefaultLocation({name:loc[0].name, meta:loc[0].meta, bridge_type:loc[0].bridge_type, bridge_uuid:loc[0].bridge_uuid, type:loc[0].bridge_type, type_uuid:loc[0].bridge_uuid, })
    }
    
    // let type = this.locations.filter(l=>{return (l.name==location_key)})
    // console.log("updateActiveId",type);
    // if(type[0]){
    //   this.userData.updateUserResource('default_location',type[0].bridge_type ,type[0].bridge_uuid)
    // }
    
  }
  dismiss() {
    // using the injected ModalController this page
    // can "dismiss" itself and pass back data
    this.modalCtrl.dismiss({key:"this.key", time:"this.time_array",bridge:"this.bridge"},'save');
  }
}
