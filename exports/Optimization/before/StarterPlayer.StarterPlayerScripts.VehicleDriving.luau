local Players=game:GetService('Players')
local RS=game:GetService('ReplicatedStorage')
local CAS=game:GetService('ContextActionService')
local UIS=game:GetService('UserInputService')
local RunService=game:GetService('RunService')
local player=Players.LocalPlayer
local request=RS:WaitForChild('VehicleDriveRequest')
local input=RS:WaitForChild('VehicleDriveInput')
local drive=player:WaitForChild('PlayerGui'):WaitForChild('ScreenGui'):WaitForChild('Drive')
local driveImage='rbxassetid://115652426030762'
local returnImage='rbxassetid://97522031198243'
local busy=false
local held={};local driving=false
local throttle,steer,braking=0,0,false
local vehicleState
local function message(text) drive:SetAttribute('DrivingError',text) end
local function invoke(action)
 if busy then return end;busy=true
 local ok,success,result=pcall(function() return request:InvokeServer(action) end)
 busy=false
 if not ok then message('Driving is unavailable. Please try again.')
 elseif not success then message(result) end
end
drive.Activated:Connect(function() invoke(driving and 'Exit' or 'Start') end)
local mappings={DriveForward='forward',DriveReverse='reverse',DriveLeft='left',DriveRight='right',DriveBrake='brake'}
local function control(action,state)
 if not driving then return Enum.ContextActionResult.Pass end
 if action=='DriveExit' then if state==Enum.UserInputState.Begin then task.spawn(invoke,'Exit') end
 else held[mappings[action]]=state==Enum.UserInputState.Begin or state==Enum.UserInputState.Change end
 return Enum.ContextActionResult.Sink
end
local function sync()
 driving=player:GetAttribute('IsDriving')==true;held={};throttle=0;steer=0;braking=false
 drive.Image=driving and returnImage or driveImage
 drive:SetAttribute('DrivingState',driving and 'Return' or 'Drive')
 for _,name in {'DriveForward','DriveReverse','DriveLeft','DriveRight','DriveBrake','DriveExit'} do CAS:UnbindAction(name) end
 if driving then
  local build=player.PlayerGui:FindFirstChild('ZAD');if build then build.Enabled=false end
  CAS:BindAction('DriveForward',control,false,Enum.KeyCode.W,Enum.KeyCode.Up)
  CAS:BindAction('DriveReverse',control,false,Enum.KeyCode.S,Enum.KeyCode.Down)
  CAS:BindAction('DriveLeft',control,false,Enum.KeyCode.A,Enum.KeyCode.Left)
  CAS:BindAction('DriveRight',control,false,Enum.KeyCode.D,Enum.KeyCode.Right)
  CAS:BindAction('DriveBrake',control,false,Enum.KeyCode.Space,Enum.KeyCode.ButtonX)
  CAS:BindAction('DriveExit',control,false,Enum.KeyCode.E,Enum.KeyCode.ButtonB)

 end
 -- Leave Roblox's regular camera controls in charge throughout driving.
 local h=player.Character and player.Character:FindFirstChildOfClass('Humanoid')
 if h then workspace.CurrentCamera.CameraSubject=h end
