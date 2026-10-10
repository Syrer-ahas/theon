local sg=game.StarterGui:FindFirstChild("DrivingState") or game.StarterGui:FindFirstChild("DriveState") or game.StarterGui:FindFirstChild("DriveMeter")
assert(sg,"Driving ScreenGui missing")
local meter=sg:FindFirstChild("Meter")
assert(meter,"Meter missing")
local old=meter:FindFirstChild("Group23") if old then old:Destroy() end
local group=Instance.new("Frame")
group.Name="Group23"
group.BackgroundTransparency=1
group.AnchorPoint=Vector2.new(0,1)
group.Position=UDim2.new(1,14,1,0)
group.Size=UDim2.new(0,34,1.8,0)
local aspect=Instance.new("UIAspectRatioConstraint")
aspect.AspectRatio=528/3315
aspect.DominantAxis=Enum.DominantAxis.Height
aspect.Parent=group
local background=Instance.new("ImageLabel")
background.Name="Background"
background.BackgroundTransparency=1
background.Size=UDim2.fromScale(1,1)
background.Image="rbxassetid://136458214582135"
background.ScaleType=Enum.ScaleType.Stretch
background.ZIndex=3
background.Parent=group
local fill=Instance.new("ImageLabel")
fill.Name="fill"
fill.BackgroundTransparency=1
fill.Position=UDim2.fromScale(55/528,340/3315)
fill.Size=UDim2.fromScale(460/528,3005/3315)
fill.Image="rbxassetid://91254978684821"
fill.ScaleType=Enum.ScaleType.Stretch
fill.ZIndex=4
fill.Parent=group
local details=Instance.new("ImageLabel")
details.Name="Flame"
details.BackgroundTransparency=1
details.Size=UDim2.fromScale(1,528/3315)
details.Image="rbxassetid://134866765394086"
details.ScaleType=Enum.ScaleType.Stretch
details.ZIndex=5
details.Parent=group
group:SetAttribute("FigmaSourceSize",Vector2.new(528,3315))
group.Parent=meter
game.Selection:Set({group})
return "Group23 and separate fill imported into "..sg.Name
