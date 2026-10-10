-- Imported walk/run assets blend through a one-second walking start; custom actions stay responsive.
local Players=game:GetService("Players")
local RunService=game:GetService("RunService")
local CAS=game:GetService("ContextActionService")
local UIS=game:GetService("UserInputService")
local package=game:GetService("ReplicatedStorage"):WaitForChild("HussR6AnimationPack")
local Pack=require(package:WaitForChild("Player"))
local remote=package:WaitForChild("Movement")
local tracked={}
local lastHeadSend=0
local lastHeadDirection=Vector3.zero
local lastSteer=0
local lastLocalSlide=-math.huge
local function attach(character)
 local hum=character:WaitForChild("Humanoid",10)
 local root=character:WaitForChild("HumanoidRootPart",10)
 if not hum or not root or hum.RigType~=Enum.HumanoidRigType.R6 then return end
 if character==Players.LocalPlayer.Character then character:GetAttributeChangedSignal("DashResetAt"):Connect(function() lastLocalSlide=-math.huge end) end
 hum.CameraOffset=Vector3.zero
 hum.UseJumpPower=true hum.JumpPower=0 hum.JumpHeight=0 hum.Jump=false
 hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false)
 local joints={}
 for _,joint in ipairs(character:GetDescendants()) do
  if joint:IsA("Motor6D") and joint.Part1 then joints[joint.Part1.Name]=joint end
 end
 tracked[character]={hum=hum,root=root,joints=joints,clip="Idle",time=0,lastState=hum:GetState(),landUntil=0,current={},phase=0,smoothedSpeed=0,previousSpeed=0,turnRate=0,acceleration=0,facing=root.CFrame.LookVector,transition=1,from={},lean=CFrame.identity,actionStart=0}
 local animate=character:FindFirstChild("Animate")
 if animate and animate:IsA("LocalScript") then animate.Enabled=false end
 local animator=hum:FindFirstChildOfClass("Animator")
 if animator then for _,track in ipairs(animator:GetPlayingAnimationTracks()) do track:Stop(0) end end
end
local function watch(player)
 player.CharacterAdded:Connect(function(c) task.spawn(attach,c) end)
 if player.Character then task.spawn(attach,player.Character) end
end
Players.PlayerAdded:Connect(watch)
for _,player in ipairs(Players:GetPlayers()) do watch(player) end
-- Correct the visual pose before applying joints; never push the physical root down.
local function keepSlideAboveGround(char,data)
 local torso=data.joints.Torso
 if not torso or not data.current.Torso then return end
 if not data.slideRay then
  data.slideRay=RaycastParams.new()
  data.slideRay.FilterType=Enum.RaycastFilterType.Exclude
  data.slideRay.FilterDescendantsInstances={char}
  data.slideRay.RespectCanCollide=true
 end
 local ground=workspace:Raycast(data.root.Position,Vector3.new(0,-6,0),data.slideRay)
 if not ground or ground.Normal.Y<.6 then return end
 local worlds={[data.root.Name]=data.root.CFrame}
 local minimum=math.huge
 for _,name in ipairs({"Torso","Head","Right Arm","Left Arm","Right Leg","Left Leg"}) do
  local joint=data.joints[name]
  local parent=joint and joint.Part0 and worlds[joint.Part0.Name]
  if parent and joint.Part1 then
   local cf=parent*joint.C0*(data.current[name] or CFrame.identity)*joint.C1:Inverse()
   worlds[name]=cf
   local half=joint.Part1.Size*.5
   local normal=ground.Normal
   local radius=math.abs(cf.RightVector:Dot(normal))*half.X+math.abs(cf.UpVector:Dot(normal))*half.Y+math.abs(cf.LookVector:Dot(normal))*half.Z
   minimum=math.min(minimum,(cf.Position-ground.Position):Dot(normal)-radius)
  end
 end
 if minimum<.06 then
  local raise=math.clamp((.06-minimum)/ground.Normal.Y,0,2)
  local basis=data.root.CFrame*torso.C0
  data.current.Torso=CFrame.new(basis:VectorToObjectSpace(Vector3.new(0,raise,0)))*data.current.Torso
 end
