local Players=game:GetService('Players')
local RS=game:GetService('ReplicatedStorage')
local RunService=game:GetService('RunService')
local Stats=require(RS:WaitForChild('VehicleStats'))
local Geometry=require(RS:WaitForChild('BuildGeometry'))
local Ownership=require(RS:WaitForChild('PlotOwnership'))
local request=RS:WaitForChild('VehicleDriveRequest')
local input=RS:WaitForChild('VehicleDriveInput')
local active=workspace:FindFirstChild('ActiveVehicles') or Instance.new('Folder',workspace)
active.Name='ActiveVehicles'
local Resources=require(script.Parent:WaitForChild('VehicleResources'))
local boostInput=RS:FindFirstChild('VehicleBoostInput') or Instance.new('RemoteEvent',RS);boostInput.Name='VehicleBoostInput'
local sessions,lastRequest={},{}
local function weld(a,b)
 local w=Instance.new('WeldConstraint');w.Part0=a;w.Part1=b;w.Parent=a
end
local function stop(player)
 local s=sessions[player];if not s then return end
 sessions[player]=nil
 Resources.Stop(s)
 if s.seat then s.seat.Disabled=true end
 if s.humanoid and s.humanoid.Parent then s.humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping,s.oldJumpEnabled~=false);s.humanoid.Sit=false;s.humanoid.AutoRotate=s.oldAutoRotate~=false end
 for part,old in s.hidden do
  if part.Parent then part.Transparency=old[1];part.CanCollide=old[2];part.CanQuery=old[3];part.CanTouch=old[4] end
 end
 if s.vehicle then s.vehicle:Destroy() end
 player:SetAttribute('IsDriving',false);player:SetAttribute('VehicleSpeed',0)
 local char=player.Character
 if char and s.surface and s.surface.Parent and s.humanoid and s.humanoid.Health>0 then
  char:PivotTo(s.surface.CFrame*CFrame.new(-s.surface.Size.X/2-2,3,0))
  local returnedRoot=char:FindFirstChild('HumanoidRootPart')
  if returnedRoot then returnedRoot.AssemblyLinearVelocity=Vector3.zero;returnedRoot.AssemblyAngularVelocity=Vector3.zero end
 end
end
-- Only parts touching the pilot's connected build participate in the vehicle.
local function connected(folder,pilot)
 local seen={[pilot]=true};local queue={pilot};local at=1
 local params=OverlapParams.new();params.FilterType=Enum.RaycastFilterType.Include;params.FilterDescendantsInstances={folder}
 params.RespectCanCollide=false
 while at<=#queue do
  local model=queue[at];at+=1
  local cf,size=model:GetBoundingBox()
  for _,part in workspace:GetPartBoundsInBox(cf,size+Vector3.new(.7,.7,.7),params) do
   local other=part
   while other and other.Parent~=folder do other=other.Parent end
   if other and other:IsA('Model') and not seen[other] then seen[other]=true;table.insert(queue,other) end
  end
 end
 return queue
