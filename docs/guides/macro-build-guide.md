# Macro Builder Guide

The **Macro Builder** is a specialized environment for constructing reusable sub-systems and defining repeating structures outside the main workspace.

## Interface Overview

The Macro Builder runs in a dedicated full-screen dialog containing:
1.  **Module List (Left):** A library of available components.
2.  **Canvas (Center):** An independent workspace for assembling your macro.
3.  **Configuration (Bottom):** Controls for repetition and generation.

## How to Build a Macro

1.  **Open Builder:** Click the **Macro Build** button in the main toolbar.
2.  **Assemble:** Drag modules from the left sidebar onto the canvas.
3.  **Connect:** Link the modules to define the internal flow.
4.  **Refine:** Use **Ghost Nodes** to clean up complex connections if wires become cluttered.

## Creating Repeating Structures

You can automatically generate arrayed structures (e.g., segmented vessels) using the **Repeat Count** feature.

1.  **Design Unit:** Build a *single* segment of your structure in the canvas.
2.  **Set Multiplier:** Enter the number of repetitions in the **Repeat Count** field at the bottom of the screen.
3.  **Generate:** Click **Generate Macro Node**.

PhLynx will compile the design and generate the specified number of sequential copies in your main workspace.