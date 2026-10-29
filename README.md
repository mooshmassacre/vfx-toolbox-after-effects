# VFX ToolBox

**0.11.0 beta · After Effects production tools for tracking, 3D stamping, frame capture, proxies, asset reload and project versioning**

VFX ToolBox is a compact ScriptUI panel that brings common VFX production tasks into one responsive workspace. It launches native 3D and motion tracking, creates organized tracker targets, projects frames onto 3D planes, captures color-aware PSD Plates, generates playback and editing proxies, reloads imported assets and saves incremental After Effects project versions without overwriting earlier work.

## Use

1. Copy `VFX_ToolBox.jsx` into After Effects' `Scripts/ScriptUI Panels` folder and restart After Effects.
2. Enable **Allow Scripts to Write Files and Access Network** in **Preferences > Scripting & Expressions**.
3. Open a square-pixel composition at Full resolution with an ICC working color space.
4. Select one unlocked 3D visual layer. Keep all corners inside the frame and disable every Solo switch.
5. To start tracking, select exactly one layer in the active composition and click **Tracker**. 3D Camera Tracker accepts imported movies and image sequences; Motion Tracker also accepts pre-composition layers.
6. To create a proxy, select exactly one imported movie, composition or pre-composition in the Project panel, or select one movie footage layer in the active timeline. Click **Generate Proxy**, then choose **Play Proxy - Same Res | H265** or **Work Proxy - Low Res | QTProxy**.
7. Click **Stamp 3D** to create a projected texture. Click **Save Frame**, then choose Save Plate or Save Unstretched.
8. Click **Reload Textures** to force every file-based imported asset in the project to reload from disk.

**Versioning** saves the open project beside its current file as `Project_V01.aep`, `Project_V02.aep`, and so on. It scans the folder for the highest existing version, never replaces an earlier file and leaves the newly saved version open as the active After Effects project. For an unsaved project, the first click opens After Effects' native Save As dialog and keeps the chosen initial project open; numbered versions begin on subsequent clicks. Cancelling the dialog creates nothing.

**Tracker** is a standard clickable button that opens a two-option chooser. **3D Camera Tracker** applies After Effects' native tracker effect to a selected unlocked 2D movie or image-sequence layer and refuses duplicate application. **Motion Tracker** accepts an imported movie, image sequence or pre-composition layer, creates a 2D Null named `TRACKER_01`, `TRACKER_02`, and so on, then invokes After Effects' native Track Motion command for that layer. Its generated Null source is stored in a top-level **Assets** folder in the Project panel, which VFX ToolBox creates when needed.

**Generate Proxy** opens a two-option chooser. **Play Proxy - Same Res | H265** creates a same-resolution H.265/HEVC MP4 at a 10 Mbps target video bitrate with AAC audio. **Work Proxy - Low Res | QTProxy** creates an editing-friendly QuickTime MOV using Apple ProRes 422 Proxy with PCM audio; it never upscales, limits height to 1080 pixels and preserves the source aspect ratio.

Both proxy types are imported as visible footage into a top-level **Proxies** folder in the After Effects Project panel. They are also immediately associated with the source `FootageItem` through After Effects' native proxy API and enabled on the selected item. A movie layer selected in the timeline resolves to its imported source item, so the assigned proxy is available throughout the project wherever that footage is used. Imported-movie proxies are saved directly beside the original source file. Composition and pre-composition proxies are saved directly beside the `.aep` project. The first filenames are `Original_PROXY.mp4` and `Original_PROXY.mov`; repeated exports increment as `Original_PROXY_02`, `Original_PROXY_03`, and so on without replacing an earlier proxy. FFmpeg and ffprobe are required; VFX ToolBox detects Homebrew installations on Apple Silicon and Intel Macs.

Composition proxies use an isolated full-resolution QuickTime intermediate rendered by After Effects with effects, motion blur and frame blending enabled according to the composition. VFX ToolBox preserves the enabled state of existing Render Queue items, excludes existing proxies from the intermediate, removes its temporary queue item, converts the complete composition duration to the chosen proxy type and deletes the intermediate. The project must be saved before generating a composition proxy.

When the selected Project-panel item is any composition rather than an imported movie, VFX ToolBox asks **“Generate proxy for this composition?”** before rendering. **Yes** is the default choice; **No** cancels the operation.

The panel uses a responsive three-column, two-row layout. Tracker, Stamp 3D and Save Frame occupy the first row; Versioning, Generate Proxy and Reload Textures occupy the second row. All six controls expand and contract with the panel.

Every panel button displays a concise tooltip after the pointer rests over it. The three choices inside the Tracker dialog also describe their actions on hover.

**Stamp 3D** captures its projected texture directly with After Effects' `saveFrameToPng()` API, as in the original 3D Plane Stamp script. It does not create or render a Render Queue item. VFX ToolBox validates the temporary 8/16-bpc PNG, converts it headlessly to a flattened PSD and removes the PNG. The final PSD is written to **VFX ToolBox Textures** beside the project; unsaved projects use Documents. The PSD replaces the selected plane visually and follows its native 3D transform through parenting. VFX ToolBox does not require the projected corners to remain inside the composition: it captures the visible portion available in the frame and projects that result.

