local starterGui=game:GetService("StarterGui")
assert(not starterGui:FindFirstChild("ButtonsGui"),"ButtonsGui already exists; inspect before replacing")
local gui=Instance.new("ScreenGui")
gui.Name="ButtonsGui";gui.ResetOnSpawn=false;gui.IgnoreGuiInset=true;gui.ZIndexBehavior=Enum.ZIndexBehavior.Sibling;gui.DisplayOrder=30
gui:SetAttribute("FigmaFileKey","ahkmxtsUCXJ5Ruax1UAh9e");gui:SetAttribute("FigmaGroupId","134:14");gui:SetAttribute("ExportResolution",1300)
local layout=Instance.new("Frame");layout.Name="Layout";layout.BackgroundTransparency=1;layout.BorderSizePixel=0;layout.AnchorPoint=Vector2.new(.5,.5);layout.Position=UDim2.fromScale(.5,.5);layout.Size=UDim2.fromScale(.86,.3);layout.Parent=gui
local aspect=Instance.new("UIAspectRatioConstraint");aspect.AspectRatio=5934/650;aspect.DominantAxis=Enum.DominantAxis.Width;aspect.Parent=layout
local data={
{"Common","131266000784891",0,"93:3241"},
{"Uncommon","136057917898301",678,"134:2"},
{"Rare","99501370642155",1407,"94:3338"},
{"Epic","79775349688745",2172,"94:3341"},
{"Legendary","102903122622992",2937,"94:3348"},
{"Mythic","80379249346209",3728,"134:5"},
{"Divine","101470897274784",4493,"134:8"},
{"Secret","119326055870211",5284,"134:11"}}
for i,d in data do
 local b=Instance.new("ImageButton");b.Name=d[1];b.Image="rbxassetid://"..d[2];b.BackgroundTransparency=1;b.BorderSizePixel=0;b.AutoButtonColor=false;b.ScaleType=Enum.ScaleType.Fit;b.ResampleMode=Enum.ResamplerMode.Default
 b.Position=UDim2.fromScale(d[3]/5934,0);b.Size=UDim2.fromScale(650/5934,1);b.LayoutOrder=i;b.ZIndex=2
 b:SetAttribute("Rarity",d[1]);b:SetAttribute("FigmaNodeId",d[4]);b.Parent=layout
end
gui.Enabled=true;gui.Parent=starterGui
game:GetService("Selection"):Set({gui})
return {path=gui:GetFullName(),buttons=#data,enabled=gui.Enabled,aspect=aspect.AspectRatio}

