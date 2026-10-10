/* ES3-compatible preset definitions and timing shared by CEP previews and JSX. */
var VKText = (function () {
    var presets = [
        {id:'slide',name:'SLIDE UP',group:'BASIC',y:36,duration:0.8,stagger:0.04},
        {id:'word',name:'WORD REVEAL',group:'BASIC',by:'word',y:36,duration:0.8,stagger:0.04},
        {id:'tracking',name:'TRACKING',group:'BASIC',tracking:18,duration:0.8,stagger:0.04},
        {id:'scale',name:'GENTLE SCALE',group:'BASIC',scale:88,duration:0.8,stagger:0.04},
        {id:'fadeCharacters',name:'FADE UP CHARACTERS',group:'FADE & REVEAL',by:'character',duration:0.45,stagger:0.06},
        {id:'slowFade',name:'SLOW FADE ON',group:'FADE & REVEAL',by:'character',duration:1.6,stagger:0.06},
        {id:'typewriter',name:'TYPEWRITER',group:'FADE & REVEAL',by:'character',step:true,duration:1.2,stagger:0},
        {id:'blurWord',name:'BLUR BY WORD',group:'BLUR',by:'word',blur:24,duration:0.7,stagger:0.13},
        {id:'lineRise',name:'EASE LINES UP',group:'SLIDE & SCALE',by:'line',y:65,blur:5,curve:'out',duration:0.5,stagger:0.13},
        {id:'lineGlide',name:'EASE LINES FROM LEFT',group:'SLIDE & SCALE',by:'line',x:-100,blur:8,curve:'out',duration:0.45,stagger:0.1},
        {id:'outlineChars',name:'OUTLINE TO FILL · CHARACTERS',group:'OUTLINE',by:'character',outline:true,duration:0.55,stagger:0.055},
        {id:'outlineLines',name:'OUTLINE TO FILL · LINES',group:'OUTLINE',by:'line',outline:true,duration:0.65,stagger:0.18},
        {id:'scaleCascade',name:'CHARACTER SCALE IN',group:'SLIDE & SCALE',by:'character',scale:0,curve:'out',duration:0.45,stagger:0.06},
        {id:'lineSweep',name:'LINE SWEEP FROM LEFT',group:'SLIDE & SCALE',by:'line',x:-600,blur:14,curve:'out',duration:0.55,stagger:0.12},
        {id:'opposingBlur',name:'OPPOSING LINE SLIDE',group:'BLUR',by:'line',x:220,opposing:true,blur:12,curve:'out',duration:0.42,stagger:0.055,reverseOut:true}
    ];
    function get(id){for(var i=0;i<presets.length;i++)if(presets[i].id===id)return presets[i];throw new Error('Unknown text preset: '+id);}
    // Returns the animator's influence, 100 = hidden/displaced and 0 = original text.
    function amount(t,index,total,duration,stagger,out,step,curve){
        var progress;
        if(step){var interval=duration/Math.max(1,total);progress=t>=(index*interval+(index-1)*stagger)?1:0;}
        else{
            var u=Math.max(0,Math.min(1,(t-(index-1)*stagger)/duration));
            progress=curve==='out'?1-Math.pow(1-u,3):u*u*(3-2*u);
        }
        return (out?progress:1-progress)*100;
    }
    // Timing derives from the same logical units in CEP and AE. Explicit line breaks define rows.
    function delays(text,by,stagger,parallelRows){
        var rows=String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n'),result=[],i,j,parts;
        for(i=0;i<rows.length;i++){
            parts=by==='line'?[rows[i]]:(by==='word'?(rows[i].match(/\S+/g)||[]):rows[i].split(''));
            for(j=0;j<parts.length;j++)result.push(parallelRows?i*0.18+j*stagger:result.length*stagger);
        }
        return result.length?result:[0];
    }
    function influence(t,index,total,duration,stagger,out,step,curve,reverseOut,parallelRows,text,by){
        var ds=delays(text,by,stagger,parallelRows),delay=(index-1)*stagger,max=0,i;
        for(i=0;i<ds.length;i++)max=Math.max(max,ds[i]);
        if(parallelRows&&ds[index-1]!==undefined)delay=ds[index-1];
        if(reverseOut&&out)delay=(parallelRows?max:(total-1)*stagger)-delay;
        if(step)delay+=index*duration/Math.max(1,total);
        return amount(t-delay,1,1,step?0.00001:duration,0,out,false,curve);
    }
    function sample(spec){return spec.parallelRows?'SuperV\nSuperV\nSuperV':(spec.by==='line'||spec.by==='word'?'SuperV\nSuperV':'SuperV');}
    return {presets:presets,get:get,amount:amount,delays:delays,influence:influence,sample:sample};
})();