end
local function groundLocomotion(char,data,dt)
 local torso=data.joints.Torso
 if not torso or not data.current.Torso then return end
 if not data.gaitRay then
  data.gaitRay=RaycastParams.new() data.gaitRay.FilterType=Enum.RaycastFilterType.Exclude
  data.gaitRay.FilterDescendantsInstances={char} data.gaitRay.RespectCanCollide=true
 end
 local hit=workspace:Raycast(data.root.Position,Vector3.new(0,-6,0),data.gaitRay)
 if not hit or hit.Normal.Y<.7 then data.groundOffset=0 return end
 local torsoWorld=data.root.CFrame*torso.C0*data.current.Torso*torso.C1:Inverse()
 local minimum=math.huge
 for _,name in ipairs({"Right Leg","Left Leg"}) do
  local joint=data.joints[name]
  if joint and joint.Part1 then
   local cf=torsoWorld*joint.C0*(data.current[name] or CFrame.identity)*joint.C1:Inverse()
   local half=joint.Part1.Size*.5 local normal=hit.Normal
   local radius=math.abs(cf.RightVector:Dot(normal))*half.X+math.abs(cf.UpVector:Dot(normal))*half.Y+math.abs(cf.LookVector:Dot(normal))*half.Z
   minimum=math.min(minimum,(cf.Position-hit.Position):Dot(normal)-radius)
  end
 end
 local target=minimum<math.huge and math.clamp((.035-minimum)/hit.Normal.Y,-.65,.65) or 0
 data.groundOffset=(data.groundOffset or target)+(target-(data.groundOffset or target))*(1-math.exp(-65*dt))
 -- Never interpolate through the floor while a planted foot changes.
 data.groundOffset=math.max(data.groundOffset,target)
 local basis=data.root.CFrame*torso.C0
 data.current.Torso=CFrame.new(basis:VectorToObjectSpace(Vector3.new(0,data.groundOffset,0)))*data.current.Torso
end

