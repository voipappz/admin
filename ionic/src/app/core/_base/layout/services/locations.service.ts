import { Injectable } from '@angular/core';
import { Observable,of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UserData } from '../../../providers/user-data';
import { WebsocketService } from './action-cable.service';
import { HandleRequest } from './handleRequest.service';

@Injectable({
    providedIn: 'root'
})
export class LocationsService {
    constructor(private handleRequest:HandleRequest, private ws:WebsocketService,private userData:UserData) {

    }
    private readonly icons=[
      {name:'home', key:'home',ionicon_name:'home-outline'},
      {name:'briefcase', key:'work',ionicon_name:'briefcase-outline'},
      {name:'mobile', key:'mobile',ionicon_name:'phone-portrait-outline'},
      {name:'user', key:'user',ionicon_name:'person-outline'},
      {name:'globe', key:'globe',ionicon_name:'globe-outline'}
    ]
    private readonly icon_keys_array=['home','work','mobile','user','globe'];
    private available_icon_keys_array = ['home','work','mobile','user','globe'];
    getIcons(){
      return this.icons;
    }
    getAvailableIcons(){
      // console.log("getAvailableIcons",this.available_icon_keys_array)
      let icons=[]
      for(let i=0;i<this.available_icon_keys_array.length;i++){
        icons.push(this.icons[this.icon_keys_array.indexOf(this.available_icon_keys_array[i])])
      }
      return icons;
    }
    getLocations(){
      this.available_icon_keys_array = JSON.parse(JSON.stringify(this.icon_keys_array))
      let user = this.userData.getUserData();
      if(!user ||!user.resources) return [];
      let locations =  JSON.parse(JSON.stringify(user.resources.filter(r=>{return (r.type=='extension'||r.type=='ivr'||r.type=='number')})))
      let usedIconsArray=[]
      let noIconLocationIndexs=[]
      // Get default name based on user language
      const lang = (this.userData.getUserLanguage() || 'en') as string;
      const defaultNamePrefix = lang === 'he' ? 'מיקום' : 'Location';

      for(let i=0;i<locations.length;i++){
        // Ensure location has a name - fallback to translated 'Location X' if missing
        if(!locations[i].name){
          locations[i].name = defaultNamePrefix + ' ' + (i + 1);
        }
        if(locations[i].meta && locations[i].meta.icon && this.icon_keys_array.indexOf(locations[i].meta.icon)>-1){
          usedIconsArray.push(locations[i].meta.icon)
          this.available_icon_keys_array.splice(this.available_icon_keys_array.indexOf(this.icons[this.icon_keys_array.indexOf(locations[i].meta.icon)].key),1)
          locations[i].meta.icon = this.icons[this.icon_keys_array.indexOf(locations[i].meta.icon)].ionicon_name
        }else{
          noIconLocationIndexs.push(i);
        }
      }
      if(noIconLocationIndexs.length>0){
        let notUsedIconsArray=this.icon_keys_array.filter(key=>{return !usedIconsArray.includes(key)})
        for(let i=0;i<noIconLocationIndexs.length;i++){
          if(!locations[noIconLocationIndexs[i]].meta) {

          }else{
            locations[noIconLocationIndexs[i]].meta.icon = this.icons[this.icon_keys_array.indexOf(notUsedIconsArray[i])].ionicon_name
            this.available_icon_keys_array.splice(this.available_icon_keys_array.indexOf(this.icons[this.icon_keys_array.indexOf(notUsedIconsArray[i])].key),1)
          }
        }
      }
      return locations;
    }

    /**
     * Returns mock locations for development/testing purposes.
     * These are used when no real locations exist in user data.
     */
    private getMockLocations(): any[] {
      return [
        {
          name: 'home',
          type: 'number',
          type_uuid: 'mock-home-uuid-001',
          bridge_type: 'number',
          bridge_uuid: 'mock-home-uuid-001',
          bridge_number: '+1-555-HOME',
          meta: {
            icon: 'home-outline',
            default_location: true
          }
        },
        {
          name: 'work',
          type: 'extension',
          type_uuid: 'mock-work-uuid-002',
          bridge_type: 'extension',
          bridge_uuid: 'mock-work-uuid-002',
          meta: {
            icon: 'briefcase-outline',
            default_location: false
          }
        },
        {
          name: 'mobile',
          type: 'number',
          type_uuid: 'mock-mobile-uuid-003',
          bridge_type: 'number',
          bridge_uuid: 'mock-mobile-uuid-003',
          bridge_number: '+1-555-MOBILE',
          meta: {
            icon: 'phone-portrait-outline',
            default_location: false
          }
        }
      ];
    }

