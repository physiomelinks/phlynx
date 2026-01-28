# Module Parameter Matching

PhLynx includes a **Parameter Matching Dialog** that allows you to explicitly link specific CellML modules to specific parameter files. This ensures that when you run a simulation, each module draws its constants (like resistance or compliance) from the correct data source.

## Overview

The Parameter Matching system automatically analyzes your loaded modules and parameter files to suggest the best match based on variable names.

### Key Interactions

* **Auto-Detection:** Upon opening the tool, PhLynx scans every variable in your modules and compares them against the variables defined in your imported parameter files. It assigns a "Match Score" to suggest the most likely pairing.
* **Manual Override:** You can override any automatic suggestion using the dropdown menu for each module row.
* **Validation:** The system warns you if any module is left unassigned before you save.

## Interface Elements

The matching dialog consists of a table with three main columns:

### 1. Module Source
Displays the name of the CellML file (e.g., `left_ventricle.cellml`). This is the component that requires parameter values.

### 2. Parameter Source
A dropdown menu listing all currently imported parameter (`.csv`) files.
* **Action:** Select a file to link it to the module.
* **Default:** Pre-filled with the best automated match found by the system.

### 3. Match Info
A visual status indicator helping you judge the quality of the link.

| Status Tag | Color | Meaning |
| :--- | :--- | :--- |
| **High Match** | Green | A high percentage of variables in the module were found in the selected parameter file. |
| **Partial Match** | Orange | Some variables matched, but others are missing. You may want to check your file. |
| **No Match** | Red | The selected parameter file contains none of the variables required by this module. |
| **Manual** | Blue | You manually selected this file (overriding the auto-suggestion). |

> [!TIP]
> Hover over the status tag to see detailed statistics (e.g., *"Matched 15/20 variables"*).

## How to Use

1.  Import your **Modules** and **Parameter Files** via the main toolbar.
2.  Open the **Parameter Matching** dialog.
3.  Review the **Match Info** column.
    * If you see red or orange tags, check the dropdown to see if a better file is available.
4.  Click **Save** to save the associations.

These links are stored in the workspace state, so you do not need to re-link them every time you save and load your project.