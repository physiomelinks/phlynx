.. image:: https://api.netlify.com/api/v1/badges/94c2ffbc-8f11-4759-9094-626a6efd7d82/deploy-status
  :target: https://app.netlify.com/projects/latest-phlynx/deploys
  :alt: Netlify Status Badge

=======================
Physiome Links (PhLynx)
=======================

Physiome Links (PhLynx - pronounced "flinks") is a web-based graphical interface for coupling existing CellML modules into a single system model.
Common use cases include generating coupled biophysical cell models and patient-specific blood and/or lymph flow networks.

Getting Started
---------------
PhLynx is a web application - no installation required. Simply access it through your web browser, and start building models immediately. The latest state of the application can be accessed online at: https://latest-phlynx.netlify.app/

.. note::

   The latest version is not guaranteed to be stable or working at any given time.


Browser Requirements:
~~~~~~~~~~~~~~~~~~~~~
* Chrome, Firefox, Safari, or Edge (latest versions recommended)
* JavaScript enabled
* Pop-up blocker disabled for file downloads

.. note:: 

    Using Chrome will enable users to specify file download location.


About PhLynx
------------
PhLynx is a web application for visually constructing and configuring CellML system models from CellML modules.

Built with Vue 3 and Electron, PhLynx provides a node-based interface
(powered by Vue Flow) that allows users to drag, drop, and connect different modular
physiological components. It is designed to work with CellML models
(using ``vue3-libcellml.js``) and exports flattened CellML (2.0) models for use with 
web OpenCOR or system configurations (JSON, CSV) for use with the Circulatory
Autogen software.

Features
--------

* **Visual, Node-Based Editor:** Drag and drop components to build complex models.
* **CellML Integration:** Based on ``vue3-libcellml.js`` for working with CellML files.
* **Workflow Management:** Save and load your visual workflow as a JSON file.
* **Model Export:** Export your model to formats compatible with Circulatory Autogen.
* **Web-based:** Runs on macOS, Windows, and Linux in any browser.

For Developers
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

    git clone https://github.com/physiomelinks/phlynx.git
    cd phlynx
    yarn install

Development
~~~~~~~~~~~

Use the following command to launch the app in your browser 
with hot-reloading for the Vue frontend.

.. code-block:: bash

    yarn dev