end
local function start(player)
 if player:GetAttribute('InventoryDataLoaded')~=true then return false,'Your inventory is still loading.' end
 local ref=player:FindFirstChild('AssignedPlot');local plot=ref and ref.Value
 if not plot or not Ownership.CanUse(player,plot) then return false,'You can only drive your own car.' end
 local surface=Geometry.Surface(plot);local folder=plot:FindFirstChild('PlacedBuild')
 local char=player.Character;local humanoid=char and char:FindFirstChildOfClass('Humanoid');local hrp=char and char:FindFirstChild('HumanoidRootPart')
 if not surface or not folder or not humanoid or humanoid.Health<=0 or not hrp then return false,'Your car is not ready.' end
 if (hrp.Position-surface.Position).Magnitude>110 then return false,'Move closer to your plot.' end
 local pilot
 for _,m in folder:GetChildren() do
  if m:GetAttribute('OwnerUserId')==player.UserId and m:GetAttribute('BuildItemId')=='Supports_PilotChair' then pilot=m;break end
 end
 if not pilot then return false,'Place a Pilot Chair on your car first.' end
 local models=connected(folder,pilot);local ids={};local lowest=math.huge
 for _,m in models do local cf,size=m:GetBoundingBox();lowest=math.min(lowest,cf.Position.Y-size.Y/2) end
 for _,m in models do
  if m:GetAttribute('OwnerUserId')~=player.UserId then return false,'This car contains parts you do not own.' end
  local id=m:GetAttribute('BuildItemId');local grounded=true
  if Stats.Part(id).kind=='Wheel' then
   local cf,size=m:GetBoundingBox();local tire=m:FindFirstChild('Tire',true)
   grounded=cf.Position.Y-size.Y/2<=lowest+.75 and tire and tire:IsA('BasePart') and math.abs(tire.CFrame.RightVector.Y)<.25
  end
  table.insert(ids,{id=id,grounded=grounded==true})
 end
 local stats=Stats.Calculate(ids)
 if stats.error then return false,stats.error end
 local s={surface=surface,humanoid=humanoid,hidden={},wheels={},stats=stats,throttle=0,steer=0,brake=false,speed=0,lastInput=os.clock(),started=os.clock()}
 sessions[player]=s
 local ok,err=pcall(function()
  local vehicle=Instance.new('Model');vehicle.Name='Vehicle_'..player.UserId;s.vehicle=vehicle
  vehicle:SetAttribute('OwnerUserId',player.UserId)
  local pivot=pilot:GetPivot();local forward=Vector3.new(pivot.LookVector.X,0,pivot.LookVector.Z)
  if forward.Magnitude<.5 then error('The Pilot Chair must be placed upright.') end
  local reference=CFrame.lookAt(pivot.Position,pivot.Position+forward.Unit)
  local min=Vector3.new(math.huge,math.huge,math.huge);local max=-min
  for _,m in models do
   for _,p in m:GetDescendants() do if p:IsA('BasePart') then
    for x=-1,1,2 do for y=-1,1,2 do for z=-1,1,2 do
     local v=reference:PointToObjectSpace(p.CFrame:PointToWorldSpace(p.Size*Vector3.new(x,y,z)/2))
     min=min:Min(v);max=max:Max(v)
    end end end
   end end
  end
  local root=Instance.new('Part');root.Name='Chassis';root.Transparency=1
  root.Size=Vector3.new(math.max(1,max.X-min.X-.5),.65,math.max(1,max.Z-min.Z-.5))
  root.CFrame=reference*CFrame.new((min.X+max.X)/2,min.Y+.7,(min.Z+max.Z)/2)
  root.Anchored=true;root.CanCollide=false;root.RootPriority=127;root.Parent=vehicle
  root.CustomPhysicalProperties=PhysicalProperties.new(1,.03,0,100,100)
  vehicle.PrimaryPart=root;s.root=root
  local function attach(part)
   part.Anchored=false;part.Massless=true;part.CanCollide=false;part.CanTouch=false;weld(root,part)
  end
  for _,m in models do
   local clone=m:Clone();clone.Parent=vehicle
   local kind=Stats.Part(m:GetAttribute('BuildItemId')).kind
   local tire=kind=='Wheel' and clone:FindFirstChild('Tire',true)
   local rotating=tire and tire.Parent
   -- Tire and rim spin, their mounting brackets remain fixed to the chassis.
   for _,p in clone:GetDescendants() do
    if p:IsA('JointInstance') or p:IsA('WeldConstraint') or p:IsA('Constraint') then p:Destroy() end
   end
   if tire and tire:IsA('BasePart') then
    tire.Anchored=false;tire.Massless=true;tire.CanCollide=false;tire.CanTouch=false
    local joint=Instance.new('Motor6D');joint.Name='WheelAxle';joint.Part0=root;joint.Part1=tire
    joint.C0=root.CFrame:ToObjectSpace(tire.CFrame);joint.Parent=root
    local radius=math.max(tire.Size.Y,tire.Size.Z)/2
    for _,p in clone:GetDescendants() do if p:IsA('BasePart') and p.Name=='Tire' then radius=math.max(radius,math.max(p.Size.Y,p.Size.Z)/2) end end
    joint:SetAttribute('WheelBase',joint.C0)
    local front=joint.C0.Position.Z<-.1
    joint:SetAttribute('WheelRadius',radius)
    joint:SetAttribute('WheelFront',front)
    local carrier=Instance.new('Part');carrier.Name='WheelCarrier'
    carrier.Size=Vector3.new(.2,.2,.2);carrier.CFrame=CFrame.new(tire.Position)*root.CFrame.Rotation
    carrier.Transparency=1;carrier.CanCollide=false;carrier.CanQuery=false;carrier.CanTouch=false;carrier.Parent=vehicle
    local collider=Instance.new('Part');collider.Name='WheelContact';collider.Shape=Enum.PartType.Cylinder
    collider.Size=Vector3.new(tire.Size.X,radius*2,radius*2);collider.CFrame=tire.CFrame
    collider.Transparency=1;collider.CanCollide=true;collider.CanTouch=false;collider.CanQuery=false
    collider.CustomPhysicalProperties=PhysicalProperties.new(1.5,.8,0,100,100)
    collider.Parent=vehicle
    local axle0=Instance.new('Attachment');axle0.Name='RollingAxle';axle0.CFrame=carrier.CFrame:ToObjectSpace(collider.CFrame);axle0.Parent=carrier
    local axle1=Instance.new('Attachment');axle1.Parent=collider
    local hinge=Instance.new('HingeConstraint');hinge.Name='RollingWheel'
    hinge.Attachment0=axle0;hinge.Attachment1=axle1;hinge.ActuatorType=Enum.ActuatorType.None;hinge.Parent=carrier
    axle0:SetAttribute('AxleBase',axle0.CFrame)
    local slide0=Instance.new('Attachment');slide0.Name='SuspensionAnchor'
    slide0.CFrame=CFrame.new(joint.C0.Position)*CFrame.Angles(0,0,math.pi/2);slide0.Parent=root
    local slide1=Instance.new('Attachment');slide1.CFrame=CFrame.Angles(0,0,math.pi/2);slide1.Parent=carrier
    local slide=Instance.new('PrismaticConstraint');slide.Name='SuspensionGuide';slide.Attachment0=slide0;slide.Attachment1=slide1
    slide.LimitsEnabled=true;slide.LowerLimit=-.4;slide.UpperLimit=.25;slide.Parent=carrier
    local spring0=Instance.new('Attachment');spring0.Position=joint.C0.Position+Vector3.yAxis*.8;spring0.Parent=root
    local spring1=Instance.new('Attachment');spring1.Parent=carrier
    local spring=Instance.new('SpringConstraint');spring.Name='WheelSpring';spring.Attachment0=spring0;spring.Attachment1=spring1
    spring.FreeLength=1.27;spring.Stiffness=1000;spring.Damping=100;spring.Parent=carrier
    local ref=Instance.new('ObjectValue');ref.Name='WheelCarrier';ref.Value=carrier;ref.Parent=joint
    table.insert(s.wheels,{joint=joint,spring=spring,carrier=carrier,collider=collider})
    for _,p in clone:GetDescendants() do if p:IsA('BasePart') and p~=tire then
     if p.Name=='Tire' or (rotating:IsA('Model') and p:IsDescendantOf(rotating)) then
      p.Anchored=false;p.Massless=true;p.CanCollide=false;p.CanTouch=false;weld(tire,p)
     else attach(p) end
    end end
   else
    for _,p in clone:GetDescendants() do if p:IsA('BasePart') then attach(p) end end
    if kind=='Body' then
     local box,size=clone:GetBoundingBox()
     local collider=Instance.new('Part');collider.Name='BodyContact';collider.Size=size-Vector3.new(.08,.08,.08)
     collider.CFrame=box;collider.Transparency=1;collider.Massless=true;collider.CanCollide=true;collider.CanTouch=false;collider.CanQuery=false
     collider.CustomPhysicalProperties=PhysicalProperties.new(1,.05,0,100,100)
     collider.Parent=vehicle;weld(root,collider)
    end
   end
   if kind=='Pilot' or kind=='Passenger' then
    local seat=Instance.new('Seat');seat.Name=kind=='Pilot' and 'PilotSeat' or 'PassengerSeat'
    seat.Size=Vector3.new(1.5,.2,1.3);seat.Transparency=1;seat.CanCollide=false;seat.CanTouch=false;seat.Massless=true
    local seatPivot=m:GetPivot()
    seat.CFrame=seatPivot*CFrame.new(0,.15,-.15);seat.Parent=vehicle;weld(root,seat)
    seat.Disabled=kind~='Pilot'
    if kind=='Pilot' and m==pilot then s.seat=seat end
   end
  end
  -- A suspension wheel must never collide with its own body or another axle.
  local contacts={}
  for _,part in vehicle:GetChildren() do if part:IsA('BasePart') and part.CanCollide then table.insert(contacts,part) end end
  for i,part in contacts do for j=i+1,#contacts do
   local other=contacts[j]
   if part.Name=='WheelContact' or other.Name=='WheelContact' then
    local ignore=Instance.new('NoCollisionConstraint');ignore.Part0=part;ignore.Part1=other;ignore.Parent=vehicle
   end
  end end
  local attachment=Instance.new('Attachment');attachment.Parent=root
  local traction=Instance.new('VectorForce');traction.Name='Traction';traction.Attachment0=attachment
  traction.RelativeTo=Enum.ActuatorRelativeTo.World;traction.ApplyAtCenterOfMass=true;traction.Parent=root;s.traction=traction
  local alignment=Instance.new('AlignOrientation');alignment.Attachment0=attachment;alignment.Mode=Enum.OrientationAlignmentMode.OneAttachment
  alignment.MaxTorque=100000;alignment.Responsiveness=8;alignment.MaxAngularVelocity=3
  alignment.CFrame=reference.Rotation;alignment.Parent=root;s.alignment=alignment
  s.yaw=select(2,reference:ToOrientation())
  for _,m in models do for _,p in m:GetDescendants() do if p:IsA('BasePart') then
   s.hidden[p]={p.Transparency,p.CanCollide,p.CanQuery,p.CanTouch}
   p.Transparency=1;p.CanCollide=false;p.CanQuery=false;p.CanTouch=false
  end end end
  vehicle:SetAttribute('TopSpeed',stats.topSpeed)
  vehicle:SetAttribute('Acceleration',stats.acceleration)
  vehicle:SetAttribute('Grip',stats.grip)
  vehicle:SetAttribute('Steer',0)
  vehicle.Parent=active;root.Anchored=false
  s.oldJumpEnabled=humanoid:GetStateEnabled(Enum.HumanoidStateType.Jumping);humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping,false);humanoid.Jump=false
  s.oldAutoRotate=humanoid.AutoRotate;humanoid.AutoRotate=false
  for _,part in char:GetDescendants() do if part:IsA('BasePart') then
   s.hidden[part]={part.Transparency,part.CanCollide,part.CanQuery,part.CanTouch}
   part.CanCollide=false
  end end
  s.seat:Sit(humanoid)
  local sprungMass=root.AssemblyMass
  for _,wheel in s.wheels do
   local load=sprungMass/#s.wheels
   wheel.spring.Stiffness=load*workspace.Gravity/.25
   wheel.spring.Damping=2*math.sqrt(wheel.spring.Stiffness*wheel.carrier.AssemblyMass)*.95
   wheel.spring.MaxForce=load*workspace.Gravity*4
  end
  -- The seated driver owns the entire assembly, including their character.
  root:SetNetworkOwner(player)
  for _,wheel in s.wheels do wheel.carrier:SetNetworkOwner(player);wheel.collider:SetNetworkOwner(player) end
  task.delay(.2,function()
   if sessions[player]==s and root.Parent and s.seat.Occupant==humanoid then root:SetNetworkOwner(player) end
  end)
  Resources.Start(player,s,ids)
  player:SetAttribute('IsDriving',true)
  for name,value in {VehicleWeightKg=stats.weight,VehicleCapacityKg=stats.capacity,VehicleTopSpeed=stats.topSpeed,VehicleEngineCount=stats.engines,VehicleWheelCount=stats.wheels} do player:SetAttribute(name,value) end
 end)
 if not ok then stop(player);warn('Vehicle start failed: '..tostring(err));return false,'The car could not start. Check your Pilot Chair placement.' end
 return true,'Driving'
