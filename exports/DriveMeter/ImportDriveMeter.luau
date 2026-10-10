local sg=Instance.new("ScreenGui")
sg.Name="DriveMeter"
sg.ResetOnSpawn=false
sg.IgnoreGuiInset=true
sg.DisplayOrder=10
sg.ZIndexBehavior=Enum.ZIndexBehavior.Sibling
sg:SetAttribute("FigmaSourceSize",Vector2.new(1320,714))
local meter=Instance.new("Frame")
meter.Name="Meter"
meter.BackgroundTransparency=1
meter.AnchorPoint=Vector2.new(1,1)
meter.Position=UDim2.new(1,-24,1,-24)
meter.Size=UDim2.new(0.22,0,0,180)
meter.Parent=sg
local aspect=Instance.new("UIAspectRatioConstraint")
aspect.AspectRatio=1320/714
aspect.DominantAxis=Enum.DominantAxis.Width
aspect.Parent=meter
local dial=Instance.new("ImageLabel")
dial.Name="Dial"
dial.BackgroundTransparency=1
dial.Size=UDim2.fromScale(1,1)
dial.Image="rbxassetid://94911812810471"
dial.ScaleType=Enum.ScaleType.Stretch
dial.ZIndex=1
dial.Parent=meter
local needle=Instance.new("ImageLabel")
needle.Name="GaugeNeedle"
needle.BackgroundTransparency=1
needle.Position=UDim2.fromScale(592.5/1320,308.5/714)
needle.Size=UDim2.fromScale(106/1320,284/714)
needle.Image="rbxassetid://107948808057422"
needle.ScaleType=Enum.ScaleType.Stretch
needle.ZIndex=2
needle.Parent=meter
sg.Parent=game:GetService("StarterGui")
game:GetService("Selection"):Set({sg})
return "DriveMeter imported with separate Dial and GaugeNeedle."
