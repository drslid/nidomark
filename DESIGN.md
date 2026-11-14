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
  inverse-surface: "#2b3231"
  inverse-on-surface: "#ecf2f0"
  inverse-primary: "#82d5ca"
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
  inverse-surface-dark: "#dde4e2"
  inverse-on-surface-dark: "#2b3231"
  inverse-primary-dark: "#006a62"
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
  segmented-button-compact:
    textColor: "{colors.on-surface}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 12px"
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
  suggestion-chip:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.sm}"
    height: "28px"
    padding: "0 10px 0 8px"
  suggestion-chip-alt:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    padding: "0 10px"
  assist-chip:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 12px 0 8px"
  assist-chip-suggest:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
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
  subfolder-node:
    backgroundColor: "{colors.node}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title-small}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "4px 12px 4px 4px"
  fold-button:
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.pill}"
    size: "32px"
  fold-button-sub:
    size: "28px"
  folder-tile:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "{rounded.md}"
    size: "40px"
  folder-tile-to-check:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
  folder-tile-quick-access:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
  folder-tile-duplicates:
    backgroundColor: "{colors.surface-high}"
    textColor: "{colors.on-surface-variant}"
  subfolder-tile:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    rounded: "10px"
    size: "32px"
  add-folder-node:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.title-small}"
    rounded: "{rounded.lg}"
    height: "56px"
    padding: "7px 16px 7px 8px"
  root-label:
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-medium}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
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
  subfolder-row:
    textColor: "{colors.on-surface}"
    typography: "{typography.title-small}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "4px 12px"
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
  menu-item-nested:
    height: "40px"
    padding: "0 16px 0 36px"
  dialog:
    backgroundColor: "{colors.surface-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xxl}"
    padding: "24px"
    width: "400px"
  text-field:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-large}"
    rounded: "{rounded.xs}"
    height: "56px"
    padding: "0 16px"
  select-field:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-large}"
    rounded: "{rounded.xs}"
    height: "56px"
    padding: "0 12px"
  choice-row:
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  choice-row-checked:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
  action-bar:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-medium}"
    padding: "12px 16px 12px 24px"
  snackbar:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.xs}"
    height: "48px"
    padding: "4px 4px 4px 16px"
    width: "560px"
  snackbar-action:
    textColor: "{colors.inverse-primary}"
    typography: "{typography.label-large}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 12px"
  status-banner:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    padding: "8px 12px 8px 24px"
  busy-strip:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.body-medium}"
    padding: "10px 24px"
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

Nidomark's screens read like the plan a mover draws before the truck arrives: every bookmark is shown on its way to a labelled folder of the new tree, line weights say how much travels where, and nothing leaves its shelf until the user signs at the bottom of the page. The visual language is Google's Material 3 taken at face value (tonal color roles, Google Sans, Material Symbols Rounded, pill-shaped buttons, a three-step soft elevation scale), so the extension feels like part of Chrome rather than a guest in it, light or dark as the browser decides.

The personality is spent in one place, the review canvas: a single source card on a dotted floor, curves fanning out to a column of folder cards, each curve as heavy as the number of bookmarks it carries, drawn in once when the proposal arrives, and subfolders hanging under their folder on thin rails like the branches of the plan. Around it the chrome stays quiet at a comfortable Material density (40px controls, 56px folder cards, 44px subfolder cards, 64px sheet rows), with one teal for acting and choosing and one amber for whatever deserves a second look.

Reassurance is part of the visual system rather than a message: the toolbar docked under the canvas says that nothing has changed yet at every width, the Apply button states how many bookmarks it will file, an edit answers in a snackbar that offers to undo it, and the start screen says, right above the Analyze button, that the current tree is kept in a dated backup. The analysis progress screen follows the same tokens; it is recorded here from code and has no reference screenshot yet.

**Key Characteristics:**
- Material 3 color roles with a light and a dark value each, switched by `prefers-color-scheme`.
- Tonal layering builds the structure; shadows appear only as a response or for overlays.
- One family, Google Sans, in two weights (400 and 500) on the Material type scale.
- Pill buttons, 16px cards and nodes, 12px tiles and subfolder cards, 8px chips.
- A node canvas whose connector weight encodes bookmark counts; subfolders hang from their folder on 1px rails.
- Drag and drop of bookmarks and folders with lit targets, always paired with a menu path.
- Every edit reported in a snackbar with Undo.
- Logical properties throughout, so the page mirrors in Arabic.

## Colors

Material 3 color roles: a teal primary family, a sage secondary container, an amber tertiary and green-grey neutral surfaces. Every role has a light value and a `-dark` twin, applied through `prefers-color-scheme` with `color-scheme: light dark`; the component tokens name the light role and resolve to its twin in dark.

