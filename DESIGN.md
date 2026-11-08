---
name: Nidomark
description: Material 3 bookmark organizer for Chrome that draws its proposed folder tree as a node canvas to check before anything is applied.
colors:
  primary: "#006a62"
  on-primary: "#ffffff"
  primary-container: "#9ef2e6"
  on-primary-container: "#00201d"
  secondary-container: "#cce8e3"
  on-secondary-container: "#051f1c"
  tertiary: "#775a00"
  tertiary-container: "#ffdf9e"
  on-tertiary-container: "#261a00"
  surface: "#f5faf8"
  surface-lowest: "#ffffff"
  surface-low: "#eff5f3"
  surface-container: "#e9efed"
  surface-high: "#e3eae8"
  surface-highest: "#dde4e2"
  on-surface: "#171d1c"
  on-surface-variant: "#3f4947"
  outline: "#6f7977"
  outline-variant: "#bec9c6"
  dot: "#cdd7d4"
  node: "#ffffff"
  scrim: "rgba(0, 0, 0, 0.32)"
  primary-dark: "#82d5ca"
  on-primary-dark: "#003732"
  primary-container-dark: "#005049"
  on-primary-container-dark: "#9ef2e6"
  secondary-container-dark: "#324b47"
  on-secondary-container-dark: "#cce8e3"
  tertiary-dark: "#ecc248"
  tertiary-container-dark: "#5a4300"
  on-tertiary-container-dark: "#ffdf9e"
  surface-dark: "#0e1514"
  surface-lowest-dark: "#090f0e"
  surface-low-dark: "#161d1c"
  surface-container-dark: "#1a2120"
  surface-high-dark: "#252b2a"
  surface-highest-dark: "#2f3635"
  on-surface-dark: "#dde4e2"
  on-surface-variant-dark: "#bec9c6"
  outline-dark: "#899390"
  outline-variant-dark: "#3f4947"
  dot-dark: "#2a3432"
  node-dark: "#252b2a"
typography:
  display-small:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: "2.75rem"
    letterSpacing: "-0.01em"
  headline-medium:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: "2.25rem"
    letterSpacing: "-0.01em"
  title-large:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  title-medium:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: "1.5rem"
  title-small:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  body-large:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  body-medium:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-small:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    letterSpacing: "0.01em"
  label-large:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "0.01em"
  label-medium:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  label-small:
    fontFamily: "'Google Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.03em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "28px"
  pill: "20px"
  pill-lg: "28px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
  page: "64px"
components:
  app-bar:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title-large}"
    height: "64px"
    padding: "0 16px 0 20px"
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 24px"
  button-filled-large:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-medium}"
    rounded: "{rounded.pill-lg}"
    height: "56px"
    padding: "0 28px"
  button-tonal:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 24px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 24px"
  button-text:
    textColor: "{colors.primary}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 12px"
  icon-button:
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.pill}"
    size: "40px"
  segmented-button:
    textColor: "{colors.on-surface}"
    typography: "{typography.title-small}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  segmented-button-selected:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
  switch:
    backgroundColor: "{colors.surface-highest}"
    rounded: "16px"
    width: "52px"
    height: "32px"
  switch-checked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px 0 10px"
  chip-icon-only:
    backgroundColor: "{colors.surface-container}"
    padding: "0 7px"
  tag-new:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    typography: "{typography.label-small}"
    rounded: "6px"
    height: "20px"
    padding: "0 8px"
  workspace:
    backgroundColor: "{colors.surface-lowest}"
    rounded: "{rounded.xl}"
  canvas:
    backgroundColor: "{colors.surface}"
    padding: "32px"
  source-node:
    backgroundColor: "{colors.node}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title-medium}"
    rounded: "{rounded.lg}"
    padding: "16px"
  folder-node:
    backgroundColor: "{colors.node}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title-small}"
    rounded: "{rounded.lg}"
    height: "56px"
    padding: "7px 16px 7px 8px"
  folder-tile:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.md}"
    size: "40px"
  folder-tile-to-check:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
  folder-tile-stays:
    backgroundColor: "{colors.surface-high}"
    textColor: "{colors.on-surface-variant}"
  add-folder-node:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.title-small}"
    rounded: "{rounded.lg}"
    height: "56px"
    padding: "7px 16px 7px 8px"
  side-sheet:
    backgroundColor: "{colors.surface-lowest}"
    textColor: "{colors.on-surface}"
    width: "400px"
  sheet-header-tile:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "14px"
    size: "48px"
  sheet-row:
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.md}"
    height: "64px"
    padding: "8px 4px 8px 16px"
  sheet-row-hover:
    backgroundColor: "{colors.surface-low}"
  menu:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "8px 0"
  menu-item:
    typography: "{typography.body-medium}"
    height: "48px"
    padding: "0 16px"
  menu-item-current:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
  dialog:
    backgroundColor: "{colors.surface-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xxl}"
    padding: "24px"
    width: "360px"
  text-field:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-large}"
    rounded: "{rounded.xs}"
    height: "56px"
    padding: "0 16px"
  action-bar:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-medium}"
    padding: "12px 16px 12px 24px"
  status-banner:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    padding: "8px 12px 8px 24px"
  notice-banner:
    backgroundColor: "{colors.surface-lowest}"
    rounded: "{rounded.lg}"
    padding: "12px 12px 12px 16px"
  list-card:
    backgroundColor: "{colors.surface-lowest}"
    rounded: "{rounded.lg}"
  list-item:
    height: "72px"
    padding: "12px 16px 12px 20px"
  progress-track:
    backgroundColor: "{colors.secondary-container}"
    rounded: "2px"
    height: "4px"
    width: "360px"
  progress-indicator:
    backgroundColor: "{colors.primary}"
    rounded: "2px"
    height: "4px"