    getNonLocationResources(){
      let user = this.userData.getUserData();
      if(!user ||!user.resources) return [];
      return user.resources.filter(r=>{return !(r.type=='extension'||r.type=='ivr'||r.type=='number')})
    }
    updateLocations(locations){
      // console.log("updateLocations  locations ",locations )
      let resources = locations.map(loc=>{
        let icon:any = this.icons.filter(i=>{return i.ionicon_name==loc.meta.icon})
        if(!icon[0])icon[0]={key:''}
        return {name:loc.name, meta:{default_location:loc.meta.default_location,icon:icon[0].key}, type:loc.type, type_uuid:loc.type_uuid,  }
      });

      let not_location_resources = this.getNonLocationResources()
      resources = [...resources, ...not_location_resources]
      this.userData.saveUserData({resources:resources}, 'resources')
    }
    updateDefaultLocation(def_location){
      let def_loc = {name:def_location.name, meta:def_location.meta, type:def_location.bridge_type, type_uuid:def_location.bridge_uuid,  }
      def_loc.meta.icon = def_loc.meta.icon.key
      this.userData.updateUserLocation('default_location',def_loc)
    }
    addLocation(location){
      console.log("add location --------------------",location)
      if(!location || !location.bridge_uuid || !location.bridge_type || ['extension','number','ivr'].indexOf(location.bridge_type)==-1){
        return;
      }
      let locations_array = this.getLocations();
      if(!location.name){
        location.name = 'location_'+locations_array.length//TODO
      }
      if(!location.meta){
        location.meta = {}
      }
      if(!location.meta.icon){
        let availableIcons = this.getAvailableIcons()
        if(availableIcons.length>0){
          location.meta.icon = availableIcons[0].key
        }else{
          location.meta.icon = 'home'//TODO
        }
      }
      locations_array.push({name:location.name, type:location.bridge_type,type_uuid:location.bridge_uuid, meta:location.meta});
      // console.log("add location update--------------------",locations_array)
      this.updateLocations(locations_array);
    }
    public get(): Observable<any> {
        return this.handleRequest.get("/api/call_conditions?page=1&per_page=20&order_by=created_at&order_type=desc")
        //   .map(res => res.json())
            // .toPromise();
    }
    public update(uuid,data): Observable<any>{
      return this.handleRequest.patch("/api/call_conditions/"+uuid, data)
    }
    public getUuids(type):Observable<any>{
      return this.handleRequest.get("/api/"+type+'s')
    }
    public getNumber(uuid):Observable<any>{
      return this.handleRequest.get("/api/numbers/"+uuid)
    }
    public getParams(): Promise<any> {
      return this.handleRequest.get("/api/calls?action=params")
      //   .map(res => res.json())
          .toPromise();
    }
    public saveParams(params): Observable<any>{
      return this.handleRequest.patch("/api/calls?action=save_params", params)
    }

    public getSegments(): Promise<any> {
      return this.handleRequest.get("/api/calls?action=segments")
      //   .map(res => res.json())
          .toPromise();
    }
    getPage(page,filter:any={}): Observable<any>{
        return this.handleRequest.getPage("/api/calls?page="+page, filter,{})
        // .toPromise();
      }
    public getColumns(): Observable<any> {
        return this.handleRequest.get("/api/calls?action=columns")
    }
    public getByUuid(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/call_conditions/"+uuid+'?action=load')
      //   .map(res => res.json())
          // .toPromise();
    }
    public run(uuid:string): Observable<any> {
      return this.handleRequest.get("/api/calls/"+uuid+'?action=run')
      //   .map(res => res.json())
          // .toPromise();
    }
    public export(filters={}): Observable<any> {
      return this.handleRequest.getWithParams("/api/calls?action=export", filters)
      //   .map(res => res.json())
          // .toPromise();
    }
  
}
