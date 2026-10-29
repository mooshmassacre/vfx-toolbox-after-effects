const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/VFX_ToolBox.jsx','utf8');
const exposed=source.replace('    build();','    this.api={verifyPNG:verifyPNG,verifyPSD:verifyPSD,renderPNG:renderPNG,savePNGDirect:savePNGDirect,selectPNGOutput:selectPNGOutput,selectPhotoshop32Output:selectPhotoshop32Output,selectQuickTimeIntermediate:selectQuickTimeIntermediate,safeName:safeName,shellQuote:shellQuote,nextPlateFile:nextPlateFile,nextProxyFile:nextProxyFile,nextVersionFile:nextVersionFile,nextTrackerName:nextTrackerName,timelineProxyTarget:timelineProxyTarget,layerCaptureRect:layerCaptureRect,reloadImportedAssets:reloadImportedAssets};');
let tests=0;
function test(name,fn){fn();tests++;console.log('PASS '+name);}
test('Project identity is VFX ToolBox',()=>{
 assert(/var TITLE = "VFX ToolBox", VERSION = "0\.11\.1 beta"/.test(source));
 assert(/\/VFX ToolBox Textures/.test(source));
 assert(!/var TITLE = "PlaneTrace"/.test(source));
});
function MockFile(path){if(MockFile.registry[path])return MockFile.registry[path];this.fsName=path||'';this.name=(path||'').split('/').pop();this.exists=false;}
MockFile.registry={};
function FootageItem(){}
function FileSource(){}
function CompItem(){this.usedIn=[];}
const sandbox={app:{project:{bitsPerChannel:16}},Window:function(){},Panel:function(){},File:MockFile,FootageItem,FileSource,CompItem,alert:()=>{},confirm:()=>true,Date,Math,isFinite,Error,parseInt,GetSettingsFormat:{STRING:1,STRING_SETTABLE:2},PostRenderAction:{NONE:0},RQItemStatus:{DONE:1,QUEUED:2,UNQUEUED:3,USER_STOPPED:4,ERR_STOPPED:5,RENDERING:6,NEEDS_OUTPUT:7}};
vm.createContext(sandbox);vm.runInContext(exposed,sandbox);
function u32(n){let b=Buffer.alloc(4);b.writeUInt32BE(n);return b;}
function chunk(type,data){return Buffer.concat([u32(data.length),Buffer.from(type),data,Buffer.alloc(4)]);}
function png(bits=16,options={}){
 let ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(options.width||1920,0);ihdr.writeUInt32BE(options.height||1080,4);ihdr[8]=bits;ihdr[9]=options.colorType===undefined?6:options.colorType;
 let chunks=[chunk('IHDR',ihdr)];if(options.icc!==false)chunks.push(chunk('iCCP',Buffer.from('Project Profile\0\0profile')));chunks.push(chunk('IEND',Buffer.alloc(0)));
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...chunks]);
}
function mockFile(buffer){let cursor=0;return {length:buffer.length,closed:false,open(){return true;},close(){this.closed=true;},read(n){const b=buffer.subarray(cursor,cursor+n);cursor+=b.length;return b.toString('latin1');},tell(){return cursor;},seek(offset,mode){cursor=mode===1?cursor+offset:mode===2?buffer.length+offset:offset;return cursor>=0&&cursor<=buffer.length;}};}
function psd(depth=16,options={}){
 const header=Buffer.alloc(26);header.write('8BPS',0);header.writeUInt16BE(1,4);header.writeUInt16BE(options.channels||4,12);header.writeUInt32BE(options.height||1080,14);header.writeUInt32BE(options.width||1920,18);header.writeUInt16BE(depth,22);header.writeUInt16BE(options.mode===undefined?3:options.mode,24);
 let resources=Buffer.alloc(0);if(options.icc!==false){resources=Buffer.alloc(16);resources.write('8BIM',0);resources.writeUInt16BE(1039,4);resources.writeUInt32BE(4,8);resources.fill(1,12);}
 const colorLength=Buffer.alloc(4),resourceLength=Buffer.alloc(4),layerLength=Buffer.alloc(4);resourceLength.writeUInt32BE(resources.length);
 return Buffer.concat([header,colorLength,resourceLength,resources,layerLength,Buffer.alloc(2)]);
}
const context={depth:16,space:'Rec.709',comp:{width:1920,height:1080}};
for(const depth of [8,16])test('PNG '+depth+' bpc, dimensions and ICC',()=>{let f=mockFile(png(depth));sandbox.api.verifyPNG(f,{...context,depth});assert(f.closed);});
for(const [label,data] of [['depth downgrade',png(8)],['missing ICC',png(16,{icc:false})],['resized output',png(16,{height:720})],['non-RGB output',png(16,{colorType:0})],['truncated PNG',png().subarray(0,28)],['renamed PSD',Buffer.alloc(32)]])test('Reject '+label,()=>{let f=mockFile(data);assert.throws(()=>sandbox.api.verifyPNG(f,context));assert(f.closed);});
test('Direct PNG may be untagged while retaining structural validation',()=>{
 let f=mockFile(png(16,{icc:false})),info=sandbox.api.verifyPNG(f,context,false);assert.equal(info.embeddedICC,false);assert(f.closed);
});
for(const depth of [8,16,32])test('PSD '+depth+' bpc, dimensions and ICC metadata',()=>{let f=mockFile(psd(depth)),info=sandbox.api.verifyPSD(f,{...context,depth});assert.equal(info.embeddedICC,true);assert(f.closed);});
test('Accept untagged PSD and report its metadata state',()=>{let f=mockFile(psd(16,{icc:false})),info=sandbox.api.verifyPSD(f,context);assert.equal(info.embeddedICC,false);assert(f.closed);});
for(const [label,data] of [['depth mismatch',psd(8)],['resized PSD',psd(16,{height:720})],['non-RGB PSD',psd(16,{mode:4})],['invalid PSD',Buffer.alloc(32)]])test('Reject '+label,()=>{let f=mockFile(data);assert.throws(()=>sandbox.api.verifyPSD(f,context));assert(f.closed);});
test('Portable filename',()=>assert.equal(sandbox.api.safeName('a/b:c?* .'),'a_b_c__'));
test('Shell conversion path is safely single-quoted',()=>assert.equal(sandbox.api.shellQuote("a'b"),"'a'\\''b'"));
test('Plate numbering increments the highest existing Plate',()=>{
 const names=['Plate_01.png','plate_07.PNG','Plate_03.png','Plate_99.psd','notes.png'];
 const folder={fsName:'/project/Plates',getFiles(){return names.map(n=>new MockFile('/project/Plates/'+n));}};
 assert.equal(sandbox.api.nextPlateFile(folder,'psd').name,'Plate_100.psd');
});
test('PSD Plate numbering starts at 01',()=>{
 const folder={fsName:'/project/Plates',getFiles(){return [];}};
 assert.equal(sandbox.api.nextPlateFile(folder,'psd').name,'Plate_01.psd');
});
test('Plate numbering is shared across previous and current formats',()=>{
 const names=['Plate_08.png','Plate_09.tif','Plate_10.tiff'];
 const folder={fsName:'/project/Plates',getFiles(){return names.map(n=>new MockFile('/project/Plates/'+n));}};
 assert.equal(sandbox.api.nextPlateFile(folder,'psd').name,'Plate_11.psd');
});
test('Proxy naming uses the source folder, uppercase suffix and no replacement',()=>{
 const names=['Shot_PROXY.mp4','Shot_PROXY_04.MP4','Shot_PROXY.mov','Other_PROXY_20.mp4'];
 const folder={fsName:'/media',getFiles(){return names.map(n=>new MockFile('/media/'+n));}};
 assert.equal(sandbox.api.nextProxyFile(folder,'Shot.mov','mp4').name,'Shot_PROXY_05.mp4');
 assert.equal(sandbox.api.nextProxyFile(folder,'Shot.mov','mov').name,'Shot_PROXY_02.mov');
 assert.equal(sandbox.api.nextProxyFile(folder,'New Shot.mov','mp4').name,'New Shot_PROXY.mp4');
});
test('Project versioning increments the highest version and keeps the base name',()=>{
 const names=['Feature.aep','Feature_V01.aep','Feature_V04.aep','Other_V20.aep'];
 const folder={fsName:'/project',getFiles(){return names.map(n=>new MockFile('/project/'+n));}};
 assert.equal(sandbox.api.nextVersionFile(folder,'Feature.aep').name,'Feature_V05.aep');
 assert.equal(sandbox.api.nextVersionFile(folder,'Feature_V04.aep').name,'Feature_V05.aep');
});
function templateItem(definitions){let current=null;return {outputModule(){return {templates:Object.keys(definitions),applyTemplate(n){current=n;},getSettings(mode){return mode===2?{}:definitions[current];}};}};}
for(const depth of [8,16])test('Select native PNG '+depth+'-bit output',()=>{
 const names={8:'Millions of Colors+',16:'Trillions of Colors+'};
 const item=templateItem({'Photoshop':{Format:'Photoshop Sequence',Depth:names[depth]},['_HIDDEN X-Factor '+depth]:{Format:'PNG Sequence',Depth:names[depth],Channels:'RGB + Alpha'}});
 assert.equal(sandbox.api.selectPNGOutput(item,{depth}).getSettings(1).Format,'PNG Sequence');
});
test('Never select 32-bit PNG',()=>{const item=templateItem({'PNG':{Format:'PNG Sequence',Depth:'Trillions of Colors+'}});assert.throws(()=>sandbox.api.selectPNGOutput(item,{depth:32}),/No compatible/);});
test('Select hidden 32-bit Photoshop fallback',()=>{
 const item=templateItem({'Photoshop':{Format:'Photoshop Sequence',Depth:'Millions of Colors+'},'_HIDDEN X-Factor 32':{Format:'Photoshop Sequence',Depth:'Floating Point+',Channels:'RGB + Alpha'}});
 assert.equal(sandbox.api.selectPhotoshop32Output(item,{depth:32}).getSettings(1).Depth,'Floating Point+');
});
test('Select lossless QuickTime intermediate for composition proxies',()=>{
 const item=templateItem({'H.264 - 40 Mbps':{Format:'H.264'},'Lossless':{Format:'QuickTime',Depth:'Millions of Colors+'}});
 assert.equal(sandbox.api.selectQuickTimeIntermediate(item).getSettings(1).Format,'QuickTime');
});
function queueEntry(status,enabled){let value=enabled;return {status,writes:0,get render(){return value;},set render(v){this.writes++;if([1,4,5,6].includes(this.status))throw Error('immutable');value=v;this.status=v?2:3;}};}
test('Render queue isolation and displayed timeline origin',()=>{
 let original=queueEntry(2,true),done=queueEntry(1,true),removed=false,item;
 let om={templates:['_HIDDEN X-Factor 16'],applyTemplate(){},getSettings(mode){return mode===2?{}:{Format:'PNG Sequence',Depth:'Trillions of Colors+',Channels:'RGB + Alpha'};}};
 sandbox.app.project.renderQueue={numItems:2,item(i){return i===1?original:done;},items:{add(){item={setSettings(){},outputModule(){return om;},status:1,remove(){removed=true;}};return item;}},render(){assert.equal(original.render,false);assert.equal(done.writes,0);assert(Math.abs(item.timeSpanStart-74948.66)<1e-8);}};
 sandbox.api.renderPNG({comp:{frameDuration:1/24,displayStartTime:74940.19},time:8.47,depth:16},{exists:true});
 assert(original.render);assert.equal(done.writes,0);assert(removed);
});
test('Direct frame saving bypasses the queue and restores preview resolution',()=>{
 let called=0,queueCalls=0,file=mockFile(png(16));file.exists=true;file.fsName='/direct.png';MockFile.registry[file.fsName]=file;
 sandbox.app.project.renderQueue={render(){queueCalls++;}};
 let comp={resolutionFactor:[2,2],saveFrameToPng(time,target){called++;assert.equal(time,4.25);assert.strictEqual(target,file);}};
 sandbox.api.savePNGDirect({comp,time:4.25},file);
 assert.equal(called,1);assert.equal(queueCalls,0);assert.deepEqual(comp.resolutionFactor,[2,2]);
 delete MockFile.registry[file.fsName];
});
test('PSD is final, PNG is temporary and project depth is never reassigned',()=>{
 assert(/nextPlateFile\(folder,"psd"\)/.test(source));
 assert(/temporaryPNG\.remove\(\)/.test(source));
 assert(!/bitsPerChannel\s*=(?!=)/.test(source));
});
test('Save Frame creates PSD Plates without Photoshop',()=>{
 assert(/function platesFolder\(\)/.test(source));
 assert(/folder = platesFolder\(\)/.test(source));
 assert(/function projectPlatesFolder\(\)/.test(source));
 assert(/footage\.parentFolder = projectPlatesFolder\(\)/.test(source));
 assert(/renderPhotoshop32\(context,file\)/.test(source));
 assert(/convertPNGToPSD\(temporaryPNG,file\)/.test(source));
 assert(/verifyPSD\(file,context\)/.test(source));
 assert(/options\.importAs=ImportAsType\.FOOTAGE/.test(source));
 assert(/plateLayer=context\.comp\.layers\.add\(footage\)/.test(source));
 assert(/plateLayer\.startTime=context\.time/.test(source));
 assert(/plateLayer\.inPoint=context\.time/.test(source));
 assert(/\/usr\/bin\/sips/.test(source));
 assert(!/BridgeTalk/.test(source));
 assert(/saveButton\.onClick = runSave/.test(source));
});
test('Save Frame offers Save Plate and Save Unstretched choices',()=>{
 assert(/function chooseSaveMode\(\)/.test(source));
 assert(/"Save Plate"/.test(source));
 assert(/"Save Unstretched"/.test(source));
 assert(/dialog\.defaultElement=plate/.test(source));
 assert(/var choice=chooseSaveMode\(\)/.test(source));
});
test('Save Plate isolates selected masked layers as transparent PNG',()=>{
 assert(/layer\.property\("ADBE Mask Parade"\)/.test(source));
 assert(/nextPlateFile\(folder,"png"\)/.test(source));
 assert(/isolateLayerForCapture\(context\.comp,target/.test(source));
 assert(/savePNGDirect\(context,file\)/.test(source));
 assert(/pngInfo\.colorType!==6/.test(source));
 assert(/unstretched\?"Unstretched":"Masked"/.test(source));
 assert(/" PNG Plate \| Source: "/.test(source));
 assert(/if\(maskedLayer\) saveLayerPNG\(context,folder,maskedLayer,false\)/.test(source));
});
test('Save Unstretched restores the original quadrilateral with Corner Pin',()=>{
 assert(/effects\.addProperty\("CC Power Pin"\)/.test(source));
 assert(/pin\.property\(6\)\.setValue\(true\)/.test(source));
 assert(/addProperty\("ADBE Corner Pin"\)/.test(source));
 assert(/cornerPin\.property\(i\+1\)\.setValue\(setup\.corners\[i\]\)/.test(source));
 assert(/saveLayerPNG\(context,folder,selectedPlateLayer\(context,false\),true\)/.test(source));
 assert(/restoreLayerStates\(states\|\|\[\]\)/.test(source));
});
test('Save Unstretched uses current mask bounds instead of full layer bounds',()=>{
 const shapeProperty={valueAtTime(){return {vertices:[[100,50],[500,50],[500,350],[100,350]]};}};
 const mask={property(name){return name==='ADBE Mask Shape'?shapeProperty:null;}};
 const masks={numProperties:1,property(){return mask;}};
 const layer={property(name){return name==='ADBE Mask Parade'?masks:null;},sourceRectAtTime(){return {left:0,top:0,width:1920,height:1080};}};
 const rect=sandbox.api.layerCaptureRect(layer,2);
 assert.deepEqual(JSON.parse(JSON.stringify(rect)),{left:100,top:50,width:400,height:300,fromMasks:true,corners:[[100,50],[500,50],[100,350],[500,350]]});
 assert(/layerCaptureRect\(target,context\.time\)/.test(source));
 assert(/var local=rect\.corners\|\|/.test(source));
});
test('Stamp 3D directly captures its temporary PNG and converts it to PSD',()=>{
 assert(/file = uniqueFile\(folder, layer\.name, "psd"\)/.test(source));
 assert(/temporaryPNG = uniqueFile\(folder, "VFX_ToolBox_TEMP_" \+ layer\.name, "png"\)/.test(source));
 const captureBody=source.slice(source.indexOf('function capture('),source.indexOf('function saveFrame('));
 assert(/savePNGDirect\(context, temporaryPNG\)/.test(captureBody));
 assert(!/renderPNG\(context, temporaryPNG\)/.test(captureBody));
 assert(/verifyPNG\(temporaryPNG, context, false\)/.test(captureBody));
 assert(/convertPNGToPSD\(temporaryPNG, file\)/.test(source));
 assert(!/if\(!psdInfo\.embeddedICC\)/.test(captureBody));
 assert(/temporaryPNG\.remove\(\)/.test(source));
});
test('Render Queue accepts After Effects frame suffix variants',()=>{
 assert(/escapedPrefix\+"\.\*\\\\\."\+escapedSuffix/.test(source));
 assert(/Found "\+matches\.length\+" matching files/.test(source));
});
test('Render Queue normalizes a bracketed After Effects frame filename',()=>{
 let original=queueEntry(2,false),item,renamed=false;
 let requested=new MockFile('/textures/VFX_ToolBox_TEMP_Test_123.png');requested.parent={getFiles(filter){return [rendered].filter(filter);}};
 let rendered=new MockFile('/textures/VFX_ToolBox_TEMP_Test_123_[00001].png');rendered.name='VFX_ToolBox_TEMP_Test_123_[00001].png';rendered.rename=function(name){renamed=name==='VFX_ToolBox_TEMP_Test_123.png';requested.exists=renamed;return renamed;};
 MockFile.registry[requested.fsName]=requested;
 let om={templates:['_HIDDEN X-Factor 16'],applyTemplate(){},getSettings(mode){return mode===2?{}:{Format:'PNG Sequence',Depth:'Trillions of Colors+',Channels:'RGB + Alpha'};}};
 sandbox.app.project.renderQueue={numItems:1,item(){return original;},items:{add(){item={setSettings(){},outputModule(){return om;},status:1,remove(){}};return item;}},render(){}};
 sandbox.api.renderPNG({comp:{frameDuration:1/24,displayStartTime:0},time:1,depth:16},requested);
 assert(renamed);assert(requested.exists);
 delete MockFile.registry[requested.fsName];
});
test('Interface uses Stamp 3D label consistently',()=>{
 assert(/topRow\.add\("button", undefined, "Stamp 3D"\)/.test(source));
 assert(/captureButton\.text = "Stamp 3D"/.test(source));
 assert(!/"Capture PNG"/.test(source));
});
test('Reload Textures reloads every file-based Footage item and reports failures',()=>{
 let good=new FootageItem(),bad=new FootageItem(),generated=new FootageItem(),calls=0;
 good.name='Good';good.mainSource=new FileSource();good.mainSource.reload=()=>{calls++;};
 bad.name='Missing';bad.mainSource=new FileSource();bad.mainSource.reload=()=>{throw Error('offline');};
 generated.name='Solid';generated.mainSource={};
 sandbox.app.project={numItems:3,item(i){return [good,bad,generated][i-1];}};
 let result=sandbox.api.reloadImportedAssets();
 assert.equal(calls,1);assert.equal(result.reloaded,1);assert.equal(result.failed.length,1);assert(/Missing/.test(result.failed[0]));
});
test('Interface includes Reload Textures beside the existing actions',()=>{
 assert(/bottomRow\.add\("button", undefined, "Reload Textures"\)/.test(source));
 assert(/reloadButton\.onClick = runReload/.test(source));
 assert(/reloadButton\.enabled = false/.test(source));
});
test('Play Proxy remains a same-resolution H.265 MP4 at 10 Mbps',()=>{
 const proxyIndex=source.indexOf('bottomRow.add("button", undefined, "Generate Proxy")');
 const stampIndex=source.indexOf('topRow.add("button", undefined, "Stamp 3D")');
 assert(proxyIndex>=0 && stampIndex>=0);
 assert(/-b:v 10M -maxrate 10M -bufsize 20M/.test(source));
 assert(/mode !== "work" && codec !== "hevc"/.test(source));
 assert(/item\.setProxy\(proxyFile\)/.test(source));
 assert(/item\.useProxy = true/.test(source));
 assert(/Image sequences are not converted/.test(source));
 assert(/return sourceFile\.parent/.test(source));
 assert(/mode === "work" \? "mov" : "mp4"/.test(source));
});
test('Work Proxy uses ProRes Proxy MOV and scales proportionally to at most 1080 high',()=>{
 assert(/-c:v prores_ks -profile:v 0 -vendor apl0 -pix_fmt yuv422p10le/.test(source));
 assert(/min\(1\\\\,1080\/ih\)/.test(source));
 assert(/mode === "work" && codec !== "prores"/.test(source));
 assert(/Math\.min\(1, 1080 \/ item\.height\)/.test(source));
 assert(/expectedWidth/.test(source) && /expectedHeight/.test(source));
 assert(/"Play Proxy - Same Res \| H265"/.test(source));
 assert(/"Work Proxy - Low Res \| QTProxy"/.test(source));
 assert(/dialog\.defaultElement=play/.test(source));
});
test('Generate Proxy accepts one movie footage layer selected in the timeline',()=>{
 const footage=new FootageItem();footage.mainSource=new FileSource();footage.mainSource.isStill=false;
 const layer={source:footage};Object.setPrototypeOf(layer,{constructor:{name:'AVLayer'}});
 // Runtime type validation is covered statically because AVLayer is host-provided.
 const body=source.slice(source.indexOf('function timelineProxyTarget('),source.indexOf('function selectedProxyTarget('));
 assert(/comp\.selectedLayers\.length!==1/.test(body));
 assert(/layer\.source instanceof FootageItem/.test(body));
 assert(/layer\.source\.mainSource instanceof FileSource/.test(body));
 assert(/return layer\.source/.test(body));
 assert(/var target=selectedProxyTarget\(\)/.test(source));
 assert(/item\.setProxy\(proxyFile\)/.test(source));
 assert(/item\.useProxy = true/.test(source));
});
test('Generated proxies are imported into the Project panel Proxies folder',()=>{
 assert(/function projectProxiesFolder\(\)/.test(source));
 assert(/item instanceof FolderItem && item\.name === "Proxies"/.test(source));
 assert(/app\.project\.items\.addFolder\("Proxies"\)/.test(source));
 assert(/new ImportOptions\(file\)/.test(source));
 assert(/app\.project\.importFile\(options\)/.test(source));
 assert(/footage\.parentFolder=projectProxiesFolder\(\)/.test(source));
 const generateBody=source.slice(source.indexOf('function generateProxy('),source.indexOf('function convertPNGToPSD('));
 assert(/importedProxy=importProxyFootage\(proxyFile,item,mode\)/.test(generateBody));
 assert(generateBody.indexOf('importedProxy=importProxyFootage') < generateBody.indexOf('item.setProxy(proxyFile)'));
});
test('Generate Proxy supports comps through a disposable full-resolution intermediate',()=>{
 assert(/target instanceof CompItem/.test(source));
 assert(/item instanceof CompItem/.test(source));
 assert(/renderCompIntermediate\(item,intermediate\)/.test(source));
 assert(/item\.timeSpanDuration=comp\.duration/.test(source));
 assert(/item\.timeSpanStart=comp\.displayStartTime/.test(source));
 assert(/"Resolution":"Full"/.test(source));
 assert(/"Proxy Use":"Use No Proxies"/.test(source));
 assert(/intermediate\.exists && !intermediate\.remove\(\)/.test(source));
 assert(/return app\.project\.file\.parent/.test(source));
});
test('Every selected composition proxy requires confirmation with Yes as default',()=>{
 assert(/target instanceof CompItem && !confirm\(/.test(source));
 assert(/"Generate proxy for this composition\?", false, TITLE/.test(source));
 assert(!/movie && !confirm/.test(source));
});
test('Interface is a responsive grid of two rows and three buttons',()=>{
 assert(/panel\.orientation = "column"/.test(source));
 assert(/topRow\.orientation = "row"/.test(source));
 assert(/bottomRow\.orientation = "row"/.test(source));
 assert.equal((source.match(/topRow\.add\("button"/g)||[]).length,3);
 assert.equal((source.match(/bottomRow\.add\("button"/g)||[]).length,3);
 assert(/topRow\.add\("button", undefined, "Tracker"\)/.test(source));
 assert(/bottomRow\.add\("button", undefined, "Generate Proxy"\)/.test(source));
 assert(/bottomRow\.add\("button", undefined, "Versioning"\)/.test(source));
 assert(/bottomRow\.add\("button", undefined, "Reload Textures"\)/.test(source));
 assert.equal((source.match(/\.alignment = \["fill","fill"\]/g)||[]).length>=8,true);
 assert(/versioningButton\.onClick = runVersioning/.test(source));
 const top=["Tracker","Stamp 3D","Save Frame"].map(label=>source.indexOf('topRow.add("button", undefined, "'+label+'")'));
 const bottom=["Versioning","Generate Proxy","Reload Textures"].map(label=>source.indexOf('bottomRow.add("button", undefined, "'+label+'")'));
 assert(top[0]>=0 && top[0]<top[1] && top[1]<top[2]);
 assert(bottom[0]>=0 && bottom[0]<bottom[1] && bottom[1]<bottom[2]);
});
test('Tracker precedes Stamp 3D and offers two native workflows',()=>{
 const trackerIndex=source.indexOf('topRow.add("button", undefined, "Tracker")');
 const stampIndex=source.indexOf('topRow.add("button", undefined, "Stamp 3D")');
 assert(trackerIndex>=0 && trackerIndex<stampIndex);
 assert(/matchName="ADBE 3D Tracker"/.test(source));
 assert(/effects\.canAddProperty\(matchName\)/.test(source));
 assert(/effects\.addProperty\(matchName\)/.test(source));
 assert(/3D Camera Tracker is already applied/.test(source));
 assert(/app\.executeCommand\(2568\)/.test(source));
 assert(/"3D Camera Tracker"/.test(source));
 assert(/"Motion Tracker"/.test(source));
 assert(/trackerButton\.onClick = runTrackerChoice/.test(source));
 assert(!/trackerButton\.addEventListener\("mouseover"/.test(source));
});
test('Motion Tracker creates the next numbered null and stores its source in Assets',()=>{
 const comp={numLayers:3,layer(i){return [{name:'Footage'},{name:'TRACKER_01'},{name:'TRACKER_07'}][i-1];}};
 assert.equal(sandbox.api.nextTrackerName(comp),'TRACKER_08');
 assert(/comp\.layers\.addNull\(comp\.duration\)/.test(source));
 assert(/nullLayer\.source\.parentFolder = projectAssetsFolder\(\)/.test(source));
 assert(/item instanceof FolderItem && item\.name === "Assets"/.test(source));
 const motionBody=source.slice(source.indexOf('function applyMotionTracker('),source.indexOf('function chooseTrackerMode('));
 assert(/createMotionTrackerNull\(comp, layer\)/.test(motionBody));
 assert(/app\.executeCommand\(2568\)/.test(motionBody));
});
test('Motion Tracker accepts pre-composition layers',()=>{
 const motionBody=source.slice(source.indexOf('function applyMotionTracker('),source.indexOf('function chooseTrackerMode('));
 assert(/layer\.source instanceof CompItem/.test(motionBody));
 assert(/!isPrecomp && !isTrackableFootage/.test(motionBody));
 assert(/movie, image-sequence, or pre-composition layer/.test(motionBody));
});
test('Versioning saves the next project file and keeps it open',()=>{
 assert(/function saveNextProjectVersion\(\)/.test(source));
 assert(/app\.project\.saveWithDialog\(\)/.test(source));
 assert(/if \(!saved \|\| !app\.project\.file\) return null/.test(source));
 assert(/app\.project\.save\(nextFile\)/.test(source));
 assert(/app\.project\.file\.fsName !== nextFile\.fsName/.test(source));
 assert(!/Save the After Effects project once before creating a numbered version/.test(source));
});
test('Every visible tool button has a concise hover description',()=>{
 for(const name of ['versioningButton','captureButton','saveButton','reloadButton','proxyButton','trackerButton'])
  assert(new RegExp(name+'\\.helpTip =? ?"[^"\\n]+"').test(source),name+' tooltip');
 assert(/camera\.helpTip=/.test(source));
 assert(/motion\.helpTip=/.test(source));
 assert(/cancel\.helpTip=/.test(source));
 assert(/play\.helpTip=/.test(source));
 assert(/work\.helpTip=/.test(source));
});
test('Stamp 3D does not reject projected corners outside the composition',()=>{
 assert(!/Keep all plane corners inside/.test(source));
 assert(!/completely outside the composition frame/.test(source));
 assert(/The plane is edge-on or too small/.test(source));
});
console.log(tests+' checks passed. AE rendering/UI and color round-trip still require host testing.');