RunService.PreSimulation:Connect(function(dt)
 local now=workspace:GetServerTimeNow()
 for char,data in pairs(tracked) do
  if not char.Parent then tracked[char]=nil continue end
  local hum,root=data.hum,data.root
  local state=hum:GetState()
  local locked=char:GetAttribute("MovementLocked")==true
  local velocity=Vector3.new(root.AssemblyLinearVelocity.X,0,root.AssemblyLinearVelocity.Z)
  local speed=velocity.Magnitude
  if char==Players.LocalPlayer.Character then
   local moving=hum.MoveDirection.Magnitude>.1 and hum.Health>0 and not hum.Sit and not locked
   if moving~=data.moveIntent then
    data.moveIntent=moving remote:FireServer("Locomotion",moving)
    if moving then data.movementStarted=now else data.movementStopped=now end
   end
   if not moving and data.movementStopped and now-data.movementStopped>.12 then data.movementStarted=nil end

  end
  -- A brief visual brake on releasing a run. Starting again cancels it immediately.
  if locked then data.stopStart=nil data.runStopArmed=false data.movementStarted=nil end
  local isLocal=char==Players.LocalPlayer.Character
  if data.clip=="Run" and speed>16 then data.runStopArmed=true data.lastRunAt=now end
  if data.runStopArmed and now-(data.lastRunAt or 0)<.35 and hum.FloorMaterial~=Enum.Material.Air and
   ((isLocal and data.moveIntent==false) or (not isLocal and speed<2)) then
   data.stopStart=now data.runStopArmed=false
  end
  if data.stopStart and ((isLocal and data.moveIntent) or (not isLocal and speed>6 and now-data.stopStart>.08) or hum.FloorMaterial==Enum.Material.Air or hum.Sit) then data.stopStart=nil end
  data.smoothedSpeed+=(speed-data.smoothedSpeed)*(1-math.exp(-18*dt))
  local facing=root.CFrame.LookVector
  local angle=math.atan2(data.facing:Cross(facing).Y,math.clamp(data.facing:Dot(facing),-1,1))
  local turn=math.clamp(math.deg(angle)/math.max(dt,.001),-220,220)
  data.turnRate+=(turn-data.turnRate)*(1-math.exp(-14*dt))
  local acceleration=math.clamp((speed-data.previousSpeed)/math.max(dt,.001),-90,90)
  data.acceleration+=(acceleration-data.acceleration)*(1-math.exp(-13*dt))
  data.facing=facing data.previousSpeed=speed
  if data.lastState==Enum.HumanoidStateType.Freefall and hum.FloorMaterial~=Enum.Material.Air then data.landUntil=now+.14 end
  data.lastState=state
  local action=char:GetAttribute("R6Action")
  local actionStart=char:GetAttribute("R6ActionStart") or now
  local actionClip=type(action)=="string" and Pack.GetClip(action)
  local slideStart=char:GetAttribute("SlideStart")
  local clip="Idle"
  if hum.Health<=0 then clip="Death"
  elseif locked then clip="Idle"
  elseif type(slideStart)=="number" and now-slideStart>=0 and now-slideStart<Pack.Config.SlideDuration then clip="Slide"
  elseif actionClip and now-actionStart<actionClip.duration then clip=action
  elseif hum.Sit then clip="Sit"
  elseif state==Enum.HumanoidStateType.Climbing then clip="Climb"
  elseif state==Enum.HumanoidStateType.Swimming then clip=speed>1 and "Swim" or "SwimIdle"
  elseif state==Enum.HumanoidStateType.Jumping then clip="Jump"
  elseif state==Enum.HumanoidStateType.Freefall then clip="Fall"
  elseif now<data.landUntil then clip="Land"
  elseif data.stopStart and now-data.stopStart<Pack.GetClip("Stop").duration then clip="Stop"
  elseif (isLocal and data.moveIntent) or (not isLocal and speed>1.4) then
   local started=char==Players.LocalPlayer.Character and data.movementStarted or char:GetAttribute("MovementStarted")
   clip=type(started)=="number" and now-started>=1 and "Run" or "Walk"
  elseif char:FindFirstChildOfClass("Tool") then clip="Ready" end
  local restarted=actionClip and clip==action and data.actionStart~=actionStart
  if data.clip~=clip or restarted then
   data.slideRecovery=data.clip=="Slide"
   data.from=table.clone(data.current)
   data.transition=0 data.clip=clip data.time=0 data.actionStart=actionStart
  end
  local gait=clip=="Run" or clip=="Walk"
  local referenceSpeed=clip=="Walk" and Pack.Config.WalkSpeed or Pack.Config.MoveSpeed
  local rate=gait and math.clamp(data.smoothedSpeed/referenceSpeed,.75,1.2) or 1
  data.time+=dt*rate
  if gait then data.phase=(data.phase+dt*rate/Pack.GetClip(clip).duration)%1 end
  local time=gait and data.phase*Pack.GetClip(clip).duration or data.time
  if clip=="Stop" then time=now-data.stopStart
  elseif clip=="Slide" then time=now-slideStart
  elseif actionClip and clip==action then time=now-actionStart end
  local pose=Pack.Sample(clip,time)
  if clip=="Throw" and speed>.8 then
   -- Keep the running legs underneath the short upper-body throw.
   local runRate=math.clamp(data.smoothedSpeed/Pack.Config.MoveSpeed,.15,1.5)
   data.phase=(data.phase+dt*runRate/Pack.GetClip("Run").duration)%1
   local gait=Pack.Sample("Run",data.phase*Pack.GetClip("Run").duration)
   pose["Right Leg"]=gait["Right Leg"]
   pose["Left Leg"]=gait["Left Leg"]
  end
  local transitionDuration=clip=="Stop" and .07 or (clip=="Slide" or clip=="Throw") and .025 or (data.slideRecovery and .08 or ((clip=="Run" or clip=="Walk") and .22 or .07))
  data.transition=math.min(1,data.transition+dt/transitionDuration)
  local transition=1-(1-data.transition)^3
  local localVelocity=root.CFrame:VectorToObjectSpace(velocity)
  local dynamic=CFrame.identity
  if gait then
   local amount=math.clamp(data.smoothedSpeed/Pack.Config.MoveSpeed,0,1)
   local pitch=math.clamp(-data.acceleration*.008,-1.5,1.5)
   local roll=math.clamp(-localVelocity.X*.07-data.turnRate*.012,-3,3)*amount
   dynamic=CFrame.Angles(math.rad(pitch),math.rad(math.clamp(-localVelocity.X*.16,-5,5)),math.rad(roll))
  elseif clip=="Slide" then
   dynamic=CFrame.Angles(0,0,math.rad(math.clamp(-data.turnRate*.04,-8,8)))
  end
  data.lean=data.lean:Lerp(dynamic,1-math.exp(-18*dt))
  for part,joint in pairs(data.joints) do
   if joint.Parent then
    local target=pose[part] or CFrame.identity
    if part=="Torso" then
     local basis=joint.C0.Rotation
     target=(basis:Inverse()*data.lean*basis)*target
    elseif part=="Head" and (gait or clip=="Slide") then
     local basis=joint.C0.Rotation
     local counter=CFrame.Angles(0,0,math.rad(math.clamp(data.turnRate*.022,-5,5)))
     target=(basis:Inverse()*counter*basis)*target
    end
    local current=(data.from[part] or CFrame.identity):Lerp(target,transition)
    data.current[part]=current
   end
  end
  if clip=="Slide" or (data.slideRecovery and data.transition<1) then keepSlideAboveGround(char,data)
  elseif (locked or hum.FloorMaterial~=Enum.Material.Air) and (gait or clip=="Stop" or clip=="Idle" or clip=="Ready") then groundLocomotion(char,data,dt)
  else data.groundOffset=0 end
  -- Layer camera aim over the animation without moving the character or camera.
  local neck=data.joints.Head
  local torsoJoint=data.joints.Torso
  local camera=workspace.CurrentCamera
  local lookDirection=char:GetAttribute("HeadLookDirection")
  if char==Players.LocalPlayer.Character and camera then
   lookDirection=camera.CFrame.LookVector
   if now-lastHeadSend>=.1 and ((lookDirection-lastHeadDirection).Magnitude>.015 or now-lastHeadSend>=.5) then
    lastHeadSend=now lastHeadDirection=lookDirection
    remote:FireServer("HeadLook",lookDirection)
   end
  end
  local lookTarget=CFrame.identity
  if neck and torsoJoint and typeof(lookDirection)=="Vector3" and hum.Health>0 then
   local torsoWorld=root.CFrame*torsoJoint.C0*(data.current.Torso or CFrame.identity)*torsoJoint.C1:Inverse()
   local direction=torsoWorld:VectorToObjectSpace(lookDirection)
   local pitch=math.clamp(math.atan2(direction.Y,Vector2.new(direction.X,direction.Z).Magnitude),math.rad(-45),math.rad(55))
   local yaw=math.clamp(math.atan2(-direction.X,-direction.Z),math.rad(-75),math.rad(75))
   local basis=neck.C0.Rotation
   lookTarget=basis:Inverse()*(CFrame.Angles(0,yaw,0)*CFrame.Angles(pitch,0,0))*basis
  end
  data.headLook=(data.headLook or CFrame.identity):Lerp(lookTarget,1-math.exp(-16*dt))
  for part,joint in pairs(data.joints) do
   if joint.Parent then
    local pose=data.current[part] or CFrame.identity
    joint.Transform=part=="Head" and hum.Health>0 and CFrame.new(pose.Position)*data.headLook or pose
   end
  end
  if char==Players.LocalPlayer.Character then
   if clip=="Slide" then
    local direction=Vector3.new(hum.MoveDirection.X,0,hum.MoveDirection.Z)
    if direction.Magnitude>.1 then
     direction=direction.Unit
     if now-lastSteer>.025 then lastSteer=now remote:FireServer("SlideSteer",direction) end
     -- Immediate prediction for the owning player while the server confirms steering.
     local actuator=root:FindFirstChild("HussSlideVelocity")
     if actuator and actuator:IsA("LinearVelocity") then
      local progress=math.clamp((now-slideStart)/Pack.Config.SlideDuration,0,1)
      local predictedSpeed=Pack.Config.MoveSpeed+(Pack.Config.SlideSpeed-Pack.Config.MoveSpeed)*(1-progress)^.65
      actuator.PlaneVelocity=Vector2.new(direction.X,direction.Z)*predictedSpeed
      root.CFrame=CFrame.lookAt(root.Position,root.Position+direction)
     end
    end
   end
  end
 end
end)
CAS:UnbindAction("HussSprint")
local function slideAction(_,state)
 if state==Enum.UserInputState.Begin then
  local char=Players.LocalPlayer.Character
  local hum=char and char:FindFirstChildOfClass("Humanoid")
  local root=char and char:FindFirstChild("HumanoidRootPart")
  local now=workspace:GetServerTimeNow()
  if hum and root and hum.Health>0 and hum.FloorMaterial~=Enum.Material.Air and not hum.Sit and now-lastLocalSlide>=Pack.Config.SlideCooldown then
   local velocity=Vector3.new(root.AssemblyLinearVelocity.X,0,root.AssemblyLinearVelocity.Z)
   if velocity.Magnitude>=8 then
    local input=Vector3.new(hum.MoveDirection.X,0,hum.MoveDirection.Z)
    lastLocalSlide=now
    remote:FireServer("Slide",input.Magnitude>.1 and input.Unit or velocity.Unit)
   end
  end
 end
 return Enum.ContextActionResult.Sink