end
request.OnServerInvoke=function(player,action)
 if action=='Exit' then stop(player);return true,'Returned to build mode.' end
 if action~='Start' then return false,'Invalid driving request.' end
 if sessions[player] then return true,'Already driving.' end
 local now=os.clock();if now-(lastRequest[player] or -10)<1 then return false,'Please wait a moment.' end
 lastRequest[player]=now
 return start(player)
end
local function finite(n) return typeof(n)=='number' and n==n and math.abs(n)<=1 end
input.OnServerEvent:Connect(function(player,throttle,steer,brake)
 local s=sessions[player];if not s or not finite(throttle) or not finite(steer) or typeof(brake)~='boolean' then return end
 local now=os.clock()
 if now-(s.lastAcceptedInput or 0)<1/40 then return end
 s.lastAcceptedInput=now
 s.throttle=throttle;s.steer=steer;s.brake=brake;s.lastInput=now
 if s.inputTimedOut then s.inputTimedOut=false;s.root:SetNetworkOwner(player);for _,w in s.wheels do w.carrier:SetNetworkOwner(player);w.collider:SetNetworkOwner(player) end end
 if s.vehicle:GetAttribute('Steer')~=steer then s.vehicle:SetAttribute('Steer',steer) end
end)
boostInput.OnServerEvent:Connect(function(player,held)
 local s=sessions[player];if not s or typeof(held)~='boolean' then return end
 local now=os.clock();if now-(s.lastBoostPacket or -1)<.04 then return end
 s.lastBoostPacket=now;s.lastBoostInput=now;s.boostHeld=held
end)
local lifecycleElapsed=0
RunService.Heartbeat:Connect(function(dt)
 lifecycleElapsed+=dt
 if lifecycleElapsed<.05 then return end
 dt=lifecycleElapsed;lifecycleElapsed=0
 for player,s in sessions do
  if not player.Parent or not s.root.Parent or s.humanoid.Health<=0 or s.root.Position.Y<-80
   or (os.clock()-s.started>1.5 and s.seat.Occupant~=s.humanoid) then stop(player);continue end
  if os.clock()-s.lastInput>.75 then
   s.throttle=0;s.steer=0;s.brake=true;s.traction.Force=Vector3.zero
   if not s.inputTimedOut then s.inputTimedOut=true;s.root:SetNetworkOwner(nil);for _,w in s.wheels do w.carrier:SetNetworkOwner(nil);w.collider:SetNetworkOwner(nil) end end
  end
  -- Physics runs on the driver; the server keeps lifecycle and speed checks.
  local measured=s.root.AssemblyLinearVelocity:Dot(s.root.CFrame.LookVector)
  if s.root.AssemblyLinearVelocity.Magnitude>math.max(180,s.stats.topSpeed*2+30) then stop(player);continue end
  Resources.Update(player,s,dt,os.clock())
  if s.health<=0 then stop(player);continue end
  s.publish=(s.publish or 0)+dt
  if s.publish>=.2 then
   s.publish=0
   Resources.Publish(player,s)
   local speed=math.round(math.abs(measured)*10)/10
   if player:GetAttribute('VehicleSpeed')~=speed then player:SetAttribute('VehicleSpeed',speed) end
  end
 end
end)
Players.PlayerRemoving:Connect(function(p) stop(p);lastRequest[p]=nil end)
Players.PlayerAdded:Connect(function(p) p.CharacterRemoving:Connect(function() stop(p) end) end)
for _,p in Players:GetPlayers() do p.CharacterRemoving:Connect(function() stop(p) end) end
game:BindToClose(function() for p in sessions do stop(p) end end)