-- A reversible, client-only recording sequence. No remotes or inventory writes.
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local Run = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local StarterGui = game:GetService("StarterGui")
local UIS = game:GetService("UserInputService")
local CAS = game:GetService("ContextActionService")
local Tags = game:GetService("CollectionService")
local G = require(RS:WaitForChild("BuildGeometry"))
local player = Players.LocalPlayer
local Director = {Duration = 22, Title = "BUILD & KILL BRAINROTS"}
local state
local V = Vector3.new
local PI = math.pi
local origin = V(0, 1200, 0)
local gold = Color3.fromRGB(255, 220, 52)
local cyan = Color3.fromRGB(47, 237, 255)
local function smooth(x) x=math.clamp(x,0,1); return x*x*(3-2*x) end
local function out(x) return 1-(1-math.clamp(x,0,1))^3 end
local function pose(x,y,z) return CFrame.new(origin+V(x,y,z)) end
local function clean(model, keepHumanoid)
 for _,d in model:GetDescendants() do
  for _,tag in Tags:GetTags(d) do Tags:RemoveTag(d,tag) end
  if d:IsA("LuaSourceContainer") or d:IsA("LayerCollector") or d:IsA("ProximityPrompt") or d:IsA("Highlight") or d:IsA("Humanoid") and not keepHumanoid then d:Destroy()
  elseif d:IsA("BasePart") then d.Anchored=true; d.CanCollide=false; d.CanTouch=false; d.CanQuery=false end
 end
 for _,tag in Tags:GetTags(model) do Tags:RemoveTag(model,tag) end
end
local function visible(model, value)
 if model:GetAttribute("TrailerVisible") == value then return end
 model:SetAttribute("TrailerVisible",value)
 for _,p in model:GetDescendants() do
  if p:IsA("BasePart") then p.LocalTransparencyModifier=value and 0 or 1 end
 end
end
local function part(parent,name,size,cf,color,material)
 local p=Instance.new("Part"); p.Name=name; p.Size=size; p.CFrame=cf
 p.Color=color; p.Material=material or Enum.Material.SmoothPlastic
 p.Anchored=true; p.CanCollide=false; p.CanTouch=false; p.CanQuery=false
 p.TopSurface=Enum.SurfaceType.Studs; p.BottomSurface=Enum.SurfaceType.Smooth; p.Parent=parent
 if not material and (name=="Grass" or name=="BuildPlot" or name=="Runway" or name=="Cliff" or name=="GrassCap") then
  p.Material=Enum.Material.Plastic; p.MaterialVariant="2022 Universal"
 end
 return p
end
local function label(parent,name,y,height,text,color)
 local l=Instance.new("TextLabel"); l.Name=name; l.BackgroundTransparency=1
 l.AnchorPoint=Vector2.new(.5,.5); l.Position=UDim2.fromScale(.5,y); l.Size=UDim2.fromScale(.9,height)
 l.Font=Enum.Font.GothamBlack; l.Text=text; l.TextColor3=color or Color3.new(1,1,1); l.TextScaled=true; l.TextWrapped=true
 local stroke=Instance.new("UIStroke"); stroke.Thickness=3; stroke.Color=Color3.fromRGB(19,13,30); stroke.Parent=l
 l.Parent=parent; return l
