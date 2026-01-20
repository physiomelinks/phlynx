# Valid port configurations

Ports may be defined as an input, output, or general type. When exporting the system model, PhLynx will connect variables that are associated with a port with the same label and a compatible port type. 

Valid connections are as follows:

| Port type | Valid connections | 
|---|---|
| Input | Output, General |
| Output | Input, General |
| General | Input, Output, General |

> [!NOTE]
> Input and output port types are equivalent to entrance and exit port types in [Circulatory Autogen](https://github.com/physiomelinks/circulatory_autogen).

Should two ports share a port label but have incompatible port types, they will not be connected during model export. For now, no warning or error will be generated.