# Welcome to PhLynx

Physiome Links (**PhLynx** — pronounced "flinks") is a web-based graphical interface designed to couple existing <GlossaryLink term="CellML"/> components into unified system models. It is commonly used to generate coupled biophysical cell models and blood or lymph flow networks.

## Why PhLynx?

PhLynx streamlines the model-building workflow by offering the following key advantages:

- **Visual Model Assembly:** Replace manual variable mapping with a graphical interface. PhLynx allows you to visually connect modules, define shared variables, and inspect your system architecture at a glance.

- **Module Reusability:** Avoid creating monolithic, single-use models. PhLynx encourages the integration of modular, reusable components. You can access a wide library of open modules and easily couple them with your own custom developments, creating systems that others can build upon.

- **The Power of CellML:** Models generated in PhLynx are fully compatible with the <GlossaryLink term="CellML"/> standard. This ensures unit consistency and allows you to regenerate your model in various languages (C++, Python, MATLAB) for integration with other model types (e.g., PDEs) or embedded systems.

- **Open Source:** PhLynx is completely open source. This promotes reproducible science by allowing the community to freely use, audit, and verify the modules and models created within the platform.

## Workflow Integration

PhLynx fits seamlessly into the <GlossaryLink term="CellML"/> ecosystem to facilitate model composition:

1.  **Create or Acquire:** Develop <GlossaryLink term="CellML"/> components in your preferred IDE or download existing components.
2.  **Import:** Load your <GlossaryLink term="CellML"/> files into the PhLynx Workbench.
3.  **Assemble:** Visually connect modules and define their interactions.
4.  **Export:** Generate a flattened <GlossaryLink term="CellML"/> model.
5.  **Next Steps:**
    * **Simulate:** Run your model in [OpenCOR](https://opencor.ws/).
    * **Analyze:** Perform calibration, parameter identifiability, and sensitivity analysis using [Circulatory Autogen](https://physiomelinks.github.io/circulatory_autogen/).