### Primary
- **Lagoon Teal** (`primary` #006a62, dark #82d5ca): the action and selection color. Filled buttons; the labels of text and outlined buttons; the add-folder node; focus rings; the progress indicator; the completion icon; checkboxes (through `accent-color`); the checked switch; the icons of the sheet's assist chips; the open node's border and its top-level connector; every drop-target highlight, on cards and root labels alike. In Settings it also colors the group headings and the status line.
- **On Teal** (`on-primary` #ffffff, dark #003732): labels and icons on filled teal; the thumb of a checked switch.
- **Mint Glass** (`primary-container` #9ef2e6, dark #005049) with **Teal Ink** (`on-primary-container` #00201d, dark #9ef2e6): the text selection highlight and the Quick access tile, on the canvas and in the side sheet, nothing else.
- **Lagoon Shallows** (`inverse-primary` #82d5ca, dark #006a62): the snackbar's Undo label, teal turned for the inverse surface, nothing else.

### Secondary
- **Sage Mist** (`secondary-container` #cce8e3, dark #324b47) with **Pine Ink** (`on-secondary-container` #051f1c, dark #cce8e3): the quiet fill for chosen-but-secondary things: tonal buttons, the selected segment, the current menu item, the checked choice in the delete dialog, the folder and subfolder tiles behind an emoji or folder icon, and the progress track. It also fills the busy strip that holds the board while a folder is analysed again; there the progress track is Pine Ink at 16%.

### Tertiary
- **Honey Amber** (`tertiary` #775a00, dark #ecc248): the To-check connector (70% opacity at rest, full on hover or when open), warning icons in notice banners, and, mixed 40% into `outline-variant`, the edge of the alternative suggestion chips.
- **Pale Honey** (`tertiary-container` #ffdf9e, dark #5a4300) with **Umber Ink** (`on-tertiary-container` #261a00, dark #ffdf9e): the first suggestion chip on a bookmark to check, the File all as suggested chip, the To-check tile, and the banner shown when bookmarks changed during a review.

### Neutral
- **Paper White** (`surface-lowest` #ffffff, dark #090f0e): the review workspace, the side sheet, list cards and start-screen panels.
- **Canvas Mist** (`surface` #f5faf8, dark #0e1514): the canvas floor under the nodes.
- **Grid Dot** (`dot` #cdd7d4, dark #2a3432): the 1px dots of the canvas grid.
- **Page Tint** (`surface-low` #eff5f3, dark #161d1c): the page ground and the app bar; the hover fill of sheet rows, subfolder rows, scope rows and the More options row.
- **Toolbar Tint** (`surface-container` #e9efed, dark #1a2120): the docked action bar, menus, and the pressed icon-only chip.
- **Seam Tint** (`surface-high` #e3eae8, dark #252b2a): 1px seams inside the workspace, list cards and the side sheet (above its Subfolders list); the tiles of Duplicates, Removed and No folder, and the sheet's static tile for a folder of an earlier sort; the dialog.
- **Track Grey** (`surface-highest` #dde4e2, dark #2f3635): the unchecked switch track.
- **Node Card** (`node` #ffffff, dark #252b2a): the fill of every node, folder or subfolder. It aliases `surface-lowest` in light and `surface-high` in dark, so nodes read as raised cards in both themes.
- **Graphite** (`on-surface` #171d1c, dark #dde4e2): main text, including the per-bookmark reason lines and the labels of assist chips and alternative suggestions.
- **Slate** (`on-surface-variant` #3f4947, dark #bec9c6): secondary text, meta lines, counts, root labels, the sheet's path line, icon buttons, the trust line.
- **Pewter Line** (`outline` #6f7977, dark #899390): edges of controls and fields (outlined and segmented buttons, text fields and the Location select, the switch track), node ports, the dashed add-folder node.
- **Mist Line** (`outline-variant` #bec9c6, dark #3f4947): node and chip borders, the rails of the folder tree, connectors at rest, favicon rings, menu dividers, the dashed empty-folder zone, scrollbar thumbs.
- **Charcoal Pane** (`inverse-surface` #2b3231, dark #dde4e2) with **Frost Ink** (`inverse-on-surface` #ecf2f0, dark #2b3231): the snackbar, the one surface that inverts the theme, with its message and close icon.
- **Scrim** (`scrim` rgba(0, 0, 0, 0.32), both themes): the dialog backdrop.

The stylesheet also declares an error role that no shipped surface applies yet; it stays out of this palette until a screen uses it.

### Named Rules
**The Two Signals Rule.** Teal says act, choose or focus; amber says look again (To check, suggestions, caution). No other hue belongs to the interface: folder emoji and site favicons are content, not palette.

**The Raised Node Rule.** A node always sits one tonal step above the canvas: white over the mist floor in light, `surface-high` over the near-black floor in dark. Never fill a node with the canvas color, and never with `surface-lowest` in dark.

**The Seam and Edge Rule.** Seams between sections and between list rows are 1px `surface-high`. Stronger edges belong to objects: `outline-variant` around nodes and chips, `outline` around outlined controls, fields and the switch. The rails of the folder tree take the node edge, 1px `outline-variant`, so a subfolder reads as hanging from its folder.

## Typography

**Display Font:** Google Sans (self-hosted WOFF2 in latin, latin-ext, vietnamese, cyrillic, cyrillic-ext, arabic, devanagari and bengali subsets, declared for weights 400 to 700, SIL Open Font License 1.1), falling back to system-ui, -apple-system, Segoe UI, Roboto, sans-serif
**Body Font:** Google Sans, same stack

The stack ends with Apple Color Emoji, Segoe UI Emoji and Noto Color Emoji, because folder emoji render through it. Google Sans covers every script of the interface but Chinese, Japanese and Korean, which fall back to the system faces of the stack, as in Google's own products; each subset carries its own `unicode-range`, so a page only loads the scripts it shows. The page's `lang` carries the full tag of the interface language (zh-TW, pt-BR) so the fallback picks the regional glyph forms, and Arabic sets `dir="rtl"`.

**Character:** One geometric family carries everything from the 36px screen heading to the 12px labels. Hierarchy comes from size and weight on the Material type scale, within that single family.

### Hierarchy
- **Display small** (400, 2.25rem / 2.75rem, -0.01em, balanced wrapping): the one heading of each centered screen (start, progress, done, empty, error).
- **Headline medium** (400, 1.75rem / 2.25rem, -0.01em): the Settings page title.
- **Title large** (400, 1.375rem / 1.75rem): the side-sheet title and the editable name of a folder, the dialog title, the app-bar wordmark.
- **Title medium** (500, 1rem / 1.5rem): the source node's name, the counts of top-level cards (with tabular figures), and the large button's label (set on a 1.25rem line).
- **Title small** (500, 0.875rem / 1.25rem): folder and subfolder card names, subfolder card counts, the add-folder label, segmented-button labels, the names in the sheet's Subfolders rows, the busy strip's title.
- **Body large** (400, 1rem / 1.5rem): the lead paragraph under a screen heading (at most 44ch, pretty wrapping); text in the dialog's name field and Location select.
- **Body medium** (400, 0.875rem / 1.25rem): the base size: sheet rows, menu items, assist chips, the snackbar's message, Settings rows and their supporting text, the trust line.
- **Body small** (400, 0.75rem / 1rem, 0.01em): hints, the privacy note, the bookmarks-bar label, the sheet's path line and Display label, and the supporting lines of start-screen rows, dialog choices and banners. Node meta lines, the host and reason lines of sheet rows and the drop hint of a root label use the same size without the tracking.
- **Label large** (500, 0.875rem / 1.25rem, 0.01em): button labels.
- **Label medium** (500, 0.75rem / 1rem): menu headers and the root labels inside move menus, Settings group headings, the root labels of the destination column, the sheet's Subfolders label, the Location field label and the suggestion chips.

### Named Rules
**The Two Weights Rule.** Regular (400) for reading and for headings, Medium (500) for names, counts and actions. Headings grow in size, not in weight.

## Layout

- **Page frame.** A sticky 64px app bar on the `surface-low` page ground, with no divider and no shadow; content sits below it.
- **Centered screens** (start, progress, done, empty, error): one 560px column starting 12vh from the top, 24px between items, centered text; the lead paragraph stops at 44ch.
- **Settings**: one 720px column of grouped list cards 24px apart; 72px rows divided by 1px seams.
- **Review workspace.** One rounded panel inset 16px from the window sides and bottom. It holds the board and, while a node is open, a 400px side-sheet column. The board stacks an optional caution banner, the busy strip while a folder is analysed again, the bookmarks-bar strip, the scrolling canvas and the docked action bar.
- **Canvas grid.** Three tracks centered on the dotted floor: source (168 to 260px), connector gutter (48 to 320px) and destinations (300 to 400px), with 32px padding. Destination nodes stack with 8px gaps, grouped under 32px root labels that sit 12px further from the group above. The floor's dots are 1px on a 20px pitch.
- **Folder tree.** Subfolders stack 4px apart, starting 4px under their folder. Their column steps in so that its rail drops from the middle of the parent's tile (28px in from a folder card's start edge, 20px from a subfolder card's), and the cards start 16px past the rail; each deeper level nests the same way.

**Spacing rhythm.** A 4px base, used as 4, 8, 12, 16, 20, 24, 32 and 64px. 20px is the text inset of the app bar, list rows and the side sheet; 24px separates stacked blocks and pads the dialog; folder nodes take 7px of vertical padding so that, with their 1px border, a 40px tile lands on a 56px card, and subfolder cards center a 32px tile in 44px. Clusters of chips in the sheet (its tools, a bookmark's suggestions) close up to 6px.

**Responsive behavior.**
- At 1100px and below, the bookmarks-bar hint is dropped.
- From 1024px up, the side sheet docks as a second column. At 1023px and below it becomes an overlay under the app bar, min(400px, 100vw) wide, at elevation level 3.
- At 760px and below, the workspace runs edge to edge without corner radius; the canvas collapses to one stacked column with no connectors and no ports, while the folder tree keeps its rails; the folder-name style switch leaves the app bar (it stays in Settings); the trust line takes its own row above the buttons; the undo icon button leaves the toolbar (the snackbar keeps its Undo) and the two remaining buttons wrap toward the end edge.

**Direction.** Every directional value is a logical property (inline start and end), so the page mirrors in Arabic: the source sits at the inline start and the destinations at the end, ports and connectors swap sides, the side sheet docks on the left and enters from there, the fold chevron and the chevron of subfolder rows point the other way, menus align on their trigger's end edge, and indeterminate progress runs right to left. Four-value paddings in this file read left to right.

### Named Rules
**The Names Before Pictures Rule.** When the destinations column narrows, the favicon preview gives up room first: three icons, then two below a 400px column, then none below 340px. A folder name may truncate only after that.

**The Docked Toolbar Rule.** The apply toolbar is the last row of the board, never a bar floating over the canvas. Its trust line stays visible at every width, and the Apply button carries the number of bookmarks it files. The snackbar is the one thing that floats, 12px above it, and it leaves on its own.

## Elevation & Depth

Hybrid, tonal first. Structure comes from stacked surface roles: the `surface-low` page ground, the `surface-lowest` workspace, the `surface` canvas, `node` cards, `surface-container` for the toolbar and menus, `surface-high` for the dialog, `inverse-surface` for the snackbar. The three Material shadows are kept for a response to the pointer, an open menu or a valid drop, and layers over the board. Selection is drawn with color, not lift.

### Shadow Vocabulary
- **Level 1** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15)`): hover on filled buttons, folder and subfolder cards, the sheet's folder tile, the suggestion chips and the File all as suggested chip; the notice banner at rest, the one elevated card.
- **Level 2** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)`): menus and the emoji picker; the card under a dragged bookmark or folder.
- **Level 3** (`box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)`): the dialog; the side sheet when it overlays the board below 1024px; the snackbar.
- **Selection ring** (`box-shadow: 0 0 0 1px` in `primary`, over a 1px `primary` border): the open card, folder or subfolder; the drop target adds Level 2 to it.
- **Focus ring** (`outline: 2px solid` in `primary`, `outline-offset: 2px`): every focusable element; drawn 3px inside the segmented button.
- **Favicon ring** (`box-shadow: 0 0 0 2px` in the card color, then `0 0 0 3px` in `outline-variant`): the cut-out that separates overlapping favicons.

### Named Rules
**The Lift Is a Response Rule.** Nodes, list cards, the workspace and the docked sheet are flat at rest; a shadow appears because the pointer is there, a menu opened, a drop is possible, or a layer floats over the board (the dialog, the overlaid sheet, the snackbar).

## Shapes

Every corner is rounded on the Material shape scale, and the shape says what the element is.

- **Pills.** Buttons, icon buttons, segmented buttons, emoji cells and the switch: the radius is half the height (20px at 40px, 28px at 56px, 16px for the 32px switch and compact segmented button); the smaller fold chevrons and the snackbar's close button stay round.
- **Rounded rectangles.** 16px for folder nodes, list cards, notice banners and the empty drop zone; 12px for subfolder cards, root labels, 40px folder tiles, sheet rows, subfolder rows, dialog choices and menus, 14px for the 48px tile in the sheet header and 10px for the 32px tiles of subfolders; 8px for chips (bar, assist and suggestion chips) and inline fields; 4px for the outlined text field, the Location select, the snackbar and 16px favicons.
- **Frames.** 24px for the review workspace, 28px for the dialog.
- **Circles.** Favicons in a stack, node ports (10px with a 2px edge), the switch thumb.
- **Lines.** Borders are 1px. Connectors are cubic Bézier curves with horizontal tangents at both ports and round caps. Rails are straight 1px lines with square elbows: a vertical drop from the parent's tile and a 12px step to the middle of each subfolder card, the last one ending at its elbow.

### Named Rules
**The Pill Is for Buttons Rule.** Only buttons and switches are pills. Nodes and chips are clickable too, but keep rectangular corners so they read as objects rather than commands; the sheet's assist chips act, yet keep the chip's 8px corners.

**The Dashed Means Not Yet Rule.** A dashed stroke marks an empty slot or a bookmark that is not recreated: the add-folder node, the empty-folder drop zone, the root labels while a drag is on (an open slot at the top of a root), the dotted Duplicates and Removed connectors (1px dash, 5px gap). It never decorates a filled container.

## Components

### Buttons
- **Shape:** full pill (20px on the 40px button, 28px on the 56px large button).
- **Filled:** `primary` fill with an `on-primary` label, 24px side padding (28px on the large start-screen button). The single most important action of a screen or dialog: Analyze, File the bookmarks, Finish, Create, Discard, Delete, Retry.
- **Tonal:** `secondary-container` fill for secondary confirmations: undo an interrupted sort, confirm a custom emoji.
- **Outlined:** a 1px `outline` edge and a teal label, for alternatives such as Undo on the done screen and the data actions in Settings.
- **Text:** a teal label with 12px side padding: Restore proposal, Cancel, Refresh. On the snackbar, Undo takes the `inverse-primary` label.
- **Icon buttons:** 40px circles in `on-surface-variant`: close, settings, back, undo, a row's more (more_vert) button and its open-link button, the scope card's chevron. The fold chevron of a folder card is 32px (28px on a subfolder card); the snackbar's close is 36px in `inverse-on-surface`.
- **Hover / Pressed:** a state layer in the label color at 8% on hover and 12% when pressed, faded over 150ms on the standard curve; filled buttons also lift to Level 1. Focus shows the teal ring.
- **Disabled:** the label drops to 38% `on-surface`; a filled button's fill becomes 12% `on-surface`.
- **Icons:** a leading 18px symbol (24px on the large button) that pulls the leading padding in by 8px.

### Segmented button
- The folder-name style picker (emoji only, emoji and name, name only), the destination picker and the quick-access picker (none, 5, 10, 20): a 40px pill with a 1px `outline` edge and 1px dividers. The selected segment fills with `secondary-container` and shows an 18px check. The style picker also sits in the app bar on the review screen (hidden at 760px and below), where it sets the default for every folder.
- **Compact** (the side sheet's Display row, one folder's own style): 32px tall, 12px side padding, a 6px gap, 13px labels and a 16px check. The 13px label is the one size off the type scale, taken so the three segments fit beside their Display label in the 400px sheet.

### Switch
- The Material switch, 52 by 32px. Off: `surface-highest` track with a 2px `outline` edge and a 16px `outline` thumb. On: `primary` track with a 24px `on-primary` thumb. The thumb travels and grows over 200ms on the emphasized curve. Built on a native checkbox with `role="switch"`.

### Chips
- **Bookmarks-bar chip:** 32px tall, 8px corners, a 1px `outline-variant` edge, a 16px favicon and a name truncated at 200px; hover adds an 8% `on-surface` layer.
- **Icon-only state** (`aria-pressed="true"`): the name and the edge disappear and the chip fills with `surface-container`.
- **The strip previews the new bar:** quick-access chips first (icon only by default), then the folders created in the bar as chips with a folder icon in `on-surface-variant` and the title Chrome will show (the emoji alone by default); a click opens that folder in the side sheet.
- **Assist chips** (the side sheet's tools): 32px tall, 8px corners, a 1px `outline-variant` edge, an 18px teal icon and an `on-surface` label in body medium, padded 8px before and 12px after, 6px apart and wrapping. A folder of the new tree gets Subfolder (create_new_folder), Move (drive_file_move), Analyze again (refresh) and Delete (delete). To check keeps only File all as suggested (N), filled `tertiary-container` with its sparkle in the chip's ink and lifting to Level 1 on hover, and Analyze again. Duplicates and Removed carry a single Keep all or Restore all chip (restore icon).
- **Suggestion chips:** up to three on a bookmark to check, under its reason, 6px apart and wrapping: 28px tall, 8px corners, the folder's emoji and name in label medium, truncated, with the full path as a tooltip ("Tech › Development", marked new when the folder would be created). The first, the model's best lean, fills with `tertiary-container` behind an 18px sparkle; the others are outlined (transparent, a 1px edge of `tertiary` mixed 40% into `outline-variant`, an `on-surface` label, 10px side padding). Hover lifts a chip to Level 1; a click files the bookmark there.

### Cards / Containers
- **Corner Style:** 16px for folder nodes, list cards and notice banners; 12px for subfolder cards.
- **Background:** `surface-lowest` on the page ground; `node` on the canvas.
- **Shadow Strategy:** flat at rest; the notice banner of the start and done screens is the one elevated card (Level 1). See Elevation & Depth.
- **Border:** nodes and chips have a 1px `outline-variant` edge; list cards have none and divide their rows with 1px `surface-high` seams.
- **Internal Padding:** 16px in the source node; 7px 16px 7px 8px in folder nodes and 4px 12px 4px 4px in subfolder cards, the end padding dropping to 4px when a fold chevron follows the count; 12px 16px 12px 20px in 72px list rows; 12px 12px 12px 16px in notice banners.

### Inputs / Fields
- **Outlined text field** (new-folder dialog): 56px tall, 4px corners, a 1px `outline` edge, body large, 16px side padding.
- **Location select** (under it in the same dialog): the native select drawn as the outlined field, 56px, 4px corners, 12px side padding, body large, labelled above in label medium `on-surface-variant`. It lists Directly in each root, then that root's folders, their depth shown by em-space indents because native options cannot be styled.
- **Focus:** the edge thickens to 2px `primary` and the padding drops by 1px so the text does not move.
- **Inline rename** (a folder's name in the sheet header, title large, 40px tall; a bookmark's title in its row, body medium, in a 32px field opened by a double-click on the title or by Rename in the row menu): borderless at rest, an `outline-variant` edge on hover, a `primary` edge plus a 1px inset ring on focus. Enter saves, Escape cancels.
- **Custom emoji field:** 40px tall, 8px corners, a 1px `outline` edge.
- **Checkboxes and radios:** native, tinted by `accent-color`; 18px in the scope card and in the choices of the delete dialog.

### Navigation
- **App bar:** 64px and sticky, on the page ground with no divider or shadow. The 32px app icon and the wordmark (title large) lead; the folder-name segmented button (review screen only) and a settings icon button trail. Settings swaps the settings button for a leading back arrow; the review screen adds the same arrow, and leaving the review asks first in a dialog.

### Menus and dialog
- **Menu:** a top-layer popover anchored 4px below its trigger (above it when there is no room), its end edge aligned with the trigger's so it mirrors in Arabic: `surface-container`, 12px corners, Level 2, 8px vertical padding, 220 to 320px wide, scrolling past min(420px, 70vh). Items are 48px tall with a 24px icon or emoji slot; the current item fills with `secondary-container`; headers and root labels use label medium in `on-surface-variant`; dividers are 1px `outline-variant`. Arrow keys move between items.
- **Row menu** (a bookmark's more button): Move to… (opens the move menu from the same button), Rename, Icon only as a checkbox item (in Quick access only, where a bookmark can show its icon alone), Keep original title or Use the cleaner title when the proposal retitles it, Open the page, then a divider and Remove. In Duplicates and Removed it offers Keep this copy or Restore, and Open the page.
- **Move menus follow the new tree.** Nested items are 40px tall and step in 20px per level from the 16px inset (36px at level 2, 56px at level 3, up to level 6). The bookmark menu opens with up to three suggestions (sparkle icon) and a divider, then groups every folder under its root label: Quick access in the bar, the folders and subfolders, No folder in other roots; New folder closes it after a divider. The folder menu lists, for each root, a Directly in item (vertical_align_top) followed by every folder outside the one being moved, one step deeper than in the tree; the current place is marked.
- **Emoji picker:** the same menu with an 8-column grid of 40px round cells and a custom-emoji row.
- **Dialog:** up to 400px wide, 28px corners, `surface-high`, Level 3, 24px padding, over the `scrim`; actions sit at the end edge (text Cancel, filled Create, Discard or Delete). New folder holds the name field, then the Location select. Delete folder counts what the folder holds in a muted line, then offers two radio choices as 12px-corner rows (10px 12px padding, a title over a body-small hint, an 8% `on-surface` layer on hover, the checked row filled with `secondary-container`): keep what it holds (the default; it moves up into the folder above) or delete it too (its bookmarks stay in the backup). Cancel takes the focus.

### Start screen
- **Order:** heading and lead, the scope card, the options card, the backup note, the large filled Analyze button carrying the number of bookmarks, then the privacy promise. Notice banners (last sort, interrupted sort) come first when present. The column starts 6vh from the top with 20px between blocks.
- **Scope card:** a list card of the root folders (bookmarks bar, other bookmarks, mobile) as 56px rows: an 18px native checkbox, the name in body medium (the bookmarks bar adds a body-small hint that its shortcuts are included and the most used come back first), the count in title small with tabular figures in `on-surface-variant`, and a 40px chevron icon button that unfolds the first-level folders as 48px rows indented to 54px. The card scrolls past min(46vh, 440px).
- **Options card:** 64px rows with the label at the start and the control at the end: the destination, folder-name and quick-access segmented buttons, then a disclosure row "More options" whose body-small summary lists what is on; it unfolds switch rows (read sites, dead sites, one copy of each page, most visited first), each with a body-small hint. The chevron turns 180° over 200ms. Below 760px the segmented buttons take the full row and drop their check.
- **Backup note:** a body-small line in `on-surface-variant` behind an 18px archive-box icon (inventory_2), in a 46ch block: the current tree is kept as it is in a dated backup, and one click undoes the sort. The backup is not optional, so it is a statement rather than a switch.
- **Privacy promise:** a 24px shield in `on-surface`, a title-small line ("No data leaves this computer") and a body-small explanation, aligned to the start in a 46ch block under the button. It is the screen's last word, never a banner.

### Special destinations
- The destination column is split by root labels: 32px rows in label medium `on-surface-variant` with 12px side padding, 12px corners and a transparent 1px dashed edge, standing 4px wider than the cards on each side, 12px above each group after the first. The roots carry Chrome's own names for them, in the interface language (Bookmarks bar, Other bookmarks); the Not recreated group comes last, before the add-folder node. Each folder sits under the root it will be created in. While a drag is on, the root labels become drop zones (see Node canvas); Not recreated never does.
- **Quick access** (`primary-container` tile, bolt icon) opens the Bookmarks bar group. **To check** (amber tile, help icon, solid amber connector) sits under Other bookmarks, next to Porn and Unreachable sites when they exist. **No folder** (`surface-high` tile, subdirectory_arrow_right icon, meta "Right in the root folder") appears under a root when bookmarks sit right in it. **Not recreated** holds **Duplicates** (copy icon) and **Removed** (delete icon), both on `surface-high` tiles with dotted connectors (1px dash and 5px gap), just above the add-folder node. Duplicates is the only node that is not a drop target; a bookmark dropped on Removed is removed.
- **Folders of an earlier sort** keep their name and place: the meta of a top-level one opens by saying it is already in the bookmarks, the card cannot be dragged, and its sheet shows a static title behind the folder's emoji on a `surface-high` tile, with no Display row and no Move or Delete chip.
- In the To-check sheet and in the dead-sites folder, each row gains an open icon button (a link styled as an icon button, opening the page in a new tab) before the more button.
- The source node is sticky: it stays near the middle of the visible canvas, `max(24px, 50vh - 156px)` from the top, while a long destination column scrolls, and the connectors are redrawn on scroll. Below 760px it is static.

### Side sheet
- A 400px column of `surface-lowest` behind a 1px `surface-high` seam. The header holds a 48px folder tile (a button that opens the emoji picker on folders of the new tree, and on To check, where it is amber; otherwise a static tile in its node's colors: `primary-container` for Quick access, `surface-high` for Duplicates, Removed, No folder and folders of an earlier sort), the title or the rename field, and a close button.
- Under the header, for folders, a path line in body small `on-surface-variant`, cut with an ellipsis: the root, the folders above and the folder itself ("Bookmarks bar › Home › Home automation"). Then a sub line in `on-surface-variant` (the reason most rows share, or what the place is for); for a folder of the new tree, a Display row (a body-small label and the compact segmented button); then the row of assist chips.
- Then 64px rows: a 20px favicon, the title, the host, and the reason when it differs from the one most rows share; rows of To check add their suggestion chips. A trailing more (more_vert) icon button opens the row menu. Rows are draggable (grab cursor; the dragged row fades to 40%). An empty folder shows a dashed drop zone.
- **Subfolders** follow the folder's own rows behind a 1px `surface-high` seam: a Subfolders label in label medium `on-surface-variant`, then 48px rows with 12px corners: a 32px tile (10px corners, the emoji or an 18px folder icon), the name in title small, the count in `on-surface-variant` with tabular figures and an 18px chevron (mirrored in Arabic). A row hovers in `surface-low` and opens that subfolder in the sheet.
- It enters from the inline end with a 24px slide and a fade over 250ms on the emphasized curve. While a folder is analysed again, it is inert.

### Docked action bar
- The last row of the board: `surface-container` with a 1px `surface-high` top seam, padded 12px 16px 12px 24px. At the start, a 20px info icon and the trust line (plus a sync note while a folder is syncing). At the end, an undo icon button once there is an edit to undo (its tooltip names Ctrl+Z), the Restore proposal text button and the filled Apply button with a check icon and the number of bookmarks it files ("File 47 bookmarks"). The trust line has a 240px basis and wraps above the buttons when space runs out. While a folder is analysed again, the three actions are disabled.
- **Snackbar:** after an edit, a Material snackbar says what it did, anchored 12px above the toolbar and centered on the board: at most 560px wide and 16px clear of the board's sides, at least 48px tall, 4px corners, `inverse-surface` with the message in `inverse-on-surface`, an Undo text button in `inverse-primary` and a 36px close icon button, at Level 3. It rises 8px and fades in over 200ms on the emphasized curve, and leaves after 8s, though never while a drag, a menu or a dialog is open (it waits 2s more each time). Ctrl+Z (Cmd+Z) undoes the last edit too, outside text fields, menus and dialogs.

### Banners and progress
- **Caution banner** (bookmarks changed during a review): a full-width strip above the bookmarks bar in `tertiary-container`, with a warning icon and a Refresh text button in the banner's own ink. Apply stays disabled until the refresh.
- **Busy strip** (a folder analysed again): a full-width `secondary-container` strip at the top of the board, after any caution banner, padded 10px 24px: the title ("Analyzing “Tech” again") in title small, then the phase and the count at 80% opacity, all in `on-secondary-container`, and a 4px progress bar up to 240px wide whose track is `on-secondary-container` at 16%. The canvas and the sheet are inert meanwhile.
- **Notice banner** (start and done screens): a `surface-lowest` card at Level 1 with a leading icon (`tertiary` when it warns) and trailing text or tonal buttons.
- **Progress** (recorded from code): a 4px linear bar up to 360px wide, with a `secondary-container` track and a `primary` indicator. Known progress animates its width over 250ms; unknown progress slides a 40% segment across every 1.4s, the other way in Arabic.

### Node canvas (signature)
- **Floor:** `surface` with the `dot` grid.
- **Source node:** up to 260px wide, 16px padding: the source folder's name in title medium, a count line, a stack of up to five 28px favicons, and a port on its inline-end edge.
- **Folder nodes:** 56px cards laid out as tile (40px), name and meta, favicon preview (up to three 24px favicons overlapping by 8px) and count, with a port on the inline-start edge. A folder shows its emoji (or a folder icon, also when its display is set to name only) and, as meta, its subfolders joined by middle dots; its count covers every bookmark inside, subfolders included. Quick access uses the `primary-container` tile with a bolt and the meta "Icons at the start of the bar"; To check uses the amber tile with a help icon; Duplicates, Removed and No folder the `surface-high` tile with their own icon.
- **Fold:** a folder with subfolders ends with a 32px fold chevron (expand_more, 18px) after its count; folded, the chevron turns -90° (90° in Arabic) over 200ms and the subfolders hide. The card body and the chevron are two buttons side by side, and the selection ring is drawn around the whole card.
- **Subfolder cards:** compact 44px cards under their folder: 12px corners, a 32px tile with 10px corners (18px icons), the name and the count in title small, no meta, no favicon preview, no port, and a 28px fold chevron when they hold subfolders in turn. They are indented and joined by 1px `outline-variant` rails: a vertical rail from the middle of the parent's tile and a 12px elbow to the middle of each card, the last child's rail stopping at its elbow.
- **States:** hover lifts a card to Level 1 and, on a top-level card, turns its connector teal; the open card takes the selection ring, and the connector of its top-level folder stays teal.
- **Add-folder node:** the same footprint with a dashed `outline` edge and a teal label behind a plus; hover turns the edge teal and adds an 8% teal wash.
- **Connectors:** one curve from the source port to the port of each top-level card, never to a subfolder, with control points pushed out horizontally by 55% of the gap (at least 48px) and round caps. `outline-variant` at rest, teal when hovered or open, amber for To check, a dotted line for Duplicates and Removed.
- **Drag:** bookmark rows (from the sheet) and folder cards (from the canvas) can be dragged; a folder of an earlier sort stays put. While a drag is on, every place that can take the item lights up: a card gets an edge mixed 55% toward teal, a 4% teal wash and a filled teal port; a root label shows its dashed edge mixed 55% toward teal, turns its label teal and shows "Drop here, at the top" at its end. Cards that cannot take it fade to 55%, and the dragged card or row to 40%. The place under the pointer turns fully teal: a card takes the selection ring, a 10% teal wash and Level 2; a root label turns its edge solid teal over a 10% wash. A folder never goes into itself or below; Duplicates takes nothing; Quick access, No folder and Removed take bookmarks only. The row menu and the folder's Move chip do the same jobs without a pointer.
- **Reduced motion:** connectors appear already drawn, the sheet and the snackbar appear in place, and unknown progress becomes a static full-width bar at 40% opacity.

### Named Rules
**The One Filled Button Rule.** A screen or dialog has at most one filled button; every other action is tonal, outlined or text.

**The Weight Is Data Rule.** A connector's stroke is 1.5px plus 0.5px per bookmark it carries, subfolders included, capped at twelve bookmarks (7.5px). The Duplicates and Removed connectors are always 1.5px and dotted.

**The Draw Once Rule.** Connectors draw in once per proposal (700ms on the emphasized curve, 40ms stagger per folder, the dotted lines fading in); later redraws after an edit, a fold or a resize happen without motion.

## Do's and Don'ts

### Do:
- **Do** take every color from the role tokens, and give any new surface both its light and its `-dark` value.
- **Do** keep teal for actions, selection, focus and progress, and amber for To check, suggestions and caution (The Two Signals Rule).
- **Do** fill nodes with `node`, which resolves to `surface-high` in dark, so they stay raised over the canvas (The Raised Node Rule).
- **Do** keep the apply toolbar docked as the board's last row, with the trust line visible at every width and the bookmark count on the Apply button.
- **Do** let connector weight carry the count (1.5px plus 0.5px per bookmark, 7.5px at most) and draw connectors in only once per proposal.
- **Do** hang subfolders under their folder as 44px cards on 1px `outline-variant` rails, and keep connectors for the top-level cards.
- **Do** shrink the favicon preview (three, two, none) before a folder name may truncate.
- **Do** pair every drag gesture, of a bookmark or of a folder, with a menu path (the row menu, the folder's Move chip), light only the cards and root labels that can accept the drop, and fade the other cards to 55%.
- **Do** report each edit in the snackbar above the toolbar, with its Undo, and keep Ctrl+Z working outside text fields.
- **Do** write every directional value as a logical property, so the page mirrors in Arabic.
- **Do** honor reduced motion: connectors, the sheet and the snackbar appear without animation, and unknown progress becomes a static bar.
- **Do** set text in Google Sans at 400 or 500 on the Material type scale.
- **Do** draw icons as inline Material Symbols Rounded SVG: 24px by default, 18px in buttons, chips, segments, subfolder tiles and fold chevrons, 16px in the compact segmented button, 20px for the trust line's info icon.

### Don't:
- **Don't** float the apply toolbar over the canvas or move the bookmark count out of the Apply button.
- **Don't** use teal or amber as decoration; apart from the Settings group headings and status line, teal text is always something to press or, during a drag, a place to drop.
- **Don't** lift resting nodes, list cards, the workspace or the docked sheet with a shadow; the notice banner is the one elevated card.
- **Don't** put emoji or Unicode symbols in place of Material Symbols for interface actions and states; emoji belong to folder names.
- **Don't** hide the trust line at any width.
- **Don't** draw connectors or ports in the stacked layout at 760px and below.
- **Don't** run a connector to a subfolder card or give it a port; its rail ties it to its folder.
- **Don't** replay the connector animation after the first draw.
