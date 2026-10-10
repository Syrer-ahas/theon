-- Walk for one second, then ease into running. Slides remain server validated.
local Players=game:GetService("Players")
local RunService=game:GetService("RunService")
local PhysicsService=game:GetService("PhysicsService")
local visualGroup="HussSlideVisual"
pcall(function() PhysicsService:RegisterCollisionGroup(visualGroup) end)
for _,group in ipairs(PhysicsService:GetRegisteredCollisionGroups()) do
 PhysicsService:CollisionGroupSetCollidable(visualGroup,group.name,false)
end
local slideHitbox=require(script.Parent:WaitForChild("SlideHitbox"))
local titleProgress=require(script.Parent:WaitForChild("TitleAchievements"))
local package=game:GetService("ReplicatedStorage"):WaitForChild("HussR6AnimationPack")
local config=require(package.Player).Config
local remote=package.Movement
local cooldown,active,lastRequest={},{},{}
local headLookSent={}
local lastDashReset={}
local locomotion={}
local function baseSpeed(char) return char:GetAttribute("LocomotionMode")=="Run" and config.MoveSpeed or config.WalkSpeed end
local function finish(player)
 local slide=active[player]
 active[player]=nil
 if not slide then return end
 slide.velocity:Destroy()
 slide.attachment:Destroy()
 local function restoreCollision()
  if slide.collider then slide.collider:Destroy() end
  for part,original in pairs(slide.collisions or {}) do
   if part.Parent then
    part.CollisionGroup=original.group
    part.CanCollide=original.collidable
   end
  end
 end
 -- Keep the fixed collision shape through the visual recovery, then restore the rig.
 if slide.hum.Parent and slide.hum.Health>0 then task.delay(.1,restoreCollision) else restoreCollision() end
 if slide.hum.Parent then
  slide.hum.AutoRotate=slide.autoRotate
  slide.hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false)
  slide.hum.WalkSpeed=baseSpeed(slide.character)
 end
 if slide.character.Parent then slide.character:SetAttribute("SlideStart",nil) end
end
local function onCharacter(player,char)
 finish(player) cooldown[player]=nil lastRequest[player]=nil
 locomotion[player]={character=char,started=nil,stopped=nil}
 char:SetAttribute("MovementStarted",nil) char:SetAttribute("LocomotionMode","Walk")
 local hum=char:WaitForChild("Humanoid")
 if player.Character~=char then return end
 hum.WalkSpeed=baseSpeed(char)
 hum.UseJumpPower=true hum.JumpPower=0 hum.JumpHeight=0 hum.Jump=false
 hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false)
 task.spawn(function()
  local ok,description=pcall(function() return Players:GetHumanoidDescriptionFromUserIdAsync(player.UserId) end)
  if ok and hum.Parent and player.Character==char then
   local applied,err=pcall(function() hum:ApplyDescriptionAsync(description) end)
   if not applied then warn("R6 avatar appearance could not load:",err) end
   if hum.Parent and not active[player] then hum.WalkSpeed=baseSpeed(char) end
  end
 end)
 assert(hum.RigType==Enum.HumanoidRigType.R6,"Huss Balley requires an R6 StarterCharacter")
 hum.Died:Connect(function() finish(player) end)
end
local function watch(player)
 player.CharacterAdded:Connect(function(char) onCharacter(player,char) end)
 if player.Character then task.spawn(onCharacter,player,player.Character) end
