## ADDED Requirements

### Requirement: Tauri v2 app window launches
The `tunetag-gui` crate SHALL produce a Tauri v2 desktop application that opens a window with a title of "TuneTag".

#### Scenario: App launches with correct title
- **WHEN** the GUI binary is executed
- **THEN** a desktop window appears with the title "TuneTag"

### Requirement: Menu bar with placeholder menus
The app window SHALL display a menu bar with the following top-level menus: File, Edit, Convert, Tag Sources, View.

#### Scenario: Menu bar is visible
- **WHEN** the app launches
- **THEN** the menu bar displays File, Edit, Convert, Tag Sources, and View menus

#### Scenario: Menu items are present but non-functional
- **WHEN** the user opens any menu
- **THEN** the menu items from PRD section 10 are listed (e.g., File → Open Files, Open Folder, Save, Close All) but do not perform actions yet

### Requirement: Resizable split pane layout
The app SHALL display a two-panel layout: a file list area on the left and a tag panel area on the right, separated by a draggable divider.

#### Scenario: Split pane renders
- **WHEN** the app launches
- **THEN** both the file list panel and tag panel are visible side by side

#### Scenario: Divider is draggable
- **WHEN** the user drags the divider between panels
- **THEN** the panels resize proportionally

### Requirement: Status bar
The app SHALL display a status bar at the bottom showing placeholder text (e.g., "0 files loaded | 0 selected | 0 unsaved").

#### Scenario: Status bar is visible
- **WHEN** the app launches
- **THEN** the status bar is displayed at the bottom of the window with placeholder counts

### Requirement: Frontend uses React + TypeScript + Vite + Tailwind
The frontend SHALL be built with React, TypeScript, Vite as the bundler, and Tailwind CSS for styling.

#### Scenario: Dev server starts
- **WHEN** `npm run dev` (or equivalent) is run in the frontend directory
- **THEN** the Vite dev server starts and serves the React application
