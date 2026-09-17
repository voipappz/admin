import { NgModule } from '@angular/core';

// import { CustomTablePipe } from './custom-table';
import { HumanizePipe } from './humanize.pipe';
import { GroupByPipe } from './group-by-date.pipe';
// import { KeysPipe } from './key-value';
// import { ShowPropertyPipe } from './show-property';
// import { LimitLengthPipe }  from './limit-string-length';

@NgModule({
  declarations: [
    // KeysPipe,
    HumanizePipe,
    GroupByPipe
    // CustomTablePipe,
    // ShowPropertyPipe,
    // LimitLengthPipe
  ],
  imports: [

  ],
  exports: [
    // KeysPipe,
    HumanizePipe,
    GroupByPipe
    // CustomTablePipe,ShowPropertyPipe,LimitLengthPipe
  ]
})
export class PipesModule {}
