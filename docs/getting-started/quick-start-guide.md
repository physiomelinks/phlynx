# Quick Start Guide

We've prepared a simple tutorial to showcase some of PhLynx's capabilities and get you building your first system model. 

## Overview

By the end of this you will:
- Understand the layout of PhLynx
- Learn how to place, connect, and edit modules
- Export your first combined system model

## Workbench layout

Before we get started, it's worth familiarising yourself with PhLynx's <GlossaryLink term="Workbench"/>. There are three main areas for interactions:
- **[Toolbar](../reference/ui-overview#toolbar) (top):** A collection of buttons for file management and workspace operations.
- **[Module list](../reference/ui-overview#module-list) (left):** Storage area for imported <GlossaryLink term="modules"/>.
- **[Workspace](../reference/ui-overview#workbench) (centre):** Working area for assembling your model.

These key areas are highlighted in the image below:
![PhLynx Workbench view with workspace, toolbar, and module list labelled](../assets/images/phlynx_ui.png){.align-center min-width="600px"}

> [!NOTE]
> See [UI overview](../reference/ui-overview) for a more comprehensive description of the user interface and its components.

## Assembling your first model

PhLynx comes pre-installed with a collection of modules that describe a range of physiological processes and subsystems. We'll use some of these to build your first model.

> [!NOTE]
> For creating and importing your own modules, see [Making your own modules](../guides/build-custom-module.md)

### Placing

The Module List contains a text-based search to quickly find the modules you need. To place a module in the <GlossaryLink term="Workspace"/>, simply click on your module of interest and drag it into position. 

#### Step 1: Place 
To begin, find the modules **SN_soma**, **SN_axon**, and **SN_varicosity**, and drag them onto your Workspace (as below).

![PhLynx Workspace with modules in position](../assets/images/quick-start-step-one-placed.png){.align-center width="800px"}

Module names can be edited by double clicking on a module placed in the workspace. Update the names of the modules to **soma_SN**, **axon_SN**, and **var_SN**.

![PhLynx Workspace with renamed modules in position](../assets/images/quick-start-step-one-renamed.png){.align-center width="800px"}

You'll notice that the original name and the CellML file name are preserved in a label beneath your custom names.

### Connecting

With our modules in position, it's time to connect them. You might have noticed that each module in the <GlossaryLink term="Workspace"/> contains three buttons.

![Labelled module node](../assets/images/labelled-module.png){.align-center width="600px"}

From left to right, these are the:
- **[Set key](../reference/ui-overview#key):** Colour code the modules for indentifiability (purely visual).
- **[Add port node](../reference//ui-overview#add-port-node):** Add a <GlossaryLink term="port-node"/>.
- **[Edit module](../reference//ui-overview#edit-module):** Open the edit module dialogue.

In order to connect two modules, they must each possess at least one port node. Port nodes can be added to either the "top", "bottom", "left", or "right" of a module node by pressing the "add port node" button. 

**Adding a port node**

As an example, adding a port node to the left of a module would look as follows:
![Adding a port node to the left of a module](../assets/images/add-port-node.png){.align-center width="800px"}

**Removing a port node**

Port nodes may be removed by hovering and selecting the delete button:
![Removing a port node from a module](../assets/images/remove-port-node.png){.align-center width="550px"}

**Connecting port nodes**

Once the modules you wish to connect each possess a port node, click on one of the nodes and drag the arrow to the other one.
![Connecting two port nodes](../assets/images/connect-port-nodes.png){.align-center width="550px"}

#### Step 2: Connect

Now that you're familiar with editing and connecting port nodes, let's connect our modules from [Step 1](./quick-start-guide#step-1-place-your-modules).

![PhLynx Workspace with connected modules in position](../assets/images/quick-start-step-two.png){.align-center width="800px"}

### Editing

Before we can export our model, we need to provide PhLynx with more information. 

First, click the edit module button to open the [Edit Module](../reference/ui-overview#edit-module) dialogue:

![Labelled Edit Module dialogue](../assets/images/edit-module-detail.png){.align-center width="800px"}

Here, you'll be able to add and modify <GlossaryLink term="ports"/>, as well as set a custom module name. 

Ports can be thought of as a collection of variables that can be shared between connected modules. A port definition has four components:

- **Type:** Indicates directionality of a port. Can be input (I), output (O), or general (G). For valid port-coupling configurations, see [Valid port configurations](../reference/valid-port-configurations.md).
- **Label:** User-assigned name for a variable or collection of variables. This must match with the port label on a connected module if you wish them to couple.
- **Variable(s):** A variable (or variables) associated with a given port. Variables can be selected from a drop down menu, populated with variables detected in the associated CellML module.
- **Sum?:** Indicates that this port should sum with the port it connects with. As an example, you may wish to sum the transmembrane flux of an ionic species from multiple channels.

#### Step 3: Edit

Edit **var_SN** to have two ports:

| Type | Label | Variable(s) | Sum? |
|---|---|---|---|
| Input | membrane_voltage | V | No |
| Output | synaptic_NE | NE | No |

Add two ports to **axon_SN**, too: 

| Type | Label | Variable(s) | Sum? |
|---|---|---|---|
| Input | VI_port | V_in, I | No |
| Output | membrane_voltage | V | No |

And, finally, two ports to **soma_SN**:

| Type | Label | Variable(s) | Sum? |
|---|---|---|---|
| Input | i_stim | I_in | No |
| Output | VI_port | V, I_out | No |


## Saving your progress

You can save your current workspace at any time by clicking the “Save Workspace” button located in the upper-left-hand corner of the user interface. This will download a JSON file representing the current state of the workspace, including module positions, port definitions, and connections. Press it now to save your work so far.

Now to test it out. First, select your modules by holding shift and covering them with a selection box. Press delete to remove them from the workspace. To load your saved workspace, click the “Load Workspace" button and select the JSON file from your local filesystem. The workspace will be restored to the state it was in when it was saved.

### Exporting

With all the information in place, we're ready to export our combined system model. To do so, find the Export button at the right-hand side of the Toolbar and press the downward facing arrow. 

You'll see that there are two options for export: 
- **CellML:** Creates and downloads a flattened CellML 2.0 version of the model.
- **Configuration files:** Converts the current workspace into a ZIP archive containing *vessel_array.csv* and *module_config.json* files for use with Circulatory Autogen.

<!-- [Image of new export to come when pull request comes through] -->

Select the CellML option, and your combined model will be saved to your Downloads directory.

> [!NOTE]
> If using PhLynx in a Chrome Browser window, you will be prompted to select where to save your exported model.

### Running your model

We couldn't finish the tutorial before you've had the chance to run the model. To do so, navigate to [web OpenCOR](https://opencor.ws/app). Drag and drop your new CellML model onto the window and press the play button in the top left-hand corner.

<!-- [Image of web openCOR and expected simulation result to come] -->

Congratulations, you've just created and run your first model using PhLynx! 

Need more information? Check out the Guides and Reference sections of our User Guide.