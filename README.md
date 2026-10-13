# VFX ToolBox

**0.9.9 beta · After Effects · tracking, versioning, PSD capture, Plates and H.265 proxies**

VFX ToolBox captures the current composition frame onto a selected 3D plane. It can also save the complete frame at the playhead as an incrementally numbered, flattened PSD Plate.

## Use

1. Copy `VFX_ToolBox.jsx` into After Effects' `Scripts/ScriptUI Panels` folder and restart After Effects.
2. Enable **Allow Scripts to Write Files and Access Network** in **Preferences > Scripting & Expressions**.
3. Open a square-pixel composition at Full resolution with an ICC working color space.
4. Select one unlocked 3D visual layer. Keep all corners inside the frame and disable every Solo switch.
5. To start tracking, select exactly one movie or image-sequence layer in the active composition and click **Tracker**, then choose 3D Camera Tracker or Motion Tracker.
6. To create a proxy, select exactly one imported movie, composition or pre-composition in the Project panel and click **Generate Proxy**.
7. Click **Stamp 3D** to create a projected texture, or **Save Frame** to save the complete composition frame at the playhead.
8. Click **Reload Textures** to force every file-based imported asset in the project to reload from disk.

**Versioning** saves the open project beside its current file as `Project_V01.aep`, `Project_V02.aep`, and so on. It scans the folder for the highest existing version, never replaces an earlier file and leaves the newly saved version open as the active After Effects project. For an unsaved project, the first click opens After Effects' native Save As dialog and keeps the chosen initial project open; numbered versions begin on subsequent clicks. Cancelling the dialog creates nothing.

**Tracker** is a standard clickable button that opens a two-option chooser. **3D Camera Tracker** applies After Effects' native tracker effect to a selected unlocked 2D movie or image-sequence layer and refuses duplicate application. **Motion Tracker** creates a 2D Null named `TRACKER_01`, `TRACKER_02`, and so on, then invokes After Effects' native Track Motion command for the selected footage layer. Its generated Null source is stored in a top-level **Assets** folder in the Project panel, which VFX ToolBox creates when needed.

**Generate Proxy** is the first action in the panel. It creates an H.265/HEVC MP4 at a 10 Mbps target video bitrate, retains the selected item's pixel dimensions, encodes audio as AAC and immediately assigns and enables the result as that item's proxy. For imported movies, the automatically created **Proxys** folder is beside the original media. For compositions and pre-compositions, **Proxys** is beside the saved `.aep` project. Names increment as `Original_Proxy_01.mp4`, `Original_Proxy_02.mp4`, and so on, without replacing an earlier proxy. FFmpeg and ffprobe are required; VFX ToolBox detects Homebrew installations on Apple Silicon and Intel Macs.

Composition proxies use an isolated full-resolution QuickTime intermediate rendered by After Effects with effects, motion blur and frame blending enabled according to the composition. VFX ToolBox preserves the enabled state of existing Render Queue items, excludes existing proxies from the intermediate, removes its temporary queue item, converts the complete composition duration and deletes the intermediate after H.265 encoding. The project must be saved before generating a composition proxy.

When the selected Project-panel item is any composition rather than an imported movie, VFX ToolBox asks **“Generate proxy for this composition?”** before rendering. **Yes** is the default choice; **No** cancels the operation.

The panel uses a responsive three-column, two-row layout. Tracker, Stamp 3D and Save Frame occupy the first row; Versioning, Generate Proxy and Reload Textures occupy the second row. All six controls expand and contract with the panel.

Every panel button displays a concise tooltip after the pointer rests over it. The three choices inside the Tracker dialog also describe their actions on hover.

**Stamp 3D** captures its projected texture directly with After Effects' `saveFrameToPng()` API, as in the original 3D Plane Stamp script. It does not create or render a Render Queue item. VFX ToolBox validates the temporary 8/16-bpc PNG, converts it headlessly to a flattened PSD and removes the PNG. The final PSD is written to **VFX ToolBox Textures** beside the project; unsaved projects use Documents. The PSD replaces the selected plane visually and follows its native 3D transform through parenting. VFX ToolBox does not require the projected corners to remain inside the composition: it captures the visible portion available in the frame and projects that result.

