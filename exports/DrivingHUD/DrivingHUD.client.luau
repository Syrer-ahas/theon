local Players=game:GetService('Players')
local RS=game:GetService('ReplicatedStorage')
local UIS=game:GetService('UserInputService')
local CAS=game:GetService('ContextActionService')
local RunService=game:GetService('RunService')
local player=Players.LocalPlayer
local pg=player:WaitForChild('PlayerGui')
local gui=pg:WaitForChild('DrivingState');local hud=gui:WaitForChild('HUD')
local statusGui=pg:WaitForChild('PlayerStatusHUD');local statusHud=statusGui:WaitForChild('HUD')
local remote=RS:WaitForChild('VehicleBoostInput');local request=RS:WaitForChild('VehicleDriveRequest')
local camera=workspace.CurrentCamera
local viewportConnection
local driving=false;local keyBoost=false;local pointerBoost=false;local lastHeld=false;local lastPacket=0
local busy=false;local hidden={};local paint=0;local timer=0
local rocketFuel=hud:WaitForChild('rocketfuel')
local boostClip=rocketFuel.FillClip
local fuelClip=hud.Fuel.FillClip
local healthClip=hud.VehicleHealth.FillClip
local needle=hud.Meter.NeedlePivot
local actual={boost=100,fuel=100,health=100,speed=0}
local target={boost=100,fuel=100,health=100,speed=0}
local vehicle
local function resize()
 camera=workspace.CurrentCamera
 if not camera then return end
 local size=camera.ViewportSize
 local scale=math.min(size.X/1124,size.Y/614)
 hud.ViewportScale.Scale=scale;statusHud.ViewportScale.Scale=scale
end
if camera then viewportConnection=camera:GetPropertyChangedSignal('ViewportSize'):Connect(resize) end
workspace:GetPropertyChangedSignal('CurrentCamera'):Connect(function()
 if viewportConnection then viewportConnection:Disconnect();viewportConnection=nil end
 camera=workspace.CurrentCamera;if camera then viewportConnection=camera:GetPropertyChangedSignal('ViewportSize'):Connect(resize) end;resize()
end)
resize()
local function compact(n)
 n=math.max(0,math.floor(n or 0))
 if n>=1000000 then return string.format('%.1fM',n/1000000):gsub('%.0M','M') end
 if n>=1000 then return string.format('%.1fK',n/1000):gsub('%.0K','K') end
 return tostring(n)
end
local function read()
 target.boost=math.clamp(player:GetAttribute('VehicleBoost') or 100,0,100)
 target.fuel=math.clamp(player:GetAttribute('VehicleFuel') or 0,0,100)
 target.health=math.clamp(player:GetAttribute('VehicleHealth') or 100,0,100)
 hud.Distance.Text='Distance: '..math.floor(player:GetAttribute('DriveDistance') or 0)
 hud.Earnings.Value.Text=compact(player:GetAttribute('DriveEarnings') or 0)
end
for _,name in {'VehicleBoost','VehicleFuel','VehicleHealth','DriveDistance','DriveEarnings'} do player:GetAttributeChangedSignal(name):Connect(read) end
local function restore()
 for o,v in hidden do if o.Parent then o[v.property]=v.value end end;table.clear(hidden)
end
local function syncRocketHUD()
 local visible=driving and player:GetAttribute('VehicleHasRocketThruster')==true
 rocketFuel.Visible=visible;hud.Shifty.Visible=visible
end
player:GetAttributeChangedSignal('VehicleHasRocketThruster'):Connect(syncRocketHUD)
local function sync()
 driving=player:GetAttribute('IsDriving')==true
 gui.Enabled=driving;keyBoost=false;pointerBoost=false
 syncRocketHUD()
 remote:FireServer(false);lastHeld=false
 CAS:UnbindAction('DriveBoost')
 restore()
 local screen=pg:FindFirstChild('ScreenGui');local old=screen and screen:FindFirstChild('Drive')
 if driving then
  for _,screenGui in pg:GetChildren() do
   if screenGui:IsA('ScreenGui') and screenGui~=gui and screenGui~=statusGui and screenGui.Name~='BossPanel' then
    if screenGui.Name=='frontend' then
     for _,o in screenGui:GetChildren() do
      if o:IsA('GuiObject') and o.Name~='event' and o.Name~='notificationhandler' then
       hidden[o]={property='Visible',value=o.Visible};o.Visible=false
      end
     end
    else
     hidden[screenGui]={property='Enabled',value=screenGui.Enabled};screenGui.Enabled=false
    end
   end
  end
  vehicle=workspace.ActiveVehicles:FindFirstChild('Vehicle_'..player.UserId)
  read();actual.boost=target.boost;actual.fuel=target.fuel;actual.health=target.health;actual.speed=0
 else vehicle=nil end
end
hud.Return.Activated:Connect(function()
 if busy or not driving then return end;busy=true
 local ok,success,err=pcall(function() return request:InvokeServer('Exit') end)
 busy=false
 if not ok or not success then gui:SetAttribute('ReturnError',tostring(err or 'Return unavailable')) end
end)
-- Space and pointer boost controls are deferred.
local function fill(clip,height,value) clip.Size=UDim2.fromOffset(clip.Size.X.Offset,height*value/100) end
RunService.Heartbeat:Connect(function(dt)
 if not driving then return end
 paint+=dt;timer+=dt
 if paint<1/30 then return end
 local delta=paint;paint=0
 if not vehicle or not vehicle.Parent then vehicle=workspace.ActiveVehicles:FindFirstChild('Vehicle_'..player.UserId) end
 local root=vehicle and vehicle.PrimaryPart
 target.speed=root and math.abs(root.AssemblyLinearVelocity:Dot(root.CFrame.LookVector)) or player:GetAttribute('VehicleSpeed') or 0
 local alpha=1-math.exp(-14*delta)
 for name,value in target do actual[name]+=(value-actual[name])*alpha end
 fill(boostClip,264*3005/3315,actual.boost)
 -- Icons retain one silhouette. Percent text displays the remaining fuel and health.
 rocketFuel.Percent.Text=math.ceil(target.boost)..'%'
 hud.Fuel.Percent.Text=math.ceil(target.fuel)..'%';hud.VehicleHealth.Percent.Text=math.ceil(target.health)..'%'
 hud.Speed.Text=math.round(actual.speed)..' studs/s'
 local max=math.max(1,(player:GetAttribute('VehicleTopSpeed') or 40)*1.35)
 needle.Rotation=-100+math.clamp(actual.speed/max,0,1)*180
end)
player:GetAttributeChangedSignal('IsDriving'):Connect(sync)
read();sync()