end
player:GetAttributeChangedSignal('IsDriving'):Connect(sync)
UIS.WindowFocusReleased:Connect(function() held={};throttle=0;steer=0;braking=true end)
local elapsed=0
local lastSentAt,lastThrottle,lastSteer,lastBrake=0,nil,nil,nil
RunService.Heartbeat:Connect(function(dt)
 if not driving then return end
 elapsed+=dt;if elapsed<.05 then return end;elapsed=0
 throttle=(held.forward and 1 or 0)-(held.reverse and 1 or 0)
 steer=(held.right and 1 or 0)-(held.left and 1 or 0)
 if UIS.GamepadEnabled then
  for _,state in UIS:GetGamepadState(Enum.UserInputType.Gamepad1) do
   if state.KeyCode==Enum.KeyCode.Thumbstick1 and state.Position.Magnitude>.15 then throttle=state.Position.Y;steer=state.Position.X end
  end
 end
 braking=held.brake==true
 local now=os.clock()
 if throttle~=lastThrottle or steer~=lastSteer or braking~=lastBrake or now-lastSentAt>=.25 then
  input:FireServer(throttle,steer,braking)
  lastSentAt=now;lastThrottle=throttle;lastSteer=steer;lastBrake=braking
 end

end)
sync()
-- Local physics removes the round-trip delay between the driver, seat and car.
RunService.PreSimulation:Connect(function(dt)
 if not driving then vehicleState=nil;player:SetAttribute('LocalDriveSteer',0);return end
 local active=workspace:FindFirstChild('ActiveVehicles')
 local vehicle=active and active:FindFirstChild('Vehicle_'..player.UserId)
 local root=vehicle and vehicle.PrimaryPart
 if not root then return end
 if not vehicleState or vehicleState.vehicle~=vehicle then
  local _,yaw=root.CFrame:ToOrientation()
  local ray=RaycastParams.new();ray.FilterType=Enum.RaycastFilterType.Exclude
  ray.FilterDescendantsInstances={active,player.Character};ray.RespectCanCollide=true
  local wheels={}
  for _,joint in root:GetChildren() do if joint:IsA('Motor6D') and joint.Name=='WheelAxle' then
   table.insert(wheels,{joint=joint,base=joint:GetAttribute('WheelBase'),radius=joint:GetAttribute('WheelRadius') or 1.15,
    carrier=joint:FindFirstChild('WheelCarrier') and joint.WheelCarrier.Value})
  end end
  local minZ,maxZ=math.huge,-math.huge
  for _,wheel in wheels do if wheel.base then minZ=math.min(minZ,wheel.base.Position.Z);maxZ=math.max(maxZ,wheel.base.Position.Z) end end
  vehicleState={vehicle=vehicle,yaw=yaw,ray=ray,wheels=wheels,up=root.CFrame.UpVector,steering=0,wheelBase=math.max(3,maxZ-minZ)}
 end
 local state=vehicleState
 if not UIS:GetFocusedTextBox() then
  throttle=(held.forward and 1 or 0)-(held.reverse and 1 or 0)
  steer=(held.right and 1 or 0)-(held.left and 1 or 0)
  if UIS.GamepadEnabled then
   for _,inputState in UIS:GetGamepadState(Enum.UserInputType.Gamepad1) do
    if inputState.KeyCode==Enum.KeyCode.Thumbstick1 and inputState.Position.Magnitude>.15 then throttle=inputState.Position.Y;steer=inputState.Position.X end
   end
  end
 end
 braking=held.brake==true
 dt=math.min(dt,.1)
 local traction=root:FindFirstChild('Traction')
 local alignment=root:FindFirstChildOfClass('AlignOrientation')
 if not traction or not alignment then return end
 local normal=Vector3.zero
 local grounded=0
 for _,wheel in state.wheels do
  if not wheel.carrier or not wheel.carrier.Parent then continue end
  local center=wheel.carrier.Position
  local hit=workspace:Raycast(center+Vector3.yAxis*.25,Vector3.new(0,-(wheel.radius/.45+.4),0),state.ray)
  if hit and hit.Normal.Y>.45 and (center-hit.Position):Dot(hit.Normal)<=wheel.radius+.09 then
   grounded+=1;normal+=hit.Normal
  end
 end
 local topSpeed=vehicle:GetAttribute('TopSpeed') or 1
 local acceleration=vehicle:GetAttribute('Acceleration') or 0
 local grip=vehicle:GetAttribute('Grip') or 1
 local measured=root.AssemblyLinearVelocity:Dot(root.CFrame.LookVector)
 state.steering+=(steer-state.steering)*(1-math.exp(-24*dt))
 if grounded>0 then
  state.up=state.up:Lerp(normal.Unit,1-math.exp(-18*dt)).Unit
  local steerAngle=state.steering*math.rad(25)/(1+math.abs(measured)/35)
  local yawRate=measured/state.wheelBase*math.tan(steerAngle)
  state.yaw-=math.clamp(yawRate,-2.5,2.5)*dt
  local flat=CFrame.Angles(0,state.yaw,0).LookVector
  local projected=flat-state.up*flat:Dot(state.up)
  local forward=projected.Magnitude>.01 and projected.Unit or root.CFrame.LookVector
  local rotation=CFrame.lookAt(Vector3.zero,forward,state.up)
  alignment.Enabled=true;alignment.CFrame=rotation
  local speed=root.AssemblyLinearVelocity:Dot(forward)
  local target=braking and 0 or throttle*topSpeed*(throttle<0 and .4 or 1)
  local rate=braking and 60 or throttle==0 and 10 or acceleration*1.4
  local longitudinal=math.clamp((target-speed)*7,-rate,rate)
  -- Gravity compensation acts along the contacted surface, never as lift.
  longitudinal+=workspace.Gravity*forward.Y
  local sideSpeed=root.AssemblyLinearVelocity:Dot(rotation.RightVector)
  local lateral=math.clamp(-sideSpeed*22,-workspace.Gravity*grip,workspace.Gravity*grip)
  local totalMass=root.AssemblyMass
  for _,wheel in state.wheels do
   if wheel.carrier then
    totalMass+=wheel.carrier.AssemblyMass
    local hinge=wheel.carrier:FindFirstChild('RollingWheel')
    local contact=hinge and hinge.Attachment1 and hinge.Attachment1.Parent
    if contact then totalMass+=contact.AssemblyMass end
   end
  end
  -- Contact controls available acceleration; grade compensation covers the entire vehicle.
  local contactFraction=math.clamp(grounded/#state.wheels,.65,1)
  local grade=workspace.Gravity*forward.Y
  traction.Force=(forward*((longitudinal-grade)*contactFraction+grade)+rotation.RightVector*lateral)*totalMass
 else
  traction.Force=Vector3.zero
  alignment.Enabled=false
  state.yaw=select(2,root.CFrame:ToOrientation())
 end

 player:SetAttribute('LocalDriveSteer',steer)
end)
