# Design System Strategy: Precision Utility

## 1. Overview & Creative North Star
This design system is built for the power user—the digital archivist who demands high information density without sacrificing visual soul. Moving away from the "clunky" legacy of traditional audio taggers, our Creative North Star is **"The Precision Vault."** 

We are creating an environment that feels like a high-end technical instrument (think Leica cameras or Swiss laboratory equipment). The layout is intentionally dense to support professional workflows, but it maintains an "Editorial Utilitarian" feel. We achieve this by rejecting the standard grid of lines and boxes, instead using sophisticated tonal layering, intentional asymmetry in information grouping, and a focus on "Quiet UI" that only speaks when it needs to.

## 2. Colors & Tonal Architecture
The palette is a sophisticated range of neutral grays and crisp whites, accented by a deep, professional blue. This is not just a "light mode"—it is a study in monochromatic depth.

### The "No-Line" Rule
To elevate this system above generic desktop apps, **1px solid borders for sectioning are strictly prohibited.** Do not use a border to separate the sidebar from the main content. Instead:
- **Surface Transitions:** Define boundaries through background shifts. For example, a `surface-container-low` sidebar sitting next to a `surface-container-lowest` content area creates a natural, sharp boundary that feels premium.
- **Tonal Contrast:** Use the `outline-variant` (#9cb3da) only for interactive element boundaries (inputs), never for structural layout.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested, physical layers. 
1.  **Level 0 (Base):** `surface` (#f9f9ff) – The global background.
2.  **Level 1 (Sidebar/Navigation):** `surface-container-low` (#f0f3ff) – Recessed, steady.
3.  **Level 2 (Main Workspace):** `surface-container-lowest` (#ffffff) – The active "canvas" for data.
4.  **Level 3 (Interactive Overlays):** `surface-bright` (#f9f9ff) with a glassmorphism effect.

### Signature Textures
For primary actions (CTAs), do not use a flat fill. Use a subtle vertical gradient transitioning from `primary` (#005db5) to `primary_dim` (#0052a0). This provides a "machined" feel that implies weight and importance.

## 3. Typography: The Editorial Scale
We utilize **Inter Variable** to bridge the gap between technical data and high-end design.

*   **Data Density (The Workhorse):** Use `label-md` (12px) and `label-sm` (11px) for table data and sidebar attributes. To maintain legibility at these small scales, set the letter-spacing to `-0.01em` and use the Medium weight for labels.
*   **The Editorial Anchor:** Use `headline-sm` (1.5rem) for album titles or section headers. This intentional jump in scale breaks the "spreadsheet" monotony and provides a clear entry point for the eye.
*   **Functional Hierarchy:** `title-sm` (1rem) should be reserved for sidebar group headers (e.g., "METADATA", "FILESYSTEM"), always in uppercase with `0.05em` letter-spacing to command authority.

## 4. Elevation & Depth
In "The Precision Vault," depth is achieved through **Tonal Layering** rather than structural shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on top of a `surface-container-low` background to create a "lift" that is felt, not seen. 
*   **Ambient Shadows:** For floating elements (menus, tooltips), use an ultra-diffused shadow: `box-shadow: 0 4px 20px rgba(27, 51, 83, 0.06)`. The shadow color is derived from `on-surface` (#1b3353) to ensure it feels like a natural part of the atmosphere.
*   **The Ghost Border:** For input fields, use the `outline-variant` token at **20% opacity**. This provides enough affordance for the hit area without cluttering the high-density layout with dark lines.
*   **Glassmorphism:** Use `backdrop-filter: blur(8px)` on floating toolbars using a semi-transparent `surface-container-highest`. This allows the colors of the audio waveform or album art to subtly bleed through, softening the utilitarian edge.

## 5. Components

### Tables & Data Grids
*   **No Horizontal Dividers:** Instead of lines, use a alternating row fill using `surface-container-lowest` and `surface-container-low`. 
*   **Selection State:** Use `primary_container` (#d6e3ff) for selected rows, with `on_primary_container` (#00519e) for text.
*   **Header:** `surface-container-high` (#dee8ff) with a bold `label-sm` font.

### Inputs & Fields
*   **Styling:** Minimal padding (`spacing.2` vertical, `spacing.3` horizontal). 
*   **Focus State:** A 2px solid ring of `primary` (#005db5) with a 2px offset to ensure the focus is "loud" against the "quiet" UI.
*   **Compactness:** Utilize `sm` (0.125rem) or `DEFAULT` (0.25rem) corner radii to maintain a sharp, technical aesthetic.

### Buttons
*   **Primary:** Gradient fill (Primary to Primary Dim), `on_primary` text, `DEFAULT` roundedness.
*   **Tertiary (Ghost):** No border. Use `on_surface_variant` (#4a6083) text that shifts to `primary` on hover. This keeps the interface clean when many actions are present.

### Audio Waveform / Metadata Strip
A custom component for this system. Use a `surface-container-highest` background with a subtle inner shadow to look "recessed" into the interface, housing the waveform and high-priority tags (Year, Genre) in `label-sm`.

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a separator. Use `spacing.4` (0.9rem) between logical groups instead of a divider line.
*   **DO** keep icons thin. Use 1.5px stroke weights to match the precision of the Inter Variable typeface.
*   **DO** lean into high-contrast text. Use `on_surface` (#1b3353) for primary data and `on_surface_variant` (#4a6083) for secondary metadata.

### Don't
*   **DON'T** use 100% black for any element. It breaks the sophisticated tonal range of the grays.
*   **DON'T** use large corner radii. Anything above `md` (0.375rem) will make the tool look like a consumer toy rather than a professional editor.
*   **DON'T** crowd the sidebar. While the main content is high-density, the sidebar should use `spacing.5` padding to provide a "breathing room" anchor for the user.