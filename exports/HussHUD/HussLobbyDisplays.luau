
local Displays={}
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local RunService=game:GetService("RunService")
local Pack=require(RS:WaitForChild("HussR6AnimationPack").Player)
local Catalog=require(RS:WaitForChild("HussBallCatalog"))
function Displays.Start(screens)
 local player=Players.LocalPlayer
 local showroom=workspace:WaitForChild("Arena"):WaitForChild("BallShowroom")
 local old=workspace:FindFirstChild("LocalBallDisplays") if old then old:Destroy() end
 local folder=Instance.new("Folder") folder.Name="LocalBallDisplays" folder.Parent=workspace
 local oldUI=player.PlayerGui:FindFirstChild("HussBallDisplayBillboards") if oldUI then oldUI:Destroy() end
 local displayUI=Instance.new("ScreenGui") displayUI.Name="HussBallDisplayBillboards" displayUI.IgnoreGuiInset=true displayUI.ResetOnSpawn=false displayUI.DisplayOrder=20 displayUI.ZIndexBehavior=Enum.ZIndexBehavior.Sibling displayUI.Parent=player.PlayerGui
 local active={} local building=false local generation=0 local tick=0
 local function label(parent,name,text,size,pos,dims,color)
  local l=Instance.new("TextLabel") l.Name=name l.BackgroundTransparency=1 l.Text=text l.TextSize=size l.Position=pos l.Size=dims l.TextColor3=color or Color3.fromRGB(245,245,240) l.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Heavy) l.Parent=parent
  local s=Instance.new("UIStroke") s.Color=Color3.new() s.Thickness=1.3 s.Parent=l return l
 end
 local function pedestalPose(pedestal,hum)
  return pedestal.CFrame*CFrame.new(0,pedestal.Size.Y*.5+(hum and hum.HipHeight or 0)+3,0)*CFrame.Angles(0,math.rad(pedestal:GetAttribute("DisplayYawOffset") or 0),0)
 end
 local function build(char)
  if building then return end building=true generation+=1 local current=generation
  local root=char:WaitForChild("HumanoidRootPart",10) local hum=char:FindFirstChildOfClass("Humanoid")
  if not root or not hum then building=false return end
  -- Clothing/accessories arrive after CharacterAdded; wait for their loaded appearance.
  local deadline=os.clock()+12
  while player.Character==char and not player:HasAppearanceLoaded() and os.clock()<deadline do task.wait(.2) end
  if player.Character~=char or not char.Parent then building=false return end
  local template
  local ok,model=pcall(function() return Players:CreateHumanoidModelFromDescriptionAsync(hum:GetAppliedDescription(),Enum.HumanoidRigType.R6) end)
  if ok then template=model else local original=char.Archivable char.Archivable=true template=char:Clone() char.Archivable=original end
  if not template then building=false return end
  template.Archivable=true
  folder:ClearAllChildren() displayUI:ClearAllChildren()
  for _,gui in ipairs(player.PlayerGui:GetChildren()) do if gui:IsA("BillboardGui") and gui.Name:match("^HussBallView") then gui:Destroy() end end
  active={}
  for i,id in ipairs({"Solar","Void","Frost","Dragon"}) do
   local pedestal=showroom:FindFirstChild("Pedestal"..i)
   if not pedestal or not pedestal:IsA("BasePart") then continue end
   local item=Catalog.ById[id] local rig=template:Clone() rig.Name=item.Name.."Display"
   for _,o in ipairs(rig:GetDescendants()) do if o:IsA("LuaSourceContainer") or o:IsA("Tool") or o:IsA("BillboardGui") or o:IsA("Highlight") then o:Destroy() end end
   for _,part in ipairs(rig:GetDescendants()) do if part:IsA("BasePart") then part.CanCollide=false part.CanTouch=false part.CanQuery=false part.LocalTransparencyModifier=0 part.CastShadow=true end end
   local rigRoot=rig:FindFirstChild("HumanoidRootPart") local rigHum=rig:FindFirstChildOfClass("Humanoid")
   if not rigRoot then rig:Destroy() continue end
   rig.PrimaryPart=rigRoot rigRoot.PivotOffset=CFrame.identity rigRoot.Anchored=true
   if rigHum then rigHum.DisplayDistanceType=Enum.HumanoidDisplayDistanceType.None rigHum.AutoRotate=false rigHum.PlatformStand=true end
   rig.Parent=folder rig:PivotTo(pedestalPose(pedestal,rigHum))
   local joints={} for _,j in ipairs(rig:GetDescendants()) do if j:IsA("Motor6D") and j.Part1 then joints[j.Part1.Name]=j end end
   local ball=RS.HussBallModels[id]:Clone() ball:ScaleTo(.42) local arm=rig["Right Arm"]
   ball:PivotTo(arm.CFrame*CFrame.new(0,-1.05,0))
   for _,part in ipairs(ball:GetDescendants()) do if part:IsA("BasePart") then part.Anchored=false part.CanCollide=false part.CanTouch=false part.CanQuery=false part.Massless=true local w=Instance.new("WeldConstraint") w.Part0=arm w.Part1=part w.Parent=part end end ball.Parent=rig
   local light=Instance.new("PointLight") light.Name="ShowcaseFill" light.Color=Color3.fromRGB(240,245,255) light.Brightness=.7 light.Range=9 light.Shadows=false light.Parent=rigRoot
   local header=Instance.new("BillboardGui") header.Name="ShowcaseHeader" header.Adornee=rigRoot header.Size=UDim2.fromOffset(330,102) header.StudsOffsetWorldSpace=Vector3.new(0,4.5,0) header.MaxDistance=40 header.Parent=rig
   local category=label(header,"Rarity",item.Rarity.." BALL",12,UDim2.fromOffset(55,0),UDim2.fromOffset(220,22),item.Color)
   category.BackgroundTransparency=0 category.BackgroundColor3=Color3.fromRGB(20,16,30) local c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,12) c.Parent=category
   local title=label(header,"Name",item.Name,22,UDim2.fromOffset(0,27),UDim2.fromOffset(330,38)) title.BackgroundTransparency=.1 title.BackgroundColor3=item.Color:Lerp(Color3.fromRGB(13,17,25),.8)
   c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,10) c.Parent=title
   local phase=label(header,"Phase","PREVIEW · WALK",12,UDim2.fromOffset(0,66),UDim2.fromOffset(330,25))
   local price=Instance.new("Frame") price.Name="ViewBall"..i price.AnchorPoint=Vector2.new(.5,.5) price.Size=UDim2.fromOffset(205,34) price.BackgroundTransparency=1 price.Visible=false price.Parent=displayUI
   local button=Instance.new("TextButton") button.Name="View" button.Size=UDim2.fromScale(1,1) button.Text="GAMEPASS · VIEW" button.TextSize=16 button.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Bold) button.BackgroundColor3=item.Color button.TextColor3=Color3.fromRGB(18,18,26) button.Parent=price c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,18) c.Parent=button
   button.Active=true button.Selectable=true
   button.Activated:Connect(function() if RS.GameRemotes:GetAttribute("RoundState")=="Active" and player:GetAttribute("PlayerRole")=="Lobby" then screens:OpenBall(id) end end)
   local prompt=Instance.new("ProximityPrompt") prompt.Name="ViewBallPrompt" prompt.ActionText="View Ball" prompt.ObjectText=item.Name prompt.MaxActivationDistance=10 prompt.RequiresLineOfSight=false prompt.Parent=rigRoot prompt.Triggered:Connect(function() if RS.GameRemotes:GetAttribute("RoundState")=="Active" and player:GetAttribute("PlayerRole")=="Lobby" then screens:OpenBall(id) end end)
   table.insert(active,{rig=rig,hum=rigHum,pedestal=pedestal,joints=joints,phase=phase,header=header,price=price,root=rigRoot,id=id,prompt=prompt,offset=0,currentPose={}})
  end
  template:Destroy() building=false
  if player.Character~=char then task.defer(build,player.Character) end
 end
 player.CharacterAdded:Connect(function(char) task.spawn(build,char) end)
 player.CharacterAppearanceLoaded:Connect(function(char) if char==player.Character then task.delay(.2,function() build(char) end) end end)
 if player.Character then task.spawn(build,player.Character) end
 local retryAt=0
 RunService.PreSimulation:Connect(function(dt)
  tick+=dt
  if not building and #active==0 and player.Character and tick>retryAt then retryAt=tick+3 task.spawn(build,player.Character) end
  local nearest local distance=math.huge local playerRoot=player.Character and player.Character:FindFirstChild("HumanoidRootPart")
  for _,d in ipairs(active) do
   if d.pedestal.Parent and d.rig.Parent then
    d.rig:PivotTo(pedestalPose(d.pedestal,d.hum))
    if playerRoot then local delta=(d.root.Position-playerRoot.Position).Magnitude if delta<distance then nearest=d distance=delta end end
   end
  end
  for _,d in ipairs(active) do

   local t=tick local clip="Ready" local sample=t%2.4 local phase="READY"
   if d.id=="Solar" then
    t=tick%2.8 phase="SHOOTER"
    if t<1 then clip="Throw" sample=math.min(t*.22,.219) end
   elseif d.id=="Void" then
    t=tick%3.1 phase="CATCHER"
    if t<1.5 then clip="Catch" sample=math.min(t*.32,.479) end
   elseif d.id=="Frost" then
    t=tick%4.8 phase="DODGER" clip="Idle" sample=t
    if t<1.4 then clip="Slide" sample=math.min(t*.24,.339)
    elseif t>2.4 and t<3.3 then clip="Jump" sample=math.min((t-2.4)*.46,.419) end
   elseif d.id=="Dragon" then
    t=tick%4.2 phase="VICTORY"
    if t<2 then clip="Victory" sample=math.min(t*.75,1.499) end
   end
   local modal=player:GetAttribute("HussHudModalOpen")==true
   d.header.Enabled=not modal and d==nearest
   d.prompt.Enabled=not modal and RS.GameRemotes:GetAttribute("RoundState")=="Active" and player:GetAttribute("PlayerRole")=="Lobby"
   d.phase.Text="PREVIEW · "..phase
   local pose=Pack.Sample(clip,sample)
   for name,j in pairs(d.joints) do if j.Parent then local target=pose[name] or CFrame.identity local blended=(d.currentPose[name] or CFrame.identity):Lerp(target,1-math.exp(-16*dt)) d.currentPose[name]=blended j.Transform=blended end end
  end
 end)
 RunService.RenderStepped:Connect(function()
  local camera=workspace.CurrentCamera if not camera then return end
  local modal=player:GetAttribute("HussHudModalOpen")==true
  for _,d in ipairs(active) do
   if d.root.Parent and d.price.Parent then
    local position,onScreen=camera:WorldToViewportPoint(d.root.Position+Vector3.new(0,-1,0))
    d.price.Visible=not modal and RS.GameRemotes:GetAttribute("RoundState")=="Active" and player:GetAttribute("PlayerRole")=="Lobby" and onScreen and position.Z>0 and (camera.CFrame.Position-d.root.Position).Magnitude<=40
    d.price.Position=UDim2.fromOffset(position.X,position.Y)
   end
  end
 end)
end
return Displays
