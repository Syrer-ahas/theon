Settings, Plot Access, and Index — Figma exports

Already installed in TEST under StarterGui: Settings, PlotAccess, Index.

Each ScreenGui owns a separate Panel ImageLabel, close ImageButton, and its
other controls directly. FrameNot containers own only their own Artwork
ImageLabel. No button or frame is inside the main Panel image.

Settings: Panel + CloseButton + FrameNot1.
PlotAccess: Panel + CloseButton + Button1.
Index: Panel + CloseButton + five category buttons + six FrameNot containers.

PNGs preserve transparency. Panels are rendered at 4096 pixels wide;
individual controls have separately rendered high-resolution textures.
Original SVG sources are included for future exports. Raster icons retain
the source detail provided by Figma.

The .rbxmx files can be inserted under StarterGui in another Studio place.
They start disabled; enable the ScreenGui to display it. GuiController
maintains alignment when the viewport changes and closes its own GUI.
ButtonActivated is a BindableEvent for connecting your game logic.
Index also sets its SelectedCategory attribute when a category is clicked.

Verification: all 19 image instances loaded successfully in Studio; all
five Index category buttons and the Plot Access button activated separately;
all three close buttons closed their own ScreenGui. Visual appearance was
checked in play mode. Figma soft-light highlights were resolved into vector
gradients before rendering and compared with a direct Figma PNG export.
