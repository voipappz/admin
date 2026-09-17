// Angular
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'select2adapter',
    standalone: false
})
export class Select2AdapterPipe implements PipeTransform {
  transform(array, key='uuid', value='name') : any {
    console.log("text", array, key, value)
    if(!array) return [];
    return array.map(obj=>{
      return {value:obj[key],label:obj[value] }
    })
  }
}
