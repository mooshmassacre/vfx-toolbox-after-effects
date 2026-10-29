# Attribution and provenance

VFX ToolBox is an independent custom edition developed from the workflow examined in AE-3DPlaneStamp v1.7.

The original script credits:

- Nate Lovell / NT Productions
- Hashi

The v1.7 source links to https://aescripts.com/authors/m-p/nt-productions/.

VFX ToolBox is not the authors' official Version 2. Attribution does not imply affiliation or endorsement.

No explicit license grant was found in the inspected v1.7 file. The MIT License in this repository applies to the original VFX ToolBox contributions and does not assign a new license to the original work or establish redistribution permissions for it. Attribution records provenance; it is not a substitute for a license.

# Changes in 0.1.2 beta

- Renamed the custom edition from Plane Stamp Modern to PlaneTrace.
- Translated all interface labels, progress messages, errors, setup instructions and documentation to English.
- Renamed the script, output folder default, output module template default, temporary layer and generated texture label.
- Retained the PSD rendering and validation behavior of 0.1 beta.

# Queue fix in 0.1.2 beta

- Only QUEUED items are temporarily disabled. Completed, stopped and other nonqueued items are left untouched even if their render flag reads true.
- Only successfully disabled items are recorded for restoration, with status checks during cleanup.
- Error propagation no longer repeats Error prefixes at each nesting level.
- Added six regression checks for queue states and failed checkbox writes.

# Interface update in 0.1.3 beta

- Replaced the previous panel with one Capture PSD button.
- Progress is displayed in the button; output folder and template are automatic.
- Uses the PlaneTrace PSD output module template. Missing-template errors include setup instructions.
- Includes the render-queue fix from 0.1.2.

# Timeline fix in 0.1.4 beta

- The render queue start now includes the composition displayStartTime offset.
- Sets the single-frame duration before the render start to avoid a transient full-duration interval.
- Adds regression checks for zero, one-hour, large positive and negative timeline origins.

# Output selection fix in 0.1.5 beta

- Removed the mandatory PlaneTrace PSD template name.
- Finds Photoshop output by actual format and matches project depth; supports arbitrary saved template names.
- Attempts to set Depth only when the running host reports it writable. Does not lower project/output precision silently.
- Existing PSD dimension and ICC checks remain in place. Native color settings still require host validation.

# Output metadata fix in 0.1.6 beta

- Reads format, channels and bit depth through getSettings(GetSettingsFormat.STRING), explicitly requesting textual values.
- Includes inspected template names, format and depth in failure diagnostics.
- Added regression coverage for numeric individual-setting identifiers.
- A Photoshop preset was found in local saved AE preferences; actual host API results remain unverified because application automation is unavailable.

# PNG workflow in 0.2.0 beta

- Replaced PSD output with native PNG Sequence output for 8/16-bpc projects.
- Uses the installed depth-specific PNG templates, including the native hidden X-Factor presets shown by After Effects 2026.
- Validates PNG dimensions, RGB/RGBA mode, channel depth and embedded ICC-profile presence before import.
- Rejects 32-bpc projects because PNG cannot store 32-bit floating-point channels.
- Keeps the single-button interface and the render-queue/timeline fixes from earlier betas.

# Plate export in 0.2.1 beta

- Adds a Save PNG button beside Capture PNG.
- Saves the full composition frame at the current playhead into a `Plates` folder beside the `.aep` project.
- Uses sequential `Plate_01.png`, `Plate_02.png`, and later names based on the highest existing number, without replacing prior files.
- Imports each saved PNG into a top-level `Plates` folder in the After Effects Project panel, creating it when necessary.
- Uses the same full-resolution, project-bit-depth, embedded-ICC validation as texture capture.

# Direct Plate export in 0.2.2 beta

- Save PNG now uses the composition's direct PNG-frame method instead of creating a Render Queue item.
- Temporarily requests full composition resolution and restores the prior preview-resolution setting after the call.
- Keeps the dimension, bit-depth and embedded-ICC checks before importing the Plate.
- Capture PNG continues to use its isolated Render Queue workflow because it renders the temporary plane-projection setup.

# 32-bit Plate export in 0.3.0 beta

- Renames Save PNG to Save Frame and selects the format from project depth.
- Keeps direct PNG saving for 8/16-bpc projects.
- Saves 32-bpc projects as 32-bit floating-point TIFF through an isolated one-frame queue render because ExtendScript provides no direct TIFF counterpart to `saveFrameToPng`.
- Validates TIFF dimensions, RGB/RGBA samples, 32-bit floating-point sample metadata and embedded ICC profile before import.
- Shares one never-overwrite `Plate_XX` numbering sequence across PNG and TIFF files.

# Direct PNG completion fix in 0.3.1 beta

- Waits for the PNG `IEND` marker before validating a frame written by the direct composition API.
- Removes the artificial 64 MB chunk limit, while retaining the PNG specification's maximum chunk size and file-boundary checks.
- Skips large image-data chunks without loading them fully into ExtendScript memory.
- Reports the failing chunk type, offset, declared size and remaining file size when structural validation fails.

