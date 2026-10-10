local Resources={}
-- Fuel comes only from installed gas tanks; the server owns the reserve.
Resources.Config={BoostEnabled=false,BoostCapacity=100,BoostDrain=22,BoostRegen=16,BoostDelay=1.25,BoostSpeed=1.35,BoostAcceleration=1.2,BaseFuel=0,FuelPerSecond=.2,BoostFuelPerSecond=.12,Health=100}
function Resources.Start(player,s,ids)
 local c=Resources.Config
 s.hasRocketThruster=false
 for _,entry in ids do if entry.id=='Supports_RocketThruster' then s.hasRocketThruster=true;break end end
 s.vehicle:SetAttribute('HasRocketThruster',s.hasRocketThruster)
 s.boost=c.BoostCapacity;s.fuelCapacity=c.BaseFuel;s.health=c.Health
 for _,entry in ids do if string.match(entry.id or '', '^Fuel:') then s.fuelCapacity+=entry.id=='Fuel:8' and 30 or 60 end end
 s.fuel=s.fuelCapacity;s.vehicle:SetAttribute('OutOfFuel',s.fuel<=0);s.distance=0;s.lastPosition=s.root.Position;s.origin=s.root.Position;s.lastVelocity=Vector3.zero;s.lastBoostAt=-10
 s.lastMoney=0;s.earnings=0
 local money=player:FindFirstChild('leaderstats') and player.leaderstats:FindFirstChild('Money')
 if money then s.lastMoney=money.Value;s.moneyConnection=money.Changed:Connect(function(value)
  if value>s.lastMoney then s.earnings+=value-s.lastMoney end;s.lastMoney=value
 end) end
 s.damageRay=RaycastParams.new();s.damageRay.FilterType=Enum.RaycastFilterType.Exclude
 s.damageRay.FilterDescendantsInstances={workspace.ActiveVehicles,player.Character,s.surface.Parent};s.damageRay.RespectCanCollide=true
 Resources.Publish(player,s)
end
function Resources.Publish(player,s)
 for name,value in {VehicleHasRocketThruster=s.hasRocketThruster==true,VehicleBoost=math.floor(s.boost*10)/10,VehicleFuel=s.fuelCapacity>0 and math.floor(s.fuel/s.fuelCapacity*1000)/10 or 0,VehicleHealth=math.round(s.health),DriveDistance=math.floor(s.distance),DriveEarnings=s.earnings} do
  if player:GetAttribute(name)~=value then player:SetAttribute(name,value) end
 end
end
function Resources.Update(player,s,dt,now)
 local c=Resources.Config
 local velocity=s.root.AssemblyLinearVelocity;local speed=velocity.Magnitude
 local active=c.BoostEnabled==true and s.boostHeld==true and now-(s.lastBoostInput or 0)<.75 and s.boost>0 and s.fuel>0 and math.abs(s.throttle)>.05 and not s.brake
 if s.boostLocked then active=false;if s.boost>=20 then s.boostLocked=false end end
 if active then s.boost=math.max(0,s.boost-c.BoostDrain*dt);s.lastBoostAt=now;if s.boost==0 then s.boostLocked=true end
 elseif now-s.lastBoostAt>=c.BoostDelay then s.boost=math.min(c.BoostCapacity,s.boost+c.BoostRegen*dt) end
 active=active and s.boost>0
 if s.vehicle:GetAttribute('BoostActive')~=active then s.vehicle:SetAttribute('BoostActive',active) end
 local moving=math.abs(s.throttle)>.05 and speed>1
 if moving then s.fuel=math.max(0,s.fuel-(c.FuelPerSecond+(active and c.BoostFuelPerSecond or 0))*dt) end
 if s.vehicle:GetAttribute('OutOfFuel')~=(s.fuel<=0) then s.vehicle:SetAttribute('OutOfFuel',s.fuel<=0) end
 -- Count legitimate horizontal travel. Ignore teleport-sized movements.
 local delta=s.root.Position-s.lastPosition;local horizontal=Vector3.new(delta.X,0,delta.Z).Magnitude
 if horizontal<=math.max(4,s.stats.topSpeed*c.BoostSpeed*dt*2) then s.distance+=horizontal end
 s.lastPosition=s.root.Position
 -- Hard frontal impacts damage the vehicle. Hills and braking are excluded.
 local prior=Vector3.new(s.lastVelocity.X,0,s.lastVelocity.Z);local current=Vector3.new(velocity.X,0,velocity.Z)
 if prior.Magnitude>25 and prior.Magnitude-current.Magnitude>15 and not s.brake and now-(s.lastDamage or -10)>.8 then
  local hit=workspace:Raycast(s.root.Position,prior.Unit*(s.root.Size.Magnitude/2+3),s.damageRay)
  if hit and math.abs(hit.Normal.Y)<.45 and prior.Unit:Dot(hit.Normal)<-.5 then
   s.health=math.max(0,s.health-math.clamp((prior.Magnitude-current.Magnitude)*.7,5,35));s.lastDamage=now
  end
 end
 s.lastVelocity=velocity
end
function Resources.Stop(s)
 if s.moneyConnection then s.moneyConnection:Disconnect();s.moneyConnection=nil end
end
return Resources