end
local function createCar(s, upgraded)
 local model=Instance.new("Model"); model.Name=upgraded and "HeroCar" or "StarterCar"; model.Parent=s.stage
 local nodes={}
 local catalog=s.catalog
 local function add(id,cf,kind,index)
  local m,size,_,inset=G.Clone(assert(catalog[id],"Missing trailer part "..id))
  clean(m); m.Parent=model
  table.insert(nodes,{model=m,cf=cf,size=size,kind=kind,index=index or #nodes+1,inset=inset})
 end
 -- Each 2x2 slab sits one stud above its base, matching the build system.
 for iz=0,3 do for ix=0,1 do
  add(upgraded and "blocks:9" or "blocks:10",CFrame.new(ix*2-1,1.12,iz*2-3),"slab")
 end end
 for i,spec in {{-2.55,-2.45},{2.55,-2.45},{-2.55,2.45},{2.55,2.45}} do
  local id=upgraded and "tires:40" or "tires:3"
  local wheel,size=G.Clone(catalog[id])
  wheel:Destroy()
  add(id,CFrame.new(spec[1],size.Y/2,spec[2])*CFrame.Angles(0,PI/2,0)*CFrame.new(0,-size.Y/2,0),"wheel",i)
 end
 add(upgraded and "Engines:6" or "Engines:1",CFrame.new(0,2.12-(upgraded and .2393 or .2504),-1.6)*CFrame.Angles(0,PI/2,0),"engine")
 add(upgraded and "Fuel:1" or "Fuel:8",CFrame.new(0,2.12,2.55)*CFrame.Angles(0,PI/2,0),"fuel")
 if upgraded then
  for _,x in {-1,1} do
   add("blocks:5",CFrame.new(x,2.12,.8),"armor")
   add("Supports_RocketThruster",CFrame.new(x,2.12,3.1),"boost")
  end
 end
 -- A compact cockpit provides a readable silhouette while using the real parts.
 local seat=part(model,"Cockpit",V(1.55,.3,1.45),CFrame.identity,Color3.fromRGB(30,30,44))
 table.insert(nodes,{model=seat,cf=CFrame.new(0,2.4,.4),kind="seat",index=20})
 for _,x in {-1.4,1.4} do
  local lamp=part(model,"Headlight",V(.6,.32,.22),CFrame.identity,cyan,Enum.Material.Neon)
  table.insert(nodes,{model=lamp,cf=CFrame.new(x,2,-4),kind="lamp",index=21})
 end
 -- The player's avatar is only a cinematic copy.
 if player.Character then
  local old=player.Character.Archivable; player.Character.Archivable=true
  local avatar=player.Character:Clone(); player.Character.Archivable=old
  if avatar then
   clean(avatar,true); avatar.Name="Driver"; avatar.Parent=model
   local human=avatar:FindFirstChildOfClass("Humanoid")
   if human then human.DisplayDistanceType=Enum.HumanoidDisplayDistanceType.None; human.BreakJointsOnDeath=false end
   for _,p in avatar:GetDescendants() do if p:IsA("BasePart") then p.CanCollide=false end end
   local root=avatar:FindFirstChild("HumanoidRootPart")
   if root then
    avatar.PrimaryPart=root; avatar:PivotTo(CFrame.identity)
    -- Bake the seated pose into the anchored copy, so it cannot revert to idle.
    local joints={}
    for _,joint in avatar:GetDescendants() do if joint:IsA("Motor6D") then
     local bend=CFrame.identity
     if joint.Name:find("Hip") then bend=CFrame.Angles(-1.25,0,0)
     elseif joint.Name:find("Knee") then bend=CFrame.Angles(1.1,0,0)
     elseif joint.Name:find("Shoulder") then bend=CFrame.Angles(-1.05,0,0)
     elseif joint.Name:find("Elbow") then bend=CFrame.Angles(-.35,0,0) end
     table.insert(joints,{a=joint.Part0,b=joint.Part1,c0=joint.C0,c1=joint.C1,bend=bend})
    end end
    for _=1,8 do for _,j in joints do if j.a and j.b then j.b.CFrame=j.a.CFrame*j.c0*j.bend*j.c1:Inverse() end end end
    for _,accessory in avatar:GetChildren() do if accessory:IsA("Accessory") then
     local handle=accessory:FindFirstChild("Handle")
     local weld=handle and handle:FindFirstChild("AccessoryWeld")
     if weld and weld.Part1 then handle.CFrame=weld.Part1.CFrame*weld.C1*weld.C0:Inverse() end
    end end
    for _,joint in avatar:GetDescendants() do if joint:IsA("Motor6D") or joint:IsA("Weld") then joint:Destroy() end end
   end
   table.insert(nodes,{model=avatar,cf=CFrame.new(0,3.5,.5),kind="driver",index=22})
  end
 end
 return {model=model,nodes=nodes}
end
local function moveCar(car,cf,travel,assembly)
 for n,node in car.nodes do
  local target=node.cf
  local alpha=1
  if assembly then
   local delay=node.kind=="slab" and (n-1)*.105 or node.kind=="wheel" and 1.15+(node.index-1)*.16 or node.kind=="engine" and 2.05 or node.kind=="fuel" and 2.5 or 2.9
   alpha=out((assembly-delay)/.65)
   local from=node.kind=="wheel" and CFrame.new((node.index%2==0 and 1 or -1)*11,0,0)
    or CFrame.new(0,7+(n%3),0)*CFrame.Angles(0,PI*.7,0)
   target=from:Lerp(CFrame.identity,alpha)*target
  end
  if node.kind=="wheel" then
   target=target*CFrame.new(0,node.size.Y/2,0)*CFrame.Angles(0,0,-(travel or 0)/(node.size.Y/2))*CFrame.new(0,-node.size.Y/2,0)
  end
  local bob=assembly and 0 or math.sin((travel or 0)*1.5)*.035
  node.model:PivotTo(cf*CFrame.new(0,bob,0)*target)
 end
end
local function enemy(s,template,index)
 local m=template:Clone(); clean(m); m.Parent=s.stage
 local mesh=m:FindFirstChild("Mesh",true)
 local meshToPivot=mesh and mesh.CFrame:ToObjectSpace(m:GetPivot()) or CFrame.identity
 m:PivotTo(pose(0,0,0)*meshToPivot)
 local box,size=m:GetBoundingBox()
 local bottom=box.Position.Y-size.Y/2-origin.Y
 local joints={}
 if mesh then
  for _,b in mesh:GetDescendants() do if b:IsA("Bone") then
   b.Transform=CFrame.identity
   joints[b.Name]={bone=b,axis=b.WorldCFrame:VectorToObjectSpace(mesh.CFrame.RightVector).Unit}
  end end
 end
 return {model=m,rotation=meshToPivot,bottom=bottom,joints=joints,index=index,height=size.Y}
end
local function moveEnemy(e,x,z,time,hit)
 local angle=hit>0 and hit*5 or 0
 local height=hit>0 and math.sin(math.min(hit,1)*PI)*9 or 0
 local knock=hit*14
 e.model:PivotTo(pose(x+knock, -e.bottom+height, z-knock*.4)*CFrame.Angles(0,PI,angle)*e.rotation)
 for name,j in e.joints do
  local amplitude=(name=="Bone.010" or name=="Bone.007" or name=="Bone.008.L" or name=="Bone.011.R") and .42 or .1
  local sign=(name:find("R") or name=="Bone.013" or name=="Bone.008") and -1 or 1
  j.bone.Transform=CFrame.fromAxisAngle(j.axis,math.sin(time*12+e.index)*amplitude*sign)
 end
end
local function buildStage(s)
 s.catalog=G.Catalog(); s.stage=Instance.new("Folder"); s.stage.Name="LocalTrailerStage"; s.stage.Parent=workspace
 part(s.stage,"Grass",V(240,2,320),pose(0,-1,-75),Color3.fromRGB(113,176,24))
 part(s.stage,"BuildPlot",V(30,.12,30),pose(0,.07,0),Color3.fromRGB(192,169,224))
 part(s.stage,"Runway",V(28,.06,190),pose(0,.08,-100),Color3.fromRGB(149,180,64))
 for i=0,18 do
  part(s.stage,"TrackMarker",V(.25,.08,4),pose(-14,.14,-i*10),cyan,Enum.Material.Neon)
  part(s.stage,"TrackMarker",V(.25,.08,4),pose(14,.14,-i*10),cyan,Enum.Material.Neon)
 end
 for i=0,12 do
  for _,side in {-1,1} do
   local height=22+(i%4)*6
   part(s.stage,"Cliff",V(25,height,27),pose(side*(48+(i%3)*4),height/2-1,-i*26+35),Color3.fromRGB(152+(i%3)*10,65,34))
   part(s.stage,"GrassCap",V(26,1,28),pose(side*(48+(i%3)*4),height-.5,-i*26+35),Color3.fromRGB(114,173,26))
  end
 end
 for i=0,16 do
  local x=(i%2==0 and -1 or 1)*(23+i%3*3); local z=25-i*12
  part(s.stage,"Trunk",V(1,5,1),pose(x,2.5,z),Color3.fromRGB(111,65,36))
  part(s.stage,"Crown",V(6,5,6),pose(x,6,z),Color3.fromRGB(79,154,38))
 end
 s.starter=createCar(s,false); s.hero=createCar(s,true)
 s.enemies={}
 local templates=RS:WaitForChild("TrailerAssets"):WaitForChild("Brainrots"):GetChildren()
 for i=1,9 do table.insert(s.enemies,enemy(s,templates[(i-1)%#templates+1],i)) end
 s.cash={}
 for i=1,32 do
  local p=part(s.stage,"Cash",V(.7,.06,1.3),pose(0,0,0),Color3.fromRGB(80,248,87)); p.TopSurface=Enum.SurfaceType.Smooth
  table.insert(s.cash,p)
 end
 s.spin=Instance.new("Model"); s.spin.Name="SpinReveal"; s.spin.Parent=s.stage
 local station=RS.TrailerAssets:FindFirstChild("SpinStation")
 if station then
  local clone=station:Clone(); clean(clone); clone.Parent=s.spin
  clone:PivotTo(pose(0,0,0))
  s.turntable=clone:FindFirstChild("PLATFORM")
  if s.turntable then s.turntableCF=pose(0,0,0):ToObjectSpace(s.turntable:GetPivot()) end
  s.lever=clone:FindFirstChild("parts spin")
  if s.lever then s.leverCF=s.lever.CFrame end
 end
 if not station then part(s.spin,"RevealPedestal",V(8,.4,8),pose(0,.3,0),Color3.fromRGB(40,24,55)) end
 s.spinItems={}
 for i,id in {"blocks:10","tires:3","Fuel:8","Engines:1","blocks:5","Engines:6"} do
  local m,size=G.Clone(s.catalog[id]); clean(m); m.Parent=s.spin
  if i==6 then m:ScaleTo(m:GetScale()*1.65) end
  table.insert(s.spinItems,{model=m,size=size,index=i})
 end
 s.flash=Instance.new("ColorCorrectionEffect"); s.flash.Name="TrailerGrade"; local gameplayGrade=Lighting:FindFirstChild("GameplayGrade"); local hasGrade=gameplayGrade and gameplayGrade.Enabled; s.flash.Saturation=hasGrade and 0 or .08; s.flash.Contrast=hasGrade and 0 or .035; s.flash.Parent=Lighting
 s.gui=Instance.new("ScreenGui"); s.gui.Name="TrailerOverlay"; s.gui.IgnoreGuiInset=true; s.gui.ResetOnSpawn=false; s.gui.DisplayOrder=10000; s.gui.Parent=player.PlayerGui
 local safe=Instance.new("Frame"); safe.Name="PortraitSafeArea"; safe.BackgroundTransparency=1; safe.AnchorPoint=Vector2.new(.5,.5); safe.Position=UDim2.fromScale(.5,.5); safe.Size=UDim2.fromScale(1,1); safe.Parent=s.gui
 local aspect=Instance.new("UIAspectRatioConstraint"); aspect.AspectRatio=9/16; aspect.DominantAxis=Enum.DominantAxis.Height; aspect.Parent=safe
 s.caption=label(safe,"Caption",.16,.09,"",Color3.new(1,1,1))
 s.sub=label(safe,"Subcaption",.245,.045,"",gold)
 s.reward=label(safe,"Reward",.66,.09,"",gold)
 s.count=label(safe,"Countdown",.5,.18,"",gold)
 s.white=Instance.new("Frame"); s.white.Name="ImpactFlash"; s.white.Size=UDim2.fromScale(1,1); s.white.BackgroundColor3=Color3.new(1,1,1); s.white.BorderSizePixel=0; s.white.BackgroundTransparency=1; s.white.ZIndex=10; s.white.Parent=s.gui
 s.sound=Instance.new("Sound"); s.sound.SoundId="rbxassetid://138826200740867"; s.sound.Volume=.5; s.sound.Parent=s.gui
 s.tick=Instance.new("Sound");s.tick.SoundId="rbxassetid://137872392480008";s.tick.Volume=.45;s.tick.Parent=s.gui
 s.roll=Instance.new("Sound");s.roll.SoundId="rbxassetid://80854650043151";s.roll.Volume=.4;s.roll.Parent=s.gui
 s.lastBeat=-1
end
local function shot(s,position,target,fov)
 local camera=workspace.CurrentCamera
 camera.CameraType=Enum.CameraType.Scriptable
 camera.CFrame=CFrame.lookAt(origin+position,origin+target)
 camera.FieldOfView=fov
end
local function draw(s,t)
 local time=math.max(t,0)
 s.count.Visible=t<0; s.count.Text=t<0 and tostring(math.ceil(-t)) or ""
 s.caption.Visible=t>=0; s.sub.Visible=t>=0; s.reward.Text=""
 local scene=time<2 and 1 or time<5 and 2 or time<10 and 3 or time<16 and 4 or time<19 and 5 or 6
 visible(s.starter.model,scene==3 or scene==5 and time<17.3)
 visible(s.hero.model,scene==1 or scene==4 or scene==5 and time>=17.3 or scene==6)
 visible(s.spin,scene==2)
 for _,e in s.enemies do visible(e.model,scene==1 or scene==4) end
 for _,p in s.cash do p.LocalTransparencyModifier=1 end
 local impact=0
 if scene==1 or scene==4 then
  local dt=scene==1 and time+2.3 or time-10
  local travel=dt*19; local z=12-travel
  local carCf=pose(math.sin(dt*1.3)*1.2,0,z)*CFrame.Angles(0,math.sin(dt*1.3)*.05,0)
  moveCar(s.hero,carCf,travel)
  for i,e in s.enemies do
   local enemyZ=-10-(i-1)*12
   local hit=math.clamp((enemyZ-z)/19+.12,0,1.8)
   visible(e.model,hit<1.35)
   local x=(i%3-1)*2.3
   moveEnemy(e,x,enemyZ,time,hit)
   if hit>.01 and hit<.12 then impact=math.max(impact,1-hit/.12) end
   if hit>0 then
    local cashIndex=(i-1)*3+1
    for k=cashIndex,math.min(cashIndex+2,#s.cash) do
     local p=s.cash[k]; p.LocalTransparencyModifier=hit>1.2 and 1 or 0
     p.CFrame=pose(x+math.sin(k*4)*hit*5,1+math.sin(math.min(hit/1.2,1)*PI)*5,enemyZ+math.cos(k*3)*hit*5)*CFrame.Angles(hit*4,k,hit*3)
    end
   end
  end
  local shake=V(math.sin(time*75),math.cos(time*61),0)*impact*.11
  if scene==1 then
   shot(s,V(15,6.5,z-8)+shake,V(0,2.5,z),53)
   s.caption.Text="THIS STARTED"; s.sub.Text="WITH ONE SPIN."
  elseif time<12.3 then
   shot(s,V(10,5,z+12)+shake,V(0,2.5,z-3),58)
   s.caption.Text="DRIVE."; s.sub.Text="YOUR BUILD. YOUR RULES."
  elseif time<14.6 then
   shot(s,V(-14,5,z-6)+shake,V(0,2.4,z-2),59)
   s.caption.Text="DESTROY."; s.sub.Text="TURN BRAINROTS INTO CASH."
  else
   shot(s,V(0,13,z+15)+shake,V(0,1.8,z-7),62)
   s.caption.Text="GET PAID."; s.sub.Text="BUILD SOMETHING BIGGER."
  end
 elseif scene==2 then
  local dt=time-2; local progress=smooth((dt-1.65)/.8)
  local rotation=dt*12*(1-progress)+PI*.25*progress
  if s.turntable then s.turntable:PivotTo(pose(0,0,0)*CFrame.Angles(0,rotation,0)*s.turntableCF) end
  if s.lever then s.lever.CFrame=s.leverCF*CFrame.Angles(0,0,-.5*math.sin(math.min(dt/.45,1)*PI)) end
  for i,node in s.spinItems do
   visible(node.model,dt<1.85 or i==6)
   local a=rotation+(i-1)*2*PI/6
   local radius=5.8*(1-progress)
   node.model:PivotTo(pose(math.cos(a)*radius,3.2+math.sin(dt*4)*.13,math.sin(a)*radius)*CFrame.Angles(0,-a+PI/2,0))
  end
  shot(s,V(12-4*progress,7-2*progress,16-5*progress),V(0,3.3,0),55-7*progress)
  s.caption.Text="SPIN FOR PARTS."; s.sub.Text=dt>1.9 and "BIG DROP. BIGGER POSSIBILITIES." or "ONE SPIN. ENDLESS BUILDS."
 elseif scene==3 then
  local dt=time-5
  moveCar(s.starter,pose(0,0,0),0,dt)
  local angle=-.7+dt*.3
  shot(s,V(math.sin(angle)*15,8-dt*.38,-math.cos(angle)*16),V(0,2.9,0),50)
  s.caption.Text="BUILD YOUR CAR."; s.sub.Text=dt<1.2 and "START WITH A SLAB." or dt<2.1 and "ADD YOUR WHEELS." or dt<3.1 and "DROP IN THE POWER." or "READY TO ROLL."
 elseif scene==5 then
  local dt=time-16; local upgraded=time>=17.3
  moveCar(upgraded and s.hero or s.starter,pose(0,0,0),0)
  shot(s,V(12-dt*1.5,6,-16+dt*2),V(0,2.5,0),51)
  s.caption.Text="EARN. UPGRADE."; s.sub.Text="REPEAT."
  s.reward.Text=dt<1.3 and "+ CASH" or "NEXT LEVEL."
  impact=math.max(0,1-math.abs(time-17.3)/.16)
  for i,p in s.cash do
   local a=i*2.399+dt*1.5; local r=6-dt*1.4
   p.LocalTransparencyModifier=0; p.CFrame=pose(math.cos(a)*r,2+(i%7)*.65+math.sin(dt*3+i),math.sin(a)*r)*CFrame.Angles(dt*2,i,dt)
  end
 else
  local dt=time-19; local a=-.45+dt*.22
  moveCar(s.hero,pose(0,0,0),0)
  shot(s,V(math.sin(a)*17,6.8,-math.cos(a)*17),V(0,2.6,0),53)
  s.caption.Text=Director.Title; s.sub.Text="WHAT WILL YOU BUILD?"
 end
 s.white.BackgroundTransparency=1-impact*.45
 s.flash.Brightness=impact*.09
 local beat=scene==2 and math.floor(time*12) or math.floor(time*3)
 if beat~=s.lastBeat then
  s.lastBeat=beat
  if scene==2 and time<3.8 or scene==3 and time<8.4 then s.tick.PlaybackSpeed=scene==2 and 1.2 or .85;s.tick:Play() end
 end
 if scene~=s.lastScene then
  s.lastScene=scene
  if scene==2 then s.roll:Play() elseif scene==5 or scene==6 then s.sound:Play() end
 end
 if time>=3.9 and time<5 and not s.revealed then s.revealed=true;s.sound:Play() end
 local phase=scene==1 and time or scene==2 and time-2 or scene==3 and time-5 or scene==4 and time-10 or scene==5 and time-16 or time-19
 local pop=out(phase/.22)
 s.caption.Position=UDim2.fromScale(.5,.16+(1-pop)*.04)
 s.caption.Size=UDim2.fromScale(.9,scene==6 and .13 or .09)
 s.sub.Position=UDim2.fromScale(.5,scene==6 and .28 or .245)
 s.caption.TextTransparency=1-pop; s.sub.TextTransparency=1-pop
end
function Director.IsPlaying() return state~=nil end
function Director.Cancel()
 local s=state; if not s then return end; state=nil
 Run:UnbindFromRenderStep("TrailerDirector")
 CAS:UnbindAction("TrailerBlockControls")
 if s.connection then s.connection:Disconnect() end
 if s.respawn then s.respawn:Disconnect() end
 if s.stage then s.stage:Destroy() end
 if s.gui then s.gui:Destroy() end
 if s.flash then s.flash:Destroy() end
 for gui,enabled in s.guis do if gui.Parent then gui.Enabled=enabled end end
 for effect,enabled in s.effects do if effect.Parent then effect.Enabled=enabled end end
 for kind,enabled in s.core do pcall(function() StarterGui:SetCoreGuiEnabled(kind,enabled) end) end
 UIS.MouseIconEnabled=s.mouse
 local camera=workspace.CurrentCamera
 camera.CameraType=s.cameraType; camera.CameraSubject=s.subject; camera.CFrame=s.cameraCF; camera.FieldOfView=s.fov
 if s.controls then s.controls:Enable() end
 if s.humanoid and s.humanoid.Parent then s.humanoid.WalkSpeed=s.walkSpeed; s.humanoid.JumpPower=s.jumpPower; s.humanoid.JumpHeight=s.jumpHeight; s.humanoid.AutoRotate=s.autoRotate end
 player:SetAttribute("TrailerPlaying",false)
end
function Director.Start()
 if state then return end
 local camera=workspace.CurrentCamera
 local s={guis={},effects={},core={},mouse=UIS.MouseIconEnabled,cameraType=camera.CameraType,subject=camera.CameraSubject,cameraCF=camera.CFrame,fov=camera.FieldOfView}
 state=s
 local ok,err=xpcall(function()
  for _,gui in player.PlayerGui:GetChildren() do if gui:IsA("ScreenGui") then s.guis[gui]=gui.Enabled end end
  for gui in s.guis do gui.Enabled=false end
  s.connection=player.PlayerGui.ChildAdded:Connect(function(gui)
   if gui:IsA("ScreenGui") and gui.Name~="TrailerOverlay" then s.guis[gui]=gui.Enabled;gui.Enabled=false end
  end)
  for _,effect in Lighting:GetChildren() do if effect:IsA("BlurEffect") or effect:IsA("DepthOfFieldEffect") then s.effects[effect]=effect.Enabled;effect.Enabled=false end end
  for _,kind in {Enum.CoreGuiType.Backpack,Enum.CoreGuiType.Chat,Enum.CoreGuiType.PlayerList,Enum.CoreGuiType.Health,Enum.CoreGuiType.EmotesMenu} do
   pcall(function() s.core[kind]=StarterGui:GetCoreGuiEnabled(kind); StarterGui:SetCoreGuiEnabled(kind,false) end)
  end
  UIS.MouseIconEnabled=false
  local pm=player.PlayerScripts:FindFirstChild("PlayerModule")
  if pm then pcall(function() s.controls=require(pm):GetControls(); s.controls:Disable() end) end
  s.humanoid=player.Character and player.Character:FindFirstChildOfClass("Humanoid")
  if s.humanoid then
   s.walkSpeed=s.humanoid.WalkSpeed; s.jumpPower=s.humanoid.JumpPower; s.jumpHeight=s.humanoid.JumpHeight; s.autoRotate=s.humanoid.AutoRotate
   s.humanoid.WalkSpeed=0; s.humanoid.JumpPower=0; s.humanoid.JumpHeight=0; s.humanoid.AutoRotate=false
  end
  CAS:BindActionAtPriority("TrailerBlockControls",function() return Enum.ContextActionResult.Sink end,false,3000,Enum.KeyCode.W,Enum.KeyCode.A,Enum.KeyCode.S,Enum.KeyCode.D,Enum.KeyCode.Space,Enum.UserInputType.MouseButton1,Enum.UserInputType.MouseButton2)
  player:SetAttribute("TrailerPlaying",true)
  buildStage(s); s.started=os.clock()+3
  s.respawn=player.CharacterRemoving:Connect(Director.Cancel)
  Run:BindToRenderStep("TrailerDirector",Enum.RenderPriority.Camera.Value+100,function()
   local t=s.preview or (os.clock()-s.started)
   if t>=Director.Duration then Director.Cancel(); return end
   local success,message=xpcall(function()
    for gui in s.guis do if gui.Parent and gui.Enabled then gui.Enabled=false end end
    for effect in s.effects do if effect.Parent then effect.Enabled=false end end
    draw(s,t)
   end,debug.traceback)
   if not success then warn("Trailer: "..message); Director.Cancel() end
  end)
 end,debug.traceback)
 if not ok then warn("Trailer: "..err); Director.Cancel() end
end
-- Deterministic still-frame inspection; the J shortcut always runs normally.
function Director.Preview(seconds) if not state then Director.Start() end; if state then state.preview=math.clamp(seconds,0,21.99) end end
function Director.Resume() if state then state.started=os.clock()-(state.preview or 0);state.preview=nil end end
return Director
