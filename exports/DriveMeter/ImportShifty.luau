local sg=game:GetService("StarterGui"):FindFirstChild("DriveMeter") or game:GetService("StarterGui"):FindFirstChild("DrivingState")
assert(sg,"DriveMeter ScreenGui missing")
local meter=sg:FindFirstChild("Meter")
assert(meter,"Meter frame missing")
local previous=meter:FindFirstChild("Shifty")
if previous then previous:Destroy() end
local shifty=Instance.new("ImageButton")
shifty.Name="Shifty"
shifty.BackgroundTransparency=1
shifty.AnchorPoint=Vector2.new(1,1)
shifty.Position=UDim2.new(0,-14,1,0)
shifty.Size=UDim2.new(0.35,0,0,116)
shifty.Image="rbxassetid://82537358304293"
shifty.ScaleType=Enum.ScaleType.Stretch
shifty.AutoButtonColor=false
shifty.ZIndex=3
local aspect=Instance.new("UIAspectRatioConstraint")
aspect.AspectRatio=1200/1397
aspect.DominantAxis=Enum.DominantAxis.Width
aspect.Parent=shifty
shifty:SetAttribute("FigmaSourceSize",Vector2.new(1200,1397))
shifty.Parent=meter
game:GetService("Selection"):Set({shifty})
return "Shifty added to DriveMeter."