# Interface label in 0.3.2 beta

- Renames the first button from Capture PNG to Stamp 3D without changing its projection workflow.

# Direct PNG color handling in 0.3.3 beta

- Accepts the direct composition API's untagged PNG output for Save Frame while retaining dimension, RGB/RGBA and 8/16-bpc validation.
- Records the project working-space name in the imported footage comment when the PNG has no embedded ICC profile.
- Keeps embedded-ICC validation mandatory for Stamp 3D PNGs and 32-bit TIFF Plates created through output modules.

# Automatic 32-bit TIFF fallback in 0.3.4 beta

- Uses a compatible TIFF output module directly when one is installed.
- Otherwise renders a temporary 32-bit floating-point PSD through the installed hidden X-Factor 32 template and converts it to TIFF through Adobe Photoshop BridgeTalk.
- Requests TIFF ZIP compression, alpha-channel retention and embedded color profile in Photoshop, then validates the resulting TIFF before import.
- Removes the temporary PSD after conversion, except on a Photoshop timeout where it is kept for recovery.

# Unified PSD Plates in 0.4.0 beta

- Changes Save Frame's final format to flattened PSD at the project's 8, 16 or 32 bits per channel.
- Converts direct 8/16-bpc PNG frames to PSD through the native macOS `sips` command without opening Photoshop or using the Render Queue.
- Renders 32-bpc PSD directly through the installed hidden X-Factor 32 Floating Point template.
- Validates PSD signature, dimensions, RGB/RGBA mode, bit depth and ICC-resource presence before import.
- Removes temporary PNG files and keeps one never-overwrite `Plate_XX` sequence across previous and current formats.

# Timeline placement in 0.4.1 beta

- Forces saved PSD Plates to import as flattened footage.
- Inserts the imported Plate into the active composition and aligns its layer start and in point to the capture playhead.
- Selects the inserted Plate layer and groups the project-panel/timeline changes into one undo operation.

# Stamp 3D PSD output in 0.4.2 beta

- Changes Stamp 3D's final texture format from PNG to flattened PSD at the project's 8/16-bpc depth.
- Keeps the existing projected PNG render as a validated temporary intermediate and converts it headlessly through native macOS ImageIO.
- Requires the converted PSD to retain the source PNG's embedded ICC profile before import.
- Removes the temporary PNG while preserving the existing 3D parenting, transform and cleanup workflow.
- Resolves the frame-number suffixes that After Effects may append to one-frame PNG Sequence renders before PSD conversion.

# Rendered filename resolution in 0.4.3 beta

- Uses a visible, uniquely timestamped temporary PNG name for Stamp 3D.
- Accepts the frame suffix variants produced by After Effects PNG Sequence output, including bracketed variants, before normalizing the filename.

# Reload Textures in 0.5.0 beta

- Adds a third compact button that reloads every file-based imported Footage item from its main source on disk.
- Preserves the current project selection, skips generated sources such as solids, and reports assets that After Effects could not reload.

# Generate Proxy in 0.6.0 beta

- Adds Generate Proxy as the first panel action for one movie selected in the After Effects Project panel.
- Uses the installed FFmpeg encoder to create a same-resolution H.265/HEVC MP4 with a 2 Mbps target video bitrate and AAC audio.
- Creates a `Proxys` folder beside the original media, increments proxy filenames without replacement, validates the HEVC codec and dimensions, then assigns and enables the proxy on the selected item.

# Responsive tool grid in 0.6.1 beta

- Reorganizes the panel into two responsive rows of three equal, resizable buttons.
- Keeps Generate Proxy, Stamp 3D and Save Frame on the first row and moves Reload Textures to the first position of the second row.
- Adds disabled Tool 05 and Tool 06 placeholders for future functions.

# Proxy quality in 0.6.2 beta

- Raises the H.265/HEVC proxy target video bitrate from 2 Mbps to 10 Mbps.
- Uses a 10 Mbps maximum rate and a 20 Mbps encoder buffer to retain substantially more visual detail.

# Composition proxies in 0.7.0 beta

- Allows Generate Proxy to target a composition or pre-composition selected in the Project panel.
- Renders the complete comp at full resolution to a temporary QuickTime intermediate without using existing proxies, then encodes and assigns the H.265 MP4 proxy.
- Stores composition proxies in a `Proxys` folder beside the saved `.aep`, removes the temporary queue item and intermediate, and restores previously enabled Render Queue items.

# Pre-composition confirmation in 0.7.1 beta

- Detects when the selected composition is used by another composition.
- Requests explicit confirmation before generating and enabling its proxy, with No selected by default.

# Composition confirmation in 0.7.2 beta

- Expands the proxy confirmation to every selected CompItem, whether or not it is already used as a pre-composition.
- Imported movie assets continue directly without displaying the confirmation.
- Uses a short, direct confirmation prompt with No selected by default.