**Reload Textures** reloads the main source of every file-based Footage item, including still images, image sequences, video and audio. Solids and generated sources are ignored. The current Project panel selection is preserved, and failures are reported by asset name.

**Save Frame** creates a **Plates** folder beside the saved `.aep` project and writes `Plate_01.psd`, `Plate_02.psd`, and so on. It reads the highest existing Plate number across earlier PNG, TIFF and PSD Plates and always increments it, so it never replaces a file. The PSD is imported as flattened footage into a top-level **Plates** folder in the Project panel, then inserted as a selected layer in the active composition with its start and in point at the capture playhead. The project must be saved first so its disk root is known.

At 8/16 bpc, Save Frame writes a temporary full-resolution PNG through After Effects' direct frame API, validates it, and converts it headlessly to PSD with the native macOS ImageIO converter. It does not touch the Render Queue or open Photoshop. The temporary PNG is removed after conversion.

At 32 bpc, Save Frame renders the final PSD directly through the installed `_HIDDEN X-Factor 32` Floating Point template. The temporary queue item is removed afterwards, and every previously enabled queue item is restored without being rendered.

The direct After Effects PNG method does not embed an ICC profile, so its converted 8/16-bpc PSD is normally untagged. VFX ToolBox records the project working-space name in the footage comment. With no embedded profile or matching interpretation rule, After Effects interprets untagged footage in the project working space. A 32-bpc PSD keeps any ICC resource supplied by the native output template.

## Precision and color

- Save Frame produces a flattened PSD matching the project's 8, 16 or 32 bits per channel.
- The native macOS converter was verified to retain both 8-bpc and 16-bpc PNG depth in the PSD header.
- Stamp 3D remains limited to 8/16 bpc and uses After Effects' direct PNG frame API before converting the validated PNG to PSD.
- Before importing, VFX ToolBox checks PSD signature, dimensions, RGB/RGBA mode, channel depth and ICC-resource presence. Direct Stamp 3D and Save Frame results are normally untagged, so VFX ToolBox records the project working-space name in their footage comments.
- The PNG `iCCP` chunk is compressed. ExtendScript does not provide a reliable built-in decompressor, so VFX ToolBox confirms profile presence but cannot prove that its contents exactly match the project working space. A Photoshop/After Effects round-trip remains necessary for color-critical work.

## Limits

- Each result is one static rendered image, not a layered file.
- Adobe Color Managed / ICC projects are supported. OCIO/ACES is currently blocked.
- The original plane remains hidden in the composition and must be kept because it is the texture's transform parent.
- Transform animation and parent chains are followed; animated content, masks, opacity and deformation are not reproduced.
- The captured region can include foreground objects visible in the chosen frame.
- Non-square pixels, collapsed transformations, nonzero anchor Z and active Solo switches are rejected.
- Direct frame capture and conversion are synchronous and may briefly block the interface.
- Headless PSD conversion for Stamp 3D and 8/16-bpc Save Frame currently requires macOS.
- Generate Proxy currently requires macOS and FFmpeg. It accepts file-based movies and saved-project compositions; still images and image sequences are not transcoded.
- Undo does not delete the PSD from disk.

## Attribution

VFX ToolBox is an independent custom modernization of the workflow in **AE-3DPlaneStamp v1.7**, originally credited to **Nate Lovell / NT Productions and Hashi**. It is not their official Version 2 and does not imply endorsement. No new license is asserted for the original work; see `NOTICE.md`.

## License

Original VFX ToolBox contributions are released under the [MIT License](LICENSE), copyright © 2026 Moosh Massacre. Portions derived from or attributable to AE-3DPlaneStamp v1.7 remain subject to the rights of their respective authors; see [NOTICE.md](NOTICE.md).

## Verification

The included checks cover synthetic PNG and 8/16/32-bpc PSD files, incompatible outputs, sequential filenames, native template selection, render-queue isolation and nonzero timeline origins. They do not replace testing inside After Effects.

Run them with `node verify.cjs`.