end
CAS:BindActionAtPriority("HussSlide",slideAction,true,Enum.ContextActionPriority.High.Value+51,Enum.KeyCode.Space,Enum.KeyCode.C,Enum.KeyCode.ButtonB)
UIS.InputBegan:Connect(function(input)
 if not UIS:GetFocusedTextBox() and (input.KeyCode==Enum.KeyCode.Space or input.KeyCode==Enum.KeyCode.C) then
  slideAction("HussSlide",Enum.UserInputState.Begin)
 end
end)
CAS:SetTitle("HussSlide","Slide")
CAS:SetPosition("HussSlide",UDim2.fromScale(.85,.54))
CAS:BindActionAtPriority("HussDisableJump",function()
 local char=Players.LocalPlayer.Character
 local hum=char and char:FindFirstChildOfClass("Humanoid")
 if hum then hum.Jump=false end
 return Enum.ContextActionResult.Sink
end,false,Enum.ContextActionPriority.High.Value+50,Enum.KeyCode.ButtonA)
UIS.JumpRequest:Connect(function()
 local char=Players.LocalPlayer.Character
 local hum=char and char:FindFirstChildOfClass("Humanoid")
 if hum then hum.Jump=false hum:SetStateEnabled(Enum.HumanoidStateType.Jumping,false) end
end)
local gui=Players.LocalPlayer:WaitForChild("PlayerGui")
local function hideJump(obj)
 if obj.Name=="JumpButton" and obj:IsA("GuiObject") and obj.Parent and obj.Parent.Name=="TouchControlFrame" then obj.Visible=false end
end
for _,obj in ipairs(gui:GetDescendants()) do hideJump(obj) end
gui.DescendantAdded:Connect(hideJump)
