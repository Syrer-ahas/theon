-- Render approved slides for every nearby player; physics remains server controlled.
local Players=game:GetService("Players")
local RunService=game:GetService("RunService")
local config=require(game.ReplicatedStorage:WaitForChild("HussR6AnimationPack"):WaitForChild("Player")).Config
local states={}
local watchers={}
local function attachment(root,name,position)
 local a=Instance.new("Attachment") a.Name=name a.Position=position a.Parent=root return a
end
local function cleanup(char)
 local s=states[char] if not s then return end
 states[char]=nil
 for _,v in ipairs(s.owned) do v:Destroy() end
end
local function attach(char)
 local root=char:WaitForChild("HumanoidRootPart",10)
 local hum=char:WaitForChild("Humanoid",10)
 if not root or not hum or not char.Parent or states[char] then return end
 local folder=Instance.new("Folder") folder.Name="HussSlideVFX" folder.Parent=char
 local contact=attachment(root,"HussSlideGroundFX",Vector3.new(0,-2.8,.8))
 local owned={folder,contact}
 local dust=Instance.new("ParticleEmitter")
 dust.Name="GroundDust" dust.Texture="rbxasset://textures/particles/smoke_main.dds"
 dust.Enabled=false dust.Rate=38 dust.Lifetime=NumberRange.new(.22,.48)
 dust.Speed=NumberRange.new(3,7) dust.SpreadAngle=Vector2.new(38,24)
 dust.EmissionDirection=Enum.NormalId.Back dust.Drag=6 dust.VelocityInheritance=.12
 dust.Acceleration=Vector3.new(0,2,0) dust.Rotation=NumberRange.new(0,360)
 dust.RotSpeed=NumberRange.new(-35,35)
 dust.Size=NumberSequence.new({NumberSequenceKeypoint.new(0,.35),NumberSequenceKeypoint.new(.5,1.15),NumberSequenceKeypoint.new(1,1.8)})
 dust.Transparency=NumberSequence.new({NumberSequenceKeypoint.new(0,.55),NumberSequenceKeypoint.new(.35,.7),NumberSequenceKeypoint.new(1,1)})
 dust.LightInfluence=.7 dust.Parent=contact
 local grit=Instance.new("ParticleEmitter")
 grit.Name="SlideGrit" grit.Texture="rbxasset://textures/particles/sparkles_main.dds"
 grit.Enabled=false grit.Rate=16 grit.Lifetime=NumberRange.new(.12,.28)
 grit.Speed=NumberRange.new(7,12) grit.SpreadAngle=Vector2.new(55,12)
 grit.EmissionDirection=Enum.NormalId.Back grit.Drag=10 grit.Acceleration=Vector3.new(0,-12,0)
 grit.Size=NumberSequence.new({NumberSequenceKeypoint.new(0,.12),NumberSequenceKeypoint.new(1,0)})
 grit.Transparency=NumberSequence.new({NumberSequenceKeypoint.new(0,.2),NumberSequenceKeypoint.new(1,1)})
 grit.LightEmission=.35 grit.Color=ColorSequence.new(Color3.fromRGB(255,235,179))
 grit.Parent=contact
 local trails={}
 for _,side in ipairs({-1,1}) do
  local a=attachment(root,"HussSlideRibbonA"..side,Vector3.new(side*1.05,-.95,.5))
  local b=attachment(root,"HussSlideRibbonB"..side,Vector3.new(side*1.05,-.75,.5))
  table.insert(owned,a) table.insert(owned,b)
  local t=Instance.new("Trail") t.Name="SpeedRibbon"..side t.Attachment0=a t.Attachment1=b
  t.Enabled=false t.Lifetime=.14 t.MinLength=.05 t.FaceCamera=true
  t.LightEmission=.6 t.Color=ColorSequence.new(Color3.fromRGB(255,243,199),Color3.fromRGB(238,249,255))
  t.WidthScale=NumberSequence.new({NumberSequenceKeypoint.new(0,1),NumberSequenceKeypoint.new(1,0)})
  t.Transparency=NumberSequence.new({NumberSequenceKeypoint.new(0,.22),NumberSequenceKeypoint.new(1,1)})
  t.Parent=folder table.insert(trails,t)
 end
 local ray=RaycastParams.new() ray.FilterType=Enum.RaycastFilterType.Exclude
 ray.FilterDescendantsInstances={char} ray.RespectCanCollide=true
 states[char]={root=root,hum=hum,folder=folder,contact=contact,dust=dust,grit=grit,trails=trails,owned=owned,ray=ray,active=false,lastStart=nil}
end
local function watch(player)
 local connections={}
 connections[1]=player.CharacterAdded:Connect(function(char) task.spawn(attach,char) end)
 connections[2]=player.CharacterRemoving:Connect(cleanup)
 watchers[player]=connections
 if player.Character then task.spawn(attach,player.Character) end
end
local added=Players.PlayerAdded:Connect(watch)
local removed=Players.PlayerRemoving:Connect(function(player)
 for _,connection in ipairs(watchers[player] or {}) do connection:Disconnect() end
 watchers[player]=nil
 if player.Character then cleanup(player.Character) end
end)
for _,player in ipairs(Players:GetPlayers()) do watch(player) end
local heartbeat=RunService.Heartbeat:Connect(function()
 local now=workspace:GetServerTimeNow()
 local camera=workspace.CurrentCamera
 for char,s in pairs(states) do
  if not char.Parent or not s.root.Parent then cleanup(char) continue end
  local start=char:GetAttribute("SlideStart")
  local elapsed=typeof(start)=="number" and now-start or math.huge
  local speed=Vector3.new(s.root.AssemblyLinearVelocity.X,0,s.root.AssemblyLinearVelocity.Z).Magnitude
  local near=not camera or (camera.CFrame.Position-s.root.Position).Magnitude<180
  local approved=Players.LocalPlayer:GetAttribute("HussVFXEnabled")~=false and elapsed>=0 and elapsed<config.SlideDuration and s.hum.Health>0 and speed>5 and near
  local hit=approved and workspace:Raycast(s.root.Position,Vector3.new(0,-5,0),s.ray)
  local active=approved and hit~=nil
  if active then
   local ground=hit.Instance:IsA("BasePart") and hit.Instance.Color or workspace.Terrain:GetMaterialColor(hit.Material)
   s.dust.Color=ColorSequence.new(ground:Lerp(Color3.fromRGB(202,186,155),.5))
   s.contact.Position=s.root.CFrame:PointToObjectSpace(hit.Position+Vector3.new(0,.16,0)+s.root.CFrame.LookVector*-.6)
   s.dust.Rate=math.clamp(speed*1.3,18,45)
   if s.lastStart~=start then
    s.lastStart=start s.dust:Emit(15) s.grit:Emit(10)
    for _,trail in ipairs(s.trails) do trail:Clear() end
   end
  end
  s.active=active
  s.folder:SetAttribute("Active",active)
  s.dust.Enabled=active s.grit.Enabled=active
  for _,trail in ipairs(s.trails) do trail.Enabled=active end
 end
end)
script.Destroying:Connect(function()
 heartbeat:Disconnect() added:Disconnect() removed:Disconnect()
 for _,list in pairs(watchers) do for _,connection in ipairs(list) do connection:Disconnect() end end
 local chars={} for char in pairs(states) do table.insert(chars,char) end
 for _,char in ipairs(chars) do cleanup(char) end
end)

