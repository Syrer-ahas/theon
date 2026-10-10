-- Server controlled shots: no bouncing, assembly impulses or uncontrolled spin.
local Run=game:GetService("RunService")
local Players=game:GetService("Players")
local config=require(game.ReplicatedStorage.HussThrowConfig)
local Flight={}
function Flight.Bounds(map)
 local a=map:FindFirstChild("ZoneADetector") local b=map:FindFirstChild("ZoneBDetector")
 if not a or not b then return nil end
 local lo,hi=Vector3.new(math.huge,math.huge,math.huge),Vector3.new(-math.huge,-math.huge,-math.huge)
 for _,part in ipairs({a,b}) do
  for _,x in ipairs({-1,1}) do for _,y in ipairs({-1,1}) do for _,z in ipairs({-1,1}) do
   local point=part.CFrame:PointToWorldSpace(part.Size*.5*Vector3.new(x,y,z)) lo=lo:Min(point) hi=hi:Max(point)
  end end end
 end
 return {Min=lo-Vector3.new(2,8,12),Max=hi+Vector3.new(2,28,12)}
end
function Flight.Start(ball,position,velocity,bounds,tryHit,isActive)
 local direction=velocity.Unit local speed=math.clamp(velocity.Magnitude,config.Speed,config.Speed*1.2) local radius=ball.Size.X*.5
 ball.Anchored=true ball.CanCollide=false ball.CanTouch=false ball.CanQuery=false
 ball.AssemblyLinearVelocity=Vector3.zero ball.AssemblyAngularVelocity=Vector3.zero
 ball.CFrame=CFrame.lookAt(position,position+direction)
 local elapsed,distance=0,0 local connection
 local params=RaycastParams.new() params.FilterType=Enum.RaycastFilterType.Exclude params.RespectCanCollide=true
 local function outside(point)
  return bounds and (point.X<bounds.Min.X or point.X>bounds.Max.X or point.Y<bounds.Min.Y or point.Y>bounds.Max.Y or point.Z<bounds.Min.Z or point.Z>bounds.Max.Z)
 end
 connection=Run.Heartbeat:Connect(function(dt)
  if not ball.Parent then connection:Disconnect() return end
  elapsed+=dt
  if elapsed>=config.Lifetime or distance>=config.MaxDistance or (isActive and not isActive()) then ball:Destroy() return end
  local ignored={ball}
  for _,p in ipairs(Players:GetPlayers()) do if p.Character then table.insert(ignored,p.Character) end end
  params.FilterDescendantsInstances=ignored
  local step=direction*math.min(speed*dt,config.MaxDistance-distance)
  local obstruction=workspace:Spherecast(position,radius,step,params)
  local nextPosition=obstruction and position+direction*math.max(0,obstruction.Distance-.01) or position+step
  -- Swept hits use only the segment before the first wall.
  tryHit(position,nextPosition)
  if not ball.Parent then return end
  distance+=(nextPosition-position).Magnitude position=nextPosition
  ball.CFrame=CFrame.lookAt(position,position+direction)
  if obstruction or outside(position) then ball:Destroy() end
 end)
 ball.Destroying:Once(function() if connection then connection:Disconnect() end end)
 return connection
end
return Flight
