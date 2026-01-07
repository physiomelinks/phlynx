.. image:: https://api.netlify.com/api/v1/badges/94c2ffbc-8f11-4759-9094-626a6efd7d82/deploy-status
  :target: https://app.netlify.com/projects/latest-phlynx/deploys
  :alt: Netlify Status Badge

=================================
Circulatory Autogen Model Builder
=================================

"Circulatory Autogen Model Builder" (CA System Builder) is a desktop application for visually constructing and configuring circulatory autogen system models.

Built with Vue 3 and Electron, this tool provides a node-based interface
(powered by Vue Flow) that allows users to drag, drop, and connect different
physiological components. It is designed to work with CellML models
(using ``vue3-libcellml.js``) and exports system configurations (JSON, CSV) for use with the Circulatory
Autogen software.

Features
--------

* **Visual, Node-Based Editor:** Drag and drop components to build complex models.
* **CellML Integration:** Based on ``vue3-libcellml.js`` for working with CellML files.
* **Workflow Management:** Save and load your visual workflow as a JSON file.
* **Model Export:** Export your model to formats compatible with Circulatory Autogen.
* **Cross-Platform:** Runs on macOS, Windows, and Linux as a standalone desktop app.

The latest state of the application can be accessed online at: https://latest-phlynx.netlify.app/

.. note::

   The latest version is not guaranteed to be stable or working at any given time.

Usage Instructions
------------------

This guide is for developers who wish to run or build the application from
the source code.

Prerequisites
~~~~~~~~~~~~~

* Node.js (v20 or later recommended)
* A package manager (npm or yarn)

Installation
~~~~~~~~~~~~

Clone the repository and install the dependencies:

.. code-block:: bash

    git clone https://github.com/hsorby/ca-model-builder
    cd ca-system-builder
    yarn install

Development
~~~~~~~~~~~

**Run as a Desktop Application (Recommended)**

This will launch the Electron app with hot-reloading for the Vue frontend.

.. code-block:: bash

    yarn app:dev

**Run as a Web Application (for quick UI testing)**

This will launch the app in your browser. Note: Electron-specific features
(like native file saving) will not be available.

.. code-block:: bash

    yarn dev

Building the Application
~~~~~~~~~~~~~~~~~~~~~~~~

To build the final, distributable application, you can use the following scripts.
The output will be placed in the ``dist-applications`` directory, as defined
in ``package.json``.

**Build Installers (Recommended for distribution)**

This command builds the packaged application and creates platform-specific
installers (e.g., ``.dmg`` for macOS, ``.exe`` for Windows).

.. code-block:: bash

    yarn app:build

**Build a "Packed" Directory**

This command builds the application without creating an installer. This is
useful for testing the final packaged app without running an installer.

.. code-block:: bash

    yarn app:pack
