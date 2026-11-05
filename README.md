# VFX ToolBox

**0.11.5 beta · A compact After Effects panel for tracking, 3D stamping, Plates, proxies, asset reload and AEP versioning.**

VFX ToolBox groups six everyday VFX actions into a responsive two-row ScriptUI panel. It is designed to keep artists inside After Effects, organize generated assets automatically and avoid replacing existing files.

## Highlights

- **Tracker** — launch 3D Camera Tracker or Motion Tracker on footage, image sequences and precomps. Motion Tracker also creates sequential `TRACKER_01`, `TRACKER_02` nulls inside an **Assets** folder.
- **Stamp 3D** — capture the current frame, convert it to PSD without opening Photoshop and project it back onto the selected 3D plane. It uses After Effects' direct frame API instead of the Render Queue.
- **Save Frame** — create sequential Plates at the playhead. Save Plate supports full frames and transparent masked layers; Save Unstretched expands a cut object to the composition edges, then reimports it with Corner Pin restoring its original placement.
- **Save AEP** — open Save As for a new project or create the next non-destructive `_V1`, `_V2`, `_V3` project version.
- **Generate Proxy** — create either a same-resolution 50 Mbps H.265 Play Proxy or a ProRes 422 Proxy Work Proxy capped at 1080 pixels high.
- **Reload Textures** — force every file-based imported asset to reload while preserving the current Project-panel selection.

## Proxy workflows

**Play Proxy - Same Res | H265** creates an MP4 with AAC audio and assigns it through After Effects' native proxy system.

**Work Proxy - Low Res | QTProxy** creates a ProRes Proxy MOV with PCM audio. It is imported as ordinary footage—not assigned as a native proxy—and VFX ToolBox creates and opens a matching precomp for immediate editing.

Footage proxies are stored beside their original media. Composition proxies are stored beside the saved AEP and use the project name. Both begin at `Name_PROXY_V1` and increment without overwriting earlier files.

## Plate and color handling

- Full-frame Plates are flattened PSD files matching the project's 8, 16 or 32 bits per channel.
- Transparent masked and unstretched Plates use full-composition PNG at 8 or 16 bpc.
- Stamp 3D supports 8/16 bpc and converts its validated temporary PNG to PSD headlessly on macOS.
- Generated assets are imported into organized **Plates**, **Proxies** and **Assets** folders.
- Direct PNG capture does not embed an ICC profile. VFX ToolBox records the project working-space name in the imported footage comment; color-critical results should still be verified in After Effects.

## Installation

1. Copy `VFX_ToolBox.jsx` into After Effects' `Scripts/ScriptUI Panels` folder.
2. Restart After Effects and open **Window > VFX ToolBox**.
3. Enable **Allow Scripts to Write Files and Access Network** under **Preferences > Scripting & Expressions**.

## Requirements and current limits

- After Effects 2026; macOS is currently required for headless PSD conversion and proxy generation.
- FFmpeg and ffprobe are required for Play and Work Proxy generation.
- Adobe color-managed/ICC projects are supported; OCIO/ACES is currently blocked.
- Stamp 3D requires a square-pixel composition and an unlocked visual 3D layer. Its original plane remains hidden as the projected texture's transform parent.
- Masked and unstretched PNG workflows are unavailable in 32-bpc projects.
- Generated images are flattened stills, not layered PSD documents.

## Attribution and license

VFX ToolBox is an independent custom modernization of the workflow in **AE-3DPlaneStamp v1.7**, originally credited to **Nate Lovell / NT Productions and Hashi**. It is not their official Version 2 and does not imply endorsement.

Original VFX ToolBox contributions are released under the [MIT License](LICENSE), copyright © 2026 Moosh Massacre. Portions derived from or attributable to AE-3DPlaneStamp v1.7 remain subject to the rights of their respective authors; see [NOTICE.md](NOTICE.md).

## Verification

Run the included checks with `node verify.cjs`. They validate file structures, sequential naming, output selection and workflow safeguards, but do not replace host testing inside After Effects.
