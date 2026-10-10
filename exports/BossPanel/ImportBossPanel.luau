-- Original Figma artwork, separate controls, one ScreenGui.
local gui=Instance.new('ScreenGui')
gui.Name='BossPanel'
gui.ResetOnSpawn=false
gui.IgnoreGuiInset=true
gui.DisplayOrder=50
gui.ZIndexBehavior=Enum.ZIndexBehavior.Sibling
gui:SetAttribute('FigmaNode','153:287')
gui:SetAttribute('FigmaFile','ahkmxtsUCXJ5Ruax1UAh9e')
local root=Instance.new('Frame')
root.Name='Panel'
root.BackgroundTransparency=1
root.AnchorPoint=Vector2.new(.5,.5)
root.Position=UDim2.fromScale(.5,.433078855)
root.Size=UDim2.fromScale(.439698488,.218093947)
root.Parent=gui
local function artwork(name,class,id,x,y,w,h,z)
 local a=Instance.new(class)
 a.Name=name a.BackgroundTransparency=1 a.BorderSizePixel=0
 a.Image=id a.ScaleType=Enum.ScaleType.Stretch
 a.Position=UDim2.fromScale(x/4359,y/1927)
 a.Size=UDim2.fromScale(w/4359,h/1927) a.ZIndex=z
 if a:IsA('ImageButton') then a.AutoButtonColor=false end
 a.Parent=root return a
end
artwork('Background','ImageLabel','rbxassetid://118161332157361',0,0,4359,1927,1)
artwork('No','ImageButton','rbxassetid://77238929040052',128,1108,2008,608,5)
artwork('Yes','ImageButton','rbxassetid://106655322923801',2223,1108,2008,608,5)
artwork('PromptShadow','ImageLabel','rbxassetid://101294724026588',1044.890869,535.800781,2249.693604,245,2)
artwork('Prompt','ImageLabel','rbxassetid://119523488116359',1044.890869,522.800781,2249.693604,245,3)
local function bar(name,color,transparency,z)
 local f=Instance.new('Frame') f.Name=name f.BorderSizePixel=0
 f.BackgroundColor3=color f.BackgroundTransparency=transparency
 f.Position=UDim2.fromScale(579/4359,840/1927)
 f.Size=UDim2.fromScale(3200/4359,110/1927)
 f.ZIndex=z f.Parent=root
 local corner=Instance.new('UICorner') corner.CornerRadius=UDim.new(.5,0) corner.Parent=f
 local stroke=Instance.new('UIStroke') stroke.Name='Outline' stroke.ApplyStrokeMode=Enum.ApplyStrokeMode.Border
 stroke.Color=Color3.new(0,0,0) stroke.Thickness=15*700/4359 stroke.Parent=f
 return f,stroke
end
local background=bar('WaitingBarBackground',Color3.fromRGB(123,123,123),.3,3)
local fill,outline=bar('WaitingBar',Color3.new(1,1,1),0,4)
outline.Color=Color3.fromRGB(255,217,0)
local gradient=Instance.new('UIGradient')
gradient.Color=ColorSequence.new(Color3.fromRGB(255,195,0),Color3.fromRGB(255,177,67))
gradient.Parent=fill
assert(not game.StarterGui:FindFirstChild('BossPanel'),'BossPanel already exists')
gui.Parent=game.StarterGui
return {path=gui:GetFullName(),yes=gui.Panel.Yes.ClassName,no=gui.Panel.No.ClassName,waitingbar=gui.Panel.WaitingBar.ClassName,background=gui.Panel.WaitingBarBackground.ClassName}


