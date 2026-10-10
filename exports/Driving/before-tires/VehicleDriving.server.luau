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
local sessions,lastRequest={},{}
local function weld(a,b)
 local w=Instance.new('WeldConstraint');w.Part0=a;w.Part1=b;w.Parent=a
end
local function stop(player)
 local s=sessions[player];if not s then return end
 sessions[player]=nil
 if s.seat then s.seat.Disabled=true end
 if s.humanoid and s.humanoid.Parent then s.humanoid.Sit=false end
 for part,old in s.hidden do
  if part.Parent then part.Transparency=old[1];part.CanCollide=old[2];part.CanQuery=old[3];part.CanTouch=old[4] end
 end
 if s.vehicle then s.vehicle:Destroy() end
 player:SetAttribute('IsDriving',false);player:SetAttribute('VehicleSpeed',0)
 local char=player.Character
 if char and s.surface and s.surface.Parent and s.humanoid and s.humanoid.Health>0 then
  char:PivotTo(s.surface.CFrame*CFrame.new(-s.surface.Size.X/2-2,3,0))
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
  root.Anchored=true;root.CanCollide=true;root.RootPriority=127;root.Parent=vehicle
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
    local direction=tire.CFrame.RightVector:Dot(root.CFrame.RightVector)>=0 and 1 or -1
    table.insert(s.wheels,{joint=joint,base=joint.C0,radius=radius,angle=0,direction=direction})
    for _,p in clone:GetDescendants() do if p:IsA('BasePart') and p~=tire then
     if p.Name=='Tire' or (rotating:IsA('Model') and p:IsDescendantOf(rotating)) then
      p.Anchored=false;p.Massless=true;p.CanCollide=false;p.CanTouch=false;weld(tire,p)
     else attach(p) end
    end end
   else for _,p in clone:GetDescendants() do if p:IsA('BasePart') then attach(p) end end end
   if kind=='Pilot' or kind=='Passenger' then
    local seat=Instance.new('Seat');seat.Name=kind=='Pilot' and 'PilotSeat' or 'PassengerSeat'
    seat.Size=Vector3.new(1.5,.2,1.3);seat.Transparency=1;seat.CanCollide=false;seat.CanTouch=false;seat.Massless=true
    local seatPivot=m:GetPivot()
    seat.CFrame=seatPivot*CFrame.new(0,.65,-.1);seat.Parent=vehicle;weld(root,seat)
    seat.Disabled=kind~='Pilot'
    if kind=='Pilot' and m==pilot then s.seat=seat end
   end
  end
  local attachment=Instance.new('Attachment');attachment.Parent=root
  local suspension=Instance.new('VectorForce');suspension.Name='Suspension';suspension.Attachment0=attachment
  suspension.RelativeTo=Enum.ActuatorRelativeTo.World;suspension.ApplyAtCenterOfMass=true;suspension.Parent=root;s.suspension=suspension
  local velocity=Instance.new('LinearVelocity');velocity.Attachment0=attachment
  velocity.VelocityConstraintMode=Enum.VelocityConstraintMode.Plane;velocity.RelativeTo=Enum.ActuatorRelativeTo.World
  velocity.PrimaryTangentAxis=Vector3.xAxis;velocity.SecondaryTangentAxis=Vector3.zAxis
  velocity.ForceLimitsEnabled=true;velocity.ForceLimitMode=Enum.ForceLimitMode.Magnitude
  velocity.MaxForce=10000;velocity.Parent=root;s.velocity=velocity
  local alignment=Instance.new('AlignOrientation');alignment.Attachment0=attachment;alignment.Mode=Enum.OrientationAlignmentMode.OneAttachment
  alignment.MaxTorque=100000;alignment.Responsiveness=12;alignment.MaxAngularVelocity=4
  alignment.CFrame=reference.Rotation;alignment.Parent=root;s.alignment=alignment
  s.yaw=select(2,reference:ToOrientation())
  for _,m in models do for _,p in m:GetDescendants() do if p:IsA('BasePart') then
   s.hidden[p]={p.Transparency,p.CanCollide,p.CanQuery,p.CanTouch}
   p.Transparency=1;p.CanCollide=false;p.CanQuery=false;p.CanTouch=false
  end end end
  vehicle.Parent=active;root.Anchored=false;root:SetNetworkOwner(nil)
  s.seat:Sit(humanoid)
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
 s.throttle=throttle;s.steer=steer;s.brake=brake;s.lastInput=os.clock()
end)
RunService.Heartbeat:Connect(function(dt)
 dt=math.min(dt,.1)
 for player,s in sessions do
  if not player.Parent or not s.root.Parent or s.humanoid.Health<=0 or s.root.Position.Y<-80
   or (os.clock()-s.started>1.5 and s.seat.Occupant~=s.humanoid) then stop(player);continue end
  if os.clock()-s.lastInput>.75 then s.throttle=0;s.steer=0;s.brake=true end
  local ray=RaycastParams.new();ray.FilterType=Enum.RaycastFilterType.Exclude;ray.FilterDescendantsInstances={active,player.Character}
  local hit=workspace:Raycast(s.root.Position,Vector3.new(0,-2.2,0),ray)
  s.velocity.Enabled=hit~=nil
  local support=0
  if hit then
   local errorHeight=.7-(s.root.Position.Y-hit.Position.Y)
   support=math.clamp(workspace.Gravity+errorHeight*150-s.root.AssemblyLinearVelocity.Y*18,0,workspace.Gravity*2.5)
  end
  s.suspension.Force=Vector3.new(0,s.root.AssemblyMass*support,0)
  local target=s.brake and 0 or s.throttle*s.stats.topSpeed*(s.throttle<0 and .4 or 1)
  local rate=(s.brake or s.throttle==0) and 35 or s.stats.acceleration
  s.speed+=math.clamp(target-s.speed,-rate*dt,rate*dt)
  local measured=s.root.AssemblyLinearVelocity:Dot(s.root.CFrame.LookVector)
  if hit then s.yaw-=s.steer*math.clamp(measured/14,-1,1)*1.7*s.stats.grip*dt end
  local rotation=CFrame.Angles(0,s.yaw,0);s.alignment.CFrame=rotation
  local movement=rotation.LookVector*s.speed
  s.velocity.PlaneVelocity=Vector2.new(movement.X,movement.Z)
  s.velocity.MaxForce=s.root.AssemblyMass*math.max(35,s.stats.acceleration)*s.stats.grip
  for _,wheel in s.wheels do
   wheel.angle=(wheel.angle-measured*dt*wheel.direction/wheel.radius)%(math.pi*2)
   -- All tire assets use their local X axis for the axle.
   wheel.joint.C0=wheel.base*CFrame.Angles(wheel.angle,0,0)
  end
  s.publish=(s.publish or 0)+dt
  if s.publish>.1 then s.publish=0;player:SetAttribute('VehicleSpeed',math.abs(measured)) end
 end
end)
Players.PlayerRemoving:Connect(function(p) stop(p);lastRequest[p]=nil end)
Players.PlayerAdded:Connect(function(p) p.CharacterRemoving:Connect(function() stop(p) end) end)
for _,p in Players:GetPlayers() do p.CharacterRemoving:Connect(function() stop(p) end) end
game:BindToClose(function() for p in sessions do stop(p) end end)
