import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'truncate',
    standalone: false
})

export class TruncatePipe implements PipeTransform {

// transform(value: string, args: any[]): string {
//     const limit = args.length > 0 ? parseInt(args[0], 10) : 20;
//     const trail = args.length > 1 ? args[1] : '...';
//     return value.length > limit ? value.substring(0, limit) + trail : value;
//    }
// }
transform(value: string, limit: number,trail ): string {
    //  console.log("TruncatePipe  value", value, limit,trail )
    const _limit = limit > 0 ? limit : 20;
    const _trail = trail > 1 ? trail : '...';
    return value.length > _limit ? value.substring(0, _limit) + _trail : value;
   }
}