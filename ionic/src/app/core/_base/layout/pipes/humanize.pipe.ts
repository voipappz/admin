// Angular
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'humanize',
    standalone: false
})
export class HumanizePipe implements PipeTransform {
  transform(text, separators:string[]) : any {
    // console.log("text", text,separators )
    if (typeof text == 'boolean'){
					return text==true? "True" : "False";
				}
				if(text && typeof text=='string') {
          // console.warn("text", text)
            if(separators){
              for(let i=0;i<separators.length;i++){
                let regex = new RegExp(separators[i],'g');
                text = text.replace(regex,"_");
              }
            }
            // text = text.replace(".","_");
            // text = text.replace(/:/g,"_");
            text = text.split("_");
            // go through each word in the text and capitalize the first letter
            for (var i in text) {
                var word = text[i];
                word = word.toLowerCase();
                word = word.charAt(0).toUpperCase() + word.slice(1);
                text[i] = word;
            }

            return text.join(" ");
        }
  }
}
