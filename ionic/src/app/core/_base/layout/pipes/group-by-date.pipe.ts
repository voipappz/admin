// Angular
import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
    name: 'groupByDate',
    standalone: false
})
export class GroupByPipe implements PipeTransform {
    constructor(private translate: TranslateService) {}

    transform(collection: Array<any>, property: string = 'date'): Array<any> {
        if(!collection) {
            return null;
        }
        // console.log("GroupByPipe", collection,property)//, previous, current)
        const gc = collection.reduce((previous, current)=> {
            // console.log("GroupByPipe", collection,property, previous, current)
            current[property] = new Date(current[property])

            let _date = '';


            let _today = new Date()
            if(current[property].getDate() === _today.getDate() &&
            current[property].getMonth() === _today.getMonth() &&
            current[property].getFullYear() === _today.getFullYear()){
                _date = this.translate.instant('DATE.TODAY');
            }else{
                let _yesterday = new Date(_today.setDate(_today.getDate() - 1))
                if(current[property].getDate() === _yesterday.getDate() &&
                    current[property].getMonth() === _yesterday.getMonth() &&
                    current[property].getFullYear() === _yesterday.getFullYear()){
                        _date = this.translate.instant('DATE.YESTERDAY');
                    }else{
                        _date = current[property].getDate() + '.'+(current[property].getMonth() + 1)+'.'+current[property].getFullYear()
                    }

            }

            if(!previous[_date]) {
                previous[_date] = [];
            }
            previous[_date].push(current);
            return previous;
        }, {});
        return Object.keys(gc).map(date => ({ date: date, events: gc[date] }));
        // return collection
    }
}