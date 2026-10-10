local Players = game:GetService('Players')
local ReplicatedStorage = game:GetService('ReplicatedStorage')
local TweenService = game:GetService('TweenService')
local UserInputService = game:GetService('UserInputService')
local SoundService = game:GetService('SoundService')
local player = Players.LocalPlayer
local gui = player:WaitForChild('PlayerGui'):WaitForChild('ZAD')
local layout = gui:WaitForChild('Layout')
local scroll = layout:WaitForChild('Panel'):WaitForChild('ScrollingFrame')
local templates = ReplicatedStorage:WaitForChild('BuildCardTemplates')
local models = ReplicatedStorage:WaitForChild('RollPartTemplates')
local inventory = player:WaitForChild('OwnedParts')
local search = layout:WaitForChild('FrameNot1'):WaitForChild('TextBox')
local sortButton = layout:WaitForChild('FrameNot2'):WaitForChild('SortButton')
local rank = {Common=1, Uncommon=2, Rare=3, Epic=4, Legendary=5, Mythic=6, Divine=7, Secret=8}
local font = Font.new('rbxasset://fonts/families/Montserrat.json',Enum.FontWeight.Heavy,Enum.FontStyle.Normal)
local grid = scroll:WaitForChild('InventoryGrid')
local selected, category, sortMode = nil, 'Vehicle', 'Rarity'
local catalog, cards, watches = {}, {}, {}
local pending = false
local visibleCount = 0
for _,folder in models:GetChildren() do
 for _,item in folder:GetChildren() do
  local id = item:GetAttribute('RollItemId')
  if id then catalog[id] = item end
 end
end
for _,child in scroll:GetChildren() do
 if child:GetAttribute('InventoryPreview') then child:Destroy() end
