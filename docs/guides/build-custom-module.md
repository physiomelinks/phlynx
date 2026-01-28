# Using Custom Modules

When your model requires specific components not found in the default library, you can create and import custom CellML modules. This process requires uploading specific definition files to ensure the model can be exported and simulated correctly.

## 1. Create Custom Modules

Write your custom CellML modules in your preferred IDE. To ensure compatibility with PhLynx, follow the structure and conventions outlined in the [Module Format Guide](../writing-cellml).

## 2. Import Module Files

Once your `.cellml` files are ready, import them into the workbench:

1.  Click the arrow next to **Import** in the Toolbar.
2.  Select **Modules**.
3.  Choose your `.cellml` file(s) from the dialog.
4.  **Result:** Your modules will appear in the **Module List** and can be placed into the workspace.

## 3. Import Parameter Definitions

To ensure PhLynx correctly categorizes variables as *constants* or *global constants* during export, you must upload a parameter configuration file.

**Requirements:**
* **Format:** `.csv`
* **Naming Convention:**
    * **Constants:** `[module_name]_[parameter_name]`
    * **Global Constants:** `[parameter_name]`

> [!IMPORTANT]
> Parameter names in this file must exactly match the parameter and module names used in your PhLynx project.

**Action:**
1.  Click the arrow next to **Import** in the Toolbar.
2.  Select **Parameters**.
3.  Select your `parameter.csv` file.

## 4. Import Unit Definitions

PhLynx leverages CellML's innate dimensional consistency validation. If your modules use custom units that are not defined in the standard PhLynx library, you must import a custom units file.

**Action:**
1.  Click the arrow next to **Import** in the Toolbar.
2.  Select **Units**.
3.  Select your `units.cellml` file.

> [!NOTE]
> For a guide on creating unit definition files, see the official [CellML Specification](https://www.cellml.org/specifications/archive/20030930/units.pdf).

## 5. Build Your Model

Once the module, parameter, and unit files are imported, your custom components function exactly like standard library modules. You can drag them from the <GlossaryLink term="module-list"/>, connect them using ports, and include them in your final system export.