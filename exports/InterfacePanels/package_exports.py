from pathlib import Path
import json
import xml.etree.ElementTree as ET
import zipfile

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'roblox-assets.json').read_text(encoding='utf-8'))
controller = (base / 'GuiController.client.luau').read_text(encoding='utf-8')

def prop(parent, kind, name, value):
    item = ET.SubElement(parent, kind, {'name': name})
    item.text = str(value)
    return item

def item(parent, classname, name):
    node = ET.SubElement(parent, 'Item', {'class': classname})
    properties = ET.SubElement(node, 'Properties')
    prop(properties, 'string', 'Name', name)
    return node, properties

def udim2(parent, name, xs, xo, ys, yo):
    node = ET.SubElement(parent, 'UDim2', {'name': name})
    for key, value in [('XS', xs), ('XO', xo), ('YS', ys), ('YO', yo)]:
        ET.SubElement(node, key).text = str(value)

def image_properties(parent, asset):
    content = ET.SubElement(parent, 'Content', {'name': 'Image'})
    ET.SubElement(content, 'url').text = asset
    prop(parent, 'token', 'ResampleMode', 0)
    prop(parent, 'token', 'ScaleType', 0)

for spec in manifest:
    root = ET.Element('roblox', {'version': '4'})
    gui, properties = item(root, 'ScreenGui', spec['name'])
    prop(properties, 'bool', 'Enabled', 'false')
    prop(properties, 'bool', 'ResetOnSpawn', 'false')
    prop(properties, 'bool', 'IgnoreGuiInset', 'true')
    prop(properties, 'token', 'ScreenInsets', 0)
    prop(properties, 'token', 'ZIndexBehavior', 1)
    prop(properties, 'int', 'DisplayOrder', 120)
    item(gui, 'BindableEvent', 'ButtonActivated')
    # This matches Studio's initial 1594 x 878 viewport. Runtime layout resizes it.
    scale = min(1594 * .84 / spec['canvas']['width'], 878 * .82 / spec['canvas']['height'], 960 / 4193)
    for part in spec['parts']:
        button = part['kind'] in ('close', 'button')
        node, p = item(gui, 'Frame' if part['kind'] == 'frame' else 'ImageButton' if button else 'ImageLabel', part['name'])
        anchor = ET.SubElement(p, 'Vector2', {'name': 'AnchorPoint'})
        ET.SubElement(anchor, 'X').text = '0.5'
        ET.SubElement(anchor, 'Y').text = '0.5'
        prop(p, 'float', 'BackgroundTransparency', 1)
        prop(p, 'int', 'BorderSizePixel', 0)
        udim2(p, 'Position', .5, round((part['x'] + part['width'] / 2 - spec['canvas']['width'] / 2) * scale), .5, round((part['y'] + part['height'] / 2 - spec['canvas']['height'] / 2) * scale))
        udim2(p, 'Size', 0, round(part['width'] * scale), 0, round(part['height'] * scale))
        z = 1 if part['kind'] == 'panel' else 2 if part['kind'] == 'frame' else 3
        prop(p, 'int', 'ZIndex', z)
        if part['kind'] == 'frame':
            art, ap = item(node, 'ImageLabel', 'Artwork')
            prop(ap, 'float', 'BackgroundTransparency', 1)
            prop(ap, 'int', 'BorderSizePixel', 0)
            prop(ap, 'int', 'ZIndex', z)
            udim2(ap, 'Size', 1, 0, 1, 0)
            image_properties(ap, part['assetId'])
        else:
            image_properties(p, part['assetId'])
            if button:
                prop(p, 'bool', 'AutoButtonColor', 'false')
                prop(p, 'bool', 'Selectable', 'true')
    _, source_properties = item(gui, 'LocalScript', 'GuiController')
    init = '''do
    local gui = script.Parent
    local data = game:GetService("HttpService"):JSONDecode([==[%s]==])
    gui:SetAttribute("DesignWidth", data.canvas.width)
    gui:SetAttribute("DesignHeight", data.canvas.height)
    for _, part in ipairs(data.parts) do
        local node = gui:WaitForChild(part.name)
        node:SetAttribute("DesignX", part.x)
        node:SetAttribute("DesignY", part.y)
        node:SetAttribute("DesignWidth", part.width)
        node:SetAttribute("DesignHeight", part.height)
        node:SetAttribute("ExportWidth", part.textureWidth)
        node:SetAttribute("ExportHeight", part.textureHeight)
        node:SetAttribute("FigmaLayer", part.sourceId)
    end
end
''' % json.dumps(spec, separators=(',', ':'))
    prop(source_properties, 'ProtectedString', 'Source', init + controller)
    path = base / (spec['name'] + '.rbxmx')
    ET.indent(root, space='  ')
    ET.ElementTree(root).write(path, encoding='utf-8', xml_declaration=True)
    parsed = ET.parse(path).getroot()
    screen = parsed.find('Item')
    assert screen.get('class') == 'ScreenGui'
    panel = next(child for child in screen.findall('Item') if child.find('Properties/string[@name="Name"]').text == 'Panel')
    assert not panel.findall('Item')
    assert len([child for child in screen.findall('Item') if child.get('class') in ('Frame', 'ImageButton', 'ImageLabel')]) == len(spec['parts'])

readme = '''Settings, Plot Access, and Index — Figma exports

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
'''
(base / 'README.txt').write_text(readme, encoding='utf-8')
archive = base.parent / 'InterfacePanels.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for spec in manifest:
        for part in spec['parts']:
            bundle.write(base / part['file'], part['file'])
        for filename in [spec['name'] + '.rbxmx', spec['name'] + '-source.svg']:
            bundle.write(base / filename, filename)
    for filename in ['README.txt', 'roblox-assets.json', 'GuiController.client.luau']:
        bundle.write(base / filename, filename)
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'models': [spec['name'] + '.rbxmx' for spec in manifest], 'pngs': sum(len(spec['parts']) for spec in manifest)}))