**Reload Textures** reloads the main source of every file-based Footage item, including still images, image sequences, video and audio. Solids and generated sources are ignored. The current Project panel selection is preserved, and failures are reported by asset name.

**Save Frame** opens a two-option chooser. Both workflows create a **Plates** folder beside the saved `.aep` project, import their result into a top-level **Plates** folder in the Project panel and insert the new still at the capture playhead. Plate numbering is shared across PNG, TIFF and PSD outputs and always increments, so existing files are never replaced. The project must be saved first so its disk root is known.

**Save Plate** retains the existing full-composition workflow when no single masked visual layer is selected. It creates `Plate_01.psd`, `Plate_02.psd`, and so on. If exactly one visible layer with one or more masks is selected, Save Plate isolates that layer, preserves its current transforms and masks, hides other visual layers only for the capture, and writes a full-composition RGBA PNG with a transparent background. Visibility, Solo and selection states are restored immediately afterward.

**Save Unstretched** requires exactly one visible visual layer. It uses the selected layer's current four composition-space corners to stretch its visible result across the full composition frame, preserving masks and transparency in a composition-sized RGBA PNG. After import, VFX ToolBox applies the native Corner Pin effect with the original four corner positions, returning the still to the same on-screen placement and perspective it had at the captured frame.

At 8/16 bpc, Save Frame writes a temporary full-resolution PNG through After Effects' direct frame API, validates it, and converts it headlessly to PSD with the native macOS ImageIO converter. It does not touch the Render Queue or open Photoshop. The temporary PNG is removed after conversion.

At 32 bpc, Save Frame renders the final PSD directly through the installed `_HIDDEN X-Factor 32` Floating Point template. The temporary queue item is removed afterwards, and every previously enabled queue item is restored without being rendered.

The direct After Effects PNG method does not embed an ICC profile, so its converted 8/16-bpc PSD is normally untagged. VFX ToolBox records the project working-space name in the footage comment. With no embedded profile or matching interpretation rule, After Effects interprets untagged footage in the project working space. A 32-bpc PSD keeps any ICC resource supplied by the native output template.

## Precision and color

- Full-composition Save Plate produces a flattened PSD matching the project's 8, 16 or 32 bits per channel.
- Masked Save Plate and Save Unstretched produce transparent, full-composition PNG Plates at 8 or 16 bits per channel. PNG workflows are unavailable in 32-bpc projects.
- The native macOS converter was verified to retain both 8-bpc and 16-bpc PNG depth in the PSD header.
- Stamp 3D remains limited to 8/16 bpc and uses After Effects' direct PNG frame API before converting the validated PNG to PSD.
- Before importing, VFX ToolBox checks PSD signature, dimensions, RGB/RGBA mode, channel depth and ICC-resource presence. Direct Stamp 3D and Save Frame results are normally untagged, so VFX ToolBox records the project working-space name in their footage comments.
- The PNG `iCCP` chunk is compressed. ExtendScript does not provide a reliable built-in decompressor, so VFX ToolBox confirms profile presence but cannot prove that its contents exactly match the project working space. A Photoshop/After Effects round-trip remains necessary for color-critical work.

## Limits

- Each result is one static rendered image, not a layered file.
- Adobe Color Managed / ICC projects are supported. OCIO/ACES is currently blocked.
- The original plane remains hidden in the composition and must be kept because it is the texture's transform parent.
- Stamp 3D follows transform animation and parent chains; animated content, masks, opacity and deformation are not reproduced by that workflow. Save Plate and Save Unstretched capture masks at the selected frame.
- The captured region can include foreground objects visible in the chosen frame.
- Non-square pixels, collapsed transformations, nonzero anchor Z and active Solo switches are rejected.
- Direct frame capture and conversion are synchronous and may briefly block the interface.
- Headless PSD conversion for Stamp 3D and 8/16-bpc Save Frame currently requires macOS.
- Generate Proxy currently requires macOS, FFmpeg and ffprobe. It accepts file-based movies and saved-project compositions; still images and image sequences are not transcoded.
- Undo does not delete the PSD from disk.

## Attribution

VFX ToolBox is an independent custom modernization of the workflow in **AE-3DPlaneStamp v1.7**, originally credited to **Nate Lovell / NT Productions and Hashi**. It is not their official Version 2 and does not imply endorsement. No new license is asserted for the original work; see `NOTICE.md`.

## License

Original VFX ToolBox contributions are released under the [MIT License](LICENSE), copyright © 2026 Moosh Massacre. Portions derived from or attributable to AE-3DPlaneStamp v1.7 remain subject to the rights of their respective authors; see [NOTICE.md](NOTICE.md).

## Verification

The included checks cover synthetic PNG and 8/16/32-bpc PSD files, incompatible outputs, sequential filenames, native template selection, render-queue isolation and nonzero timeline origins. They do not replace testing inside After Effects.

Run them with `node verify.cjs`.
