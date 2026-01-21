# Ghost Nodes

**Ghost Nodes** are visual reference tools used to manage connections in complex diagrams without creating functional duplication.

## Functionality

A Ghost Node acts as a proxy for an existing "target" node. It mimics the target's:
- **Name:** Displayed as "Next: [Target Name]".
- **Ports:** Automatically mirrors the input/output ports of the target.

## Behavior

* **Synchronization:** Changes to the target node (renaming, adding ports) are automatically reflected on the Ghost Node.
* **Read-Only:** You cannot edit a Ghost Node directly; you must edit the target node to change properties.
* **Deletion:** Deleting a Ghost Node removes the visual proxy and its immediate connections but does **not** delete the original module.

## Usage

**Creating a Ghost Node**
Select **Add Ghost Node** from the tool menu and choose a target module from the dialog list.

> [!NOTE]
> To prevent circular references, you cannot create a Ghost Node of another Ghost Node.