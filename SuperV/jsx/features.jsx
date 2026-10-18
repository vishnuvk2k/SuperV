/* SuperV: wiggle, verified frame rendering, and fast or exact comp cropping. */
function VKFeatures(h) {
    var pendingCrop = null, renderState = null;
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
        var fps=crop?c.frameRate:(Number(o.fps)>0?h.num(o.fps,1,60):Math.min(c.frameRate,Number(o.maxFps)>0?Number(o.maxFps):60));
        var total=o.range==='current'?1:Math.max(1,Math.ceil((end-start)*fps-0.0001));
        if(total>18000)h.fail('The range exceeds 18,000 frames. Choose a shorter range.');
        var dir=new Folder(o.directory);
        if(!dir.exists && !dir.create())h.fail('Cannot create the temporary render folder.');
        var copy=null;
        try{
            copy=c.duplicate();copy.name=c.name;copy.comment='VK TEMP RENDER — removed when this operation finishes';var factor=crop&&o.scale===2&&c.width>=64&&c.height>=64?2:1;
            // GIF/WebM: render at the smallest resolution that still covers the output width (halves render time per step).
            if(!crop&&o.reduce&&Number(o.targetWidth)>0){while(factor<4&&c.width/(factor*2)>=Number(o.targetWidth)&&c.height/(factor*2)>=16)factor*=2;}copy.resolutionFactor=[factor,factor];
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
        var entries=[],stats={boxed:0};
        for(i=0;i<ids.length;i++)expandLayer(c,ids[i],[],0,entries,stats);
        return {ids:ids,effects:effects,boxed:stats.boxed,entries:entries,top:c};
    }
    function nameUnique(n){var k=0,i,it;for(i=1;i<=app.project.numItems;i++){it=app.project.item(i);if(it instanceof CompItem&&it.name===n)k++;}return k===1;}
    // Walk into precomps so the crop follows the real artwork, not the precomp's full frame.
    function expandLayer(comp,idx,chain,depth,out,stats) {
        var l=comp.layer(idx),src=null;
        if(l instanceof CameraLayer||l instanceof LightLayer)return;
        try{if(!l.hasVideo||l.adjustmentLayer||l.guideLayer||l.nullLayer)return;}catch(e){return;}
        if(depth>0){try{if(!l.enabled)return;}catch(e1){}try{if(l.isTrackMatte)return;}catch(e2){}}
        try{src=l.source;}catch(e3){}
        if(src instanceof CompItem&&depth<4&&out.length<300&&src.numLayers<=200&&nameUnique(src.name)){
            var next=chain.concat([{c:comp,i:idx}]);
            for(var k=1;k<=src.numLayers;k++)expandLayer(src,k,next,depth+1,out,stats);
            return;
        }
        if(src instanceof CompItem)stats.boxed++;
        else{try{if(src&&src.mainSource&&src.mainSource.hasAlpha)stats.boxed++;}catch(e4){}}
        out.push({chain:chain,comp:comp,idx:idx});
    }
    function qs(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
    function layerRef(top,comp,idx){return (comp===top?'thisComp':'comp('+qs(comp.name)+')')+'.layer('+idx+')';}
    function entryCode(top,e) {
        var refs=[],k;
        for(k=0;k<e.chain.length;k++)refs.push(layerRef(top,e.chain[k].c,e.chain[k].i));
        refs.push(layerRef(top,e.comp,e.idx));
        var nestedLeaf=e.chain.length>0,cw=nestedLeaf?'comp('+qs(e.comp.name)+')':'thisComp';
        return 'acc((function(){var T=[time],Ls=['+refs.join(',')+'],k,L,a,b;'+
            'for(k=0;k<Ls.length;k++){L=Ls[k];a=Math.min(L.inPoint,L.outPoint);b=Math.max(L.inPoint,L.outPoint);if(T[k]<a||T[k]>=b)return null;'+
            'if(k<Ls.length-1){try{T.push(L.sourceTime(T[k]));}catch(er){T.push(T[k]-L.startTime);}}}'+
            'var n=Ls.length-1,Lf=Ls[n],tf=T[n],r=Lf.sourceRectAtTime(tf,true);if(!(r.width>0&&r.height>0))return null;'+
            'var xs=[r.left,r.left+r.width],ys=[r.top,r.top+r.height],x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,u,v,p;'+
            'for(u=0;u<2;u++)for(v=0;v<2;v++){p=Lf.toComp([xs[u],ys[v]],tf);x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}'+
            (nestedLeaf?'x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min('+cw+'.width,x1);y1=Math.min('+cw+'.height,y1);if(!(x1>x0&&y1>y0))return null;':'')+
            'var cs=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]],o=[1e9,1e9,-1e9,-1e9],j;'+
            'for(j=0;j<4;j++){p=cs[j];for(k=n-1;k>=0;k--)p=Ls[k].toComp(p,T[k]);o=[Math.min(o[0],p[0]),Math.min(o[1],p[1]),Math.max(o[2],p[0]),Math.max(o[3],p[1])];}'+
            'return o;})());';
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
        var corner=function(which){
            var code='var lo=[1e9,1e9],hi=[-1e9,-1e9];function acc(v){if(!v)return;lo=[Math.min(lo[0],v[0]),Math.min(lo[1],v[1])];hi=[Math.max(hi[0],v[2]),Math.max(hi[1],v[3])];}\n',e;
            for(e=0;e<info.entries.length;e++)code+=entryCode(c,info.entries[e])+'\n';
            return code+which+';';};
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
        if(info.boxed)notes.push(info.boxed+' layer'+(info.boxed>1?'s are':' is')+' measured by full frame (precomps nested too deep, or with duplicate names, or footage with transparency). Use EXACT for a tighter crop.');
        if(notes.length)result.message+='\n'+notes.join('\n');
        return result;
    }
    // SuperV's own true duplicator: copies the selected comps and every comp nested inside them, once each,
    // and points the copies at each other so nothing in the new tree still depends on the original tree.
    function duplicateComps(o) {
        var roots=[],sel=app.project.selection,i,j,it;
        for(i=0;i<sel.length;i++)if(sel[i] instanceof CompItem)roots.push(sel[i]);
        if(!roots.length&&app.project.activeItem instanceof CompItem)roots.push(app.project.activeItem);
        if(!roots.length)h.fail('Select one or more comps in the Project panel, or open a comp, then press Duplicate.');
        var copies=Math.max(1,Math.min(Math.floor(Number(o&&o.copies)||1),50));
        var order=[],seen={};
        function visit(c){
            if(seen[c.id])return;seen[c.id]=true;
            for(var k=1;k<=c.numLayers;k++){var s=c.layer(k).source;if(s instanceof CompItem)visit(s);}
            order.push(c);
        }
        for(i=0;i<roots.length;i++)visit(roots[i]);
        if(order.length>500)h.fail('That comp tree has more than 500 comps. Select a smaller tree.');
        var rootIds={},made=[];
        for(i=0;i<roots.length;i++)rootIds[roots[i].id]=true;
        var folder=app.project.items.addFolder('Duplicates'),newRoots=[],total=0;
        for(var n=0;n<copies;n++){
            var map={},created=[];
            for(i=0;i<order.length;i++){
                var src=order[i],d=src.duplicate();
                d.name=src.name;d.parentFolder=folder;map[src.id]=d;created.push(d);
                if(rootIds[src.id])newRoots.push(d);
            }
            for(i=0;i<created.length;i++){
                var cc=created[i];
                for(j=1;j<=cc.numLayers;j++){
                    var ly=cc.layer(j),ls=ly.source;
                    if(ls instanceof CompItem&&map[ls.id]){
                        var wasLocked=ly.locked;if(wasLocked)ly.locked=false;
                        ly.replaceSource(map[ls.id],false);
                        if(wasLocked)ly.locked=true;
                    }
                }
            }
            total+=created.length;
        }
        for(i=1;i<=app.project.numItems;i++)app.project.item(i).selected=false;
        for(i=0;i<newRoots.length;i++)newRoots[i].selected=true;
        return {message:'Duplicated '+roots.length+' comp'+(roots.length===1?'':'s')+(order.length>roots.length?' and '+(order.length-roots.length)+' nested comp'+(order.length-roots.length===1?'':'s'):'')+(copies>1?' × '+copies:'')+' into the "Duplicates" folder ('+total+' new comps).'};
    }
    return {wiggle:wiggle,renderBegin:renderBegin,renderFrame:renderFrame,renderFinish:renderFinish,cropApply:cropApply,cropFast:cropFast,duplicateComps:duplicateComps};
}