# Confirmation default in 0.7.3 beta

- Makes Yes the default response when confirming a composition proxy.
- Keeps No as the secondary cancellation action.

# Camera Tracker shortcut in 0.8.0 beta

- Replaces the first-row Generate Proxy position with a Camera Tracker action immediately before Stamp 3D.
- Applies After Effects' native `ADBE 3D Tracker` effect to one selected 2D movie or image-sequence layer and prevents duplicate application.
- Moves Generate Proxy to the former Tool 05 position on the second row, preserving the six-button responsive grid.

# Tracker chooser and Camera Stamp slot in 0.9.0 beta

- Renames the first reserved workflow position to Camera Stamp.
- Replaces Tool 06 with a Camera Tracker chooser that opens on hover or click.
- Offers the native 3D Camera Tracker effect and After Effects Track Motion command for the selected timeline footage layer.

# Clickable tracker chooser in 0.9.1 beta

- Removes the automatic hover trigger because ScriptUI does not provide a dependable docked-panel dropdown button.
- Opens the same two tracker choices only when Camera Tracker is clicked.

# Tool descriptions in 0.9.2 beta

- Adds short hover descriptions to all six panel buttons.
- Adds matching descriptions to the 3D Camera Tracker, Motion Tracker and Cancel choices.

# Partial-frame Stamp 3D in 0.9.3 beta

- Removes all composition-boundary restrictions from Stamp 3D.
- Captures the visible portion available in the frame and projects it even when one or more plane corners are outside the composition.

# Tool order in 0.9.4 beta

- Orders the first row as Camera Tracker, Stamp 3D and Save Frame.
- Orders the second row as Camera Stamp, Generate Proxy and Reload Textures.

# Direct Stamp 3D capture in 0.9.5 beta

- Restores the original script's direct `CompItem.saveFrameToPng()` capture method for Stamp 3D.
- Removes Stamp 3D's dependency on PNG Sequence output templates and Render Queue filename resolution.
- Keeps full-resolution 8/16-bpc validation, headless PSD conversion, project working-space metadata and the existing 3D projection workflow.

# Motion Tracker target in 0.9.6 beta

- Renames the first-row Camera Tracker button to Tracker while retaining both native tracking choices.
- Creates a sequentially named `TRACKER_01`, `TRACKER_02`, and so on when Motion Tracker is selected.
- Stores the generated Null source in a top-level Project-panel folder named `Assets`, creating it when necessary.
- Restores the footage selection before opening After Effects' native Track Motion workflow.

# VFX ToolBox name in 0.9.7 beta

- Renames the custom project and panel from PlaneTrace to VFX ToolBox.
- Renames the distributable JSX, generated texture folder, temporary assets and generated-item metadata to the new identity.
- Retains the original AE-3DPlaneStamp attribution and licensing notice.

# Project versioning in 0.9.8 beta

- Replaces the reserved Camera Stamp control with an active Versioning button.
- Saves the current project beside its source as the next available `_V01`, `_V02`, and subsequent `.aep` version.
- Preserves the stable base name, never overwrites an existing version and keeps the newest saved version open.

# Initial project save in 0.9.9 beta

- Opens After Effects' native Save As dialog when Versioning is used on an unsaved project.
- Keeps the chosen initial project open and begins numbered versioning on the next click.
- Treats dialog cancellation as a clean cancellation without creating another file.

# Pre-composition motion tracking in 0.9.10 beta

- Allows Motion Tracker to start from a selected pre-composition layer as well as imported movies and image sequences.
- Creates and organizes the same sequential tracker Null for either source type.
- Keeps 3D Camera Tracker validation limited to supported footage sources.

# Play and Work proxies in 0.10.0 beta

- Changes Generate Proxy into a chooser with Play Proxy and Work Proxy actions.
- Keeps Play Proxy as a same-resolution 10 Mbps H.265 MP4 and adds Work Proxy as an Apple ProRes 422 Proxy QuickTime MOV capped at 1080 pixels high without upscaling.
- Preserves source aspect ratio, validates the resulting codec and dimensions, and assigns the selected proxy immediately.
- Saves both formats directly beside the original movie, or beside the saved After Effects project for composition proxies, using an uppercase `_PROXY` suffix without overwriting existing files.

# Timeline footage proxies in 0.10.1 beta

- Allows Generate Proxy to target one imported movie footage layer selected in the active timeline.
- Resolves the layer to its shared source Footage item, saves the chosen proxy beside the original media and enables it through After Effects' native proxy assignment.
- Preserves the existing Project-panel selection workflow as the fallback when no valid timeline footage is selected.

# Visible proxy imports in 0.10.2 beta

- Imports every generated Play Proxy and Work Proxy as visible footage in a top-level Project-panel folder named `Proxies`.
- Keeps the imported proxy file assigned and enabled on the original source item through After Effects' native proxy API.
- Removes a partial Project-panel import if proxy assignment fails.
