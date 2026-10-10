local HttpService = game:GetService("HttpService")
local data = HttpService:JSONDecode([==[[{"name":"Settings","canvas":{"width":4193,"height":2952},"parts":[{"name":"Panel","kind":"panel","sourceId":"Settings","x":0,"y":0,"width":4193,"height":2952,"file":"Settings/Panel.png","textureWidth":4096,"textureHeight":2884,"assetId":"rbxassetid://125934933562908"},{"name":"FrameNot1","kind":"frame","sourceId":"FRAMENOT","x":195,"y":542,"width":3804,"height":654,"file":"Settings/FrameNot1.png","textureWidth":4096,"textureHeight":704,"assetId":"rbxassetid://136367438509009"},{"name":"CloseButton","kind":"close","sourceId":"CLOSEBUTTN","x":3783,"y":0,"width":410,"height":444,"file":"Settings/CloseButton.png","textureWidth":946,"textureHeight":1024,"assetId":"rbxassetid://117812010302663"}],"verification":{"meanChannelError":0.04514167455293771,"maxError":1.1532179930795863,"pixelsAbove3":0,"pixels":704000}},{"name":"PlotAccess","canvas":{"width":4193,"height":2952},"parts":[{"name":"Panel","kind":"panel","sourceId":"PlotAccess","x":0,"y":0,"width":4193,"height":2952,"file":"PlotAccess/Panel.png","textureWidth":4096,"textureHeight":2884,"assetId":"rbxassetid://84644839712594"},{"name":"CloseButton","kind":"close","sourceId":"CLOSEBTN","x":3783,"y":0,"width":410,"height":444,"file":"PlotAccess/CloseButton.png","textureWidth":946,"textureHeight":1024,"assetId":"rbxassetid://117812010302663"},{"name":"Button1","kind":"button","sourceId":"BUTTON","x":197,"y":537,"width":3800,"height":537,"file":"PlotAccess/Button1.png","textureWidth":4096,"textureHeight":579,"assetId":"rbxassetid://119728788274447"}],"verification":{"meanChannelError":0.0002914887139124808,"maxError":1.3402229911572618,"pixelsAbove3":0,"pixels":704000}},{"name":"Index","canvas":{"width":5547,"height":2952},"parts":[{"name":"Panel","kind":"panel","sourceId":"Index","x":675,"y":0,"width":4197,"height":2952,"file":"Index/Panel.png","textureWidth":4096,"textureHeight":2881,"assetId":"rbxassetid://115281564766227"},{"name":"FrameNot1","kind":"frame","sourceId":"FRAMENOT","x":872,"y":542,"width":654,"height":654,"file":"Index/FrameNot1.png","textureWidth":2048,"textureHeight":2048,"assetId":"rbxassetid://91255863825877"},{"name":"FrameNot2","kind":"frame","sourceId":"FRAMENOT_2","x":1625,"y":541,"width":654,"height":654,"file":"Index/FrameNot2.png","textureWidth":2048,"textureHeight":2048,"assetId":"rbxassetid://134381238730695"},{"name":"FrameNot3","kind":"frame","sourceId":"FRAMENOT_3","x":2390,"y":541,"width":654,"height":654,"file":"Index/FrameNot3.png","textureWidth":2048,"textureHeight":2048,"assetId":"rbxassetid://74772994782856"},{"name":"FrameNot4","kind":"frame","sourceId":"FRAMENOT_4","x":3155,"y":541,"width":654,"height":654,"file":"Index/FrameNot4.png","textureWidth":2048,"textureHeight":2048,"assetId":"rbxassetid://95844335078172"},{"name":"FrameNot5","kind":"frame","sourceId":"FRAMENOT_5","x":3945,"y":541,"width":654,"height":654,"file":"Index/FrameNot5.png","textureWidth":2048,"textureHeight":2048,"assetId":"rbxassetid://99461653117339"},{"name":"FrameNot6","kind":"frame","sourceId":"FRAMENOT_6","x":3945,"y":1271,"width":654,"height":654,"file":"Index/FrameNot6.png","textureWidth":2048,"textureHeight":2048,"assetId":"rbxassetid://126819155013945"},{"name":"CloseButton","kind":"close","sourceId":"CLOSEBUTTN","x":4460,"y":0,"width":412,"height":444,"file":"Index/CloseButton.png","textureWidth":950,"textureHeight":1024,"assetId":"rbxassetid://85528323932446"},{"name":"EnginesButton","kind":"button","sourceId":"BUTTON","x":0,"y":396,"width":702,"height":508,"file":"Index/EnginesButton.png","textureWidth":2048,"textureHeight":1482,"assetId":"rbxassetid://85289431116420"},{"name":"FuelButton","kind":"button","sourceId":"BUTTON_2","x":0,"y":907,"width":702,"height":545,"file":"Index/FuelButton.png","textureWidth":2048,"textureHeight":1590,"assetId":"rbxassetid://120899209823907"},{"name":"WheelsButton","kind":"button","sourceId":"BUTTON_3","x":0,"y":1453,"width":702,"height":547,"file":"Index/WheelsButton.png","textureWidth":2048,"textureHeight":1596,"assetId":"rbxassetid://121157008203031"},{"name":"BlocksButton","kind":"button","sourceId":"BUTTON_4","x":0,"y":1993,"width":702,"height":555,"file":"Index/BlocksButton.png","textureWidth":2048,"textureHeight":1619,"assetId":"rbxassetid://110922718733496"},{"name":"GunsButton","kind":"button","sourceId":"BUTTON_5","x":4845,"y":426,"width":702,"height":533,"file":"Index/GunsButton.png","textureWidth":2048,"textureHeight":1555,"assetId":"rbxassetid://79422942188381"}],"verification":{"meanChannelError":0.04854186543342923,"maxError":1.7647058823529278,"pixelsAbove3":0,"pixels":532000}}]]==])
local StarterGui = game:GetService("StarterGui")
for _, spec in ipairs(data) do assert(not StarterGui:FindFirstChild(spec.name), spec.name.." already exists") end
local viewport = workspace.CurrentCamera.ViewportSize
local created = {}
for _, spec in ipairs(data) do
 local gui = Instance.new("ScreenGui")
 gui.Name = spec.name
 gui.Enabled = spec.name == "Index"
 gui.ResetOnSpawn = false
 gui.IgnoreGuiInset = true
 gui.ScreenInsets = Enum.ScreenInsets.None
 gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
 gui.DisplayOrder = 120
 gui:SetAttribute("DesignWidth", spec.canvas.width)
 gui:SetAttribute("DesignHeight", spec.canvas.height)
 gui:SetAttribute("FigmaSource", spec.name.."-source.svg")
 gui:SetAttribute("ExportResolution", "4096px panels; separately rendered controls")
 local scale = math.min(viewport.X * 0.84 / spec.canvas.width, viewport.Y * 0.82 / spec.canvas.height, 960 / 4193)
 local requested = Instance.new("BindableEvent")
 requested.Name = "ButtonActivated"
 requested.Parent = gui
 for _, part in ipairs(spec.parts) do
  local button = part.kind == "close" or part.kind == "button"
  local node = Instance.new(part.kind == "frame" and "Frame" or button and "ImageButton" or "ImageLabel")
  node.Name = part.name
  node.AnchorPoint = Vector2.new(0.5,0.5)
  node.BackgroundTransparency = 1
  node.BorderSizePixel = 0
  node.Position = UDim2.new(0.5, (part.x + part.width / 2 - spec.canvas.width / 2) * scale, 0.5, (part.y + part.height / 2 - spec.canvas.height / 2) * scale)
  node.Size = UDim2.fromOffset(part.width * scale, part.height * scale)
  node.ZIndex = part.kind == "panel" and 1 or part.kind == "frame" and 2 or 3
  node:SetAttribute("DesignX", part.x)
  node:SetAttribute("DesignY", part.y)
  node:SetAttribute("DesignWidth", part.width)
  node:SetAttribute("DesignHeight", part.height)
  node:SetAttribute("ExportWidth", part.textureWidth)
  node:SetAttribute("ExportHeight", part.textureHeight)
  node:SetAttribute("FigmaLayer", part.sourceId)
  if part.kind == "frame" then
   local artwork = Instance.new("ImageLabel")
   artwork.Name = "Artwork"
   artwork.BackgroundTransparency = 1
   artwork.BorderSizePixel = 0
   artwork.Size = UDim2.fromScale(1,1)
   artwork.Image = part.assetId
   artwork.ScaleType = Enum.ScaleType.Stretch
   artwork.ResampleMode = Enum.ResamplerMode.Default
   artwork.ZIndex = node.ZIndex
   artwork.Parent = node
  else
   node.Image = part.assetId
   node.ScaleType = Enum.ScaleType.Stretch
   node.ResampleMode = Enum.ResamplerMode.Default
   if button then node.AutoButtonColor = false node.Selectable = true end
  end
  node.Parent = gui
 end
 gui.Parent = StarterGui
 table.insert(created, {name=gui.Name, children=#gui:GetChildren(), panelChildren=#gui.Panel:GetChildren()})
end
game:GetService("Selection"):Set({StarterGui.Index})
return created