---

# Design System: Nidomark

## Overview

**Creative North Star: "The Moving Plan"**

Nidomark's screens read like the plan a mover draws before the truck arrives: every bookmark is shown on its way to a labelled folder, line weights say how much travels where, and nothing leaves its shelf until the user signs at the bottom of the page. The visual language is Google's Material 3 taken at face value (tonal color roles, Google Sans, Material Symbols Rounded, pill-shaped buttons, a three-step soft elevation scale), so the extension feels like part of Chrome rather than a guest in it, light or dark as the browser decides.

The personality is spent in one place, the review canvas: a single source card on a dotted floor, curves fanning out to a column of folder cards, each curve as heavy as the number of bookmarks it carries, drawn in once when the proposal arrives. Around it the chrome stays quiet at a comfortable Material density (40px controls, 56px folder cards, 64px sheet rows), with one teal for acting and choosing and one amber for whatever deserves a second look.

Reassurance is part of the visual system rather than a message: the toolbar docked under the canvas says that nothing has changed yet at every width, and the Apply button states how many changes it will make. Settings and the analysis progress screen follow the same tokens; they are recorded here from code and have no reference screenshots yet.

**Key Characteristics:**
- Material 3 color roles with a light and a dark value each, switched by `prefers-color-scheme`.
- Tonal layering builds the structure; shadows appear only as a response or for overlays.
- One family, Google Sans, in two weights (400 and 500) on the Material type scale.
- Pill buttons, 16px cards and nodes, 12px tiles, 8px chips.
- A node canvas whose connector weight encodes bookmark counts.
- Drag and drop with lit targets, always paired with a menu path.

## Colors

Material 3 color roles: a teal primary family, a sage secondary container, an amber tertiary and green-grey neutral surfaces. Every role has a light value and a `-dark` twin, applied through `prefers-color-scheme` with `color-scheme: light dark`; the component tokens name the light role and resolve to its twin in dark.

