local Players=game:GetService('Players')
local RunService=game:GetService('RunService')
local player=Players.LocalPlayer
local active=workspace:WaitForChild('ActiveVehicles')
local wheels={}
local function watch(joint)
 if joint:IsA('Motor6D') and joint.Name=='WheelAxle' then
  wheels[joint]={vehicle=joint.Parent.Parent,angle=0,steering=0}
 end
end
for _,d in active:GetDescendants() do watch(d) end
active.DescendantAdded:Connect(watch)
active.DescendantRemoving:Connect(function(d) wheels[d]=nil end)
RunService.PreSimulation:Connect(function(dt)
 for joint,state in wheels do
  local root=joint.Part0
  local base=state.base or joint:GetAttribute('WheelBase')
  local ref=joint:FindFirstChild('WheelCarrier')
  local carrier=ref and ref.Value
  if not root or not base or not carrier then continue end
  state.base=base;state.radius=state.radius or joint:GetAttribute('WheelRadius') or 1.15
  local owner=state.vehicle:GetAttribute('OwnerUserId')
  local steer=owner==player.UserId and (player:GetAttribute('LocalDriveSteer') or 0) or (state.vehicle:GetAttribute('Steer') or 0)
  local target=joint:GetAttribute('WheelFront') and -steer*math.rad(25)/(1+root.AssemblyLinearVelocity.Magnitude/35) or 0
  state.steering+=(target-state.steering)*(1-math.exp(-24*dt))
  if owner==player.UserId then
   local axle=carrier:FindFirstChild('RollingAxle')
   local axleBase=axle and axle:GetAttribute('AxleBase')
   if axleBase then axle.CFrame=CFrame.new(axleBase.Position)*CFrame.Angles(0,state.steering,0)*axleBase.Rotation end
  end
  local offset=root.CFrame:PointToObjectSpace(carrier.Position)
  local pose=CFrame.new(offset)*CFrame.Angles(0,state.steering,0)*base.Rotation
  local axle=root.CFrame*pose
  if state.position then
   local delta=carrier.Position-state.position
   if delta.Magnitude<20 then state.angle=(state.angle+delta:Dot(axle.RightVector:Cross(root.CFrame.UpVector))/state.radius)%(math.pi*2) end
  end
  state.position=carrier.Position
  joint.C0=pose*CFrame.Angles(state.angle,0,0)
 end
end)
