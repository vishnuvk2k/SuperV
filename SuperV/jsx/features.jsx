/* VK 1.1: alpha crop, verified rendering, expressions and colour tracking. */
function VKFeatures(h) {
    var pendingCrop = null, renderState = null, watched = [], watchedComp = null;
    var moduleRoot = h.moduleRoot || new File($.fileName).parent.parent;
    function transform(l, name) { return l.property('ADBE Transform Group').property(name); }
    function wiggle(o) {
        var c=h.comp(),layers=c.selectedLayers,amount=h.num(o.amount,0,100000),speed=h.num(o.frequency,0,1000);
        var speedName='Wiggle Speed (wigs/sec)',amountName='Wiggle Amount (pixels)',i,j;
        function targets(layer){
            var p=transform(layer,'ADBE Position'),result=[];
            if(p.dimensionsSeparated){for(var d=0;d<(layer.threeDLayer?3:2);d++)result.push(p.getSeparationFollower(d));}
            else result.push(p);
            return result;
        }
        if(!layers.length)h.fail('Select one or more layers for Position wiggle.');
        // Check all layers before changing any of them.
        for(i=0;i<layers.length;i++){
            var layer=layers[i],fx=layer.property('ADBE Effect Parade');
            if(layer.locked)h.fail('Unlock the selected layers first.');
            if(!fx||!fx.canAddProperty('ADBE Slider Control'))h.fail('Select layers that support Slider Controls.');
            var ps=targets(layer);
            for(j=0;j<ps.length;j++){
                if(!ps[j].canSetExpression)h.fail('This layer does not support a Position expression.');
                if(ps[j].expression&&!/^\/\/ VK WIGGLE/.test(ps[j].expression)&&!o.replace)h.fail('Position has another expression. Enable REPLACE EXISTING EXPRESSIONS to replace it.');
            }
            var names=[speedName,amountName];
            for(j=0;j<names.length;j++){var existing=fx.property(names[j]);if(existing&&existing.matchName!=='ADBE Slider Control')h.fail('Rename the existing effect called '+names[j]+'. A Slider Control is required.');}
        }
        for(i=0;i<layers.length;i++){
            var layer=layers[i],names=[speedName,amountName],values=[speed,amount];
            for(j=0;j<names.length;j++){
                // Adding an effect invalidates earlier indexed property references in AE.
                var fx=layer.property('ADBE Effect Parade'),ctl=fx.property(names[j]);
                if(!ctl){ctl=fx.addProperty('ADBE Slider Control');ctl.name=names[j];}
                var slider=ctl.property(1);
                if(slider.numKeys)slider.setValueAtTime(c.time,values[j]);else slider.setValue(values[j]);
            }
            var ps=targets(layer);
            var code='// VK WIGGLE\nvar speed=Math.max(0,effect("'+speedName+'")(1).value);\nvar amount=Math.max(0,effect("'+amountName+'")(1).value);\nwiggle(speed,amount);';
            for(j=0;j<ps.length;j++)h.setExpression(ps[j],code);
        }
        return {message:'Position wiggle applied to '+layers.length+' layers. Edit Wiggle Speed and Wiggle Amount in Effect Controls.'};
    }
    function positionProperties(p) {
        if (!p.dimensionsSeparated) return [p];
        return [p.getSeparationFollower(0),p.getSeparationFollower(1)];
    }
    function cropPreflight(c) {
        var jobs=[],i,l,p,j;
        for(i=1;i<=c.numLayers;i++) {
            l=c.layer(i);
            if(l.threeDLayer || l instanceof CameraLayer || l instanceof LightLayer) h.fail('CROP COMP currently supports 2D compositions. Precompose 3D artwork into a 2D layer first.');
            h.walk(l,function(prop){
                if(prop.canSetExpression && prop.expressionEnabled && /(?:thisComp|comp\s*\([^)]*\))\s*\.\s*(?:width|height)/.test(prop.expression)) h.fail('Crop would change an expression that uses composition dimensions. Precompose that artwork first.');
            });
            if (!l.parent) {
                p=positionProperties(transform(l,'ADBE Position'));
                for(j=0;j<p.length;j++) if(p[j].expressionEnabled) h.fail('A top-level Position has an expression. Precompose it before cropping.');
                jobs.push({layer:l,props:p});
            }
        }
        // Adjust existing uses of this comp so their artwork stays in place.
        var uses=[];
        for(i=1;i<=app.project.numItems;i++) {
            var item=app.project.item(i);
            if (!(item instanceof CompItem)) continue;
            for(j=1;j<=item.numLayers;j++) {
                l=item.layer(j);
                if(l.source===c) {
                    p=transform(l,'ADBE Anchor Point');
                    if(p.expressionEnabled) h.fail('An existing use of this comp has an Anchor Point expression. Precompose or bake that expression before cropping.');
                    uses.push({layer:l,props:[p]});
                }
            }
        }
        return {positions:jobs,anchors:uses};
    }
    function renderBegin(o) {
        // The panel serializes commands, so any state left here belongs to an interrupted session.
        if(renderState){try{if(isValid(renderState.comp))renderState.comp.remove();}catch(ignore){}renderState=null;}
        for(var leftover=app.project.numItems;leftover>=1;leftover--){var it=app.project.item(leftover);if(it instanceof CompItem&&it.comment.indexOf('VK TEMP RENDER')===0)it.remove();}
        var c=h.comp(),crop=o.purpose==='crop',selected=c.selectedLayers,indices=[],i;
        if(crop){pendingCrop=null;cropPreflight(c);}
        if(crop && o.scope==='selection' && !selected.length)h.fail('Select the layers whose artwork should define the crop.');
        for(i=0;i<selected.length;i++)indices.push(selected[i].index);
        var start, end;
        if(o.range==='comp'){start=0;end=c.duration;}
        else if(o.range==='current'){start=c.time;end=start+c.frameDuration;}
        else{start=c.workAreaStart;end=c.workAreaStart+c.workAreaDuration;}
        var fps=crop?c.frameRate:h.num(o.fps,1,50);
        var total=o.range==='current'?1:Math.max(1,Math.ceil((end-start)*fps-0.0001));
        if(total>18000)h.fail('The range exceeds 18,000 frames. Choose a shorter range.');
        var dir=new Folder(o.directory);
        if(!dir.exists && !dir.create())h.fail('Cannot create the temporary render folder.');
        var copy=null;
        try{
            copy=c.duplicate();copy.name=c.name;copy.comment='VK TEMP RENDER — removed when this operation finishes';var factor=crop&&o.scale===2&&c.width>=64&&c.height>=64?2:1;copy.resolutionFactor=[factor,factor];
            if(crop && o.scope==='selection'){
                for(i=1;i<=copy.numLayers;i++){copy.layer(i).locked=false;copy.layer(i).solo=false;}
                for(i=0;i<indices.length;i++)copy.layer(indices[i]).solo=true;
            }
            var token=String(new Date().getTime());
            renderState={source:c,comp:copy,token:token,directory:dir.fsName,frames:total,start:start,fps:fps,index:0,crop:crop,width:c.width,height:c.height,layers:c.numLayers};
            return {token:token,frames:total,width:c.width,height:c.height,fps:fps,range:o.range,start:start,end:end,sourceName:c.name,sourceID:c.id};
        }catch(e){if(copy && isValid(copy))copy.remove();throw e;}
    }
    function renderFrame(o){
        var state=renderState;
        if(!state || state.token!==o.token || o.index!==state.index)h.fail('The frame render request is out of sequence. Retry the operation.');
        if(state.index>=state.frames)h.fail('All frames have already been requested.');
        var count=Math.max(1,Math.min(Math.floor(Number(o.count)||1),24,state.frames-state.index)),paths=[];
        for(var n=0;n<count;n++){
            var file=new File(state.directory+'/frame_'+('000000'+state.index).slice(-6)+'.png');
            state.comp.saveFrameToPng(Math.min(state.start+state.index/state.fps,state.comp.duration-state.comp.frameDuration/100),file);
            paths.push(file.fsName);state.index++;
        }
        // Return to AE's event loop. The CEP side waits for each PNG IEND chunk.
        return {path:paths[0],paths:paths};
    }
    function renderFinish(o){
        if(!renderState || renderState.token!==o.token)return {message:'Render session already closed.'};
        var state=renderState;renderState=null;
        try{
            if(o.success && state.index!==state.frames)h.fail('The frame render is incomplete.');
            if(o.success && state.crop)pendingCrop={comp:state.source,token:state.token,width:state.width,height:state.height,layers:state.layers};
        }finally{if(isValid(state.comp))state.comp.remove();}
        return {message:o.success?'Frame rendering complete.':'Frame rendering cancelled.'};
    }
    function prepareShift(job,x,y) {
        var entries=[];
        for(var i=0;i<job.props.length;i++) {
            var p=job.props[i],scalar=p.propertyValueType===PropertyValueType.OneD,values=[];
            function shifted(v){if(scalar)return v-(i===0?x:y);var a=[];for(var d=0;d<v.length;d++)a[d]=v[d]-(d===0?x:(d===1?y:0));return a;}
            if(p.numKeys)for(var k=1;k<=p.numKeys;k++)values.push(shifted(p.keyValue(k)));
            else values.push(shifted(p.value));
            entries.push({p:p,keyed:p.numKeys>0,values:values});
        }
        return {layer:job.layer,entries:entries};
    }
    function applyShift(job) {
        var locked=job.layer.locked;
        try {
            job.layer.locked=false;
            for(var i=0;i<job.entries.length;i++) {
                var entry=job.entries[i],p=entry.p;
                if(entry.keyed)for(var k=0;k<entry.values.length;k++)p.setValueAtKey(k+1,entry.values[k]);
                else p.setValue(entry.values[0]);
            }
        } finally {job.layer.locked=locked;}
    }
    function applyCrop(c,o) {
        var pad=Math.round(h.num(o.padding,0,2000));
        var x=Math.max(0,Math.floor(h.num(o.left,0,c.width-1))-pad),y=Math.max(0,Math.floor(h.num(o.top,0,c.height-1))-pad);
        var right=Math.min(c.width,Math.ceil(h.num(o.right,1,c.width))+pad),bottom=Math.min(c.height,Math.ceil(h.num(o.bottom,1,c.height))+pad);
        var w=Math.max(4,right-x),height=Math.max(4,bottom-y);
        x=Math.min(x,c.width-w);y=Math.min(y,c.height-height);
        var jobs=cropPreflight(c),i;
        if(w===c.width && height===c.height)return {message:'No empty border to crop. The artwork already fills the composition.',width:w,height:height};
        var changes=[];
        for(i=0;i<jobs.positions.length;i++)changes.push(prepareShift(jobs.positions[i],x,y));
        for(i=0;i<jobs.anchors.length;i++)changes.push(prepareShift(jobs.anchors[i],x,y));
        c.width=w;c.height=height;
        // AE can adjust default source anchors during resize. Restore the exact planned values afterwards.
        for(i=0;i<changes.length;i++)applyShift(changes[i]);
        return {message:'Cropped to '+w+' × '+height+' px. Duration and keyframe times are unchanged.',width:w,height:height};
    }
    function cropApply(o) {
        if(!pendingCrop || pendingCrop.token!==o.token)h.fail('Crop measurement expired. Run CROP COMP again.');
        var c=pendingCrop.comp;
        if(!isValid(c) || c.width!==pendingCrop.width || c.height!==pendingCrop.height || c.numLayers!==pendingCrop.layers)h.fail('The composition changed during measurement. Run CROP COMP again.');
        pendingCrop=null;
        return applyCrop(c,o);
    }
    function measuredLayers(c,scope) {
        var ids=[],selected={},anySolo=false,effects=0,boxed=0,i,j,l;
        if(scope==='selection'){var s=c.selectedLayers;if(!s.length)h.fail('Select the layers whose artwork should define the crop.');for(i=0;i<s.length;i++)selected[s[i].index]=true;}
        for(i=1;i<=c.numLayers;i++)if(c.layer(i).solo)anySolo=true;
        for(i=1;i<=c.numLayers;i++){
            l=c.layer(i);
            // Shape and text layers are not reported as AVLayer by instanceof, so only exclude cameras and lights.
            if(l instanceof CameraLayer||l instanceof LightLayer)continue;
            if(scope==='selection'){if(!selected[i])continue;}
            else if(!l.enabled||(anySolo&&!l.solo))continue;
            try{if(!l.hasVideo||l.adjustmentLayer||l.guideLayer||l.nullLayer)continue;}catch(skip){continue;}
            try{if(l.isTrackMatte&&scope!=='selection')continue;}catch(ignore){}
            ids.push(i);
            var fx=l.property('ADBE Effect Parade');
            for(j=1;fx&&j<=fx.numProperties;j++)if(fx.property(j).enabled){effects++;break;}
            try{if(l.source instanceof CompItem||(l.source&&l.source.mainSource&&l.source.mainSource.hasAlpha))boxed++;}catch(ignore2){}
        }
        return {ids:ids,effects:effects,boxed:boxed};
    }
    // Fast crop: union of every measured layer's box over time. No rendering.
    function cropFast(o) {
        var c=h.comp(),info,start,total,fps=c.frameRate,i;
        cropPreflight(c);info=measuredLayers(c,o.scope);
        if(!info.ids.length)h.fail(o.scope==='selection'?'The selected layers have no visible artwork to measure (nulls, adjustment and guide layers are skipped). Nothing was cropped.':'No visible layers to measure. Turn on a layer\'s video switch, or check solo. Nothing was cropped.');
        if(o.range==='comp'){start=0;total=Math.max(1,Math.ceil(c.duration*fps-0.0001));}
        else if(o.range==='current'){start=c.time;total=1;}
        else{start=c.workAreaStart;total=Math.max(1,Math.ceil(c.workAreaDuration*fps-0.0001));}
        if(total>18000)h.fail('The range exceeds 18,000 frames. Choose a shorter range.');
        var selected=[];for(i=0;i<c.selectedLayers.length;i++)selected.push(c.selectedLayers[i].index);
        var corner=function(which){return 'var ids=['+info.ids.join(',')+'],lo=[1e9,1e9],hi=[-1e9,-1e9];\n'+
            'for(var i=0;i<ids.length;i++){var L=thisComp.layer(ids[i]),a=Math.min(L.inPoint,L.outPoint),b=Math.max(L.inPoint,L.outPoint);if(time<a||time>=b)continue;'+
            'var r=L.sourceRectAtTime(time,true);if(!(r.width>0&&r.height>0))continue;var xs=[r.left,r.left+r.width],ys=[r.top,r.top+r.height];'+
            'for(var u=0;u<2;u++)for(var v=0;v<2;v++){var p=L.toComp([xs[u],ys[v]]);lo=[Math.min(lo[0],p[0]),Math.min(lo[1],p[1])];hi=[Math.max(hi[0],p[0]),Math.max(hi[1],p[1])];}}\n'+which+';';};
        var probe=null,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
        try{
            probe=c.layers.addNull(c.duration);probe.name='SuperV crop probe';probe.moveToEnd();probe.enabled=false;
            var fxp=probe.property('ADBE Effect Parade');fxp.addProperty('ADBE Point Control');fxp.addProperty('ADBE Point Control');
            var pa=fxp.property(1).property(1),pb=fxp.property(2).property(1);
            pa.expression=corner('lo');pb.expression=corner('hi');
            if(pa.expressionError||pb.expressionError)h.fail('Could not measure layer bounds: '+(pa.expressionError||pb.expressionError));
            for(i=0;i<total;i++){
                var t=total===1&&o.range==='current'?start:Math.min(start+i/fps,c.duration-c.frameDuration/100);
                var lo=pa.valueAtTime(t,false),hi=pb.valueAtTime(t,false);
                if(hi[0]<=lo[0]||hi[1]<=lo[1])continue;
                if(lo[0]<x0)x0=lo[0];if(lo[1]<y0)y0=lo[1];if(hi[0]>x1)x1=hi[0];if(hi[1]>y1)y1=hi[1];
                if(x0<=0&&y0<=0&&x1>=c.width&&y1>=c.height)break;
            }
        }finally{if(probe&&isValid(probe))probe.remove();for(i=0;i<selected.length;i++)try{c.layer(selected[i]).selected=true;}catch(ignore){}}
        if(!(x1>x0&&y1>y0))h.fail('The selected range has no visible artwork. Nothing was cropped.');
        var bounds={left:Math.max(0,Math.min(c.width-1,Math.floor(x0))),top:Math.max(0,Math.min(c.height-1,Math.floor(y0))),right:Math.max(1,Math.min(c.width,Math.ceil(x1))),bottom:Math.max(1,Math.min(c.height,Math.ceil(y1))),padding:o.padding};
        var result=applyCrop(c,bounds),notes=[];
        if(info.effects)notes.push(info.effects+' layer'+(info.effects>1?'s have':' has')+' effects that may draw outside its box (glow, shadow). Add padding or use EXACT.');
        if(info.boxed)notes.push(info.boxed+' precomp/alpha footage layer'+(info.boxed>1?'s are':' is')+' measured by full size. Use EXACT for a tighter crop.');
        if(notes.length)result.message+='\n'+notes.join('\n');
        return result;
    }
    function colourTargets(c) {
        var selected=h.props(c), result=[],i;
        for(i=0;i<selected.length;i++)if(selected[i].propertyValueType===PropertyValueType.COLOR)result.push({p:selected[i],text:false});
        if(!result.length)for(i=0;i<c.selectedLayers.length;i++){
            var l=c.selectedLayers[i],text=l.property('ADBE Text Properties');
            if(text) result.push({p:text.property('ADBE Text Document'),text:true});
            else h.walk(l,function(p){if(p.propertyValueType===PropertyValueType.COLOR)result.push({p:p,text:false});});
        }
        return result;
    }
    function hex(v) {var s='#';for(var i=0;i<3;i++)s+=('0'+Math.round(Math.max(0,Math.min(1,v[i]))*255).toString(16)).slice(-2);return s.toUpperCase();}
    function readColours(targets) {
        var result=[];
        for(var i=0;i<targets.length;i++)try{
            var target=targets[i],v=target.p.value;
            if(target.text){if(!v.applyFill)continue;v=v.fillColor;}
            var s=hex(v),found=false;for(var j=0;j<result.length;j++)if(result[j]===s)found=true;
            if(!found)result.push(s);
        }catch(ignore){}
        return result;
    }
    function colour(o) {
        var c=h.comp(),targets=colourTargets(c),i;
        if(!targets.length && watchedComp===c)targets=watched;
        if(!targets.length)h.fail('Select a Fill/Stroke colour property, a shape layer, or a text layer.');
        watched=targets;watchedComp=c;
        if(o.sample)return {message:'Sampled AE colours.',colours:readColours(targets)};
        if(!/^#[0-9a-f]{6}$/i.test(o.hex))h.fail('Enter a six-digit HEX colour, for example #46A2DA.');
        for(i=0;i<targets.length;i++)if(h.owner(targets[i].p).locked)h.fail('Unlock the colour layers first.');
        var rgb=[parseInt(o.hex.substr(1,2),16)/255,parseInt(o.hex.substr(3,2),16)/255,parseInt(o.hex.substr(5,2),16)/255];
        for(i=0;i<targets.length;i++){
            var t=targets[i],p=t.p,v=p.value;
            if(t.text){v.applyFill=true;v.fillColor=rgb;}
            else v=rgb.concat([v.length>3?v[3]:1]);
            if(p.numKeys)p.setValueAtTime(c.time,v);else p.setValue(v);
        }
        return {message:'Applied '+o.hex+' to '+targets.length+' colour properties.'};
    }
    function duplicateExternal() {
        var f=new File(moduleRoot.fsName+'/vendor/True Comp Duplicator.jsx');
        if(!f.exists)h.fail('True Comp Duplicator.jsx is missing. Reinstall the complete package.');
        $.evalFile(f);
        return {message:'True Comp Duplicator opened. Select compositions in the Project panel and use its DUPLICATE button.'};
    }
    return {wiggle:wiggle,renderBegin:renderBegin,renderFrame:renderFrame,renderFinish:renderFinish,cropApply:cropApply,cropFast:cropFast,colour:colour,duplicateExternal:duplicateExternal};
}
