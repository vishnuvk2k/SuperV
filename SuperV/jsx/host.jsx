/* SuperV 1.3.0 — explicitly loaded by the CEP connection check. */
$.global.__VK_GSD_HOST__ = (function () {
    var hostFile = new File($.fileName), moduleRoot = hostFile.parent.parent;
    var clipboard = null;
    $.evalFile(new File(moduleRoot.fsName+'/js/text-presets.js'));
    if(typeof VKText==='undefined')throw new Error('Text presets are missing. Reinstall the complete package.');
    $.evalFile(new File(moduleRoot.fsName+'/js/number-format.js'));
    if(typeof VKFormatNumber!=='function')throw new Error('Number formatter is missing. Reinstall the complete package.');
    function encode(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/[\x00-\x1f\u2028\u2029]/g, function(c){return '\\u' + ('0000'+c.charCodeAt(0).toString(16)).slice(-4);}) + '"';
        if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
        if (typeof v === 'boolean') return String(v);
        var a=[],i,k; if (v instanceof Array) {for(i=0;i<v.length;i++)a.push(encode(v[i]));return '['+a.join(',')+']';}
        for(k in v)if(v.hasOwnProperty(k))a.push(encode(k)+':'+encode(v[k]));return '{'+a.join(',')+'}';
    }
    function fail(s){throw new Error(s);}
    function num(v,min,max){v=Number(v);if(!isFinite(v)||v<min||v>max)fail('Value must be between '+min+' and '+max+'.');return v;}
    function comp(){var c=app.project.activeItem;if(!(c instanceof CompItem))fail('Open a composition first.');return c;}
    function layers(c){var s=c.selectedLayers;if(!s.length)fail('Select at least one layer.');return s;}
    function editable(ls){for(var i=0;i<ls.length;i++)if(ls[i].locked)fail('Unlock the selected layers first.');}
    function owner(p){var q=p;while(q.parentProperty)q=q.parentProperty;return q;}
    function props(c){var a=c.selectedProperties,r=[],i;for(i=0;i<a.length;i++)if(a[i].propertyType===PropertyType.PROPERTY)r.push(a[i]);return r;}
    function numeric(p){var t=p.propertyValueType;return t===PropertyValueType.OneD||t===PropertyValueType.TwoD||t===PropertyValueType.ThreeD||t===PropertyValueType.TwoD_SPATIAL||t===PropertyValueType.ThreeD_SPATIAL||t===PropertyValueType.COLOR;}
    function expressionTargets(c,replace,keys){var a=props(c);if(!a.length)fail('Select properties in the timeline first.');for(var i=0;i<a.length;i++){if(!a[i].canSetExpression||!numeric(a[i]))fail('Select only numeric properties that support expressions.');if(owner(a[i]).locked)fail('Unlock the selected layers first.');if(keys&&a[i].numKeys<2)fail('Each selected property needs at least two keyframes.');if(a[i].expression&&!replace)fail('A property already has an expression. Enable REPLACE EXISTING EXPRESSIONS to replace it.');}return a;}
    function setExpression(p,e){var old=p.expression,enabled=p.expressionEnabled;p.expression=e;if(p.expressionError){var err=p.expressionError;p.expression=old;if(old)p.expressionEnabled=enabled;fail(err);}}
    function walk(group,fn){for(var i=1;i<=group.numProperties;i++){var p=group.property(i);if(p.propertyType===PropertyType.PROPERTY)fn(p);else walk(p,fn);}}
    function easeKeys(p){for(var i=1;i<=p.numKeys;i++){try{var n=p.keyInTemporalEase(i).length,a=[],b=[];for(var j=0;j<n;j++){a.push(new KeyframeEase(0,66));b.push(new KeyframeEase(0,66));}p.setInterpolationTypeAtKey(i,KeyframeInterpolationType.BEZIER,KeyframeInterpolationType.BEZIER);p.setTemporalEaseAtKey(i,a,b);}catch(ignore){}}}
    function nullTool(o){var c=comp(),ls=c.selectedLayers,i,pos=[c.width/2,c.height/2];if(o.parent)editable(ls);if(o.position==='selection'){layers(c);var x=0,y=0;for(i=0;i<ls.length;i++){if(ls[i].threeDLayer||ls[i].parent)fail('Selection centre currently needs unparented 2D layers. Choose COMP CENTRE for other layers.');var p=ls[i].property('ADBE Transform Group').property('ADBE Position').value;x+=p[0];y+=p[1];}pos=[x/ls.length,y/ls.length];}var n=c.layers.addNull(c.duration);n.name='VK NULL';n.property('ADBE Transform Group').property('ADBE Position').setValue(pos);if(o.parent)for(i=0;i<ls.length;i++)ls[i].parent=n;return {message:'Created VK NULL'+(o.parent?' and parented '+ls.length+' layers.':'.')};}
    function pathOf(p){var a=[];while(p.parentProperty){a.unshift({match:p.matchName,name:p.name,index:p.propertyIndex});p=p.parentProperty;}return a;}
    function resolve(layer,path){var p=layer;for(var i=0;i<path.length;i++){var s=path[i],q=null,j;if(s.match==='ADBE Effect Parade')q=p.property(s.match);else {q=p.property(s.index);if(!q||q.matchName!==s.match||q.name!==s.name){q=null;for(j=1;j<=p.numProperties;j++){var candidate=p.property(j);if(candidate.matchName===s.match&&candidate.name===s.name){q=candidate;break;}}}}if(!q)return null;p=q;}return p;}
    function captureKey(p,k){var r={time:p.keyTime(k),value:p.keyValue(k),inType:p.keyInInterpolationType(k),outType:p.keyOutInterpolationType(k)};try{r.inEase=p.keyInTemporalEase(k);r.outEase=p.keyOutTemporalEase(k);r.auto=p.keyTemporalAutoBezier(k);r.cont=p.keyTemporalContinuous(k);}catch(ignore){}if(p.isSpatial){r.inTan=p.keyInSpatialTangent(k);r.outTan=p.keyOutSpatialTangent(k);r.sAuto=p.keySpatialAutoBezier(k);r.sCont=p.keySpatialContinuous(k);r.roving=p.keyRoving(k);}try{r.label=p.keyLabel(k);}catch(ignore2){}return r;}
    function copyKeys(o){var c=comp(),ps=props(c),items=[],min=Infinity,count=0,source=null;for(var i=0;i<ps.length;i++){var p=ps[i],ks=p.selectedKeys;if(!ks.length)continue;if(p.propertyValueType===PropertyValueType.NO_VALUE||p.propertyValueType===PropertyValueType.CUSTOM_VALUE)fail('Custom / no-value properties cannot be copied.');var own=owner(p);if(source&&source!==own)fail('Copy from one source layer at a time. Multiple properties on that layer are supported.');source=own;var record={path:pathOf(p),type:p.propertyValueType,name:p.name,keys:[],expression:o.expressions&&p.canSetExpression?p.expression:null,expressionEnabled:p.expressionEnabled};for(var j=0;j<ks.length;j++){var r=captureKey(p,ks[j]);min=Math.min(min,r.time);record.keys.push(r);count++;}items.push(record);}if(!items.length)fail('Select keyframes, not only property names.');clipboard={items:items,start:min,count:count};return {message:'Copied '+count+' keys across '+items.length+' properties. Clipboard lasts until AE closes.',count:count};}
    function pasteKeys(o){if(!clipboard)fail('Copy keyframes first.');var c=comp(),ls=layers(c),ps=props(c),jobs=[],i,j;editable(ls);if(clipboard.items.length===1&&ps.length){for(i=0;i<ps.length;i++)jobs.push({p:ps[i],item:clipboard.items[0]});}else{for(i=0;i<ls.length;i++)for(j=0;j<clipboard.items.length;j++){var item=clipboard.items[j],p=resolve(ls[i],item.path);if(!p)fail('Target '+ls[i].name+' is missing '+item.name+'. Add matching effects/properties first.');jobs.push({p:p,item:item});}}for(i=0;i<jobs.length;i++)if(!jobs[i].p.canVaryOverTime||jobs[i].p.propertyValueType!==jobs[i].item.type)fail('Source and target property types must match.');var shift=o.offset==='original'?0:c.time-clipboard.start,done=0;for(i=0;i<jobs.length;i++){var job=jobs[i],targetP=job.p,rs=job.item.keys,indices=[];for(j=0;j<rs.length;j++){targetP.setValueAtTime(rs[j].time+shift,rs[j].value);indices.push(targetP.nearestKeyIndex(rs[j].time+shift));}for(j=0;j<rs.length;j++){var r=rs[j],k=indices[j];targetP.setInterpolationTypeAtKey(k,r.inType,r.outType);if(r.inEase&&r.inType!==KeyframeInterpolationType.HOLD&&r.outType!==KeyframeInterpolationType.HOLD){targetP.setTemporalEaseAtKey(k,r.inEase,r.outEase);if(r.inType===KeyframeInterpolationType.BEZIER&&r.outType===KeyframeInterpolationType.BEZIER){targetP.setTemporalContinuousAtKey(k,r.cont);targetP.setTemporalAutoBezierAtKey(k,r.auto);}}if(r.inTan){targetP.setSpatialTangentsAtKey(k,r.inTan,r.outTan);targetP.setSpatialContinuousAtKey(k,r.sCont);targetP.setSpatialAutoBezierAtKey(k,r.sAuto);if(k>1&&k<targetP.numKeys)targetP.setRovingAtKey(k,r.roving);}if(r.label!==undefined)try{targetP.setLabelAtKey(k,r.label);}catch(ignore){}targetP.setSelectedAtKey(k,true);done++;}if(o.expressions&&job.item.expression!==null&&targetP.canSetExpression){targetP.expression=job.item.expression;if(job.item.expression)targetP.expressionEnabled=job.item.expressionEnabled;}}return {message:'Pasted '+done+' keys. Keys at matching times were replaced.'};}
    function folder(parent,name){
        for(var i=1;i<=parent.numItems;i++){
            var candidate=parent.item(i);
            if(candidate instanceof FolderItem&&candidate.name.toUpperCase()===name.toUpperCase()){
                candidate.name=name;return candidate;
            }
        }
        var created=app.project.items.addFolder(name);created.parentFolder=parent;return created;
    }
    function organize(){
        var project=app.project,root=project.rootFolder,items=[],folders=[],used={},i,j;
        var name=project.file?decodeURI(project.file.name).replace(/\.[^.]+$/,''):'UNTITLED';
        for(i=1;i<=project.numItems;i++)items.push(project.item(i));
        for(i=0;i<items.length;i++)if(items[i] instanceof CompItem){
            for(j=1;j<=items[i].numLayers;j++){var source=items[i].layer(j).source;if(source instanceof CompItem)used[source.id]=true;}
        }
        var base=folder(root,name),moved=0,count=0;
        for(i=0;i<items.length;i++){
            var item=items[i],target=null;
            if(item instanceof FolderItem){var depth=0,p=item.parentFolder;while(p&&p!==root){depth++;p=p.parentFolder;}if(item!==base)folders.push({item:item,depth:depth});continue;}
            if(item instanceof CompItem){target=folder(base,'COMPS');if(used[item.id])target=folder(target,'PRECOMPS');}
            else if(item instanceof FootageItem){
                var group='OTHER';
                if(item.mainSource instanceof SolidSource)group='SOLIDS';
                else if(item.file){var match=/\.([^.]+)$/.exec(item.file.name);if(match)group=match[1].toUpperCase();if(group==='JPEG')group='JPG';}
                target=folder(base,group);
            }
            if(target){if(item.parentFolder!==target){item.parentFolder=target;moved++;}count++;}
        }
        folders.sort(function(a,b){return b.depth-a.depth;});var removed=0;
        for(i=0;i<folders.length;i++)if(folders[i].item.numItems===0){folders[i].item.remove();removed++;}
        return {message:'Organized '+count+' items in '+base.name+'. Main comps in COMPS; nested comps in PRECOMPS; footage grouped by extension. Undo restores the previous layout.',items:count,moved:moved,removedFolders:removed};
    }
    function loop(o){var c=comp(),ps=expressionTargets(c,o.replace,true),n=Math.floor(num(o.count,0,9999)),type=o.type;if(!/^(cycle|pingpong|offset|continue)$/.test(type))fail('Invalid loop type.');for(var i=0;i<ps.length;i++){if(n>ps[i].numKeys-1)fail('Key intervals cannot exceed key count minus one.');}var args='("'+type+'",'+n+')',code=o.direction==='in'?'loopIn'+args:(o.direction==='both'?'time < key(1).time ? loopIn'+args+' : loopOut'+args:'loopOut'+args);for(i=0;i<ps.length;i++)setExpression(ps[i],'// VK LOOP\n'+code+';');return {message:'Loop applied to '+ps.length+' properties.'};}
    function counter(o){var c=comp(),ls=c.selectedLayers,dur=num(o.duration,0.05,3600),from=num(o.from,-1e12,1e12),to=num(o.to,-1e12,1e12),dec=Math.floor(num(o.decimals,0,6)),first=o.first===undefined?3:num(o.first,1,12),every=o.every===undefined?3:num(o.every,1,12);if(first!==Math.floor(first)||every!==Math.floor(every))fail('Comma spacing must use whole numbers of digits.');if(!ls.length){ls=[c.layers.addText('0')];ls[0].name='VK COUNTER';}editable(ls);for(var i=0;i<ls.length;i++)if(!ls[i].property('ADBE Text Properties'))fail('Select text layers only, or deselect everything to create one.');for(i=0;i<ls.length;i++){var src=ls[i].property('ADBE Text Properties').property('ADBE Text Document');if(src.expression&&!/^\/\/ VK COUNTER/.test(src.expression)&&!o.replace)fail('Source Text has an expression. Enable REPLACE EXISTING EXPRESSIONS.');}for(i=0;i<ls.length;i++){var layer=ls[i],fx=layer.property('ADBE Effect Parade'),ctl=fx.property('VK COUNTER VALUE');if(!ctl){ctl=fx.addProperty('ADBE Slider Control');ctl.name='VK COUNTER VALUE';}var slider=ctl.property(1);while(slider.numKeys)slider.removeKey(slider.numKeys);slider.setValueAtTime(c.time,from);slider.setValueAtTime(c.time+dur,to);easeKeys(slider);var e='// VK COUNTER\n'+VKFormatNumber.toString()+'\nvar n=Number(effect("VK COUNTER VALUE")(1).value);\nVKFormatNumber(n,'+dec+','+(o.separator?'true':'false')+','+first+','+every+','+encode(String(o.prefix||''))+','+encode(String(o.suffix||''))+');';setExpression(layer.property('ADBE Text Properties').property('ADBE Text Document'),e);}return {message:'Counter applied to '+ls.length+' text layers. Edit VK COUNTER VALUE in Effect Controls.'};}
    function removeExpressions(){var c=comp(),ps=props(c),n=0;if(!ps.length)fail('Select properties to remove VK expressions.');for(var i=0;i<ps.length;i++)if(ps[i].canSetExpression&&/^\/\/ VK /.test(ps[i].expression)){if(owner(ps[i]).locked)fail('Unlock selected layers first.');ps[i].expression='';n++;}return {message:'Removed '+n+' VK expressions.'};}
    function textMarkerPlan(c,layer,direction,duration){
        var markers=layer.property('ADBE Marker'),found=0,edge=direction==='in'?Math.min(layer.outPoint,layer.inPoint+duration):Math.max(layer.inPoint,layer.outPoint-duration),i;
        if(layer.outPoint<=layer.inPoint)fail('Text layer must have a positive duration.');
        for(i=1;i<=markers.numKeys;i++)if(markers.keyValue(i).comment===direction){if(found)fail('Keep only one marker named "'+direction+'" on '+layer.name+'.');found=i;}
        if(found)return {markers:markers,exists:true,time:markers.keyTime(found)};
        // Find a free frame next to the requested time; never replace another marker.
        var step=c.frameDuration||1/30,limit=markers.numKeys+1;if(layer.outPoint-layer.inPoint<step)step=(layer.outPoint-layer.inPoint)/100;
        function free(t){for(var k=1;k<=markers.numKeys;k++)if(Math.abs(markers.keyTime(k)-t)<0.000001)return false;return true;}
        for(i=0;i<=limit;i++){
            var a=edge-i*step,b=edge+i*step;
            if(a>layer.inPoint&&a<layer.outPoint&&free(a))return {markers:markers,time:a};
            if(b>layer.inPoint&&b<layer.outPoint&&free(b))return {markers:markers,time:b};
        }
        fail('No free time for the "'+direction+'" marker on '+layer.name+'. Move an existing marker and try again.');
    }
    function addTextAnimation(c,layer,o){
        var dur=num(o.duration,0.1,60),stagger=num(o.stagger,0,2),spec=VKText.get(o.preset);
        var by=spec.by||o.by,based=by==='line'?4:(by==='word'?3:1);
        var text=layer.property('ADBE Text Properties'),anims=text.property('ADBE Text Animators');
        // Build all pieces before removing an earlier animation. Reacquire indexed groups after additions.
        var direction=o.direction==='out'?'out':'in',plan=textMarkerPlan(c,layer,direction,dur);
        var token='VK BUILDING '+new Date().getTime()+' ',built=0;
        var e='// VK TEXT TIMING\nvar amount='+VKText.amount.toString()+';\nvar delays='+VKText.delays.toString()+';\nvar influence='+VKText.influence.toString()+';\n'+
            'var isOut='+(direction==='out'?'true':'false')+';\nvar edge=isOut?Math.max(inPoint,outPoint-'+dur+'):Math.min(outPoint,inPoint+'+dur+');\n'+
            'for(var m=1;m<=thisLayer.marker.numKeys;m++){if(thisLayer.marker.key(m).comment==='+encode(direction)+'){edge=thisLayer.marker.key(m).time;break;}}\n'+
            'edge=Math.max(inPoint,Math.min(outPoint,edge));\nvar start=isOut?edge:inPoint,end=isOut?outPoint:edge;\n'+
            'var phase=end>start?Math.max(0,Math.min(1,(time-start)/(end-start))):(time>=end?1:0);\n'+
            'var totalDuration='+dur+'+Math.max(0,textTotal-1)*'+stagger+';\n'+
            'var a=phase<=0?(isOut?0:100):phase>=1?(isOut?100:0):influence(phase*totalDuration,textIndex,textTotal,'+dur+','+stagger+',isOut,'+(spec.step?'true':'false')+','+encode(spec.curve||'smooth')+','+(spec.reverseOut?'true':'false')+',false,String(text.sourceText),'+encode(by)+');\n';
        function piece(properties,suffix){
            var a=anims.addProperty('ADBE Text Animator');a.name=token+(++built);
            for(var i=0;i<properties.length;i++)a.property('ADBE Text Animator Properties').addProperty(properties[i][0]).setValue(properties[i][1]);
            var sel=a.property('ADBE Text Selectors').addProperty('ADBE Text Expressible Selector');sel.name='SuperV TIMING';
            sel.property('ADBE Text Range Type2').setValue(based);
            setExpression(sel.property('ADBE Text Expressible Amount'),e+suffix+'\n[a,a,a];');
        }
        try{
            var ps=[['ADBE Text Opacity',0]];
            if((spec.x||spec.y)&&!spec.opposing)ps.push(['ADBE Text Position 3D',[spec.x||0,spec.y||0,0]]);
            if(spec.scale!==undefined)ps.push(['ADBE Text Scale 3D',[spec.scale,spec.scale,100]]);
            if(spec.tracking)ps.push(['ADBE Text Tracking Amount',spec.tracking]);
            if(spec.blur)ps.push(['ADBE Text Blur',[spec.blur,spec.blur]]);
            piece(ps,spec.outline?'a=100*(1-Math.min(1,(1-a/100)*8));':'');
            if(spec.opposing)piece([['ADBE Text Position 3D',[-spec.x,0,0]]],'a*=textIndex%2===1?1:-1;');
            if(spec.outline){
                piece([['ADBE Text Fill Opacity',0]],'a=100*(1-Math.max(0,((1-a/100)-0.18)/0.82));');
                var doc=text.property('ADBE Text Document').value,color=doc.applyFill?doc.fillColor:[1,1,1];
                piece([['ADBE Text Stroke Width',1],['ADBE Text Stroke Color',color],['ADBE Text Stroke Opacity',100]],'var v=1-a/100;a=100*Math.min(1,v*8)*Math.min(1,(1-v)*8);');
            }
            if(!plan.exists){var marker=new MarkerValue(direction);marker.setParameters({supervTextTiming:direction});plan.markers.setValueAtTime(plan.time,marker);}
        }catch(err){for(var r=anims.numProperties;r>=1;r--)if(anims.property(r).name.indexOf(token)===0)anims.property(r).remove();throw err;}
        for(var q=anims.numProperties;q>=1;q--){var old=anims.property(q).name;if(old.indexOf('VK TEXT ')===0&&(old.indexOf('VK TEXT '+direction.toUpperCase()+' ')===0||!/^VK TEXT (IN|OUT) /.test(old)))anims.property(q).remove();}
        for(q=1;q<=anims.numProperties;q++)if(anims.property(q).name.indexOf(token)===0)anims.property(q).name='VK TEXT '+direction.toUpperCase()+' '+spec.id.toUpperCase()+' '+q;
    }
    function textTool(o){var c=comp(),ls=layers(c);editable(ls);for(var i=0;i<ls.length;i++){if(!ls[i].property('ADBE Text Properties'))fail('Select text layers only.');textMarkerPlan(c,ls[i],o.direction==='out'?'out':'in',num(o.duration,0.1,60));}for(i=0;i<ls.length;i++)addTextAnimation(c,ls[i],o);return {message:'Applied '+o.preset.toUpperCase()+' to '+ls.length+' layers. Drag the "'+(o.direction==='out'?'out':'in')+'" layer marker to adjust timing. The other direction is retained.'};}
    function textPreview(o){var spec=VKText.get(o.preset),sample=VKText.sample(spec),ds=VKText.delays(sample,spec.by||o.by,num(o.stagger,0,2),spec.parallelRows),last=0;for(var i=0;i<ds.length;i++)last=Math.max(last,ds[i]);var c=app.project.items.addComp('SuperV PREVIEW - '+spec.name,960,540,1,Math.max(8,num(o.duration,0.1,60)+last+2),30);var l=c.layers.addText(sample.replace(/\n/g,'\r')),src=l.property('ADBE Text Properties').property('ADBE Text Document'),doc=src.value;doc.font='Arial-BoldMT';doc.fontSize=66;doc.fillColor=[1,1,1];doc.justification=ParagraphJustification.CENTER_JUSTIFY;src.setValue(doc);l.property('ADBE Transform Group').property('ADBE Position').setValue([480,spec.parallelRows?190:250]);c.bgColor=[0.125,0.125,0.125];c.time=0.5;addTextAnimation(c,l,o);c.openInViewer();return {message:'Created a SuperV preview comp. Press SPACE / NUMPAD 0 in AE to play.'};}
    function removeText(){var c=comp(),ls=layers(c),n=0;editable(ls);for(var i=0;i<ls.length;i++){var text=ls[i].property('ADBE Text Properties');if(!text)continue;var a=text.property('ADBE Text Animators');for(var j=a.numProperties;j>=1;j--)if(a.property(j).name.indexOf('VK TEXT ')===0){a.property(j).remove();n++;}}return {message:'Removed '+n+' VK text animators.'};}
    function pickFile(o){var f=File.openDialog(o.title||'Choose file');return {path:f?f.fsName:null};}
    function pickOutput(){var f=File.saveDialog('Export GIF','GIF:*.gif');if(!f)return {path:null};var path=f.fsName;if(!/\.gif$/i.test(path))path+='.gif';var out=new File(path);if(out.exists&&!confirm('Replace existing GIF?\n'+path))return {path:null};return {path:path};}
    var actions={nullTool:nullTool,copyKeys:copyKeys,pasteKeys:pasteKeys,organize:organize,loop:loop,counter:counter,removeExpressions:removeExpressions,text:textTool,textPreview:textPreview,removeText:removeText,pickFile:pickFile,pickOutput:pickOutput,ping:function(){return {message:'Connected to After Effects '+app.version,version:app.version};}};
    var featureFile = new File(hostFile.parent.fsName+'/features.jsx');
    if(!featureFile.exists)fail('Required script is missing: '+featureFile.fsName);
    $.evalFile(featureFile);
    var extra=VKFeatures({moduleRoot:moduleRoot,comp:comp,fail:fail,num:num,props:props,owner:owner,numeric:numeric,setExpression:setExpression,walk:walk,encode:encode});
    for(var feature in extra)if(extra.hasOwnProperty(feature))actions[feature]=extra[feature];
    var moreFile = new File(hostFile.parent.fsName+'/more.jsx');
    if(!moreFile.exists)fail('Required script is missing: '+moreFile.fsName);
    $.evalFile(moreFile);
    var more=VKMore({comp:comp,fail:fail,num:num,setExpression:setExpression,encode:encode});
    for(var tool in more)if(more.hasOwnProperty(tool))actions[tool]=more[tool];
    return {version:'1.3.0',source:hostFile.fsName,dispatch:function(action,encoded){var undo=false,response;try{if(!actions.hasOwnProperty(action))fail('Unknown action.');var raw=decodeURIComponent(encoded||'%7B%7D');/* Only URI-encoded JSON from our local panel enters here. */var data=eval('('+raw+')');if(!/^(ping|pickFile|pickOutput|renderBegin|renderFrame|renderFinish|duplicateExternal|copyKeys)$/.test(action)){app.beginUndoGroup('SuperV · '+action);undo=true;}var result=actions[action](data||{});result.ok=true;response=encode(result);}catch(e){response=encode({ok:false,message:String(e.message||e),line:e.line||null});}finally{if(undo)app.endUndoGroup();}return response;},_test:{encode:encode,actions:actions}};
})();
// Standalone test alias. CEP commands use the private namespace above.
var VK = $.global.__VK_GSD_HOST__;