### Primary
- **Lagoon Teal** (`primary` #006a62, dark #82d5ca): the action and selection color. Filled buttons; the labels of text and outlined buttons; the add-folder node; focus rings; the progress indicator; the completion icon; checkboxes (through `accent-color`); the checked switch; the open node's border and its connector; every drop-target highlight. In Settings it also colors the group headings and the status line.
- **On Teal** (`on-primary` #ffffff, dark #003732): labels and icons on filled teal; the thumb of a checked switch.
- **Mint Glass** (`primary-container` #9ef2e6, dark #005049) with **Teal Ink** (`on-primary-container` #00201d, dark #9ef2e6): the text selection highlight, nothing else.

### Secondary
- **Sage Mist** (`secondary-container` #cce8e3, dark #324b47) with **Pine Ink** (`on-secondary-container` #051f1c, dark #cce8e3): the quiet fill for chosen-but-secondary things: tonal buttons, the selected segment, the current menu item, the folder tile behind an emoji or folder icon, and the progress track.

### Tertiary
- **Honey Amber** (`tertiary` #775a00, dark #ecc248): the To-check connector (70% opacity at rest, full on hover or when open) and warning icons in notice banners.
- **Pale Honey** (`tertiary-container` #ffdf9e, dark #5a4300) with **Umber Ink** (`on-tertiary-container` #261a00, dark #ffdf9e): the "New" tag on proposed folders, the To-check tile, and the banner shown when bookmarks changed during a review.

### Neutral
- **Paper White** (`surface-lowest` #ffffff, dark #090f0e): the review workspace, the side sheet, list cards and start-screen panels.
- **Canvas Mist** (`surface` #f5faf8, dark #0e1514): the canvas floor under the nodes.
- **Grid Dot** (`dot` #cdd7d4, dark #2a3432): the 1px dots of the canvas grid.
- **Page Tint** (`surface-low` #eff5f3, dark #161d1c): the page ground and the app bar; the hover fill of sheet rows and folder-picker rows.
- **Toolbar Tint** (`surface-container` #e9efed, dark #1a2120): the docked action bar, menus, and the pressed icon-only chip.
- **Seam Tint** (`surface-high` #e3eae8, dark #252b2a): 1px seams inside the workspace and list cards, the Stays tile, the dialog.
- **Track Grey** (`surface-highest` #dde4e2, dark #2f3635): the unchecked switch track.
- **Node Card** (`node` #ffffff, dark #252b2a): the fill of every node. It aliases `surface-lowest` in light and `surface-high` in dark, so nodes read as raised cards in both themes.
- **Graphite** (`on-surface` #171d1c, dark #dde4e2): main text, including the per-bookmark reason lines.
- **Slate** (`on-surface-variant` #3f4947, dark #bec9c6): secondary text, meta lines, counts, icon buttons, the trust line.
- **Pewter Line** (`outline` #6f7977, dark #899390): edges of controls and fields (outlined and segmented buttons, text fields, the switch track), node ports, the dashed add-folder node.
- **Mist Line** (`outline-variant` #bec9c6, dark #3f4947): node and chip borders, connectors at rest, favicon rings, menu dividers, the dashed empty-folder zone, scrollbar thumbs.
- **Scrim** (`scrim` rgba(0, 0, 0, 0.32), both themes): the dialog backdrop.

The stylesheet also declares an error role that no shipped surface applies yet; it stays out of this palette until a screen uses it.

### Named Rules
**The Two Signals Rule.** Teal says act, choose or focus; amber says look again (To check, New, caution). No other hue belongs to the interface: folder emoji and site favicons are content, not palette.

**The Raised Node Rule.** A node always sits one tonal step above the canvas: white over the mist floor in light, `surface-high` over the near-black floor in dark. Never fill a node with the canvas color, and never with `surface-lowest` in dark.

**The Seam and Edge Rule.** Seams between sections and between list rows are 1px `surface-high`. Stronger edges belong to objects: `outline-variant` around nodes and chips, `outline` around outlined controls, fields and the switch.

## Typography

**Display Font:** Google Sans (self-hosted WOFF2 in latin and latin-ext subsets, declared for weights 400 to 700, SIL Open Font License 1.1), falling back to system-ui, -apple-system, Segoe UI, Roboto, sans-serif
**Body Font:** Google Sans, same stack

The stack ends with Apple Color Emoji, Segoe UI Emoji and Noto Color Emoji, because folder emoji render through it.

**Character:** One geometric family carries everything from the 36px screen heading to the 11px tag. Hierarchy comes from size and weight on the Material type scale, within that single family.

### Hierarchy
- **Display small** (400, 2.25rem / 2.75rem, -0.01em, balanced wrapping): the one heading of each centered screen (start, progress, done, empty, error).
- **Headline medium** (400, 1.75rem / 2.25rem, -0.01em): the Settings page title.
- **Title large** (400, 1.375rem / 1.75rem): the side-sheet title and the editable name of a new folder, the dialog title, the app-bar wordmark.
- **Title medium** (500, 1rem / 1.5rem): the source node's name, node counts (with tabular figures), and the large button's label (set on a 1.25rem line).
- **Title small** (500, 0.875rem / 1.25rem): folder node names, the add-folder label, segmented-button labels.
- **Body large** (400, 1rem / 1.5rem): the lead paragraph under a screen heading (at most 44ch, pretty wrapping); text typed in the dialog field.
- **Body medium** (400, 0.875rem / 1.25rem): the base size: sheet rows, menu items, Settings rows and their supporting text, the trust line.
- **Body small** (400, 0.75rem / 1rem, 0.01em): hints, the privacy note, the bookmarks-bar label, and the supporting lines of start-screen rows and banners. Node meta lines and the host and reason lines of sheet rows use the same size without the tracking.
- **Label large** (500, 0.875rem / 1.25rem, 0.01em): button labels.
- **Label medium** (500, 0.75rem / 1rem): menu headers and Settings group headings.
- **Label small** (500, 0.6875rem / 1rem, 0.03em): the "New" tag.

### Named Rules
**The Two Weights Rule.** Regular (400) for reading and for headings, Medium (500) for names, counts and actions. Headings grow in size, not in weight.

## Layout

- **Page frame.** A sticky 64px app bar on the `surface-low` page ground, with no divider and no shadow; content sits below it.
- **Centered screens** (start, progress, done, empty, error): one 560px column starting 12vh from the top, 24px between items, centered text; the lead paragraph stops at 44ch.
- **Settings** (recorded from code): one 720px column of grouped list cards 24px apart; 72px rows divided by 1px seams; nested folders in the source picker indent 20px per level, up to six levels.
- **Review workspace.** One rounded panel inset 16px from the window sides and bottom. It holds the board and, while a node is open, a 400px side-sheet column. The board stacks an optional caution banner, the bookmarks-bar strip, the scrolling canvas and the docked action bar.
- **Canvas grid.** Three tracks centered on the dotted floor: source (168 to 260px), connector gutter (48 to 320px) and destinations (300 to 400px), with 32px padding. Destination nodes stack with 8px gaps. The floor's dots are 1px on a 20px pitch.

**Spacing rhythm.** A 4px base, used as 4, 8, 12, 16, 20, 24, 32 and 64px. 20px is the text inset of the app bar, list rows and the side sheet; 24px separates stacked blocks and pads the dialog; folder nodes take 7px of vertical padding so that, with their 1px border, a 40px tile lands on a 56px card.

**Responsive behavior.**
- At 1100px and below, the bookmarks-bar hint is dropped.
- From 1024px up, the side sheet docks as a second column. At 1023px and below it becomes an overlay under the app bar, min(400px, 100vw) wide, at elevation level 3.
- At 760px and below, the workspace runs edge to edge without corner radius; the canvas collapses to one stacked column with no connectors and no ports; the folder-name style switch leaves the app bar (it stays in Settings); the trust line takes its own row above the buttons.

### Named Rules
**The Names Before Pictures Rule.** When the destinations column narrows, the favicon preview gives up room first: three icons, then two below a 400px column, then none below 340px. A folder name may truncate only after that.

**The Docked Toolbar Rule.** The apply toolbar is the last row of the board, never a bar floating over the canvas. Its trust line stays visible at every width, and the Apply button carries the change count.

## Elevation & Depth

Hybrid, tonal first. Structure comes from stacked surface roles: the `surface-low` page ground, the `surface-lowest` workspace, the `surface` canvas, `node` cards, `surface-container` for the toolbar and menus, `surface-high` for the dialog. The three Material shadows are kept for a response to the pointer, an open menu or a valid drop, and modal layers. Selection is drawn with color, not lift.

### Shadow Vocabulary
- **Level 1** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15)`): hover on filled buttons, folder nodes and the sheet's folder tile; the notice banner at rest, the one elevated card.
- **Level 2** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)`): menus and the emoji picker; the folder node under a dragged bookmark.
- **Level 3** (`box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)`): the dialog; the side sheet when it overlays the board below 1024px.
- **Selection ring** (`box-shadow: 0 0 0 1px` in `primary`, over a 1px `primary` border): the open node; the drop target adds Level 2 to it.
- **Focus ring** (`outline: 2px solid` in `primary`, `outline-offset: 2px`): every focusable element; drawn 3px inside the segmented button.
- **Favicon ring** (`box-shadow: 0 0 0 2px` in the card color, then `0 0 0 3px` in `outline-variant`): the cut-out that separates overlapping favicons.

### Named Rules
**The Lift Is a Response Rule.** Nodes, list cards, the workspace and the docked sheet are flat at rest; a shadow appears because the pointer is there, a menu opened, a drop is possible, or a layer is modal.

## Shapes

Every corner is rounded on the Material shape scale, and the shape says what the element is.

- **Pills.** Buttons, icon buttons, segmented buttons, emoji cells and the switch: the radius is half the height (20px at 40px, 28px at 56px, 16px for the 32px switch).
- **Rounded rectangles.** 16px for nodes, list cards, notice banners and the empty drop zone; 12px for 40px folder tiles, sheet rows and menus, and 14px for the 48px tile in the sheet header; 8px for chips and inline fields; 6px for the tag; 4px for the outlined text field and 16px favicons.
- **Frames.** 24px for the review workspace, 28px for the dialog.
- **Circles.** Favicons in a stack, node ports (10px with a 2px edge), the switch thumb.
- **Lines.** Borders are 1px. Connectors are cubic Bézier curves with horizontal tangents at both ports and round caps.

### Named Rules
**The Pill Is for Buttons Rule.** Only buttons and switches are pills. Nodes and chips are clickable too, but keep rectangular corners so they read as objects rather than commands.

**The Dashed Means Not Yet Rule.** A dashed stroke marks an empty slot or a bookmark that does not move: the add-folder node, the empty-folder drop zone, the Stays connector (4px dash, 6px gap). It never decorates a filled container.

## Components

### Buttons
- **Shape:** full pill (20px on the 40px button, 28px on the 56px large button).
- **Filled:** `primary` fill with an `on-primary` label, 24px side padding (28px on the large start-screen button). The single most important action of a screen or dialog: Analyze, Apply, Finish, Create, Retry.
- **Tonal:** `secondary-container` fill for secondary confirmations: undo an interrupted sort, create a declined folder, confirm a custom emoji.
- **Outlined:** a 1px `outline` edge and a teal label, for alternatives such as Undo on the done screen and the data actions in Settings.
- **Text:** a teal label with 12px side padding: Reject all, Cancel, Don't create, Refresh.
- **Icon buttons:** 40px circles in `on-surface-variant`: close, settings, back, move.
- **Hover / Pressed:** a state layer in the label color at 8% on hover and 12% when pressed, faded over 150ms on the standard curve; filled buttons also lift to Level 1. Focus shows the teal ring.
- **Disabled:** the label drops to 38% `on-surface`; a filled button's fill becomes 12% `on-surface`.
- **Icons:** a leading 18px symbol (24px on the large button) that pulls the leading padding in by 8px.

### Segmented button
- The folder-name style picker (emoji and name, name only, emoji only): a 40px pill with a 1px `outline` edge and 1px dividers. The selected segment fills with `secondary-container` and shows an 18px check. It sits in the app bar on the review screen (hidden at 760px and below) and in Settings.

### Switch
- The Material switch, 52 by 32px. Off: `surface-highest` track with a 2px `outline` edge and a 16px `outline` thumb. On: `primary` track with a 24px `on-primary` thumb. The thumb travels and grows over 200ms on the emphasized curve. Built on a native checkbox with `role="switch"`.

### Chips
- **Bookmarks-bar chip:** 32px tall, 8px corners, a 1px `outline-variant` edge, a 16px favicon and a name truncated at 200px; hover adds an 8% `on-surface` layer.
- **Icon-only state** (`aria-pressed="true"`): the name and the edge disappear and the chip fills with `surface-container`.
- **Folder chips** in the same strip are static: folder icon and name, no hover.
- **"New" tag:** 20px tall, 6px corners, `tertiary-container`, label small; only on proposed folders.

### Cards / Containers
- **Corner Style:** 16px for nodes, list cards and notice banners.
- **Background:** `surface-lowest` on the page ground; `node` on the canvas.
- **Shadow Strategy:** flat at rest; the notice banner of the start and done screens is the one elevated card (Level 1). See Elevation & Depth.
- **Border:** nodes and chips have a 1px `outline-variant` edge; list cards have none and divide their rows with 1px `surface-high` seams.
- **Internal Padding:** 16px in the source node; 7px 16px 7px 8px in folder nodes; 12px 16px 12px 20px in 72px list rows; 12px 12px 12px 16px in notice banners.

### Inputs / Fields
- **Outlined text field** (new-folder dialog): 56px tall, 4px corners, a 1px `outline` edge, body large, 16px side padding.
- **Focus:** the edge thickens to 2px `primary` and the padding drops to 15px so the text does not move.
- **Inline rename** (a new folder's name in the sheet header): title large, borderless at rest, an `outline-variant` edge on hover, a `primary` edge plus a 1px inset ring on focus.
- **Custom emoji field:** 40px tall, 8px corners, a 1px `outline` edge.
- **Checkboxes:** native, tinted by `accent-color`; 18px in the folder picker.

### Navigation
- **App bar:** 64px and sticky, on the page ground with no divider or shadow. The 32px app icon and the wordmark (title large) lead; the folder-name segmented button (review screen only) and a settings icon button trail. Settings swaps the settings button for a leading back arrow.

### Menus and dialog
- **Menu:** a top-layer popover anchored 4px below its trigger (above it when there is no room): `surface-container`, 12px corners, Level 2, 8px vertical padding, 220 to 320px wide, scrolling past min(420px, 70vh). Items are 48px tall with a 24px icon or emoji slot; the current item fills with `secondary-container`; the header uses label medium in `on-surface-variant`; dividers are 1px `outline-variant`. Arrow keys move between items.
- **Emoji picker:** the same menu with an 8-column grid of 40px round cells and a custom-emoji row.
- **Dialog:** up to 360px wide, 28px corners, `surface-high`, Level 3, 24px padding, over the `scrim`; actions sit right-aligned (text Cancel, filled Create).

### Start screen
- **Order:** heading and lead, the scope card, the options card, the large filled Analyze button carrying the number of bookmarks, then the privacy promise. Notice banners (last sort, interrupted sort) come first when present. The column starts 6vh from the top with 20px between blocks.
- **Scope card:** a list card of the root folders (bookmarks bar, other bookmarks, mobile) as 56px rows: an 18px native checkbox, the name in body medium (the bookmarks bar adds a body-small hint that its shortcuts stay), the count in title small with tabular figures in `on-surface-variant`, and a 40px chevron icon button that unfolds the first-level folders as 48px rows indented to 54px. The card scrolls past min(46vh, 440px).
- **Options card:** 64px rows with the label on the left and the control on the right: the destination and folder-name segmented buttons, then a disclosure row "More options" whose body-small summary lists what is on; it unfolds switch rows (read sites, dead sites, backup, history), each with a body-small hint. The chevron turns 180° over 200ms. Below 760px the segmented buttons take the full row and drop their check.
- **Privacy promise:** a 24px shield in `on-surface`, a title-small line ("No data leaves this computer") and a body-small explanation, left-aligned in a 46ch block under the button. It is the screen's last word, never a banner.

### Special destinations
- **To check** (amber tile, help icon, solid amber connector), **Duplicates** (`surface-high` tile, copy icon, dotted connector 1px dash and 5px gap) and **Stays** (`surface-high` tile, pin icon, dashed connector) close the destination column, in that order. None of them is a drop target.
- In the To-check sheet and in the dead-sites folder, each row gains an open icon button (a link styled as an icon button, opening the page in a new tab) before the move button.
- The source node is sticky: it stays near the middle of the visible canvas, `max(24px, 50vh - 156px)` from the top, while a long destination column scrolls, and the connectors are redrawn on scroll. Below 760px it is static.

### Side sheet
- A 400px column of `surface-lowest` behind a 1px `surface-high` seam. The header holds a 48px folder tile (a button that opens the emoji picker on folders; a static amber tile for To check, a `surface-high` one for Stays), the title or the rename field, and a close button. Below it come a sub line in `on-surface-variant`, the count with its action on proposed folders, then 64px rows: a 20px favicon, the title, the host, and the reason when it differs from the one most rows share, with a trailing move button that opens the move menu. Rows are draggable (grab cursor; the dragged row fades to 40%). An empty folder shows a dashed drop zone.
- It enters with a 24px slide and a fade over 250ms on the emphasized curve.

### Docked action bar
- The last row of the board: `surface-container` with a 1px `surface-high` top seam, padded 12px 16px 12px 24px. On the left, a 20px info icon and the trust line (plus a sync note while a folder is syncing). On the right, a text button (Reject all, or restore the proposal once everything is rejected) and the filled Apply button with a check icon and the change count. The trust line has a 240px basis and wraps above the buttons when space runs out.

### Banners and progress
- **Caution banner** (bookmarks changed during a review): a full-width strip above the bookmarks bar in `tertiary-container`, with a warning icon and a Refresh text button in the banner's own ink. Apply stays disabled until the refresh.
- **Notice banner** (start and done screens): a `surface-lowest` card at Level 1 with a leading icon (`tertiary` when it warns) and trailing text or tonal buttons.
- **Progress** (recorded from code): a 4px linear bar up to 360px wide, with a `secondary-container` track and a `primary` indicator. Known progress animates its width over 250ms; unknown progress slides a 40% segment across every 1.4s.

### Node canvas (signature)
- **Floor:** `surface` with the `dot` grid.
- **Source node:** up to 260px wide, 16px padding: the source folder's name in title medium, a count line, a stack of up to five 28px favicons, and a port on its right edge.
- **Folder nodes:** 56px cards laid out as tile (40px), name and meta, favicon preview (up to three 24px favicons overlapping by 8px) and count, with a port on the left edge. A proposed folder shows its emoji (or a folder icon) and the New tag; an existing folder shows its path as meta ("Bookmarks bar › Tools"); To check uses the amber tile with a help icon; Stays uses the `surface-high` tile with a pin. A declined folder drops to 60% opacity, its name struck through, and loses its connector.
- **States:** hover lifts a node to Level 1 and turns its connector teal; the open node takes the selection ring and keeps its connector teal.
- **Add-folder node:** the same footprint with a dashed `outline` edge and a teal label behind a plus; hover turns the edge teal and adds an 8% teal wash.
- **Connectors:** one curve from the source port to each folder port, with control points pushed out horizontally by 55% of the gap (at least 48px) and round caps. `outline-variant` at rest, teal when hovered or open, amber for To check, a dashed line for Stays.
- **Drag:** while a bookmark row is dragged, every folder that can take it gets an edge mixed 55% toward teal, a 4% teal wash and a filled teal port; the folder it came from and To check stay unlit. The node under the pointer turns fully teal (edge and ring), takes a 10% teal wash and Level 2. The move menu on every row does the same job from the keyboard.
- **Reduced motion:** connectors appear already drawn, the sheet appears in place, and unknown progress becomes a static full-width bar at 40% opacity.

### Named Rules
**The One Filled Button Rule.** A screen or dialog has at most one filled button; every other action is tonal, outlined or text.

**The Weight Is Data Rule.** A connector's stroke is 1.5px plus 0.5px per bookmark it carries, capped at twelve bookmarks (7.5px). The Stays connector is always 1.5px and dashed.

**The Draw Once Rule.** Connectors draw in once per proposal (700ms on the emphasized curve, 40ms stagger per folder, the dashed Stays line fading in); later redraws after an edit or a resize happen without motion.

## Do's and Don'ts

### Do:
- **Do** take every color from the role tokens, and give any new surface both its light and its `-dark` value.
- **Do** keep teal for actions, selection, focus and progress, and amber for To check, New and caution (The Two Signals Rule).
- **Do** fill nodes with `node`, which resolves to `surface-high` in dark, so they stay raised over the canvas (The Raised Node Rule).
- **Do** keep the apply toolbar docked as the board's last row, with the trust line visible at every width and the change count on the Apply button.
- **Do** let connector weight carry the count (1.5px plus 0.5px per bookmark, 7.5px at most) and draw connectors in only once per proposal.
- **Do** shrink the favicon preview (three, two, none) before a folder name may truncate.
- **Do** pair every drag gesture with a menu or keyboard path, and light only the folders that can accept the drop.
- **Do** honor reduced motion: connectors and the sheet appear without animation, and unknown progress becomes a static bar.
- **Do** set text in Google Sans at 400 or 500 on the Material type scale.
- **Do** draw icons as inline Material Symbols Rounded SVG: 24px by default, 18px in buttons, chips and segments, 20px in the action bar.

### Don't:
- **Don't** float the apply toolbar over the canvas or move the change count out of the Apply button.
- **Don't** use teal or amber as decoration; apart from the Settings group headings and status line, teal text is always something to press.
- **Don't** lift resting nodes, list cards, the workspace or the docked sheet with a shadow; the notice banner is the one elevated card.
- **Don't** put emoji or Unicode symbols in place of Material Symbols for interface actions and states; emoji belong to folder names.
- **Don't** hide the trust line at any width.
- **Don't** draw connectors or ports in the stacked layout at 760px and below.
- **Don't** replay the connector animation after the first draw.
