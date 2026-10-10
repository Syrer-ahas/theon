local AnimationBudget=require(game:GetService('ReplicatedStorage'):WaitForChild('PerformanceAnimationBudget'))
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
  local carrier=state.carrier
  if not carrier then
   local ref=joint:FindFirstChild('WheelCarrier');carrier=ref and ref.Value
   state.carrier=carrier
  end
  if not root or not base or not carrier or not carrier.Parent then continue end
  state.base=base;state.radius=state.radius or joint:GetAttribute('WheelRadius') or 1.15
  local owner=state.owner or state.vehicle:GetAttribute('OwnerUserId');state.owner=owner
  local frameDt=dt
  if owner~=player.UserId and state.vehicle:GetAttribute('PerformanceDistanceHidden')==true then continue end
  local animate,budgetDt=AnimationBudget.Step(state,carrier.Position,frameDt,workspace.CurrentCamera,owner==player.UserId)
  if owner~=player.UserId and player:GetAttribute('Setting_HideCars')==true then continue end
  if not animate then continue end
  frameDt=budgetDt
  local steer=owner==player.UserId and (player:GetAttribute('LocalDriveSteer') or 0) or (state.vehicle:GetAttribute('Steer') or 0)
  if state.front==nil then state.front=joint:GetAttribute('WheelFront') end
  local target=state.front and -steer*math.rad(25)/(1+root.AssemblyLinearVelocity.Magnitude/35) or 0
  state.steering+=(target-state.steering)*(1-math.exp(-24*frameDt))
  if owner==player.UserId then
   local axle=state.axle or carrier:FindFirstChild('RollingAxle');state.axle=axle
   local axleBase=state.axleBase or axle and axle:GetAttribute('AxleBase');state.axleBase=axleBase
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