end
Players.PlayerAdded:Connect(watch)
for _,p in ipairs(Players:GetPlayers()) do watch(p) end
Players.PlayerRemoving:Connect(function(p)
 finish(p) cooldown[p]=nil lastRequest[p]=nil headLookSent[p]=nil lastDashReset[p]=nil locomotion[p]=nil
end)
remote.OnServerEvent:Connect(function(player,action,value)
 if action=="Locomotion" then
  if type(value)~="boolean" then return end
  local data=locomotion[player] local char=player.Character local hum=char and char:FindFirstChildOfClass("Humanoid")
  if not data or data.character~=char or not hum or hum.Health<=0 then return end
  data.intent=value
  if value and not data.started then data.started=workspace:GetServerTimeNow() char:SetAttribute("MovementStarted",data.started) end
  return
 end
 if action=="HeadLook" then
  if typeof(value)~="Vector3" or value.X~=value.X or value.Y~=value.Y or value.Z~=value.Z then return end
  local magnitude=value.Magnitude
  if magnitude<.9 or magnitude>1.1 then return end
  local now=os.clock()
  if now-(headLookSent[player] or -math.huge)<.08 then return end
  local char=player.Character
  local hum=char and char:FindFirstChildOfClass("Humanoid")
  if not hum or hum.Health<=0 then return end
  headLookSent[player]=now
  char:SetAttribute("HeadLookDirection",value.Unit)
  return
 end
 if action=="SlideSteer" then
  local slide=active[player]
  if not slide or typeof(value)~="Vector3" then return end
  local now=workspace:GetServerTimeNow()
  if now-(slide.lastSteer or 0)<.02 then return end
  slide.lastSteer=now
  local magnitude=value.Magnitude
  if magnitude~=magnitude or magnitude>1.05 then return end
  local input=Vector3.new(value.X,0,value.Z)
  if input.Magnitude>.1 then
   slide.inputDirection=input.Unit
  else slide.inputDirection=nil end
  return
 end
 if action~="Slide" then return end
 local now=workspace:GetServerTimeNow()
 if now-(lastRequest[player] or 0)<.08 then return end
 lastRequest[player]=now
 local char=player.Character
 local hum=char and char:FindFirstChildOfClass("Humanoid")
 local root=char and char:FindFirstChild("HumanoidRootPart")
 if not hum or not root or hum.Health<=0 then return end
 local reset=char:GetAttribute("DashResetAt") or 0
 if reset>(lastDashReset[player] or 0) then lastDashReset[player]=reset cooldown[player]=0 end
 if active[player] or now<(cooldown[player] or 0) or hum.Sit or hum.FloorMaterial==Enum.Material.Air then return end
 local velocity=Vector3.new(root.AssemblyLinearVelocity.X,0,root.AssemblyLinearVelocity.Z)
 if velocity.Magnitude<8 then return end
 local direction=velocity.Unit
 if typeof(value)=="Vector3" and value.Magnitude==value.Magnitude and value.Magnitude<=1.05 then
  local requested=Vector3.new(value.X,0,value.Z)
  if requested.Magnitude>.1 then direction=requested.Unit end
 end
 local attachment=Instance.new("Attachment") attachment.Name="HussSlideAttachment" attachment.Parent=root
 local actuator=Instance.new("LinearVelocity")
 actuator.Name="HussSlideVelocity" actuator.Attachment0=attachment
 actuator.RelativeTo=Enum.ActuatorRelativeTo.World
 actuator.VelocityConstraintMode=Enum.VelocityConstraintMode.Plane
 actuator.PrimaryTangentAxis=Vector3.new(1,0,0)
 actuator.SecondaryTangentAxis=Vector3.new(0,0,1)
 actuator.ForceLimitsEnabled=false
 actuator.PlaneVelocity=Vector2.new(direction.X,direction.Z)*config.SlideSpeed
 actuator.Parent=root
 local ray=RaycastParams.new() ray.FilterType=Enum.RaycastFilterType.Exclude
 ray.FilterDescendantsInstances={char} ray.RespectCanCollide=true
 -- The fixed collider carries physics; the lowered animated torso cannot drag on the floor.
 local collisions={}
 for _,name in ipairs({"Torso","Head","Right Arm","Left Arm","Right Leg","Left Leg"}) do
  local part=char:FindFirstChild(name)
  if part then
   collisions[part]={collidable=part.CanCollide,group=part.CollisionGroup}
   part.CollisionGroup=visualGroup part.CanCollide=false
  end
 end
 local collider=Instance.new("Part")
 collider.Name="HussSlideCollider" collider.Size=Vector3.new(1.8,3.8,1.2)
 collider.Transparency=1 collider.Massless=true collider.CanCollide=true collider.CanTouch=true collider.CanQuery=false
 collider.CollisionGroup=slideHitbox.SupportGroup collider.CFrame=root.CFrame*CFrame.new(0,-1.05,0)
 collider.CustomPhysicalProperties=PhysicalProperties.new(.7,.05,0,100,100)
 collider.Parent=char
 local weld=Instance.new("WeldConstraint") weld.Part0=root weld.Part1=collider weld.Parent=collider
 -- Keep character simulation on its owning client after changing the assembly.
 local canOwn=root:CanSetNetworkOwnership()
 if canOwn then root:SetNetworkOwner(player) end
 local slide={character=char,hum=hum,root=root,attachment=attachment,velocity=actuator,start=now,lastGrounded=now,direction=direction,initialDirection=direction,autoRotate=hum.AutoRotate,ray=ray,collider=collider,collisions=collisions}
 active[player]=slide
 task.delay(config.SlideDuration+.05,function() if active[player]==slide then finish(player) end end)
 cooldown[player]=now+config.SlideCooldown
 hum.AutoRotate=false hum.WalkSpeed=baseSpeed(char)
 hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false)
 char:SetAttribute("AntiCheatSlideUntil",now+config.SlideDuration+.65)
 char:SetAttribute("SlideStart",now)
 local gameRemotes=game.ReplicatedStorage:FindFirstChild("GameRemotes")
 local role=player:GetAttribute("PlayerRole")
 if gameRemotes and gameRemotes:GetAttribute("RoundState")=="Active" and (role=="Runner" or role=="Thrower") then titleProgress.Record(player,"Slide") end
