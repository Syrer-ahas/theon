-- Shared server-side ball hit bounds: body parts + a small margin, lowered during slides.
local PhysicsService=game:GetService("PhysicsService")
local Pack=require(game.ReplicatedStorage:WaitForChild("HussR6AnimationPack").Player)
local Hitbox={BallGroup="HussDodgeball",SupportGroup="HussSlideSupport",Padding=.15}
for _,name in ipairs({"HussSlideVisual",Hitbox.BallGroup,Hitbox.SupportGroup}) do
 pcall(function() PhysicsService:RegisterCollisionGroup(name) end)
end
for _,group in ipairs(PhysicsService:GetRegisteredCollisionGroups()) do
 PhysicsService:CollisionGroupSetCollidable("HussSlideVisual",group.name,false)
end
PhysicsService:CollisionGroupSetCollidable(Hitbox.BallGroup,Hitbox.SupportGroup,false)
function Hitbox.IsSliding(char)
 local start=char:GetAttribute("SlideStart")
 return type(start)=="number" and workspace:GetServerTimeNow()-start>=0 and workspace:GetServerTimeNow()-start<Pack.Config.SlideDuration
end
local names={"Torso","Head","Right Arm","Left Arm","Right Leg","Left Leg"}
function Hitbox.GetBoxes(char)
 local root=char:FindFirstChild("HumanoidRootPart")
 local start=char:GetAttribute("SlideStart")
 if not root then return {} end
 if not Hitbox.IsSliding(char) then
  local boxes={}
  for _,name in ipairs(names) do
   local part=char:FindFirstChild(name)
   if part and part:IsA("BasePart") then table.insert(boxes,{cf=part.CFrame,size=part.Size,name=name}) end
  end
  return boxes
 end
 local pose=Pack.Sample("Slide",workspace:GetServerTimeNow()-start)
 local joints={}
 for _,j in ipairs(char:GetDescendants()) do if j:IsA("Motor6D") and j.Part1 then joints[j.Part1.Name]=j end end
 local worlds={[root.Name]=root.CFrame}
 local boxes={}
 for _,name in ipairs(names) do
  local j=joints[name] local parent=j and j.Part0 and worlds[j.Part0.Name]
  if parent then
   local cf=parent*j.C0*(pose[name] or CFrame.identity)*j.C1:Inverse()
   worlds[name]=cf
   table.insert(boxes,{cf=cf,size=j.Part1.Size,name=name})
  end
 end
 -- Match the visual clearance correction without moving the physical character.
 local rp=RaycastParams.new() rp.FilterType=Enum.RaycastFilterType.Exclude rp.FilterDescendantsInstances={char} rp.RespectCanCollide=true
 local ground=workspace:Raycast(root.Position,Vector3.new(0,-6,0),rp)
 if ground and ground.Normal.Y>=.6 then
  local minimum=math.huge
  for _,box in ipairs(boxes) do
   local cf,half,n=box.cf,box.size*.5,ground.Normal
   local radius=math.abs(cf.RightVector:Dot(n))*half.X+math.abs(cf.UpVector:Dot(n))*half.Y+math.abs(cf.LookVector:Dot(n))*half.Z
   minimum=math.min(minimum,(cf.Position-ground.Position):Dot(n)-radius)
  end
  if minimum<.06 then
   local raise=Vector3.new(0,math.clamp((.06-minimum)/ground.Normal.Y,0,2),0)
   for _,box in ipairs(boxes) do box.cf=box.cf+raise end
  end
 end
 -- Match replicated camera aiming at the neck after the body pose is grounded.
 local lookDirection=char:GetAttribute("HeadLookDirection")
 local neck=joints.Head
 if neck and typeof(lookDirection)=="Vector3" then
  local torsoBox,headBox
  for _,box in ipairs(boxes) do if box.name=="Torso" then torsoBox=box elseif box.name=="Head" then headBox=box end end
  if torsoBox and headBox then
   local direction=torsoBox.cf:VectorToObjectSpace(lookDirection)
   local pitch=math.clamp(math.atan2(direction.Y,Vector2.new(direction.X,direction.Z).Magnitude),math.rad(-45),math.rad(55))
   local yaw=math.clamp(math.atan2(-direction.X,-direction.Z),math.rad(-75),math.rad(75))
   local basis=neck.C0.Rotation
   local rotation=basis:Inverse()*(CFrame.Angles(0,yaw,0)*CFrame.Angles(pitch,0,0))*basis
   headBox.cf=torsoBox.cf*neck.C0*CFrame.new((pose.Head or CFrame.identity).Position)*rotation*neck.C1:Inverse()
  end
 end
 return boxes
end
local function intersectsBox(box,from,to,radius)
 local a=box.cf:PointToObjectSpace(from)
 local b=box.cf:PointToObjectSpace(to)
 local d=b-a local half=box.size*.5+Vector3.one*radius
 local lo,hi=0,1
 for _,axis in ipairs({"X","Y","Z"}) do
  if math.abs(d[axis])<1e-6 then
   if math.abs(a[axis])>half[axis] then return false end
  else
   local t1=(-half[axis]-a[axis])/d[axis] local t2=(half[axis]-a[axis])/d[axis]
   if t1>t2 then t1,t2=t2,t1 end
   lo=math.max(lo,t1) hi=math.min(hi,t2)
   if lo>hi then return false end
  end
 end
 return true
end
function Hitbox.Intersects(char,from,to,radius)
 for _,box in ipairs(Hitbox.GetBoxes(char)) do
  if intersectsBox(box,from,to,radius+Hitbox.Padding) then return true end
 end
 return false
end
return Hitbox
