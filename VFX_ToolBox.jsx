/*
 * VFX ToolBox — 0.9.10 beta (2026-10-13)
 * Custom modernization of the workflow in AE-3DPlaneStamp v1.7.
 * Original concept/script credits: Nate Lovell / NT Productions and Hashi.
 * Independent custom edition; not the authors' official Version 2.
 * No new license is asserted for the original work.
 * ExtendScript / ScriptUI. Plate export is flattened PSD at the project bit depth.
 */
(function (host) {
    var TITLE = "VFX ToolBox", VERSION = "0.9.10 beta";
    var panel, versioningButton, trackerButton, proxyButton, captureButton, saveButton, reloadButton, activeButton;
    var busy = false, trackerMenuOpen = false;

    function fail(message) { throw new Error(message); }
    function message(text) {
        if (activeButton) activeButton.text = text;
        if (panel instanceof Window) panel.update();
    }
    function safeName(text) {
        var name = text.replace(/[\x00-\x1f<>:"\/\\|?*]/g, "_").replace(/[. ]+$/g, "");
        return (name || "Plane").substr(0, 80);
    }
    function outputFolder() {
        var base = app.project.file ? app.project.file.parent : Folder.myDocuments;
        return new Folder(base.fsName + "/VFX ToolBox Textures");
    }
    function platesFolder() {
        if (!app.project.file)
            fail("Save the After Effects project first so VFX ToolBox can create the Plates folder beside it.");
        return new Folder(app.project.file.parent.fsName + "/Plates");
    }
    function proxiesFolder(item) {
        if (item instanceof CompItem) {
            if (!app.project.file)
                fail("Save the After Effects project first so VFX ToolBox can store the composition proxy beside it.");
            return new Folder(app.project.file.parent.fsName + "/Proxys");
        }
        var sourceFile = item && item.mainSource ? item.mainSource.file : null;
        if (!sourceFile) fail("The selected footage does not have an accessible source file.");
        return new Folder(sourceFile.parent.fsName + "/Proxys");
    }
    function uniqueFile(folder, name, extension) {
        extension = extension || "png";
        var base = safeName(name) + "_" + new Date().getTime(), i = 0, file;
        do { file = new File(folder.fsName + "/" + base + (i ? "_" + i : "") + "." + extension); i++; }
        while (file.exists);
        return file;
    }
    function nextPlateFile(folder, extension) {
        var files = folder.getFiles(), highest = 0;
        for (var i = 0; i < files.length; i++) {
            if (!(files[i] instanceof File)) continue;
            var match = /^Plate_(\d+)\.(?:png|psd|tif|tiff)$/i.exec(files[i].name);
            if (match) highest = Math.max(highest, parseInt(match[1], 10));
        }
        extension = extension || "png";
        var number = highest + 1, padded = number < 10 ? "0" + number : String(number);
        var file = new File(folder.fsName + "/Plate_" + padded + "." + extension);
        // Re-scan if the folder changed between enumeration and selection.
        while (file.exists) {
            number++;
            padded = number < 10 ? "0" + number : String(number);
            file = new File(folder.fsName + "/Plate_" + padded + "." + extension);
        }
        return file;
    }
    function nextProxyFile(folder, itemName) {
        var stem = safeName(String(itemName).replace(/\.[^.]+$/, "")) + "_Proxy";
        var escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), highest = 0;
        var pattern = new RegExp("^" + escaped + "_(\\d+)\\.mp4$", "i");
        var files = folder.getFiles();
        for (var i = 0; i < files.length; i++) {
            if (!(files[i] instanceof File)) continue;
            var match = pattern.exec(files[i].name);
            if (match) highest = Math.max(highest, parseInt(match[1], 10));
        }
        var number = highest + 1, padded = number < 10 ? "0" + number : String(number);
        var file = new File(folder.fsName + "/" + stem + "_" + padded + ".mp4");
        while (file.exists) {
            number++;
            padded = number < 10 ? "0" + number : String(number);
            file = new File(folder.fsName + "/" + stem + "_" + padded + ".mp4");
        }
        return file;
    }
    function nextVersionFile(folder, projectName) {
        var extensionMatch = /\.(aepx?)$/i.exec(projectName);
        var extension = extensionMatch ? extensionMatch[1].toLowerCase() : "aep";
        var stem = projectName.replace(/\.aepx?$/i, "").replace(/_V\d+$/i, "");
        var escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), highest = 0;
        var pattern = new RegExp("^" + escapedStem + "_V(\\d+)\\." + extension + "$", "i");
        var files = folder.getFiles();
        for (var i = 0; i < files.length; i++) {
            if (!(files[i] instanceof File)) continue;
            var match = pattern.exec(files[i].name);
            if (match) highest = Math.max(highest, parseInt(match[1], 10));
        }
        var number = highest + 1, padded = number < 10 ? "0" + number : String(number);
        var file = new File(folder.fsName + "/" + stem + "_V" + padded + "." + extension);
        while (file.exists) {
            number++;
            padded = number < 10 ? "0" + number : String(number);
            file = new File(folder.fsName + "/" + stem + "_V" + padded + "." + extension);
        }
        return file;
    }
    function saveNextProjectVersion() {
        if (!app.project.file) {
            var saved = app.project.saveWithDialog();
            if (!saved || !app.project.file) return null;
            return app.project.file;
        }
        var nextFile = nextVersionFile(app.project.file.parent, app.project.file.name);
        app.project.save(nextFile);
        if (!app.project.file || app.project.file.fsName !== nextFile.fsName)
            fail("After Effects did not switch to the newly saved project version.");
        return nextFile;
    }
    function validate(comp) {
        if (!(comp instanceof CompItem)) fail("Open a composition and select a 3D plane.");
        if (comp.selectedLayers.length !== 1) fail("Select exactly one 3D plane.");
        var layer = comp.selectedLayers[0];
        if (!(layer instanceof AVLayer) || !layer.threeDLayer || layer.nullLayer)
            fail("Select a visual 3D layer. Cameras, lights and nulls are not planes.");
        if (layer.locked) fail("Unlock the plane before capturing.");
        if (layer.adjustmentLayer) fail("An adjustment layer cannot be used as a plane.");
        if (layer.collapseTransformation) fail("Disable Collapse Transformations / Continuously Rasterize on this plane.");
        if (comp.time < layer.inPoint || comp.time >= layer.outPoint)
            fail("Move the playhead inside the plane layer's duration.");
        if (comp.resolutionFactor[0] !== 1 || comp.resolutionFactor[1] !== 1)
            fail("Set the composition resolution to Full before capturing.");
        if (Math.abs(comp.pixelAspect - 1) > 0.0001 || (layer.source && Math.abs(layer.source.pixelAspect - 1) > 0.0001))
            fail("This edition requires square pixels in the composition and plane source.");
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).solo) fail("Turn off Solo on all layers before capturing.");
        }
        var rect = layer.sourceRectAtTime(comp.time, false);
        if (!(rect.width > 0 && rect.height > 0)) fail("The plane must have a nonzero width and height.");
        var anchor = layer.property("ADBE Transform Group").property("ADBE Anchor Point").value;
        if (Math.abs(anchor[2]) > 0.0001) fail("Set the plane's anchor point Z coordinate to zero.");
        if (app.project.renderQueue.rendering) fail("Wait for the current render to finish.");
        var space = app.project.workingSpace;
        if (!space) fail("Set an ICC working color space in Project Settings before capturing. It is required to verify the texture profile.");
        if (String(app.project.colorManagementSystem).toLowerCase().indexOf("ocio") >= 0 ||
            String(app.project.colorManagementSystem).toLowerCase().indexOf("opencolorio") >= 0)
            fail("Color validation in this edition requires Adobe Color Managed / ICC. OCIO and ACES workflows are not yet supported.");
        if (app.project.bitsPerChannel === 32)
            fail("PNG does not support 32-bit floating-point channels. Switch the project to 16 bpc for PNG capture, or use a float-capable format such as OpenEXR.");
        return {comp: comp, layer: layer, rect: rect, time: comp.time,
            depth: app.project.bitsPerChannel, space: space};
    }
    function validateFrame(comp) {
        if (!(comp instanceof CompItem)) fail("Open a composition before saving a frame.");
        if (app.project.renderQueue.rendering) fail("Wait for the current render to finish.");
        if (Math.abs(comp.pixelAspect - 1) > 0.0001)
            fail("Save Frame currently requires a square-pixel composition.");
        var space = app.project.workingSpace;
        if (!space) fail("Set an ICC working color space in Project Settings before saving a frame.");
        if (String(app.project.colorManagementSystem).toLowerCase().indexOf("ocio") >= 0 ||
            String(app.project.colorManagementSystem).toLowerCase().indexOf("opencolorio") >= 0)
            fail("Color validation in this edition requires Adobe Color Managed / ICC. OCIO and ACES workflows are not yet supported.");
        return {comp: comp, time: comp.time, depth: app.project.bitsPerChannel, space: space};
    }
    function removeSafely(item, warnings) {
        if (!item) return;
        try { item.remove(); } catch (e) { warnings.push("Could not remove a temporary item: " + e.toString()); }
    }
    function waitForImport(file, milliseconds) {
        var start = new Date().getTime(), lastError = "file is not available yet";
        do {
            var fresh = new File(file.fsName);
            if (fresh.exists && fresh.length > 0) {
                try {
                    var options=new ImportOptions(fresh);
                    if(options.canImportAs(ImportAsType.FOOTAGE)) options.importAs=ImportAsType.FOOTAGE;
                    return app.project.importFile(options);
                }
                catch (e) { lastError = e.toString(); }
            }
            $.sleep(200);
        } while (new Date().getTime() - start < milliseconds);
        fail("Could not import the rendered frame. " + lastError);
    }
    function projectPlatesFolder() {
        var root = app.project.rootFolder;
        for (var i = 1; i <= root.numItems; i++) {
            var item = root.item(i);
            if (item instanceof FolderItem && item.name === "Plates") return item;
        }
        return app.project.items.addFolder("Plates");
    }
    function projectAssetsFolder() {
        var root = app.project.rootFolder;
        for (var i = 1; i <= root.numItems; i++) {
            var item = root.item(i);
            if (item instanceof FolderItem && item.name === "Assets") return item;
        }
        return app.project.items.addFolder("Assets");
    }
    function nextTrackerName(comp) {
        var highest = 0;
        for (var i = 1; i <= comp.numLayers; i++) {
            var match = /^TRACKER_(\d+)$/i.exec(comp.layer(i).name);
            if (match) highest = Math.max(highest, parseInt(match[1], 10));
        }
        var number = highest + 1;
        return "TRACKER_" + (number < 10 ? "0" + number : String(number));
    }
    function createMotionTrackerNull(comp, footageLayer) {
        var name = nextTrackerName(comp), nullLayer = comp.layers.addNull(comp.duration);
        nullLayer.name = name;
        nullLayer.startTime = comp.displayStartTime;
        nullLayer.inPoint = comp.displayStartTime;
        nullLayer.outPoint = comp.displayStartTime + comp.duration;
        nullLayer.comment = TITLE + " " + VERSION + " | Motion Tracker target";
        if (nullLayer.source) {
            nullLayer.source.name = name;
            nullLayer.source.parentFolder = projectAssetsFolder();
        }
        // Track Motion must still receive the original footage as the selected layer.
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        footageLayer.selected = true;
        return nullLayer;
    }
    // PNG parsing checks the real output bit depth, dimensions and embedded ICC chunk.
    function uint16(s, i) { return (s.charCodeAt(i)&255)*256 + (s.charCodeAt(i+1)&255); }
    function uint32(s, i) { return uint16(s,i)*65536 + uint16(s,i+2); }
    function verifyPNG(file, context, requireICC) {
        if(typeof requireICC==="undefined") requireICC=true;
        file.encoding="BINARY";
        if (!file.open("r")) fail("Could not read the exported PNG.");
        function read(n) { var s=file.read(n); if(s.length!==n) fail("Incomplete PNG file."); return s; }
        try {
            if(read(8)!=="\x89PNG\r\n\x1a\n") fail("The output is not a valid PNG.");
            var sawIHDR=false, sawICC=false, sawEnd=false, width=0, height=0, bits=0, colorType=0;
            while(file.tell()<file.length) {
                var chunkOffset=file.tell(), size=uint32(read(4),0), type=read(4), data="";
                var remaining=file.length-file.tell();
                if(size>0x7fffffff || size+4>remaining)
                    fail("Invalid PNG chunk "+type+" at byte "+chunkOffset+": declared "+size+" data bytes, "+remaining+" bytes remain.");
                if(type==="IHDR") {
                    if(size!==13) fail("Invalid PNG header.");
                    data=read(size);
                    width=uint32(data,0); height=uint32(data,4);
                    bits=data.charCodeAt(8)&255; colorType=data.charCodeAt(9)&255;
                    sawIHDR=true;
                } else {
                    if(type==="iCCP") sawICC=true;
                    if(!file.seek(file.tell()+size,0)) fail("Could not skip PNG chunk "+type+".");
                }
                read(4); // CRC is checked by AE/Photoshop on import.
                if(type==="IEND") { sawEnd=true; break; }
            }
            if(!sawIHDR) fail("The PNG has no IHDR chunk.");
            if(!sawEnd) fail("The PNG is incomplete: no IEND chunk was found.");
            if(bits!==context.depth) fail("Bit depth mismatch: PNG is "+bits+" bpc; project is "+context.depth+" bpc.");
            if(width!==context.comp.width || height!==context.comp.height) fail("The output changed the frame dimensions.");
            if(colorType!==2 && colorType!==6) fail("The PNG must use RGB or RGBA color type.");
            if(!sawICC && requireICC) fail("The PNG has no embedded ICC profile. Enable Embed Profile in the PNG output template.");
            return {embeddedICC:sawICC};
        } finally { file.close(); }
    }
    // PSD parsing checks the flattened file header and scans image resources for ICC metadata.
    function verifyPSD(file, context) {
        file.encoding="BINARY";
        if(!file.open("r")) fail("Could not read the exported PSD.");
        function at(offset,count) {
            if(offset<0 || count<0 || offset+count>file.length) fail("Invalid PSD offset.");
            if(!file.seek(offset,0)) fail("Could not seek in the PSD file.");
            var value=file.read(count); if(value.length!==count) fail("Incomplete PSD file."); return value;
        }
        try {
            var header=at(0,26);
            if(header.substr(0,4)!=="8BPS" || uint16(header,4)!==1) fail("The output is not a valid standard PSD.");
            var channels=uint16(header,12),height=uint32(header,14),width=uint32(header,18);
            var depth=uint16(header,22),mode=uint16(header,24);
            if(width!==context.comp.width || height!==context.comp.height) fail("The PSD changed the frame dimensions.");
            if(depth!==context.depth) fail("Bit depth mismatch: PSD is "+depth+" bpc; project is "+context.depth+" bpc.");
            if(mode!==3 || channels<3) fail("The PSD must contain RGB or RGBA channels.");
            var colorLength=uint32(at(26,4),0), resourcesLengthOffset=30+colorLength;
            if(resourcesLengthOffset+4>file.length) fail("Invalid PSD color-mode data.");
            var resourcesLength=uint32(at(resourcesLengthOffset,4),0);
            var offset=resourcesLengthOffset+4,end=offset+resourcesLength,sawICC=false;
            if(end>file.length) fail("Invalid PSD image resources.");
            while(offset+12<=end) {
                var signature=at(offset,4); if(signature!=="8BIM" && signature!=="MeSa") break;
                var id=uint16(at(offset+4,2),0),nameLength=at(offset+6,1).charCodeAt(0)&255;
                var nameField=1+nameLength; if(nameField%2) nameField++;
                var sizeOffset=offset+6+nameField;
                if(sizeOffset+4>end) fail("Invalid PSD image resource header.");
                var dataLength=uint32(at(sizeOffset,4),0),dataOffset=sizeOffset+4;
                if(dataOffset+dataLength>end) fail("Invalid PSD image resource data.");
                if(id===1039 && dataLength>0) sawICC=true;
                offset=dataOffset+dataLength+(dataLength%2);
            }
            return {embeddedICC:sawICC};
        } finally { file.close(); }
    }
    function outputDepth(value) {
        var text=String(value).toLowerCase();
        if (/floating|32/.test(text)) return 32;
        if (/trillion|16/.test(text)) return 16;
        if (/million|8/.test(text)) return 8;
        return 0;
    }
    function selectPNGOutput(item, context) {
        var initial=item.outputModule(1), templates=initial.templates, ordered=[], seen={};
        var i, name, om, format, depth, settings, available=[], failures=[], inspected=[];
        var requested=context.depth || app.project.bitsPerChannel;
        // Prefer native depth-specific PNG presets, then inspect every available preset.
        function add(n) { if(!seen["$"+n]) { seen["$"+n]=true; ordered.push(n); } }
        for(i=0;i<templates.length;i++) if(/x-factor\s*16/i.test(templates[i]) && requested===16) add(templates[i]);
        for(i=0;i<templates.length;i++) if(/x-factor\s*8/i.test(templates[i]) && requested===8) add(templates[i]);
        for(i=0;i<templates.length;i++) if(/png/i.test(templates[i])) add(templates[i]);
        for(i=0;i<templates.length;i++) add(templates[i]);
        for(i=0;i<ordered.length;i++) {
            name=ordered[i];
            try {
                item.outputModule(1).applyTemplate(name);
                om=item.outputModule(1);
                settings=om.getSettings(GetSettingsFormat.STRING);
                format=settings["Format"];
                inspected.push(name+": format="+String(format)+", depth="+String(settings["Depth"]));
                if(!/png/i.test(String(format))) continue;
                // Some hosts expose Depth as writable; others require a native saved template.
                // Only set keys the running host explicitly reports as settable.
                if(typeof GetSettingsFormat!=="undefined") {
                    var writable=om.getSettings(GetSettingsFormat.STRING_SETTABLE);
                    if(writable && typeof writable.Depth!=="undefined") {
                        var alpha=/alpha/i.test(String(settings["Channels"]));
                        var label=requested===32?"Floating Point":requested===16?"Trillions of Colors":"Millions of Colors";
                        try { om.setSetting("Depth",label+(alpha?"+":"")); } catch(depthSettingError) {}
                        om=item.outputModule(1);
                    }
                }
                settings=om.getSettings(GetSettingsFormat.STRING);
                depth=outputDepth(settings["Depth"]);
                available.push(name+" ("+(depth?depth+"-bit":"unknown depth")+")");
                if(depth!==requested) continue;
                return om;
            } catch(templateError) { failures.push(name+": "+(templateError.message || templateError.toString())); }
        }
        fail("No compatible "+requested+"-bit PNG output template was found.\n"+
            (available.length?"PNG templates: "+available.join(", "):"No usable PNG template was detected.")+"\n\n"+
            "In Edit > Templates > Output Module, save a PNG Sequence template at "+requested+" bits with the project ICC profile embedded. Any template name is accepted.\n"+
            "The script will not lower the bit depth."+
            (failures.length?"\n\nFirst template error: "+failures[0]:"")+
            "\n\nOutput diagnostics:\n"+inspected.join("\n"));
    }
    function selectPhotoshop32Output(item, context) {
        var initial=item.outputModule(1), templates=initial.templates, ordered=[], seen={};
        var i,name,om,settings,format,depth,inspected=[];
        function add(n) { if(!seen["$"+n]) { seen["$"+n]=true; ordered.push(n); } }
        for(i=0;i<templates.length;i++) if(/x-factor\s*32/i.test(templates[i])) add(templates[i]);
        for(i=0;i<templates.length;i++) if(/photoshop/i.test(templates[i])) add(templates[i]);
        for(i=0;i<templates.length;i++) add(templates[i]);
        for(i=0;i<ordered.length;i++) {
            name=ordered[i];
            try {
                item.outputModule(1).applyTemplate(name); om=item.outputModule(1);
                settings=om.getSettings(GetSettingsFormat.STRING);
                format=settings["Format"]; depth=outputDepth(settings["Depth"]);
                inspected.push(name+": format="+String(format)+", depth="+String(settings["Depth"]));
                if(/photoshop/i.test(String(format)) && depth===32) return om;
            } catch(templateError) {}
        }
        fail("No compatible 32-bit floating-point Photoshop output template was found.\n\nOutput diagnostics:\n"+inspected.join("\n"));
    }
    function selectQuickTimeIntermediate(item) {
        var initial=item.outputModule(1), templates=initial.templates, ordered=[], seen={}, inspected=[];
        var i,name,om,settings,format;
        function add(n) { if(!seen["$"+n]) { seen["$"+n]=true; ordered.push(n); } }
        for(i=0;i<templates.length;i++) if(/lossless/i.test(templates[i])) add(templates[i]);
        for(i=0;i<templates.length;i++) if(/high quality/i.test(templates[i])) add(templates[i]);
        for(i=0;i<templates.length;i++) add(templates[i]);
        for(i=0;i<ordered.length;i++) {
            name=ordered[i];
            try {
                item.outputModule(1).applyTemplate(name); om=item.outputModule(1);
                settings=om.getSettings(GetSettingsFormat.STRING); format=settings["Format"];
                inspected.push(name+": format="+String(format));
                if(/quicktime/i.test(String(format)) && !/h\.26[45]/i.test(name)) return om;
            } catch(templateError) {}
        }
        fail("No compatible QuickTime intermediate output template was found.\n\nOutput diagnostics:\n"+inspected.join("\n"));
    }
    function renderCompIntermediate(comp, file) {
        var queue=app.project.renderQueue, item=null, previous=[], cleanup=[], primary=null;
        try {
            for(var i=1;i<=queue.numItems;i++) {
                var existing=queue.item(i);
                if(existing.status === RQItemStatus.QUEUED && existing.render) {
                    existing.render=false; previous.push(existing);
                }
            }
            item=queue.items.add(comp);
            item.setSettings({"Quality":"Best", "Resolution":"Full", "Effects":"Current Settings", "Proxy Use":"Use No Proxies", "Color Depth":"Current Settings", "Motion Blur":"Current Settings", "Frame Blending":"Current Settings", "Field Render":"Off"});
            item.timeSpanDuration=comp.duration;
            item.timeSpanStart=comp.displayStartTime;
            var om=selectQuickTimeIntermediate(item);
            om.file=file;
            om.postRenderAction=PostRenderAction.NONE;
            item.render=true;
            queue.render();
            if(item.status!==RQItemStatus.DONE) fail("Composition proxy intermediate rendering was canceled or failed.");
            if(!file.exists || file.length<=0) fail("After Effects did not create the composition proxy intermediate.");
        } catch(e) { primary=e; }
        finally {
            removeSafely(item,cleanup);
            for(var j=0;j<previous.length;j++) {
                try {
                    if(previous[j].status === RQItemStatus.UNQUEUED) previous[j].render=true;
                    else if(previous[j].status !== RQItemStatus.QUEUED)
                        cleanup.push("A previous queue item changed status. Review its render checkbox manually.");
                } catch(e2) { cleanup.push("Could not restore a previous render checkbox: " + e2.message); }
            }
        }
        if(primary) fail((primary.message || primary.toString())+(cleanup.length ? "\n"+cleanup.join("\n") : ""));
        if(cleanup.length) fail(cleanup.join("\n"));
    }
    function renderQueued(context, file, selector, label) {
        var queue=app.project.renderQueue, item=null, previous=[], cleanup=[], primary=null;
        try {
            // Isolate this render while preserving every existing queue checkbox.
            for(var i=1;i<=queue.numItems;i++) {
                var existing=queue.item(i);
                // Completed/stopped items may report render=true, but AE forbids writing it.
                if(existing.status === RQItemStatus.QUEUED && existing.render) {
                    existing.render=false;
                    // Record only successful changes so failed writes are never retried in cleanup.
                    previous.push(existing);
                }
            }
            item=queue.items.add(context.comp);
            item.setSettings({"Quality":"Best", "Resolution":"Full", "Effects":"Current Settings", "Proxy Use":"Use No Proxies", "Color Depth":"Current Settings", "Motion Blur":"Current Settings", "Frame Blending":"Current Settings", "Field Render":"Off"});
            // Comp time is relative; the render queue uses the displayed timeline origin.
            // Set the one-frame duration first to avoid a transient full-length interval.
            item.timeSpanDuration=context.comp.frameDuration;
            item.timeSpanStart=context.comp.displayStartTime + context.time;
            var om = selector(item, context);
            om.file=file;
            om.postRenderAction=PostRenderAction.NONE;
            item.render=true;
            queue.render();
            if(item.status!==RQItemStatus.DONE) fail("Rendering was canceled or failed.");
            if(!file.exists) {
                // Sequence exporters may append host-specific frame tokens, for example
                // _00001, [00001] or _[00001], even when only one frame is rendered.
                // The requested stem contains a unique timestamp, so accepting any suffix
                // after that complete stem cannot select an older VFX ToolBox render.
                var extension=file.name.match(/\.([^.]+)$/), suffix=extension?extension[1]:"";
                var prefix=file.name.replace(/\.[^.]+$/,""), escapedPrefix=prefix.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
                var escapedSuffix=suffix.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
                var sequenceName=new RegExp("^"+escapedPrefix+".*\\."+escapedSuffix+"$","i");
                var matches=file.parent.getFiles(function(f) {
                    return f instanceof File && sequenceName.test(f.name);
                });
                if(matches.length!==1)
                    fail("Could not locate the rendered "+label+". Found "+matches.length+" matching files in the output folder.");
                if(!matches[0].rename(file.name))
                    fail("The rendered "+label+" was found as "+matches[0].name+", but it could not be renamed.");
                file=new File(file.fsName);
                if(!file.exists) fail("The rendered "+label+" could not be reopened after renaming.");
            }
        } catch(e) { primary=e; }
        finally {
            removeSafely(item,cleanup);
            for(var j=0;j<previous.length;j++) {
                try {
                    if (previous[j].status === RQItemStatus.UNQUEUED) previous[j].render=true;
                    else if (previous[j].status !== RQItemStatus.QUEUED)
                        cleanup.push("A previous queue item changed status. Review its render checkbox manually.");
                } catch(e2) { cleanup.push("Could not restore a previous render checkbox: " + e2.message); }
            }
        }
        if(primary) fail((primary.message || primary.toString())+(cleanup.length ? "\n"+cleanup.join("\n") : ""));
        if(cleanup.length) fail(cleanup.join("\n"));
    }
    function renderPNG(context, file) { renderQueued(context,file,selectPNGOutput,"PNG"); }
    function renderPhotoshop32(context, file) { renderQueued(context,file,selectPhotoshop32Output,"Photoshop file"); }
    function savePNGDirect(context, file) {
        var comp = context.comp, previousResolution = comp.resolutionFactor;
        if (typeof comp.saveFrameToPng !== "function")
            fail("This After Effects version does not provide direct PNG frame saving.");
        try {
            // Direct composition export bypasses the Render Queue. Force full resolution only
            // for the call, then restore the viewer's previous resolution immediately.
            comp.resolutionFactor = [1, 1];
            comp.saveFrameToPng(context.time, file);
        } finally {
            comp.resolutionFactor = previousResolution;
        }
        var start = new Date().getTime(), complete = false;
        while(new Date().getTime() - start < 15000) {
            var fresh=new File(file.fsName);
            if(fresh.exists && fresh.length>=12) {
                fresh.encoding="BINARY";
                if(fresh.open("r")) {
                    if(fresh.seek(fresh.length-12,0)) complete=fresh.read(8)==="\x00\x00\x00\x00IEND";
                    fresh.close();
                }
                if(complete) break;
            }
            $.sleep(100);
        }
        if(!complete) fail("After Effects did not finish writing the PNG within 15 seconds.");
    }
    function shellQuote(value) { return "'"+String(value).replace(/'/g,"'\\''")+"'"; }
    function findExecutable(name) {
        if (String($.os).toLowerCase().indexOf("mac") < 0)
            fail("Generate Proxy currently requires macOS and FFmpeg.");
        var paths = ["/opt/homebrew/bin/" + name, "/usr/local/bin/" + name, "/usr/bin/" + name];
        for (var i = 0; i < paths.length; i++) {
            var candidate = new File(paths[i]);
            if (candidate.exists) return candidate;
        }
        if (typeof system !== "undefined" && typeof system.callSystem === "function") {
            var located = String(system.callSystem("/bin/zsh -lc " + shellQuote("command -v " + name))).replace(/^\s+|\s+$/g, "");
            if (located.indexOf("\n") >= 0) located = located.split(/\r?\n/)[0];
            var discovered = new File(located);
            if (located && discovered.exists) return discovered;
        }
        fail("FFmpeg is required to generate an H.265 proxy. Install ffmpeg and try again.");
    }
    function runProxyEncoder(ffmpeg, encoder, sourceFile, proxyFile) {
        var command = shellQuote(ffmpeg.fsName) + " -hide_banner -loglevel error -y -i " + shellQuote(sourceFile.fsName) +
            " -map 0:v:0 -map '0:a?' -sn -dn -map_metadata 0 -c:v " + encoder +
            " -b:v 10M -maxrate 10M -bufsize 20M -pix_fmt yuv420p -tag:v hvc1" +
            " -c:a aac -b:a 192k -movflags +faststart " + shellQuote(proxyFile.fsName) +
            " 2>&1; printf '\\n__PLANETRACE_EXIT:%s' $?";
        var output = String(system.callSystem(command));
        var status = /__PLANETRACE_EXIT:(\d+)\s*$/.exec(output);
        return {ok: status && parseInt(status[1], 10) === 0, output: output.replace(/__PLANETRACE_EXIT:\d+\s*$/, "")};
    }
    function verifyProxyDimensions(ffprobe, proxyFile, item) {
        var command = shellQuote(ffprobe.fsName) + " -v error -select_streams v:0" +
            " -show_entries stream=codec_name,width,height -of csv=s=,:p=0 " + shellQuote(proxyFile.fsName) + " 2>&1";
        var output = String(system.callSystem(command));
        var match = /hevc,(\d+),(\d+)/i.exec(output);
        if (!match) fail("The generated proxy is not a readable H.265 / HEVC video.");
        var width = parseInt(match[1], 10), height = parseInt(match[2], 10);
        if (width !== item.width || height !== item.height)
            fail("Proxy resolution mismatch: generated " + width + "x" + height +
                "; source is " + item.width + "x" + item.height + ".");
    }
    function generateProxy(item, folder) {
        var isComp=item instanceof CompItem, sourceFile=null, intermediate=null;
        var ffmpeg = findExecutable("ffmpeg"), ffprobe = findExecutable("ffprobe");
        var proxyFile = nextProxyFile(folder, item.name), encoded = null;
        try {
            if(isComp) {
                if(!(item.duration>0)) fail("The selected composition has no renderable duration.");
                intermediate=uniqueFile(folder,"VFX_ToolBox_PROXY_TEMP_"+item.name,"mov");
                message("Rendering Comp…");
                renderCompIntermediate(item,intermediate);
                sourceFile=intermediate;
            } else {
                sourceFile=item.mainSource.file;
                if (!sourceFile || !sourceFile.exists) fail("The selected source file is missing or offline.");
                if (item.mainSource.isStill) fail("Select a movie file. Still images do not need an H.265 movie proxy.");
                if (!/\.(?:mp4|mov|m4v|mxf|avi|wmv|mpg|mpeg|m2v|mts|m2ts|webm|mkv|flv|f4v|3gp|3g2|ts|vob|ogv|crm|ari|arx|braw|r3d)$/i.test(sourceFile.name))
                    fail("Select a supported movie file. Image sequences are not converted by Generate Proxy.");
            }
            if (!item.hasVideo) fail("The selected item has no video stream.");
            message("Generating Proxy…");
            encoded = runProxyEncoder(ffmpeg, "hevc_videotoolbox", sourceFile, proxyFile);
            if (!encoded.ok) {
                if (proxyFile.exists) proxyFile.remove();
                encoded = runProxyEncoder(ffmpeg, "libx265", sourceFile, proxyFile);
            }
            if (!encoded.ok || !proxyFile.exists || proxyFile.length <= 0)
                fail("FFmpeg could not generate the H.265 proxy. " + (encoded ? encoded.output : ""));
            verifyProxyDimensions(ffprobe, proxyFile, item);
            item.setProxy(proxyFile);
            item.useProxy = true;
            return proxyFile;
        } catch (error) {
            if (proxyFile.exists) proxyFile.remove();
            throw error;
        } finally {
            if(intermediate && intermediate.exists && !intermediate.remove())
                alert("The temporary composition intermediate could not be removed:\n"+intermediate.fsName, TITLE);
        }
    }
    function convertPNGToPSD(pngFile, psdFile) {
        if(String($.os).toLowerCase().indexOf("mac")<0)
            fail("Headless PNG-to-PSD conversion currently requires macOS.");
        if(typeof system==="undefined" || typeof system.callSystem!=="function")
            fail("After Effects does not provide command-line conversion access.");
        var command="/usr/bin/sips -s format com.adobe.photoshop-image "+shellQuote(pngFile.fsName)+
            " --out "+shellQuote(psdFile.fsName)+" 2>&1; printf '\\n__PLANETRACE_EXIT:%s' $?";
        var output=String(system.callSystem(command)),status=/__PLANETRACE_EXIT:(\d+)\s*$/.exec(output);
        if(!status || parseInt(status[1],10)!==0)
            fail("The macOS PSD converter failed. "+output.replace(/__PLANETRACE_EXIT:\d+\s*$/,""));
        var fresh=new File(psdFile.fsName);
        if(!fresh.exists || fresh.length<=0) fail("The macOS converter reported success but did not create the PSD.");
    }
    function capture(context, folder) {
        var comp = context.comp, layer = context.layer, rect = context.rect;
        var oldEnabled = layer.enabled;
        var stamper = null, solidSource = null, footage = null, result = null;
        var file = null, temporaryPNG = null, success = false, warnings = [], error = null, group = false;
        try {
            app.beginUndoGroup(TITLE); group = true;
            file = uniqueFile(folder, layer.name, "psd");
            temporaryPNG = uniqueFile(folder, "VFX_ToolBox_TEMP_" + layer.name, "png");
            message("Preparing projection…");
            stamper = comp.layers.addSolid([1, 1, 1], "__VFX_ToolBox_Temporary", comp.width, comp.height, 1, comp.duration);
            solidSource = stamper.source;
            stamper.adjustmentLayer = true;
            // Adding an indexed property invalidates earlier effect references; reacquire it afterwards.
            var effects = stamper.property("ADBE Effect Parade");
            effects.addProperty("ADBE Layer Control");
            effects.property(1).name = "Stamp Target";
            effects.property(1).property(1).setValue(layer.index);
            effects.addProperty("CC Power Pin");
            var pin = effects.property(2);
            var x = rect.left, y = rect.top, w = rect.width, h = rect.height;
            var corners = [[x,y],[x+w,y],[x,y+h],[x+w,y+h]], projected = [];
            for (var c = 0; c < 4; c++) {
                pin.property(c + 1).expression = 'var p=effect("Stamp Target")(1).toComp([' + corners[c][0] + ',' + corners[c][1] + ',0]); [p[0],p[1]];';
                projected[c] = pin.property(c + 1).valueAtTime(context.time, false);
                if (pin.property(c + 1).expressionError) fail(pin.property(c + 1).expressionError);
                if (!isFinite(projected[c][0]) || !isFinite(projected[c][1])) fail("Could not project the plane corners.");
            }
            var order = [0,1,3,2], area = 0;
            for (c = 0; c < 4; c++) {
                var a = projected[order[c]], b = projected[order[(c+1)%4]];
                area += a[0]*b[1] - b[0]*a[1];
            }
            if (Math.abs(area) < 2) fail("The plane is edge-on or too small in this frame.");
            pin.property(6).setValue(true); // CC Power Pin: Unstretch, as used by the original workflow.
            layer.enabled = false;
            message("Capturing frame…");
            // Match the original 3D Plane Stamp workflow: capture directly from the
            // composition without creating or rendering a Render Queue item.
            savePNGDirect(context, temporaryPNG);
            verifyPNG(temporaryPNG, context, false);
            message("Converting to PSD…");
            convertPNGToPSD(temporaryPNG, file);
            var psdInfo=verifyPSD(file,context);
            message("Importing texture…");
            footage = waitForImport(file, 15000);
            result = comp.layers.add(footage);
            result.name = layer.name + " · VFX ToolBox";
            result.threeDLayer = true;
            result.setParentWithJump(layer);
            var transform = result.property("ADBE Transform Group");
            // Parent-local coordinates map the flattened PSD (0,0) onto the source rectangle's (left,top).
            transform.property("ADBE Anchor Point").setValue([0,0,0]);
            transform.property("ADBE Position").setValue([rect.left, rect.top, 0]);
            transform.property("ADBE Scale").setValue([100*rect.width/footage.width,100*rect.height/footage.height,100]);
            transform.property("ADBE Orientation").setValue([0,0,0]);
            transform.property("ADBE Rotate X").setValue(0);
            transform.property("ADBE Rotate Y").setValue(0);
            transform.property("ADBE Rotate Z").setValue(0);
            result.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
            result.property("ADBE Material Options Group").property("ADBE Accepts Lights").setValue(false);
            result.inPoint = layer.inPoint;
            result.outPoint = layer.outPoint;
            result.label = layer.label;
            result.moveBefore(layer);
            result.comment = TITLE + " " + VERSION + " | Static frame: " + context.time + "s | Parent: " + layer.name +
                ((!psdInfo.embeddedICC) ? " | Untagged PSD; project working space: " + context.space : "");
            // Native parenting keeps transform animation, expressions and the existing parent chain.
            layer.selected = false;
            result.selected = true;
            success = true;
        } catch (e) { error = e; }
        finally {
            if (!success) { removeSafely(result, warnings); removeSafely(footage, warnings); }
            removeSafely(stamper, warnings);
            removeSafely(solidSource, warnings);
            if (temporaryPNG && temporaryPNG.exists && !temporaryPNG.remove())
                warnings.push("Remaining temporary PNG file: " + temporaryPNG.fsName);
            if (!success) {
                try { layer.enabled = oldEnabled; layer.selected = true; } catch (stateError) { warnings.push("Check the original plane's visibility."); }
                if (file && file.exists && !file.remove()) warnings.push("Remaining PSD file: " + file.fsName);
            }
            if (group) app.endUndoGroup();
        }
        if (error) fail((error.message || error.toString()) + (warnings.length ? "\n\n" + warnings.join("\n") : ""));
        if (warnings.length) alert(warnings.join("\n"), TITLE);
        return file;
    }
    function saveFrame(context, folder) {
        var isFloat = context.depth === 32;
        var file = nextPlateFile(folder,"psd"), footage = null, plateLayer = null;
        var colorInfo = null, temporaryPNG = null, group = false;
        try {
            message("Saving frame…");
            if(isFloat) {
                renderPhotoshop32(context,file);
            } else {
                temporaryPNG=new File(folder.fsName+"/.VFX_ToolBox_"+new Date().getTime()+".png");
                savePNGDirect(context,temporaryPNG);
                verifyPNG(temporaryPNG,context,false);
                message("Converting to PSD…");
                convertPNGToPSD(temporaryPNG,file);
            }
            colorInfo=verifyPSD(file,context);
        } catch (error) {
            if (file.exists) file.remove();
            throw error;
        } finally {
            if(temporaryPNG && temporaryPNG.exists) temporaryPNG.remove();
        }
        message("Importing Plate…");
        try {
            app.beginUndoGroup(TITLE + " Save Frame"); group=true;
            footage = waitForImport(file, 15000);
            footage.parentFolder = projectPlatesFolder();
            footage.comment = TITLE + " " + VERSION + " | Saved frame: " + context.time + "s" +
                ((colorInfo && !colorInfo.embeddedICC) ? " | Untagged PSD; project working space: " + context.space : "");
            plateLayer=context.comp.layers.add(footage);
            plateLayer.startTime=context.time;
            plateLayer.inPoint=context.time;
            plateLayer.comment=TITLE + " " + VERSION + " | Captured at: " + context.time + "s";
            var selected=context.comp.selectedLayers;
            for(var i=0;i<selected.length;i++) selected[i].selected=false;
            plateLayer.selected=true;
        } catch (importError) {
            if(plateLayer) { try { plateLayer.remove(); } catch(layerCleanupError) {} }
            if(footage) { try { footage.remove(); } catch(footageCleanupError) {} }
            fail("The frame was saved at:\n" + file.fsName + "\n\nIt could not be imported and inserted into the active composition. " +
                (importError.message || importError.toString()));
        } finally {
            if(group) app.endUndoGroup();
        }
        return {file: file, footage: footage, layer: plateLayer};
    }
    function reloadImportedAssets() {
        var reloaded = 0, failed = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof FootageItem) || !(item.mainSource instanceof FileSource)) continue;
            try {
                item.mainSource.reload();
                reloaded++;
            } catch (error) {
                failed.push(item.name + ": " + (error.message || error.toString()));
            }
        }
        return {reloaded: reloaded, failed: failed};
    }
    function applyCameraTracker(comp) {
        if (!(comp instanceof CompItem)) fail("Open a composition and select one footage layer.");
        if (comp.selectedLayers.length !== 1) fail("Select exactly one footage layer in the active composition.");
        var layer=comp.selectedLayers[0];
        if (!(layer instanceof AVLayer) || !layer.source || !(layer.source instanceof FootageItem) ||
            !(layer.source.mainSource instanceof FileSource) || layer.source.mainSource.isStill)
            fail("Select one imported movie or image-sequence layer.");
        if (layer.locked) fail("Unlock the footage layer before applying Camera Tracker.");
        if (layer.threeDLayer) fail("Camera Tracker requires a 2D footage layer.");
        var effects=layer.property("ADBE Effect Parade"), matchName="ADBE 3D Tracker";
        if (effects.property(matchName)) fail("3D Camera Tracker is already applied to this layer.");
        if (!effects.canAddProperty(matchName)) fail("3D Camera Tracker is not available for the selected layer.");
        app.beginUndoGroup(TITLE + " Camera Tracker");
        try {
            return effects.addProperty(matchName);
        } finally {
            app.endUndoGroup();
        }
    }
    function applyMotionTracker(comp) {
        if (!(comp instanceof CompItem)) fail("Open a composition and select one footage or pre-composition layer.");
        if (comp.selectedLayers.length !== 1) fail("Select exactly one footage or pre-composition layer in the active composition.");
        var layer=comp.selectedLayers[0];
        var isPrecomp=layer instanceof AVLayer && layer.source instanceof CompItem;
        var isTrackableFootage=layer instanceof AVLayer && layer.source instanceof FootageItem &&
            layer.source.mainSource instanceof FileSource && !layer.source.mainSource.isStill;
        if (!isPrecomp && !isTrackableFootage)
            fail("Select one imported movie, image-sequence, or pre-composition layer.");
        if (layer.locked) fail("Unlock the footage layer before starting Motion Tracker.");
        app.beginUndoGroup(TITLE + " Motion Tracker");
        try {
            createMotionTrackerNull(comp, layer);
        } finally {
            app.endUndoGroup();
        }
        // Adobe's localized dictionaries identify Track Motion as stable menu command 2568.
        app.executeCommand(2568);
    }
    function chooseTrackerMode() {
        var dialog=new Window("dialog", "Camera Tracker");
        dialog.orientation="column";
        dialog.alignChildren=["fill","fill"];
        dialog.spacing=8;
        dialog.margins=12;
        dialog.add("statictext", undefined, "Choose a tracker:");
        var camera=dialog.add("button", undefined, "3D Camera Tracker");
        var motion=dialog.add("button", undefined, "Motion Tracker");
        var cancel=dialog.add("button", undefined, "Cancel", {name:"cancel"});
        camera.helpTip="Apply After Effects' native 3D Camera Tracker effect.";
        motion.helpTip="Create a numbered tracker null and open After Effects' native Track Motion workflow.";
        cancel.helpTip="Close without starting a tracker.";
        var choice=null;
        camera.onClick=function(){ choice="camera3d"; dialog.close(1); };
        motion.onClick=function(){ choice="motion"; dialog.close(1); };
        cancel.onClick=function(){ dialog.close(0); };
        dialog.defaultElement=camera;
        dialog.cancelElement=cancel;
        dialog.center();
        dialog.show();
        return choice;
    }
    function beginAction(button) {
        if (busy) return;
        busy = true; activeButton = button;
        trackerButton.enabled = false; proxyButton.enabled = false; captureButton.enabled = false; saveButton.enabled = false; versioningButton.enabled = false; reloadButton.enabled = false;
        return true;
    }
    function endAction() {
        busy = false; activeButton = null;
        trackerButton.enabled = true; proxyButton.enabled = true; captureButton.enabled = true; saveButton.enabled = true; versioningButton.enabled = true; reloadButton.enabled = true;
        trackerButton.text = "Tracker"; proxyButton.text = "Generate Proxy"; captureButton.text = "Stamp 3D"; saveButton.text = "Save Frame"; versioningButton.text = "Versioning"; reloadButton.text = "Reload Textures";
    }
    function runCapture() {
        if (!beginAction(captureButton)) return;
        try {
            if (app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY") !== 1)
                fail("Enable Allow Scripts to Write Files and Access Network in Preferences > Scripting & Expressions.");
            var context = validate(app.project.activeItem), folder = outputFolder();
            if (!folder.exists && !folder.create()) fail("Could not create the texture folder: " + folder.fsName);
            capture(context, folder);
        } catch (e) { alert(e.message || e.toString(), TITLE); }
        finally { endAction(); }
    }
    function runTrackerChoice() {
        if (busy || trackerMenuOpen) return;
        trackerMenuOpen=true;
        try {
            var choice=chooseTrackerMode();
            if (!choice || !beginAction(trackerButton)) return;
            if (choice==="camera3d") {
                message("Applying 3D…");
                applyCameraTracker(app.project.activeItem);
            } else {
                message("Opening Tracker…");
                applyMotionTracker(app.project.activeItem);
            }
        } catch (e) { alert(e.message || e.toString(), TITLE); }
        finally {
            trackerMenuOpen=false;
            if (busy) endAction();
        }
    }
    function runProxy() {
        if (!beginAction(proxyButton)) return;
        try {
            if (app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY") !== 1)
                fail("Enable Allow Scripts to Write Files and Access Network in Preferences > Scripting & Expressions.");
            var selected = app.project.selection;
            var target=selected.length===1 ? selected[0] : null;
            var movie=target instanceof FootageItem && target.mainSource instanceof FileSource;
            if (!target || (!movie && !(target instanceof CompItem)))
                fail("Select exactly one imported movie or composition in the Project panel.");
            if (target instanceof CompItem && !confirm(
                "Generate proxy for this composition?", false, TITLE)) return;
            var folder = proxiesFolder(target);
            if (!folder.exists && !folder.create()) fail("Could not create the proxy folder: " + folder.fsName);
            var file = generateProxy(target, folder);
            message("Proxy Ready");
            $.sleep(500);
        } catch (e) { alert(e.message || e.toString(), TITLE); }
        finally { endAction(); }
    }
    function runSave() {
        if (!beginAction(saveButton)) return;
        try {
            if (app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY") !== 1)
                fail("Enable Allow Scripts to Write Files and Access Network in Preferences > Scripting & Expressions.");
            var context = validateFrame(app.project.activeItem), folder = platesFolder();
            if (!folder.exists && !folder.create()) fail("Could not create the output folder: " + folder.fsName);
            saveFrame(context, folder);
        } catch (e) { alert(e.message || e.toString(), TITLE); }
        finally { endAction(); }
    }
    function runReload() {
        if (!beginAction(reloadButton)) return;
        try {
            message("Reloading…");
            var result = reloadImportedAssets();
            if (result.failed.length) {
                var details = result.failed.slice(0, 10);
                if (result.failed.length > details.length)
                    details.push("…and " + (result.failed.length - details.length) + " more.");
                alert("Reloaded " + result.reloaded + " imported assets.\n\nCould not reload " +
                    result.failed.length + ":\n" + details.join("\n"), TITLE);
            } else if (!result.reloaded) {
                alert("No file-based imported assets were found.", TITLE);
            } else {
                message("Reloaded " + result.reloaded);
                $.sleep(500);
            }
        } catch (e) { alert(e.message || e.toString(), TITLE); }
        finally { endAction(); }
    }
    function runVersioning() {
        if (!beginAction(versioningButton)) return;
        try {
            message("Saving Version…");
            var file = saveNextProjectVersion();
            if (!file) return;
            message("Saved " + file.name.replace(/\.aepx?$/i, ""));
            $.sleep(500);
        } catch (e) { alert(e.message || e.toString(), TITLE); }
        finally { endAction(); }
    }
    function build() {
        panel = host instanceof Panel ? host : new Window("palette", TITLE, undefined, {resizeable:true});
        panel.orientation = "column";
        panel.alignChildren = ["fill","fill"];
        panel.spacing = 6;
        panel.margins = 8;
        panel.minimumSize = [300, 90];
        var topRow = panel.add("group");
        topRow.orientation = "row";
        topRow.alignment = ["fill","fill"];
        topRow.alignChildren = ["fill","fill"];
        topRow.spacing = 6;
        var bottomRow = panel.add("group");
        bottomRow.orientation = "row";
        bottomRow.alignment = ["fill","fill"];
        bottomRow.alignChildren = ["fill","fill"];
        bottomRow.spacing = 6;
        trackerButton = topRow.add("button", undefined, "Tracker");
        trackerButton.alignment = ["fill","fill"];
        trackerButton.preferredSize = [145, 36];
        trackerButton.minimumSize = [80, 32];
        trackerButton.helpTip = "Choose 3D Camera Tracker for footage or Motion Tracker for footage and pre-comps.";
        trackerButton.onClick = runTrackerChoice;
        captureButton = topRow.add("button", undefined, "Stamp 3D");
        captureButton.alignment = ["fill","fill"];
        captureButton.preferredSize = [145, 36];
        captureButton.minimumSize = [80, 32];
        captureButton.helpTip = "Project the current frame onto the selected 3D plane as a PSD.";
        captureButton.onClick = runCapture;
        saveButton = topRow.add("button", undefined, "Save Frame");
        saveButton.alignment = ["fill","fill"];
        saveButton.preferredSize = [145, 36];
        saveButton.minimumSize = [80, 32];
        saveButton.helpTip = "Save the current frame as a PSD Plate and add it at the playhead.";
        saveButton.onClick = runSave;
        versioningButton = bottomRow.add("button", undefined, "Versioning");
        versioningButton.alignment = ["fill","fill"];
        versioningButton.preferredSize = [145, 36];
        versioningButton.minimumSize = [80, 32];
        versioningButton.helpTip = "Save the open project as the next numbered _V01, _V02, and so on.";
        versioningButton.onClick = runVersioning;
        proxyButton = bottomRow.add("button", undefined, "Generate Proxy");
        proxyButton.alignment = ["fill","fill"];
        proxyButton.preferredSize = [145, 36];
        proxyButton.minimumSize = [80, 32];
        proxyButton.helpTip = "Create and assign a same-resolution H.265 proxy at 10 Mbps.";
        proxyButton.onClick = runProxy;
        reloadButton = bottomRow.add("button", undefined, "Reload Textures");
        reloadButton.alignment = ["fill","fill"];
        reloadButton.preferredSize = [145, 36];
        reloadButton.minimumSize = [80, 32];
        reloadButton.helpTip = "Reload every file-based footage item in the project from disk.";
        reloadButton.onClick = runReload;
        panel.onResizing = panel.onResize = function () { this.layout.resize(); };
        panel.layout.layout(true);
        if (panel instanceof Window) { panel.center(); panel.show(); }
    }
    build();
})(this);