end)
RunService.Heartbeat:Connect(function(dt)
 local now=workspace:GetServerTimeNow()
 for player,data in pairs(locomotion) do
  local char=data.character local hum=char:FindFirstChildOfClass("Humanoid") local root=char:FindFirstChild("HumanoidRootPart")
  if hum and root and hum.Health>0 and not active[player] then
   local velocity=Vector3.new(root.AssemblyLinearVelocity.X,0,root.AssemblyLinearVelocity.Z)
   if (data.intent==true or (data.intent==nil and velocity.Magnitude>2)) and not hum.Sit then
    data.stopped=nil
    if not data.started then data.started=now char:SetAttribute("MovementStarted",now) end
   else
    data.stopped=data.stopped or now
    if now-data.stopped>.12 then data.started=nil char:SetAttribute("MovementStarted",nil) end
   end
   local elapsed=data.started and now-data.started or 0
   local blend=math.clamp((elapsed-1)/.22,0,1) blend=blend*blend*(3-2*blend)
   local mode=elapsed>=1 and "Run" or "Walk"
   if char:GetAttribute("LocomotionMode")~=mode then char:SetAttribute("LocomotionMode",mode) end
   local multiplier=(char:GetAttribute("SecondWindUntil") or 0)>now and 1.15 or (char:GetAttribute("AdrenalineUntil") or 0)>now and 1.1 or 1
   hum.WalkSpeed=(config.WalkSpeed+(config.MoveSpeed-config.WalkSpeed)*blend)*multiplier
  end
 end
 for player,slide in pairs(active) do
  if slide.hum.FloorMaterial~=Enum.Material.Air then slide.lastGrounded=now end
  if not slide.root.Parent or slide.hum.Health<=0 or now-slide.start>=config.SlideDuration or now-slide.lastGrounded>.08 then finish(player) continue end
  -- Accept sharp turns immediately; speed and duration remain server controlled.
  if slide.inputDirection then
   slide.direction=slide.inputDirection
  end
  local wall=workspace:Raycast(slide.root.Position,slide.direction*2.2,slide.ray)
  if wall then finish(player) continue end
  local progress=math.clamp((now-slide.start)/config.SlideDuration,0,1)
  local speed=config.MoveSpeed+(config.SlideSpeed-config.MoveSpeed)*(1-progress)^.65
  slide.velocity.PlaneVelocity=Vector2.new(slide.direction.X,slide.direction.Z)*speed
 end
end)