end
local empty = Instance.new('TextLabel')
empty.Name='EmptyInventory';empty.BackgroundTransparency=1;empty.Size=UDim2.fromScale(1,.3)
empty.Position=UDim2.fromScale(0,.25);empty.Text='Buy parts from the roll station\nto add them here!'
empty.TextColor3=Color3.new(1,1,1);empty.FontFace=font;empty.TextScaled=true;empty.TextWrapped=true
local emptyTextSize=Instance.new('UITextSizeConstraint');emptyTextSize.MinTextSize=12;emptyTextSize.MaxTextSize=24;emptyTextSize.Parent=empty
local emptyOutline=Instance.new('UIStroke');emptyOutline.Color=Color3.new(0,0,0);emptyOutline.Thickness=2;emptyOutline.Parent=empty
empty.Parent=scroll
local emptyConstraint=Instance.new('UISizeConstraint');emptyConstraint.MaxSize=Vector2.new(math.huge,90);emptyConstraint.Parent=empty
-- The grid owns only its card wrappers; the message lives in an overlay.
empty.Parent=scroll.Parent;empty.Position=scroll.Position+UDim2.fromScale(0,.1);empty.Size=UDim2.new(scroll.Size.X.Scale,scroll.Size.X.Offset,.12,0)
local function resizeGrid()
 local openingScale=layout:FindFirstChild('OpeningScale')
 local parentScale=openingScale and openingScale.Scale or 1
 local width=scroll.AbsoluteSize.X/math.max(.01,parentScale)-scroll.ScrollBarThickness-20
 local cell=math.max(1,math.floor((width-16)/3))
 grid.CellSize=UDim2.fromOffset(cell,cell)
 for _,card in cards do
  card.qty.TextSize=math.clamp(math.min(cell*.21,cell*.58/(math.max(2,#card.qty.Text)*.6)),8,28)
 end
 local rows=math.ceil(visibleCount/3)
 local contentHeight=rows>0 and rows*cell+(rows-1)*8+19 or 0
 local maxHeight=scroll.Parent.AbsoluteSize.Y/math.max(.01,parentScale)*.567
 scroll.AutomaticCanvasSize=Enum.AutomaticSize.None
 scroll.Size=UDim2.new(.89,0,0,math.min(contentHeight,maxHeight))
 scroll.CanvasSize=UDim2.fromOffset(0,contentHeight)
 scroll.CanvasPosition=Vector2.new(0,math.min(scroll.CanvasPosition.Y,math.max(0,contentHeight-maxHeight)))
end
scroll:GetPropertyChangedSignal('AbsoluteSize'):Connect(resizeGrid)
scroll.Parent:GetPropertyChangedSignal('AbsoluteSize'):Connect(resizeGrid)
resizeGrid()
local function play(name)
 local s=SoundService:FindFirstChild(name)
 if s then s:Stop();s.TimePosition=0;s:Play() end
end
local function text(parent,name,content,size,pos,anchor)
 local label=Instance.new('TextLabel');label.Name=name;label.BackgroundTransparency=1
 label.Text=content;label.FontFace=font;label.TextColor3=Color3.new(1,1,1)
 label.TextScaled=name~='Quantity';label.TextWrapped=true;label.Size=size;label.Position=pos;label.AnchorPoint=anchor or Vector2.zero
 label.ZIndex=6;label.Parent=parent
 local stroke=Instance.new('UIStroke');stroke.Color=Color3.new(0,0,0);stroke.Thickness=name=='Quantity' and 3.5 or 3.2;stroke.LineJoinMode=Enum.LineJoinMode.Round;stroke.Parent=label
 local constraint=Instance.new('UITextSizeConstraint');constraint.MinTextSize=6;constraint.MaxTextSize=name=='Quantity' and 28 or 25;constraint.Parent=label
 return label
end
local function preview(button,item,entry)
 local asset=entry:GetAttribute('InventoryImage') or item:GetAttribute('InventoryImage')
 if typeof(asset)=='string' and asset~='' then
  local image=Instance.new('ImageLabel');image.Name='ItemImage';image.Image=asset;image.BackgroundTransparency=1
  image.AnchorPoint=Vector2.new(.5,.5);image.Size=UDim2.fromScale(.96,.78);image.Position=UDim2.fromScale(.5,.46);image.ScaleType=Enum.ScaleType.Fit;image.ZIndex=4;image.Parent=button
  return
 end
 local viewport=Instance.new('ViewportFrame');viewport.Name='ModelPreview';viewport.BackgroundTransparency=1
 viewport.AnchorPoint=Vector2.new(.5,.5);viewport.Size=UDim2.fromScale(.96,.78);viewport.Position=UDim2.fromScale(.5,.46)
 viewport.Ambient=Color3.fromRGB(180,180,180);viewport.LightColor=Color3.fromRGB(255,245,220)
 viewport.LightDirection=Vector3.new(-1,-1,-.5);viewport.ZIndex=4;viewport.Parent=button
 local world=Instance.new('WorldModel');world.Parent=viewport
 local clone=item:Clone()
 for _,d in clone:GetDescendants() do
  if d:IsA('LuaSourceContainer') or d:IsA('ProximityPrompt') or d:IsA('BillboardGui') or d:IsA('SurfaceGui')
   or d:IsA('ParticleEmitter') or d:IsA('Trail') or d:IsA('Beam') or d:IsA('Sound') or d:IsA('Highlight') then d:Destroy() end
 end
 local parts=clone:IsA('BasePart') and {clone} or clone:GetDescendants()
 for _,p in parts do if p:IsA('BasePart') then p.Anchored=true;p.CanCollide=false;p.CanTouch=false;p.CanQuery=false end end
 clone.Parent=world
 local pivot=clone:GetPivot();clone:PivotTo(pivot-pivot.Position)
 local lo,hi=Vector3.new(math.huge,math.huge,math.huge),Vector3.new(-math.huge,-math.huge,-math.huge)
 for _,p in parts do if p:IsA('BasePart') then
  for _,x in {-1,1} do for _,y in {-1,1} do for _,z in {-1,1} do
   local v=p.CFrame:PointToWorldSpace(p.Size*Vector3.new(x,y,z)*.5)
   lo=Vector3.new(math.min(lo.X,v.X),math.min(lo.Y,v.Y),math.min(lo.Z,v.Z))
   hi=Vector3.new(math.max(hi.X,v.X),math.max(hi.Y,v.Y),math.max(hi.Z,v.Z))
  end end end
 end end
 if lo.X==math.huge then return end
 local center=(lo+hi)*.5;local radius=(hi-lo).Magnitude*.5
 local camera=Instance.new('Camera');camera.FieldOfView=32
 local distance=math.max(.1,radius)/math.sin(math.rad(16))*1.08
 camera.CFrame=CFrame.lookAt(center+Vector3.new(4,3.2,6).Unit*distance,center)
 camera.Parent=viewport;viewport.CurrentCamera=camera
end
local function createCard(entry,item)
 local wrapper=Instance.new('Frame');wrapper.Name=entry.Name;wrapper.BackgroundTransparency=1;wrapper:SetAttribute('InventoryCard',true)
 local rarity=entry:GetAttribute('Rarity') or item:GetAttribute('Rarity') or 'Common'
 local button=(templates:FindFirstChild(rarity) or templates.Common):Clone()
 button.Name='ItemButton';button.AnchorPoint=Vector2.new(.5,.5);button.Position=UDim2.fromScale(.5,.5)
 button.Size=UDim2.fromScale(1,1);button.ZIndex=3;button.AutoButtonColor=false
 button:SetAttribute('CustomHoverEffect',true);button:SetAttribute('RollItemId',entry.Name);button.Parent=wrapper
 local scale=Instance.new('UIScale');scale.Name='InventoryHoverScale';scale.Parent=button
 local name=text(button,'ItemName',entry:GetAttribute('DisplayName') or item.Name,UDim2.fromScale(.86,.28),UDim2.fromScale(.5,.96),Vector2.new(.5,1))
 name.LineHeight=.95;name.TextXAlignment=Enum.TextXAlignment.Center;name.TextYAlignment=Enum.TextYAlignment.Center
 local qty=text(button,'Quantity','x'..entry.Value,UDim2.fromScale(.58,.25),UDim2.fromScale(.92,.025),Vector2.new(1,0))
 qty.TextXAlignment=Enum.TextXAlignment.Right
 qty.TextWrapped=false;qty.TextYAlignment=Enum.TextYAlignment.Top
 qty.TextSize=math.clamp(grid.CellSize.X.Offset*.21,8,28)
 preview(button,item,entry)
 local state={wrapper=wrapper,button=button,qty=qty,scale=scale,hover=false,pressed=false,tweens={},entry=entry}
 local function update()
  for _,t in state.tweens do t:Cancel() end
  local active=state.hover
  local info=TweenInfo.new(state.pressed and .065 or active and .19 or .16,active and Enum.EasingStyle.Back or Enum.EasingStyle.Quart,Enum.EasingDirection.Out)
  state.tweens={TweenService:Create(scale,info,{Scale=state.pressed and .95 or active and 1.10 or 1})}
  button.Position=UDim2.fromScale(.5,.5);button.Rotation=0
  wrapper.ZIndex=active and 8 or 1;button.ZIndex=active and 8 or 3
  for _,t in state.tweens do t:Play() end
 end
 state.update=update
 button.MouseEnter:Connect(function() state.hover=true;play('ZADHoverSound');update() end)
 button.MouseLeave:Connect(function() state.hover=false;state.pressed=false;update() end)
 button.SelectionGained:Connect(function() state.hover=true;update() end)
 button.SelectionLost:Connect(function() state.hover=false;state.pressed=false;update() end)
 button.InputBegan:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch or input.KeyCode==Enum.KeyCode.ButtonA then state.pressed=true;update() end
 end)
 button.InputEnded:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch or input.KeyCode==Enum.KeyCode.ButtonA then state.pressed=false;update() end
 end)
 button.Activated:Connect(function()
  selected=entry.Name;gui:SetAttribute('SelectedBuildItemId',selected);play('ZADClickSound')
  gui:SetAttribute('BuildSelectionRevision',(gui:GetAttribute('BuildSelectionRevision') or 0)+1)
  for _,card in cards do card.update() end
 end)
 wrapper.Parent=scroll
 return state
end
local function refresh()
 pending=false
 local visible={};local query=string.lower(search.Text)
 for _,entry in inventory:GetChildren() do
  local item=catalog[entry.Name]
  if item and entry:IsA('IntValue') and entry.Value>0 then
   local isWeapon=entry:GetAttribute('Category')=='Weapons'
   local name=entry:GetAttribute('DisplayName') or item.Name
   if (category=='Weapons')==isWeapon and (query=='' or string.find(string.lower(name),query,1,true)) then table.insert(visible,entry) end
  end
 end
 table.sort(visible,function(a,b)
  if sortMode=='Rarity' then
   local ar=rank[a:GetAttribute('Rarity')] or 1;local br=rank[b:GetAttribute('Rarity')] or 1
   if ar~=br then return ar>br end
  elseif sortMode=='Quantity' and a.Value~=b.Value then return a.Value>b.Value end
  return (a:GetAttribute('DisplayName') or a.Name)<(b:GetAttribute('DisplayName') or b.Name)
 end)
 local keep={}
 for i,entry in visible do
  keep[entry.Name]=true
  local card=cards[entry.Name]
  if not card then card=createCard(entry,catalog[entry.Name]);cards[entry.Name]=card end
  card.wrapper.LayoutOrder=i;card.qty.Text='x'..entry.Value
 end
 for id,card in cards do if not keep[id] then card.wrapper:Destroy();cards[id]=nil end end
 empty.Visible=#visible==0
 empty.Text=query~='' and 'No matching items' or category=='Weapons' and 'No weapons owned yet' or 'Buy parts from the roll station\nto add them here!'
 gui:SetAttribute('InventoryVisibleCount',#visible)
 visibleCount=#visible;resizeGrid()
 sortButton.Text='SORT: '..string.upper(sortMode)..'  ▼'
end
local function schedule()
 if pending then return end
 pending=true;task.defer(refresh)
end
local function watch(entry)
 if not entry:IsA('IntValue') or watches[entry] then return end
 watches[entry]={entry.Changed:Connect(schedule),entry.AttributeChanged:Connect(function()
  local card=cards[entry.Name];if card then card.wrapper:Destroy();cards[entry.Name]=nil end;schedule()
 end)}
 schedule()
end
inventory.ChildAdded:Connect(watch)
inventory.ChildRemoved:Connect(function(entry)
 for _,c in watches[entry] or {} do c:Disconnect() end;watches[entry]=nil;schedule()
end)
for _,entry in inventory:GetChildren() do watch(entry) end
search:GetPropertyChangedSignal('Text'):Connect(schedule)
layout.VehicleButton.Activated:Connect(function() category='Vehicle';schedule() end)
layout.WeaponsButton.Activated:Connect(function() category='Weapons';schedule() end)
sortButton.Activated:Connect(function()
 sortMode=sortMode=='Rarity' and 'Name' or sortMode=='Name' and 'Quantity' or 'Rarity';play('ZADClickSound');schedule()
end)
gui:GetPropertyChangedSignal('Enabled'):Connect(function()
 if gui.Enabled then schedule() else
  for _,card in cards do card.hover=false;card.pressed=false;card.update() end
 end
end)
UserInputService.WindowFocusReleased:Connect(function()
 for _,card in cards do card.hover=false;card.pressed=false;card.update() end
end)
schedule()
